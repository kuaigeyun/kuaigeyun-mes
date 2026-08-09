#!/usr/bin/env python3
"""守门：UniTable 布局仅允许 uniTableLayoutEngine.ts + uni-table.less 两处真源。"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
HIGH: list[str] = []

FORBIDDEN_IDENTIFIERS = (
    "applyNaturalHeightScroll",
    "columnsStatePatchEpoch",
    "useAntdResizableHeader",
    "buildPrimaryFlexWidthPatch",
    "applyUniTableColumnWidthPolicy",
)

ALLOWED_OVERFLOW_FILES = {
    "uni-table.less",
}


def strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"//.*?$", "", text, flags=re.M)
    return text


index_tsx = ROOT / "components/uni-table/index.tsx"
if index_tsx.exists():
    text = index_tsx.read_text(encoding="utf-8")
    if re.search(r"import\s+['\"].*uni-table\.less['\"]", text):
        HIGH.append(f"{index_tsx}: must not import uni-table.less (SSOT via global.less)")

# uni-table 目录内禁 stable gutter / JS 突变 / 已删 API
for path in (ROOT / "components/uni-table").rglob("*"):
    if path.suffix not in {".ts", ".tsx", ".less", ".css"}:
        continue
    raw = path.read_text(encoding="utf-8")
    text = strip_comments(raw)
    if re.search(r"scrollbar-gutter\s*:\s*stable", text):
        HIGH.append(f"{path}: forbidden scrollbar-gutter: stable")
    if re.search(r"\.style\.scrollbarGutter\s*=", text):
        HIGH.append(f"{path}: forbidden JS style.scrollbarGutter assignment")
    if path.suffix in {".ts", ".tsx"} and path.name != "uniTableLayoutEngine.ts":
        for pat in FORBIDDEN_IDENTIFIERS:
            for i, line in enumerate(text.splitlines(), 1):
                if re.search(rf"\b{pat}\b", line):
                    HIGH.append(f"{path}:{i}: forbidden leftover `{pat}`")

# UniTable 相关路径：禁止 scrollbar-gutter: stable / JS 突变
ssot_paths = [
    ROOT / "components/uni-table",
    ROOT / "components/uni-table-detail",
    ROOT / "global.less",
    ROOT / "utils/uniTableLayoutColumns.ts",
]
for base in ssot_paths:
    paths = [base] if base.is_file() else list(base.rglob("*"))
    for path in paths:
        if not path.is_file() or path.suffix not in {".ts", ".tsx", ".less", ".css"}:
            continue
        text = strip_comments(path.read_text(encoding="utf-8"))
        if re.search(r"scrollbar-gutter\s*:\s*stable", text):
            HIGH.append(f"{path}: forbidden scrollbar-gutter: stable")
        if re.search(r"\.style\.scrollbarGutter\s*=", text):
            HIGH.append(f"{path}: forbidden JS style.scrollbarGutter assignment")

# global.less：不得写 uni-table mode overflow；不得对 ant-table 强制 overflow-x
global_less = ROOT / "global.less"
if global_less.exists():
    code = strip_comments(global_less.read_text(encoding="utf-8"))
    if re.search(
        r"\.uni-table-(?:natural-height|scroll-y-mode)\s*[^{]*\{[^}]*overflow",
        code,
        flags=re.S,
    ):
        HIGH.append(f"{global_less}: UniTable overflow rules must live in uni-table.less only")
    # 禁止全局强制表格 overflow-x（会与 UniTable SSOT 叠算）
    if re.search(
        r"\.ant-table-(?:wrapper|body|content)[^{]*\{[^}]*overflow-x\s*:\s*auto\s*!important",
        code,
        flags=re.S,
    ):
        HIGH.append(f"{global_less}: do not force overflow-x on ant-table (UniTable owns scroll)")

# uni-table-detail 不得再写 scroll/gutter/table-layout（已迁入 uni-table.less）
detail_less = ROOT / "components/uni-table-detail/index.less"
if detail_less.exists():
    code = strip_comments(detail_less.read_text(encoding="utf-8"))
    if re.search(r"scrollbar-gutter\s*:", code):
        HIGH.append(f"{detail_less}: scrollbar-gutter must live in uni-table.less only")
    if re.search(r"table-layout\s*:\s*fixed", code):
        HIGH.append(f"{detail_less}: table-layout must live in uni-table.less only")
    if re.search(r"overflow-y\s*:\s*hidden\s*!important", code):
        HIGH.append(f"{detail_less}: overflow-y scroll contract must live in uni-table.less only")

# UniTable 调用方不得再传已被忽略的 scroll.x（除非该开标签含 allowCustomScrollX）
for path in ROOT.rglob("*.tsx"):
    raw = path.read_text(encoding="utf-8")
    if "<UniTable" not in raw:
        continue
    for m in re.finditer(r"<UniTable\b", raw):
        start = m.start()
        j = m.end()
        depth_angle = depth_brace = 0
        in_s = in_d = False
        tag_end = None
        while j < len(raw):
            ch = raw[j]
            if in_s:
                if ch == "\\":
                    j += 2
                    continue
                if ch == "'":
                    in_s = False
                j += 1
                continue
            if in_d:
                if ch == "\\":
                    j += 2
                    continue
                if ch == '"':
                    in_d = False
                j += 1
                continue
            if ch == "'":
                in_s = True
            elif ch == '"':
                in_d = True
            elif ch == "{":
                depth_brace += 1
            elif ch == "}":
                depth_brace -= 1
            elif ch == "<":
                depth_angle += 1
            elif ch == ">":
                if depth_angle > 0:
                    depth_angle -= 1
                elif depth_brace == 0:
                    tag_end = j
                    break
            j += 1
        if tag_end is None:
            continue
        tag = raw[start : tag_end + 1]
        # JSX 布尔简写 allowCustomScrollX 或显式 true
        if re.search(r"\ballowCustomScrollX\b", tag):
            continue
        if re.search(r"scroll=\{\{[^}]*\bx\s*:", tag):
            line = raw.count("\n", 0, start) + 1
            HIGH.append(
                f"{path}:{line}: UniTable scroll.x ignored by engine; remove or set allowCustomScrollX"
            )

# 明细表格进度列：detailTableColumns 内须 spread DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS
for path in ROOT.rglob("*.tsx"):
    raw = path.read_text(encoding="utf-8")
    m = re.search(
        r"const\s+detailTableColumns[\s\S]*?useMemo\s*\(\s*\(\)\s*=>\s*\[([\s\S]*?)\],\s*\[",
        raw,
    )
    if not m:
        continue
    block = m.group(1)
    if "DocumentPushProgressBar" in block and "DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS" not in block:
        line = raw.count("\n", 0, m.start()) + 1
        HIGH.append(
            f"{path}:{line}: detailTableColumns uses DocumentPushProgressBar "
            "but missing DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS spread"
        )

if HIGH:
    print("UniTable layout SSOT violations:")
    for line in HIGH:
        print(f"  HIGH {line}")
    sys.exit(1)

print("UniTable layout SSOT: ok")
sys.exit(0)
