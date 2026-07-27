"""
API JSON 唯一时区出口：datetime → 站点墙钟字符串。

与 BaseSchema.field_serializer / to_api_isoformat 同口径，供
FastAPI default_response_class 与手工 JSONResponse 使用。
"""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from fastapi.responses import JSONResponse

from core.utils.timezone_utils import to_api_isoformat


def convert_datetimes_for_api(value: Any) -> Any:
    """递归将 datetime/date 转为 API 约定字符串；其它类型原样保留。"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return to_api_isoformat(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: convert_datetimes_for_api(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [convert_datetimes_for_api(v) for v in value]
    return value


class SiteTimezoneJSONResponse(JSONResponse):
    """默认响应：保证 JSON 中的 datetime 均为站点墙钟，禁止残留 ISO-Z。"""

    def render(self, content: Any) -> bytes:
        return json.dumps(
            convert_datetimes_for_api(content),
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")
