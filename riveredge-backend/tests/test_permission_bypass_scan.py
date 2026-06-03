"""权限旁路扫描：阻断未登记的 high 违规。"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
SCAN_SCRIPT = BACKEND_ROOT / "scripts" / "scan_permission_bypass.py"


def test_permission_bypass_scan_no_high_violations() -> None:
    proc = subprocess.run(
        [sys.executable, str(SCAN_SCRIPT), "--fail-on", "high"],
        cwd=str(BACKEND_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_permission_bypass_scan_runs() -> None:
    proc = subprocess.run(
        [sys.executable, str(SCAN_SCRIPT), "--json", "--fail-on", "none"],
        cwd=str(BACKEND_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert proc.returncode == 0, proc.stderr
