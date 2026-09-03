#!/usr/bin/env python3
"""
X-Ray by Looplet — PyInstaller Sidecar Builder
Compiles engine/python/xray into a standalone, zero-dependency sidecar binary
for Tauri distribution with host target triple naming.
"""

import sys
import os
import platform
import subprocess
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENGINE_DIR = ROOT / "engine" / "python"
ENTRY_POINT = ENGINE_DIR / "xray" / "__main__.py"
TAURI_BIN_DIR = ROOT / "src-tauri" / "bin"

def get_target_triple():
    system = platform.system().lower()
    machine = platform.machine().lower()
    
    if machine in ["amd64", "x86_64"]:
        arch = "x86_64"
    elif machine in ["arm64", "aarch64"]:
        arch = "aarch64"
    else:
        arch = machine

    if system == "windows":
        return f"{arch}-pc-windows-msvc", ".exe"
    elif system == "darwin":
        return f"{arch}-apple-darwin", ""
    else:
        return f"{arch}-unknown-linux-gnu", ""

def build_sidecar(dry_run=False):
    triple, ext = get_target_triple()
    target_name = f"xray-engine-{triple}{ext}"
    output_path = TAURI_BIN_DIR / target_name

    print(f"[*] Target triple: {triple}")
    print(f"[*] Target executable: {target_name}")

    if dry_run:
        print("[*] Dry run requested. Validating files only.")
        assert ENTRY_POINT.exists(), f"Entry point not found: {ENTRY_POINT}"
        print(f"[+] Entry point verified: {ENTRY_POINT}")
        return

    TAURI_BIN_DIR.mkdir(parents=True, exist_ok=True)

    # PyInstaller command
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",
        "--name",
        f"xray-engine-{triple}",
        "--distpath",
        str(TAURI_BIN_DIR),
        "--paths",
        str(ENGINE_DIR),
        str(ENTRY_POINT),
    ]

    print(f"[*] Running: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(ROOT))
    if res.returncode != 0:
        print(f"[!] PyInstaller build exited with code {res.returncode}")
        sys.exit(res.returncode)

    if output_path.exists():
        print(f"[+] Successfully generated frozen sidecar: {output_path}")
    else:
        print(f"[!] Warning: Expected output not found at {output_path}")

if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    build_sidecar(dry_run=is_dry)
