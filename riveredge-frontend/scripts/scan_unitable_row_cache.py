#!/usr/bin/env python3
"""守门：UniTable 当前展示页行缓存不得在 request 内写入（prefetch 会覆盖）。

用法:
  python scripts/scan_unitable_row_cache.py
  python scripts/scan_unitable_row_cache.py --fail-on high
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
EXTS = {".ts", ".tsx"}
SKIP_PARTS = {"locales", "node_modules", "__snapshots__"}

# 当前展示页行缓存 / 选中解析用的 state setter
ROW_CACHE_ASSIGN = re.compile(
    r"""
    (?:
      \b(?:tableRowsRef|listRowsRef|alertTableRowsRef|lastRowsRef|demandRowsByIdRef|workOrderRowByKeyRef)
      |\b\w+(?:RowsByIdRef|RowByKeyRef|TableRowsRef|ListRowsRef)
    )
    \.current\s*=
    |
    \bsetTable(?:Rows|Orders|Computations|Demands)\s*\(
    """,
    re.VERBOSE,
)

REQUEST_JSX = re.compile(r"\brequest\s*=")
IDENT = re.compile(r"^[A-Za-z_$][\w$]*")


def strip_line_comment(line: str) -> str:
    in_s = None
    i = 0
    while i < len(line):
        ch = line[i]
        if in_s:
            if ch == "\\" and i + 1 < len(line):
                i += 2
                continue
            if ch == in_s:
                in_s = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            in_s = ch
            i += 1
            continue
        if ch == "/" and i + 1 < len(line) and line[i + 1] == "/":
            return line[:i]
        i += 1
    return line


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if path.suffix not in EXTS or not path.is_file():
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        files.append(path)
    return files


def match_braces(text: str, open_idx: int) -> int | None:
    if open_idx >= len(text) or text[open_idx] != "{":
        return None
    depth = 0
    i = open_idx
    in_s: str | None = None
    while i < len(text):
        ch = text[i]
        if in_s:
            if ch == "\\" and i + 1 < len(text):
                i += 2
                continue
            if ch == in_s:
                in_s = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            in_s = ch
            i += 1
            continue
        if ch == "/" and i + 1 < len(text) and text[i + 1] == "/":
            nl = text.find("\n", i)
            i = len(text) if nl < 0 else nl
            continue
        if ch == "/" and i + 1 < len(text) and text[i + 1] == "*":
            end = text.find("*/", i + 2)
            i = len(text) if end < 0 else end + 2
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def skip_ws(text: str, i: int) -> int:
    while i < len(text) and text[i] in " \t\r\n":
        i += 1
    return i


def extract_jsx_request_expr(text: str, eq_idx: int) -> tuple[int, int, str] | None:
    i = skip_ws(text, eq_idx + 1)
    if i >= len(text):
        return None
    if text[i] == "{":
        end = match_braces(text, i)
        if end is None:
            return None
        return i + 1, end, text[i + 1 : end]
    return None


def find_named_fn_body(text: str, name: str) -> str | None:
    patterns = [
        rf"(?:const|let|var)\s+{re.escape(name)}\s*=\s*(?:async\s*)?(?:useCallback\s*\()?",
        rf"(?:async\s+)?function\s+{re.escape(name)}\s*\(",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if not m:
            continue
        brace = text.find("{", m.end() - 1)
        if brace < 0:
            continue
        end = match_braces(text, brace)
        if end is None:
            continue
        return text[brace : end + 1]
    return None


def line_no(text: str, idx: int) -> int:
    return text.count("\n", 0, idx) + 1


def assignments_in(span: str, span_start: int, text: str) -> list[tuple[int, str]]:
    hits: list[tuple[int, str]] = []
    for m in ROW_CACHE_ASSIGN.finditer(span):
        abs_idx = span_start + m.start()
        line = text.splitlines()[line_no(text, abs_idx) - 1]
        if strip_line_comment(line).find(m.group(0).split("=")[0].strip()) < 0:
            continue
        hits.append((line_no(text, abs_idx), m.group(0).split("=")[0].strip() + "="))
    return hits


def scan_file(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    rel = path.as_posix()
    findings: list[str] = []
    for m in REQUEST_JSX.finditer(text):
        extracted = extract_jsx_request_expr(text, m.end() - 1)
        if extracted is None:
            continue
        start, _end, expr = extracted
        expr_stripped = expr.strip()
        ident_m = IDENT.match(expr_stripped)
        if ident_m and expr_stripped[ident_m.end() :].strip() == "":
            body = find_named_fn_body(text, ident_m.group(0))
            if not body:
                continue
            body_idx = text.find(body)
            for ln, frag in assignments_in(body, body_idx, text):
                findings.append(f"{rel}:{ln}: request handler writes row cache `{frag}`")
            continue
        for ln, frag in assignments_in(expr, start, text):
            findings.append(f"{rel}:{ln}: request callback writes row cache `{frag}`")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fail-on", choices=("high",), default=None)
    args = parser.parse_args()

    high: list[str] = []
    for path in iter_source_files():
        high.extend(scan_file(path))

    if high:
        print(f"HIGH ({len(high)}): UniTable request 内写入当前页行缓存")
        for item in high:
            print(f"  {item}")
    else:
        print("OK: no UniTable request-internal row-cache writes")

    if args.fail_on == "high" and high:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
