import tempfile
from pathlib import Path
from unittest.mock import patch
import pytest
from server.mcp_server import run_takeoff_calibrated, marked_pdf

ROOT=Path(__file__).resolve().parents[2]
SOURCE=str(ROOT/'engine/fixtures/electrical-schedule.pdf')


@pytest.mark.parametrize('page,p0,p1,distance',[
    (-1,[0,0],[1,0],100),(True,[0,0],[1,0],100),(0,[0],[1,0],100),
    (0,[0,0],[0,0],100),(0,[0,0],[1,0],-1),(0,[0,0],[1,0],float('nan')),
    (99,[0,0],[1,0],100),(0,[0,0],[1e7,0],100),
])
def test_invalid_calibration_is_rejected(page,p0,p1,distance):
    with pytest.raises(ValueError): run_takeoff_calibrated(SOURCE,page,p0,p1,distance)


def test_valid_calibration_is_explicit_and_verified():
    result=run_takeoff_calibrated(SOURCE,0,[0,0],[100,0],1000)
    assert result['document']['pages'][0]['scale']['mmPerPt']==10
    assert result['document']['pages'][0]['scale']['verified'] is True


def test_marked_pdf_preserves_existing_and_cleans_failed_stage():
    with tempfile.TemporaryDirectory() as directory:
        target=Path(directory)/'marked.pdf';target.write_bytes(b'original')
        with pytest.raises(ValueError):marked_pdf(SOURCE,str(target))
        assert target.read_bytes()==b'original'
        fresh=Path(directory)/'fresh.pdf'
        with patch('server.mcp_server.write_marked_pdf',side_effect=OSError('write failed')):
            with pytest.raises(ValueError):marked_pdf(SOURCE,str(fresh))
        assert not fresh.exists()
        assert not list(Path(directory).glob('.xray-marked-*'))


def test_marked_pdf_actual_publish_is_readable():
    import pikepdf
    with tempfile.TemporaryDirectory() as directory:
        target=Path(directory)/'marked.pdf'
        result=marked_pdf(SOURCE,str(target))
        assert result['marked_pdf']==str(target)
        with pikepdf.open(target) as pdf:assert len(pdf.pages)==1
        assert not list(Path(directory).glob('.xray-marked-*'))
