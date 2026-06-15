"""按系统参数中的 moment 风格格式串格式化日期时间。"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

# 长 token 优先替换，避免 YYYY 被 YY 截断。
_MOMENT_TO_STRFTIME: tuple[tuple[str, str], ...] = (
    ("YYYY", "%Y"),
    ("YY", "%y"),
    ("MM", "%m"),
    ("DD", "%d"),
    ("HH", "%H"),
    ("mm", "%M"),
    ("ss", "%S"),
)


def moment_pattern_to_strftime(pattern: str) -> str:
    out = str(pattern or "YYYY-MM-DD HH:mm:ss")
    for token, spec in _MOMENT_TO_STRFTIME:
        out = out.replace(token, spec)
    return out


def _coerce_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def format_datetime_value(value: Any, *, pattern: str) -> str:
    dt = _coerce_datetime(value)
    if dt is None:
        return str(value) if value not in (None, "") else ""
    py_fmt = moment_pattern_to_strftime(pattern)
    try:
        return dt.strftime(py_fmt)
    except Exception:
        return dt.isoformat()
