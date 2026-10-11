# Independent Linux artifact integrity — October 12, 2026

## Requirement and acceptance boundary

Close the independent Linux archive verification gap left by the green CI/package-build checkpoint. Verify exact run/source binding, downloaded ZIP digest, inner tar inventory and recorded executable modes without installing or running artifact contents. Preserve hardened transport and leave `main` unchanged.

**Accepted: downloaded archive identity, three package identities and tar-recorded executable modes. Not accepted: nested package internals, installation, launch, qualified calculation runtime, signing or deployment.**

## Exact source and artifact

- Repository/branch: `affordablefencinggc/xray-by-looplet`, `recovery/full-studio-20261011`.
- Tested code: `c93ae1e7354e7d295196ab5db0d363ed9e1a34eb`; all four jobs of CI run `38150581911` were independently reconfirmed successful during this continuation.
- Artifact: `xray-desktop-linux`, ID `11705864872`, unexpired when fetched. GitHub artifact metadata binds it to run `38150581911` and that exact head SHA.
- Downloaded ZIP: **1759929030 bytes**, SHA-256 **`80b24ef0f680e07123e95b7bc755d0e55c5d7cb070c6f7ac2b80ab8c12fc786a`**; exactly matches GitHub's digest, not merely its reported filename.
- ZIP contains exactly one entry, `xray-desktop-linux.tar.gz`: **1760183199 bytes**, SHA-256 **`eea0239df23b87834bd9d6bc9c6c2a2e4f2cf08e7c5082305866c9a969a8c024`**. This inner digest was independently computed locally; it is not a separately published upstream digest.
- Outer audit completed `2026-10-11T19:47:42Z`, tar listing `19:48:48Z`, streamed member audit `19:49:40Z`. These are October 12 on the host's `+10:00` offset; GitHub's CI completion remains `2026-10-11T15:38:33Z`.
- Documentation-only successors do not change tested code or retroactively acquire its CI result. No product, workflow, parser or engine-selection changes were made for this audit.

## Inspection method and resource controls

1. Existing external `audit-artifact.ps1` downloaded via the GitHub artifact endpoint and verified SHA-256 before inspecting the ZIP directory. It preserved artifact bytes, immutable metadata, an audit JSON and success/owner records.
2. A separately capped inspector rehashed the ZIP, required the exact single tar-container name and bounded size, and copied only that inert container to an evidence directory. It computed the container digest and invoked local **bsdtar/libarchive 3.8.8** in listing mode (`-tvf`), not extraction mode. Listing exit was 0; stderr was empty.
3. A second, independently implemented streaming inspector used local Python 3.12 `tarfile` to enumerate tar metadata and read only the three regular package members into hashes. No `extract`/`extractall`, package manager, AppImage launcher, application binary, shell fixture or frozen engine was invoked. This Python use is offline archive inspection, not an application transport fallback.
4. Both inventory paths counted **588 entries**: **467 regular files, 91 directories, 30 symlinks**; logical regular-file bytes **1944180674**. The streaming inspector reported zero duplicate/unsafe member paths, special member types/permission bits, lexical link escapes or non-directory member ancestors. This is bounded metadata checking, **not** a claim of complete symlink-chain validation, malware scanning or general extraction safety.
5. The AppImage, DEB staging application, AppDir application and AppDir `AppRun` all retain tar-recorded **`0755`**. A separate comparison matched all **588** member names, types, sizes, modes and link targets between libarchive and the streaming inspector. Symlinks were enumerated, never created on Windows; Windows filesystem permission restoration was not tested.
6. Heavy download/hash/list/read work ran sequentially under verified Windows Job Object **20% aggregate CPU caps**, `Flags=5`, `CpuRate=2000`. Both archive-inspection wrappers additionally verified child membership and used 15-minute child deadlines. All helpers exited; no installer or audit process was retained.

## Individual package identities

These SHA-256 values were computed from the complete regular-file member streams inside the verified tar. They are distinct from the outer ZIP/container hashes; package bytes were not written as standalone installers or executed.

| Tar member | Bytes | Mode | SHA-256 |
| --- | ---: | --- | --- |
| `bundle/deb/X-Ray by Looplet_0.1.0_amd64.deb` | 266023752 | `0644` | `b38d49938642c76fbc0312ef49802fd53bb6d63ef1b19ae4b0705eecdaa429ba` |
| `bundle/rpm/X-Ray by Looplet-0.1.0-1.x86_64.rpm` | 265620572 | `0644` | `3e30dd4461b9607866220715de8b4ecaefc2ca08f597da56ee882be22faa0c39` |
| `bundle/appimage/X-Ray by Looplet_0.1.0_amd64.AppImage` | 341375480 | `0755` | `8229a7ee170aa24944960b264338827cba019acecbd2bab635662da638e833ee` |

DEB/RPM sizes match the successful CI log. File prefixes match ar, RPM and ELF respectively; the AppImage prefix also contains `AI`/type-2 bytes. These header observations are not a nested format or signature validation.

Additional recorded executable modes:

- `bundle/deb/X-Ray by Looplet_0.1.0_amd64/data/usr/bin/xray-by-looplet`: `0755`, 279155528 bytes.
- `bundle/appimage/X-Ray by Looplet.AppDir/usr/bin/xray-by-looplet`: `0755`, 279174816 bytes.
- `bundle/appimage/X-Ray by Looplet.AppDir/AppRun`: `0755`, 274 bytes.

The tar also includes build staging output, explaining why its total size is greater than the three distribution packages. Staged Python source is not a qualified frozen calculation engine and does not authorize Python fallback.

## Executed validation and retained evidence

- PowerShell inspector scripts parsed successfully; real ZIP digest, libarchive listing and streaming audit all exited 0 with empty error logs.
- **11 inspector tests passed**: valid names/links, absolute/traversal/control-character rejection, valid inert package hashing, missing package, missing execute bit, wrong magic, duplicate members, escaping link/non-directory ancestor and special file/permission failures. Fixtures contained only small inert bytes; no installer execution.
- Cross-checks bound the records to the remote run/SHA, compared the two inventories and verified the expected package and executable modes. Documentation links, artifact identities, whitespace and scoped branch diff were validated before committing.
- External evidence root: `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.
  - `artifact-linux-38150581911.metadata.json`, `ci-38150581911-final-confirmation.json`.
  - `artifact-linux-38150581911\audit.json`, `owner.json`, `exit.txt`, `artifact.zip`.
  - `artifact-linux-38150581911\tar-inspection\inventory.json`, `tar-listing.txt`, `member-audit.json`, `member-stdout.json`, owner/exit/error records and the inert tar container.
  - `inspect-linux-tar.ps1`, `run-linux-member-audit.ps1`, `audit-linux-members.py`, `audit-linux-members.test.py`, and captured inspector-test logs.

Large artifacts, temporary tooling and logs remain outside the repository; this checkpoint commits only proof Markdown. No new screenshots or human signoff are claimed.

Evidence/report SHA-256 anchors:

| External evidence file | SHA-256 |
| --- | --- |
| `artifact-linux-38150581911\tar-inspection\member-audit.json` | `0f599788a4ba569e48d7e519c78874dd06cd92f0a931809fd2cfe87e24460f75` |
| `artifact-linux-38150581911\tar-inspection\tar-listing.txt` | `b25ed8ec0c5873d61eedf465772de913687b1e13df8f6d2684b72ba259d74c71` |
| `inspect-linux-tar.ps1` | `82c9d5d83dd31d53bb4dbb2070452005ef47d415786850760c30bbd0fb9677b0` |
| `run-linux-member-audit.ps1` | `2940633535870c2577a96b64a92324e00164f9b907d731ccddce3064ecd92eb7` |
| `audit-linux-members.py` | `c9e5d8c22f507067d2fab62124ca20a7dfbdbb33a282402f5f10edfc1371c7cc` |
| `audit-linux-members.test.py` | `ad35b6f4889e68c914d73b130ce0a102656f34ae1b6e9395c9281bd5698f915c` |

Independent read-only review of the completed small reports agreed with this narrow acceptance. Its earlier partial-download snapshot is superseded by the completion timestamps above. The one-off inspectors are **not hardened general-purpose archive ingestion**: extended-header/sparse/trailing-data validation, full link resolution, streaming log/copy limits and whole-operation timeout/failure-cleanup hardening are outside this proof. The listing wrapper's process-start failure cleanup can mask the original error; that path was not taken in this successful audit. Child deadlines do not cover the preceding hashes/container copy. None of these untested failure-path or hostile-archive properties is claimed as accepted.

## Remaining gates

Installed Linux/Windows launch, WebView rendering and qualified real-engine execution remain open. No nested DEB/RPM payload or AppImage filesystem audit, signing verification, macOS package build or Vercel deployment was performed. Existing credential, human visual approval, compact-control and portrait-obstruction limits remain unchanged. See the [final matrix boundary](ci-matrix-final.md).