"""pytest bootstrap: make the `xray` package importable when tests are run
from the repo root or any other CWD (adds engine/python to sys.path)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))