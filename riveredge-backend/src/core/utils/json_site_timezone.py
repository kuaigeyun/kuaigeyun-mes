"""
API JSON 唯一时区出口：datetime → 站点墙钟字符串。

与 BaseSchema.field_serializer / to_api_isoformat 同口径，供
FastAPI default_response_class 与手工 JSONResponse 使用。

FastAPI 在交给 response_class 之前会先 ``jsonable_encoder``：
裸 ``dict`` 里的 datetime 会变成 ``2026-08-14T02:47:00+00:00`` 字符串，
若此处不回写，前端就会把 UTC 墙钟当本地展示（常见差 8 小时）。
因此本模块必须同时消化：
- 仍是 ``datetime`` / ``date`` 的值
- 已泄漏的 ISO（带 Z/偏移，或 ``T`` 分隔的 naive UTC）
已是契约墙钟 ``YYYY-MM-DD HH:MM:SS`` 的字符串保持不变（BaseSchema 已转过）。
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from typing import Any

from fastapi.responses import JSONResponse

from core.utils.timezone_utils import to_api_isoformat

# 已是站点墙钟（BaseSchema / 本模块输出）
_SITE_WALL_RE = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")
# jsonable_encoder / pydantic 泄漏的带时区 ISO
_ISO_AWARE_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?"
    r"(Z|[+-]\d{2}:?\d{2})$",
    re.IGNORECASE,
)
# naive ISO（T 分隔）：按存储契约视为 UTC
_ISO_NAIVE_T_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$")


def _parse_leaked_iso_datetime(text: str) -> datetime | None:
    """把 jsonable_encoder 泄漏的 ISO 瞬时解析为 aware UTC datetime。"""
    raw = text.strip()
    if not raw:
        return None
    if _SITE_WALL_RE.match(raw):
        return None
    if _ISO_AWARE_RE.match(raw):
        normalized = raw.replace("Z", "+00:00").replace("z", "+00:00")
        # 支持 +0800 → +08:00
        if re.search(r"[+-]\d{4}$", normalized):
            normalized = f"{normalized[:-5]}{normalized[-5:-2]}:{normalized[-2:]}"
        if " " in normalized and "T" not in normalized:
            normalized = normalized.replace(" ", "T", 1)
        try:
            dt = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    if _ISO_NAIVE_T_RE.match(raw):
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None
        return dt.replace(tzinfo=timezone.utc)
    return None


def convert_datetimes_for_api(value: Any) -> Any:
    """递归将 datetime/date/泄漏 ISO 转为 API 约定站点墙钟字符串。"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return to_api_isoformat(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        leaked = _parse_leaked_iso_datetime(value)
        if leaked is not None:
            return to_api_isoformat(leaked)
        return value
    if isinstance(value, dict):
        return {k: convert_datetimes_for_api(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [convert_datetimes_for_api(v) for v in value]
    return value


class SiteTimezoneJSONResponse(JSONResponse):
    """默认响应：保证 JSON 中的时刻均为站点墙钟，禁止残留 ISO-Z。"""

    def render(self, content: Any) -> bytes:
        return json.dumps(
            convert_datetimes_for_api(content),
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")
