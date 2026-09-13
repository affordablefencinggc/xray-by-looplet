"""Read-only, bounded source-coordinate bridge. No wall inference or quantities."""
import base64
import hashlib
import io
import json
import math
import sys
import tempfile
from contextlib import ExitStack
from pathlib import Path

from .source_wireframe import extract_pdf, page_matrix, transform, WireframeError

MAX_REQUEST = 42 * 1024 * 1024


def region_box(region, width, height):
    if region is None:
        return [0, 0, width, height]
    if (not isinstance(region, list) or len(region) != 4
            or any(type(v) not in (int, float) or not math.isfinite(v) for v in region)):
        raise WireframeError('Region must contain four finite normalized coordinates.')
    x, y, w, h = region
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > 1.000001 or y + h > 1.000001:
        raise WireframeError('Region is outside the source page.')
    return [x * width, y * height, w * width, h * height]


def intersects(points, box):
    x, y, w, h = box
    return (max(p[0] for p in points) >= x and min(p[0] for p in points) <= x+w
            and max(p[1] for p in points) >= y and min(p[1] for p in points) <= y+h)


def lines(paths, box):
    result = []
    for path in paths:
        previous = start = None
        for index, command in enumerate(path['commands']):
            kind = command[0]
            if kind == 'M':
                previous = start = command[1:3]
                continue
            end = start if kind == 'Z' else command[-2:]
            if kind in ('L', 'Z') and previous and end and previous != end and intersects([previous, end], box):
                result.append({'id': f'{path["id"]}/s{index}', 'a': previous, 'b': end,
                               'lengthPt': math.dist(previous, end)})
            previous = end
    return result


def inspect(request):
    import pypdfium2 as pdfium
    content = base64.b64decode(request['pdfBase64'], validate=True)
    if not 0 < len(content) <= 30*1024*1024:
        raise WireframeError('PDF byte limit exceeded.')
    digest = hashlib.sha256(content).hexdigest()
    if digest != request['sha256']:
        raise WireframeError('Source hash mismatch.')
    page_number = request['page']
    if type(page_number) is not int or page_number < 1:
        raise WireframeError('Invalid source page.')
    offset = request.get('offset', 0)
    if type(offset) is not int or offset < 0:
        raise WireframeError('Invalid segment offset.')
    with tempfile.TemporaryDirectory(prefix='xray-source-') as directory:
        source = Path(directory) / 'source.pdf'
        source.write_bytes(content)
        extracted = extract_pdf(source, [page_number])
    page_data = extracted['pages'][0]
    width, height = page_data['widthPt'], page_data['heightPt']
    box = region_box(request.get('region'), width, height)
    candidates = lines(page_data['paths'], box)
    minimum = request.get('minimumLengthPt', 2)
    if type(minimum) not in (int, float) or not math.isfinite(minimum) or not 0 <= minimum <= 1000:
        raise WireframeError('Invalid minimum segment length.')
    segments = sorted([line for line in candidates if line['lengthPt'] >= minimum], key=lambda line: (-line['lengthPt'], line['id']))
    mapping = None
    if request.get('scaleSegmentId') is not None or request.get('knownLengthMm') is not None:
        reference = next((line for line in candidates if line['id'] == request.get('scaleSegmentId')), None)
        known = request.get('knownLengthMm')
        if reference is None or type(known) not in (int, float) or not math.isfinite(known) or not 0 < known <= 100000:
            raise WireframeError('Scale requires a real segment in this region and a positive known length.')
        factor = known/reference['lengthPt']
        mapping = {'segmentId': reference['id'], 'knownLengthMm': known, 'mmPerPt': factor,
                   'evidence': 'Unverified association with a stated dimension; not locked project calibration.'}
        for line in segments:
            line['aMm'] = [v*factor for v in line['a']]
            line['bMm'] = [v*factor for v in line['b']]
            line['lengthMm'] = line['lengthPt']*factor
    if offset > len(segments):
        raise WireframeError('Segment offset exceeds result count.')
    text_runs = []
    with pdfium.PdfDocument(content) as document:
        with ExitStack() as cleanup:
            page = document[page_number-1]
            cleanup.callback(page.close)
            matrix, _, _ = page_matrix(page.get_bbox(), page.get_rotation())
            with ExitStack() as text_cleanup:
                text = page.get_textpage()
                text_cleanup.callback(text.close)
                count = text.count_chars()
                if count > 100000:
                    raise WireframeError('Source text limit exceeded.')
                for index in range(count):
                    char = text.get_text_range(index, 1)
                    if not char.strip():
                        continue
                    l, b, r, t = text.get_charbox(index)
                    corners = [transform(matrix, l, b), transform(matrix, r, t)]
                    if intersects(corners, box):
                        text_runs.append({'text': char, 'box': [min(p[0] for p in corners), min(p[1] for p in corners),
                                                             max(p[0] for p in corners), max(p[1] for p in corners)]})
                if len(text_runs) > 12000:
                    raise WireframeError('Choose a smaller region for positioned text.')
            x, y, w, h = box
            scale = min(4, 1800 / max(w, h))
            bitmap = page.render(scale=scale, crop=(x, height-y-h, width-x-w, y))
            try:
                out = io.BytesIO()
                bitmap.to_pil().save(out, format='PNG')
                image = base64.b64encode(out.getvalue()).decode('ascii')
            finally:
                bitmap.close()
    return {'schema': 'xray.assistant-source-geometry/v1', 'engine': 'python-pdfium',
            'sourceSha256': digest, 'page': page_number, 'widthPt': width, 'heightPt': height,
            'coordinateSystem': 'display-page-top-left-points', 'regionPt': box,
            'segments': segments[offset:offset+200], 'totalSegments': len(segments),
            'nextOffset': offset+200 if offset+200 < len(segments) else None,
            'minimumLengthPt': minimum, 'shortSegmentsExcluded': len(candidates)-len(segments),
            'scaleMapping': mapping,
            'textCharacters': text_runs, 'omissions': page_data['omissions'],
            'evidence': 'Source path coordinates only. Lines are not classified walls. Scale, heights and quantities are not verified. Curves are omitted from segments. Region intersections retain original endpoints.',
            'image': {'mimeType': 'image/png', 'data': image}}


def main():
    try:
        raw = sys.stdin.buffer.read(MAX_REQUEST+1)
        if len(raw) > MAX_REQUEST:
            raise WireframeError('Request too large.')
        result = inspect(json.loads(raw))
        encoded = json.dumps(result, separators=(',', ':'), allow_nan=False)
        if len(encoded.encode()) > 12*1024*1024:
            raise WireframeError('Result too large; choose a smaller region.')
        print(encoded)
    except Exception as error:
        print(json.dumps({'error': str(error) if isinstance(error, WireframeError) else 'Source extraction failed.'}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
