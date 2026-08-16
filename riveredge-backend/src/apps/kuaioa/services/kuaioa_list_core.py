"""轻办公通用列表与编码辅助。"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time
from typing import Any, Dict, Optional, Type

from tortoise.expressions import Q
from tortoise.models import Model

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.models.user import User


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


async def touch_updated(row: Model, user: Optional[User | int] = None) -> None:
    """写入 updated_at 与 updated_by / updated_by_name（int 时查用户表解析姓名）。"""
    row.updated_at = resolve_business_datetime()
    if user is None:
        return
    if isinstance(user, User):
        apply_update_audit(row, user)
        return
    resolved = await User.get_or_none(id=int(user))
    if resolved:
        apply_update_audit(row, resolved)
        return
    if hasattr(row, "updated_by"):
        row.updated_by = int(user)


def prepare_create_row(model_cls: type[Model], payload: dict[str, Any], user: User) -> dict[str, Any]:
    data = dict(payload)
    apply_create_audit(data, user)
    return data


async def apply_create_audit_by_user_id(payload: dict[str, Any], user_id: int) -> dict[str, Any]:
    """创建前写入审计四字段；user_id 查不到用户时仅写 ID。"""
    user = await User.get_or_none(id=user_id)
    if user:
        apply_create_audit(payload, user)
    else:
        payload["created_by"] = user_id
        payload["updated_by"] = user_id
    return payload
