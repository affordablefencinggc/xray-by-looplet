"""pdf.py — the PDF source adapter (pypdfium2).

Holds everything that knows a plan is a PDF: the pdfium document lifecycle, the
text-layer extraction, page geometry, the vector/raster/sparse classification,
and the Producer string. Moved here verbatim from engine.run() — behaviour is
unchanged.

The document is fully drained into a ReadResult and closed before `read()`
returns, so no live pdfium handle ever escapes this module.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

from xray.reassemble import extract_words, reassemble
from xray.sources.base import (
    SPARSE_WORD_COUNT, PageRead, ReadResult, SourceAdapter, register,
)

# --- skipped-object diagnostics ---------------------------------------------
# pdfium probing is wrapped in broad `except Exception` so one odd object or a
# quirky build never fails the read — but until now a dropped object vanished
# silently, and a page could be misclassified (e.g. raster read as vector) with
# nothing said why. Every skip goes through _record_skip: a thread-safe
# module-level counter, a warning, and — when read() passes a per-read list — a
# reason that travels on ReadResult.diagnostics.
_DIAG_LOGGER = logging.getLogger("xray.sources.pdf")
_DIAG_LOCK = threading.Lock()
_SKIPPED_OBJECTS: dict[str, int] = {}    # reason -> cumulative count


def _record_skip(reason: str, detail: str,
                 per_read: list | None = None) -> None:
    """Record a silently-skipped object/probe instead of dropping the fact.

    The per-item detail goes to DEBUG (a build without e.g. get_pos can skip
    the same probe on every page of every read, and per-item WARNINGs would
    spam the log); the read() caller emits ONE summary WARNING per read, and
    the reasons travel on ReadResult.diagnostics.
    """
    with _DIAG_LOCK:
        _SKIPPED_OBJECTS[reason] = _SKIPPED_OBJECTS.get(reason, 0) + 1
    if per_read is not None:
        per_read.append({"reason": reason, "detail": detail})
    _DIAG_LOGGER.debug("skipped object/probe [%s]: %s", reason, detail)


def skipped_object_counts() -> dict[str, int]:
    """Cumulative skipped-object counts for this process, by reason."""
    with _DIAG_LOCK:
        return dict(_SKIPPED_OBJECTS)

# a page whose largest placed image covers >= this fraction of the page area
# is a scanned sheet (raster), regardless of any invisible OCR text layer
RASTER_COVER_FRACTION = 0.5
# fallback for scans whose placement rects are unreliable: an embedded bitmap
# of at least this many pixels on a page with only OCR-level text marks it
# raster (warehouse scans: 9-29 words; doc pages with photos: 170+ words)
RASTER_MIN_PIXELS = 300_000
RASTER_MAX_WORDS = 50


def _page_kind(page, n_words: int, diag: list | None = None) -> str:
    """vector | raster | sparse (see CONTEXT.md; Paper Capture scans keep an
    invisible OCR text layer, so image coverage decides raster, not words)."""
    w, h = page.get_size()
    page_area = (w * h) or 1.0
    max_cover = 0.0
    max_px = 0
    try:
        for obj in page.get_objects(max_depth=8):
            if obj.type != pdfium_c.FPDF_PAGEOBJ_IMAGE:
                continue
            # placed coverage on the page (if this build exposes it)
            try:
                l, b, r, t = obj.get_pos()
                max_cover = max(max_cover, abs((r - l) * (t - b)) / page_area)
            except Exception as exc:
                _record_skip("image-coverage",
                             f"placement rect unreadable: {type(exc).__name__}: {exc}",
                             diag)
            # raw pixel dimensions (reliable across builds)
            try:
                pw, ph = obj.get_px_size()
                max_px = max(max_px, int(pw) * int(ph))
            except Exception as exc:
                _record_skip("image-pixel-size",
                             f"pixel size unreadable: {type(exc).__name__}: {exc}",
                             diag)
    except Exception as exc:
        # object enumeration itself failed — every remaining object on the page
        # is dropped, so this is recorded, never silent
        _record_skip("page-objects",
                     f"enumeration failed: {type(exc).__name__}: {exc}", diag)
    if max_cover >= RASTER_COVER_FRACTION:
        return "raster"
    # Paper Capture scans report unreliable placement rects; a big embedded
    # bitmap on a page with only OCR-level text is a scanned sheet
    if n_words < RASTER_MAX_WORDS and max_px >= RASTER_MIN_PIXELS:
        return "raster"
    return "vector" if n_words >= SPARSE_WORD_COUNT else "sparse"


class PdfAdapter(SourceAdapter):
    name = "pdf"

    def can_read(self, path: str | Path) -> bool:
        return str(path).lower().endswith(".pdf")

    def read(self, path: str | Path) -> ReadResult:
        doc = pdfium.PdfDocument(str(path))
        skipped: list[dict] = []   # per-read skipped-object diagnostics
        try:
            pages: list[PageRead] = []
            for i in range(len(doc)):
                page = doc[i]
                raw = extract_words(doc, i)
                words = reassemble(raw)
                w, h = page.get_size()
                pages.append(PageRead(
                    words=words,
                    raw_word_count=len(raw),
                    width_pt=float(w),
                    height_pt=float(h),
                    kind=_page_kind(page, len(raw), skipped),
                ))
            try:
                producer = doc.get_metadata_value("Producer") or ""
            except Exception as exc:
                _record_skip("metadata:Producer",
                             f"unreadable: {type(exc).__name__}: {exc}", skipped)
                producer = ""
        finally:
            doc.close()

        diagnostics: dict = {}
        if skipped:
            diagnostics["skipped_entities"] = skipped
            diagnostics["skipped_entity_count"] = len(skipped)
            _DIAG_LOGGER.warning(
                "%s: %d object/probe(s) skipped during read (%s) — see "
                "ReadResult.diagnostics for details",
                Path(path).name, len(skipped),
                ", ".join(sorted({s["reason"] for s in skipped})))

        # symbols/geometry stay empty: a PDF text layer has neither.
        return ReadResult(pages=pages, producer=producer,
                          diagnostics=diagnostics)


register(PdfAdapter())
