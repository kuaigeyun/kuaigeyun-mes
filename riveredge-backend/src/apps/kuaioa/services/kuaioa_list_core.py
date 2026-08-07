"""轻办公通用列表与编码辅助。"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time
from typing import Any, Dict, Optional, Type

from tortoise.expressions import Q
from tortoise.models import Model

from core.utils.timezone_utils import resolve_business_datetime, today_site_str


def build_keyword_q(keyword: Optional[str], *fields: str) -> Q:
    if not keyword or not str(keyword).strip():
        return Q()
    term = str(keyword).strip()
    q = Q()
    for field in fields:
        q |= Q(**{f"{field}__icontains": term})
    return q


def parse_optional_date(value: Optional[str]) -> Optional[date]:
    if value is None or not str(value).strip():
        return None
    return date.fromisoformat(str(value).strip()[:10])


def date_range_q(field: str, start: Optional[str], end: Optional[str]) -> Q:
    q = Q()
    start_date = parse_optional_date(start)
    end_date = parse_optional_date(end)
    if start_date:
        q &= Q(**{f"{field}__gte": start_date})
    if end_date:
        q &= Q(**{f"{field}__lte": end_date})
    return q


async def generate_daily_code(
    model: Type[Model],
    tenant_id: int,
    prefix: str,
    code_field: str = "request_code",
) -> str:
    today = today_site_str().replace("-", "")
    base = f"{prefix}{today}"
    count = await model.filter(tenant_id=tenant_id, **{f"{code_field}__startswith": base}).count()
    return f"{base}{count + 1:04d}"


def model_to_dict(row: Model, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for field in row._meta.fields_map:
        if field == "deleted_at":
            continue
        value = getattr(row, field, None)
        if isinstance(value, datetime):
            data[field] = value.isoformat()
        elif isinstance(value, date):
            data[field] = value.isoformat()
        else:
            data[field] = value
    if extra:
        data.update(extra)
    return data


def touch_updated(row: Model, user_id: Optional[int] = None) -> None:
    row.updated_at = resolve_business_datetime()
    if user_id is not None and hasattr(row, "updated_by"):
        row.updated_by = user_id
