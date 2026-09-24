#!/usr/bin/env python3
"""
扫描时区契约违规（写入 / 展示旁路）。

用法:
  python scripts/scan_timezone_contract.py
  python scripts/scan_timezone_contract.py --json
  python scripts/scan_timezone_contract.py --fail-on high

规则见 .cursor/rules/timezone-contract.mdc
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "riveredge-backend" / "src"
FRONTEND_SRC = REPO_ROOT / "riveredge-frontend" / "src"

BUSINESS_ASSIGN = re.compile(
    r"\b("
    r"review_time|inspection_time|notified_at|receipt_time|approved_at|handled_at|"
    r"bound_at|processed_at|sent_at|quoted_at|closed_at|published_at|completed_at|"
    r"started_at|assigned_at|action_at|submitted_at|issued_at|received_at|"
    r"actual_start(?:_date|_time)?|actual_end(?:_date|_time)?|frozen_at|"
    r"computation_\w+|snapshot_at|recalc_at|picking_time|delivery_time|borrow_time"
    r")\s*=\s*datetime\.(?:now|utcnow)\s*\(",
    re.MULTILINE,
)

DATETIME_NOW = re.compile(r"\bdatetime\.now\s*\(")
DATETIME_UTCNOW = re.compile(r"\bdatetime\.utcnow\s*\(")
HARD_SHANGHAI = re.compile(
    r'ZoneInfo\(\s*["\']Asia/Shanghai["\']\s*\)|'
    r'(?:timedelta|td)\(\s*hours\s*=\s*8\s*\)|'
    r'timezone\(\s*(?:timedelta|td)\(\s*hours\s*=\s*8\s*\)\s*\)|'
    r"dayjs\.tz\.setDefault\(\s*['\"]Asia/Shanghai['\"]\s*\)|"
    r"setDefault\(\s*['\"]Asia/Shanghai['\"]\s*\)|"
    r"\|\|\s*['\"]Asia/Shanghai['\"]|"
    r"\?\?\s*['\"]Asia/Shanghai['\"]|"
    r"\bor\s+[\"']Asia/Shanghai[\"']|"
    r"timezone\s*:\s*['\"]Asia/Shanghai['\"]|"
    r"Field\(\s*[\"']Asia/Shanghai[\"']"
)
# 字典选项 / 配置定义处不是业务旁路
HARD_SHANGHAI_SKIP = (
    "system_dictionaries.py",
    "timezone_options",
    "TIMEZONE",
    "infra_config.py",
    "default_values_service.py",
)
FUTURE_REINTERPRET = re.compile(
    r"_normalize_history_occurred_at|未来.*coerce_business_datetime_to_utc|按站点墙钟重解释"
)
# 业务时刻展示用 ISO 切片
FE_SLICE_DISPLAY = re.compile(
    r"\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*19\s*\)\s*\.replace\(\s*['\"]T['\"]|"
    r"\.replace\(\s*['\"]T['\"]\s*,\s*['\"] ['\"]\s*\)\s*\.slice\(\s*0\s*,\s*19\s*\)|"
    r"formatOccurredAt|String\([^)]+\)\.replace\(\s*['\"]T['\"]\s*,\s*['\"] ['\"]\s*\)\.slice"
)
# 业务日历日：导出文件名用 UTC toISOString 切片（应走 todaySiteDateString）
FE_EXPORT_UTC_DAY = re.compile(
    r"new Date\(\)\.toISOString\(\)\.(?:slice\(\s*0\s*,\s*10\s*\)|split\(\s*['\"]T['\"]\s*\)\[\s*0\s*\])"
)
# 业务展示用 new Date(...).getHours / toLocaleString（应走 formatDateTimeBySiteSetting）
FE_NEW_DATE_DISPLAY = re.compile(
    r"new Date\([^)]*(?:_at|_date|_time|Date|Time)[^)]*\)\s*\.\s*"
    r"(?:getFullYear|getMonth|getDate|getHours|getMinutes|toLocaleString|toLocaleDateString)\b"
)
# 业务提交走 toISOString（应走 toApiDateTimeString / nowSiteDateTimeString）
FE_TOISO_SUBMIT = re.compile(
    r"(?:_date|_time|Date|Time)\s*:\s*[^\n]*\.toISOString\(\)"
)
# API 手工 strftime 完整时刻（应走 to_api_isoformat，避免 UTC 墙钟泄漏）
API_STRFTIME_WALL = re.compile(
    r"\.strftime\(\s*['\"]%Y-%m-%d %H:%M:%S['\"]\s*\)"
)
# 第二套序列化（应直接 to_api_isoformat）
DUPLICATE_API_FORMATTER = re.compile(
    r"astimezone\([^\)]+\)\.strftime\(\s*['\"]%Y-%m-%d %H:%M:%S['\"]"
)


@dataclass
class Finding:
    severity: str
    rule: str
    path: str
    line: int
    snippet: str


def iter_py(root: Path):
    for p in root.rglob("*.py"):
        if any(x in p.parts for x in ("migrations", ".venv", "__pycache__", "scripts")):
            continue
        if p.name in ("timezone_utils.py", "json_site_timezone.py", "scan_timezone_contract.py"):
            continue
        yield p


def iter_fe(root: Path):
    for p in root.rglob("*.{ts,tsx}".replace("{ts,tsx}", "ts")):
        yield p
    for p in root.rglob("*.tsx"):
        yield p


def scan_file_py(path: Path) -> list[Finding]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
    out: list[Finding] = []
    for i, line in enumerate(text.splitlines(), 1):
        if line.strip().startswith("#"):
            continue
        if BUSINESS_ASSIGN.search(line):
            out.append(Finding("high", "business_datetime_now", rel, i, line.strip()[:200]))
        elif DATETIME_NOW.search(line) or DATETIME_UTCNOW.search(line):
            # 服务层剩余 now 一律 medium（应迁 resolve / now_utc / today_site_str）
            if "/services/" in rel or "/api/" in rel:
                out.append(Finding("medium", "datetime_now_raw", rel, i, line.strip()[:200]))
        if HARD_SHANGHAI.search(line) and "infra_config" not in rel:
            if not any(s in rel or s in line for s in HARD_SHANGHAI_SKIP):
                out.append(Finding("high", "hardcoded_shanghai_offset", rel, i, line.strip()[:200]))
        if FUTURE_REINTERPRET.search(line):
            out.append(Finding("high", "timezone_compat_repair", rel, i, line.strip()[:200]))
        if DUPLICATE_API_FORMATTER.search(line):
            out.append(Finding("high", "duplicate_api_datetime_formatter", rel, i, line.strip()[:200]))
        if API_STRFTIME_WALL.search(line) and (
            "/api/" in rel or "/services/" in rel
        ):
            # 导出 CSV 文件名等仍会命中；完整业务时刻应走 to_api_isoformat
            if "export" not in line.lower() and "filename" not in line.lower():
                out.append(
                    Finding("medium", "api_strftime_wall_bypass", rel, i, line.strip()[:200])
                )
    return out


def scan_file_fe(path: Path) -> list[Finding]:
    if "node_modules" in path.parts:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
    out: list[Finding] = []
    # dayjs default hardcode
    if path.name == "dayjs.ts" and "setDefault" in text and "Asia/Shanghai" in text:
        for i, line in enumerate(text.splitlines(), 1):
            if "setDefault" in line and "Asia/Shanghai" in line:
                out.append(Finding("high", "fe_dayjs_setdefault_shanghai", rel, i, line.strip()[:200]))
    for i, line in enumerate(text.splitlines(), 1):
        if FE_SLICE_DISPLAY.search(line):
            out.append(Finding("high", "fe_iso_slice_format", rel, i, line.strip()[:200]))
        if FE_EXPORT_UTC_DAY.search(line):
            out.append(Finding("high", "fe_export_utc_calendar_day", rel, i, line.strip()[:200]))
        if FE_NEW_DATE_DISPLAY.search(line):
            out.append(Finding("high", "fe_new_date_display", rel, i, line.strip()[:200]))
        if FE_TOISO_SUBMIT.search(line):
            out.append(Finding("high", "fe_toiso_business_submit", rel, i, line.strip()[:200]))
        if re.search(
            r"\|\|\s*['\"]Asia/Shanghai['\"]|\?\?\s*['\"]Asia/Shanghai['\"]|timezone\s*:\s*['\"]Asia/Shanghai['\"]",
            line,
        ) and "locales" not in rel:
            out.append(Finding("high", "fe_timezone_fallback_shanghai", rel, i, line.strip()[:200]))
        # 多行兜底：独立一行的 'Asia/Shanghai'（浏览器 Intl / 硬编码竞争源）
        if re.fullmatch(r"['\"]Asia/Shanghai['\"],?", line.strip()) and "systemDictionaryLabels" not in rel:
            out.append(Finding("high", "fe_timezone_fallback_shanghai", rel, i, line.strip()[:200]))
        if "buildFallbackTimezoneOptions" in line or "buildFallbackCurrencyOptions" in line:
            out.append(Finding("high", "fe_timezone_options_fallback", rel, i, line.strip()[:200]))
        if "Intl.DateTimeFormat().resolvedOptions().timeZone" in line:
            out.append(Finding("high", "fe_browser_timezone_fallback", rel, i, line.strip()[:200]))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--fail-on", choices=("high", "medium", "none"), default="none")
    args = ap.parse_args()

    findings: list[Finding] = []
    if BACKEND_SRC.is_dir():
        for p in iter_py(BACKEND_SRC):
            findings.extend(scan_file_py(p))
    if FRONTEND_SRC.is_dir():
        for p in iter_fe(FRONTEND_SRC):
            findings.extend(scan_file_fe(p))

    findings.sort(key=lambda f: (f.severity, f.path, f.line))

    if args.json:
        print(json.dumps([asdict(f) for f in findings], ensure_ascii=False, indent=2))
    else:
        by = {"high": 0, "medium": 0, "info": 0}
        for f in findings:
            by[f.severity] = by.get(f.severity, 0) + 1
            print(f"[{f.severity}] {f.rule} {f.path}:{f.line}  {f.snippet}")
        print(
            f"\nsummary high={by.get('high', 0)} medium={by.get('medium', 0)} total={len(findings)}",
            file=sys.stderr,
        )

    if args.fail_on == "high" and any(f.severity == "high" for f in findings):
        return 1
    if args.fail_on == "medium" and any(f.severity in ("high", "medium") for f in findings):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
