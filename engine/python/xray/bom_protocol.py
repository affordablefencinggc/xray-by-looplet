"""Bounded compatibility transport for the frozen fencing BOM contract.

This module adds no generic construction capability. The host supplies stdin and
an absent result path in its private current working directory. Only a complete,
validated JSON response is published, atomically and without replacing any file.
"""
from __future__ import annotations

from functools import lru_cache
from hashlib import sha256
import json
import os
from pathlib import Path, PureWindowsPath
import stat
import sys
import tempfile
from typing import BinaryIO

from .job_bom import BOM_SCHEMA, JOB_SCHEMA, RULESET, build_bom, compute_input_digest


MAX_REQUEST_BYTES = 1_048_576
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
CONTRACT_FILENAME = "xray-job-bom-v1.schema.json"
CONTRACT_SHA256 = "d394988e89d69e342d53559538367ac21b31e4402d7720b7294e237c4f5722b7"


class ProtocolError(Exception):
    """Only fixed, input-independent diagnostics may cross stderr."""


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ProtocolError("Invalid request JSON.")
        result[key] = value
    return result


def _reject_constant(_value: str) -> None:
    raise ProtocolError("Invalid request JSON.")


@lru_cache(maxsize=1)
def _validators():
    """Use only the source-owned asset or the explicitly frozen bundle asset.

    Packaging must include contracts/<filename> under sys._MEIPASS. Never search
    the request working directory, PATH, environment variables or user files.
    """
    try:
        from jsonschema import Draft202012Validator, FormatChecker

        if getattr(sys, "frozen", False):
            bundle = getattr(sys, "_MEIPASS", None)
            if not bundle:
                raise ProtocolError("Frozen contract asset is unavailable.")
            path = Path(bundle) / "contracts" / CONTRACT_FILENAME
        else:
            path = Path(__file__).resolve().parents[3] / "contracts" / CONTRACT_FILENAME
        raw = path.read_bytes()
        if sha256(raw).hexdigest() != CONTRACT_SHA256:
            raise ProtocolError("Frozen contract asset failed verification.")
        schema = json.loads(raw)
        Draft202012Validator.check_schema(schema)
        return {
            kind: Draft202012Validator(
                {"$defs": schema["$defs"], "$ref": f"#/$defs/{kind}"},
                format_checker=FormatChecker(),
            )
            for kind in ("request", "success", "error")
        }
    except ProtocolError:
        raise
    except Exception:
        raise ProtocolError("Frozen contract validation is unavailable.") from None


def contract_status() -> dict[str, str]:
    _validators()
    return {"requestSchema": JOB_SCHEMA, "responseSchema": BOM_SCHEMA, "ruleset": RULESET}


def _read_request(stream: BinaryIO) -> dict:
    # One bounded read includes a sentinel byte so oversize input is not silently
    # truncated into a valid request. Host closes stdin and owns the time limit.
    raw = stream.read(MAX_REQUEST_BYTES + 1)
    if len(raw) > MAX_REQUEST_BYTES:
        raise ProtocolError("Request exceeds the supported size limit.")
    try:
        request = json.loads(
            raw.decode("utf-8"), object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
        if not isinstance(request, dict):
            raise ProtocolError("Request must be a JSON object.")
        # Re-encoding rejects unpaired surrogate escapes before digesting/writing.
        json.dumps(request, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except ProtocolError:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise ProtocolError("Invalid request JSON.") from None
    if not _validators()["request"].is_valid(request):
        raise ProtocolError("Request does not match the frozen contract.")
    if compute_input_digest(request) != request["inputDigest"]:
        raise ProtocolError("Request digest does not match its contents.")
    return request


def _response_bytes(request: dict) -> bytes:
    # build_bom performs the existing kernel's strict semantic request validation.
    # A well-formed, bound ok:false domain result is still a completed transport.
    response = build_bom(request)
    kind = "success" if response.get("ok") is True else "error"
    if not _validators()[kind].is_valid(response):
        raise ProtocolError("Engine result does not match the frozen contract.")
    if response["requestId"] != request["requestId"]:
        raise ProtocolError("Engine result does not match the request.")
    if response["ok"]:
        bom = response["bom"]
        bound = (
            bom["inputDigest"] == request["inputDigest"]
            and bom["jobId"] == request["job"]["id"]
            and bom["jobRevision"] == request["job"]["revision"]
            and bom["documentSha256"] == request["document"]["sha256"]
            and bom["recipeSet"] == {key: request["recipeSet"][key] for key in ("id", "revision", "digest")}
            and bom["ruleset"] == {"id": RULESET, "version": 1}
        )
    else:
        bound = response["inputDigest"] == request["inputDigest"]
    if not bound:
        raise ProtocolError("Engine result does not match the request.")
    payload = (json.dumps(response, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode("utf-8")
    if len(payload) > MAX_RESPONSE_BYTES:
        raise ProtocolError("Engine result exceeds the supported size limit.")
    return payload


def _is_link_or_reparse(metadata: os.stat_result) -> bool:
    return stat.S_ISLNK(metadata.st_mode) or bool(
        getattr(metadata, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    )


def _destination(raw_path: str) -> Path:
    path = Path(raw_path)
    if (
        not path.is_absolute() or ".." in path.parts or ":" in path.name
        or PureWindowsPath(path.name).is_reserved()
        or path.name in ("", ".", "..")
    ):
        raise ProtocolError("Result destination is unsafe.")
    parent = path.parent
    # The host creates a private scratch directory and uses it as child cwd.
    if parent.resolve(strict=True) != Path.cwd().resolve(strict=True):
        raise ProtocolError("Result destination must be in the host working directory.")
    for directory in (parent, *parent.parents):
        metadata = directory.lstat()
        if not stat.S_ISDIR(metadata.st_mode) or _is_link_or_reparse(metadata):
            raise ProtocolError("Result destination is unsafe.")
    # lexists catches dangling symlinks too; os.link below supplies atomic exclusion.
    if os.path.lexists(path):
        raise ProtocolError("Result destination already exists.")
    return path


def _publish(payload: bytes, raw_path: str) -> None:
    # Use only single-component names relative to the host's pinned process cwd
    # after validation. Retargeting an ancestor of the supplied absolute path
    # cannot redirect the later publication into a different directory.
    target = Path(_destination(raw_path).name)
    fd, staged_name = tempfile.mkstemp(prefix=".xray-bom-", suffix=".tmp", dir=target.parent)
    staged = Path(Path(staged_name).name)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
            expected = os.fstat(output.fileno())
        # Recheck after staging; never replace existing files (including symlinks).
        _destination(raw_path)
        os.link(staged, target, follow_symlinks=False)
        actual = target.lstat()
        if (
            not stat.S_ISREG(actual.st_mode) or _is_link_or_reparse(actual)
            or actual.st_size != len(payload)
            or (actual.st_dev, actual.st_ino) != (expected.st_dev, expected.st_ino)
        ):
            raise ProtocolError("Result publication failed verification.")
    finally:
        # This is the uniquely named staging file we created, never the target.
        staged.unlink(missing_ok=True)


def run_job_to_bom(stream: BinaryIO, result_path: str) -> int:
    try:
        request = _read_request(stream)
        _publish(_response_bytes(request), result_path)
        return 0
    except ProtocolError as error:
        print(f"error: {error}", file=sys.stderr)
    except OSError:
        print("error: Result or input could not be accessed safely.", file=sys.stderr)
    except Exception:
        # No request data, file path, dependency traceback or exception text leaks.
        print("error: Frozen contract calculation failed.", file=sys.stderr)
    return 2
