"""Execute the actual capped owner with a pipe-holding descendant; Windows only."""
import ctypes
from ctypes import wintypes as w
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest


class ContainmentTests(unittest.TestCase):
    def test_exited_child_pipe_holder_is_bounded_and_killed(self):
        self.assertEqual(os.name, "nt", "This gate requires actual Windows Job execution")
        k = ctypes.WinDLL("kernel32", use_last_error=True)
        k.OpenProcess.argtypes, k.OpenProcess.restype = (w.DWORD, w.BOOL, w.DWORD), w.HANDLE
        k.WaitForSingleObject.argtypes, k.WaitForSingleObject.restype = (w.HANDLE, w.DWORD), w.DWORD
        k.CloseHandle.argtypes = (w.HANDLE,)
        k.TerminateProcess.argtypes = (w.HANDLE, w.UINT)
        k.QueryFullProcessImageNameW.argtypes = (w.HANDLE, w.DWORD, w.LPWSTR, ctypes.POINTER(w.DWORD))
        k.GetProcessTimes.argtypes = (w.HANDLE, ctypes.POINTER(w.FILETIME), ctypes.POINTER(w.FILETIME), ctypes.POINTER(w.FILETIME), ctypes.POINTER(w.FILETIME))
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="xray-ledger-containment-") as directory:
            root = Path(directory)
            marker = root / "owned-descendant.pid"
            handle = None
            identity_verified = False
            started = time.time()
            with (root / "stdout.txt").open("wb") as out, (root / "stderr.txt").open("wb") as err:
                owner = subprocess.Popen(["powershell.exe", "-NoProfile", "-File",
                    str(repo / "scripts/run-recovery-ledger-check.ps1"), "-Gate", "containment-fixture",
                    "-FixturePath", str(marker)], cwd=repo, stdout=out, stderr=err)
                try:
                    deadline = time.monotonic() + 15
                    while not marker.exists() and time.monotonic() < deadline and owner.poll() is None:
                        time.sleep(0.05)
                    self.assertTrue(marker.exists(), "Real fixture did not create its owned descendant")
                    pid = int(marker.read_text(encoding="ascii"))
                    handle = k.OpenProcess(0x00101001, False, pid)  # SYNCHRONIZE/query/terminate; retained handle, not PID kill.
                    self.assertTrue(handle, "Could not retain owned descendant handle")
                    image = ctypes.create_unicode_buffer(32768)
                    size = w.DWORD(len(image))
                    self.assertTrue(k.QueryFullProcessImageNameW(handle, 0, image, ctypes.byref(size)))
                    self.assertEqual(Path(image.value).resolve(), Path(sys.executable).resolve())
                    created, exited, kernel, user = w.FILETIME(), w.FILETIME(), w.FILETIME(), w.FILETIME()
                    self.assertTrue(k.GetProcessTimes(handle, ctypes.byref(created), ctypes.byref(exited), ctypes.byref(kernel), ctypes.byref(user)))
                    created_epoch = ((created.dwHighDateTime << 32) | created.dwLowDateTime) / 10_000_000 - 11644473600
                    self.assertGreaterEqual(created_epoch, started - 0.01)
                    identity_verified = True
                    self.assertEqual(k.WaitForSingleObject(handle, 0), 258, "Descendant was not alive at observation")
                    code = owner.wait(timeout=35)
                    self.assertNotEqual(code, 0, "Pipe-holder fixture must fail closed")
                    self.assertEqual(k.WaitForSingleObject(handle, 10000), 0,
                                     "Owner exited but its job descendant survived")
                finally:
                    if owner.poll() is None:
                        owner.kill()
                        owner.wait(timeout=10)
                    if handle:
                        if identity_verified and k.WaitForSingleObject(handle, 10000) != 0:
                            # Containment already failed its assertion. Cleanup only the
                            # still-held, identity-checked fixture process; never another PID.
                            self.assertTrue(k.TerminateProcess(handle, 1), "Fixture fallback cleanup failed")
                            self.assertEqual(k.WaitForSingleObject(handle, 10000), 0, "Fixture survived handle-owned cleanup")
                        k.CloseHandle(handle)
                    out.flush()
                    err.flush()
                    # Include the actual nested owner failure in the parent receipt,
                    # including its retained diagnostic path, even on assertion failure.
                    for name in ("stdout.txt", "stderr.txt"):
                        print((root / name).read_text(errors="replace")[:65536])
            output = (root / "stdout.txt").read_text(errors="replace") + (root / "stderr.txt").read_text(errors="replace")
            self.assertTrue("Redirected output drain deadline exceeded" in output or "Owned descendants remain" in output,
                            "Fixture failed for the wrong reason:\n" + output)
            self.assertIn("killOnClose=True", output)
            self.assertIn("aggregateCpuCapPercent=20", output)
            print("Actual Windows containment: exited child + live pipe-holder -> bounded owner failure; retained descendant handle signaled.")


if __name__ == "__main__":
    unittest.main(verbosity=2)