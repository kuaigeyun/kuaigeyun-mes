"""
列表/报表共用 column_filters 契约。

前端高级搜索唯一序列化为 JSON：[{field, op, value?, value_to?}]。
禁止 field__ne / field__startswith 等旁路查询键。
"""

from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

from tortoise.expressions import Q
from tortoise.queryset import QuerySet

COLUMN_FILTER_BLANK = "__blank__"
COLUMN_FILTER_NONE = "__none__"

# 单据状态：码与中文别名归一，避免 DRAFT≠草稿 漏筛
STATUS_FILTER_ALIASES: Dict[str, str] = {
    "DRAFT": "DRAFT",
    "草稿": "DRAFT",
    "PENDING_REVIEW": "PENDING_REVIEW",
    "待审核": "PENDING_REVIEW",
    "AUDITED": "AUDITED",
    "已审核": "AUDITED",
    "APPROVED": "APPROVED",
    "已通过": "APPROVED",
    "审核通过": "APPROVED",
    "REJECTED": "REJECTED",
    "已驳回": "REJECTED",
    "CONFIRMED": "CONFIRMED",
    "已确认": "CONFIRMED",
    "CLOSED": "CLOSED",
    "已关闭": "CLOSED",
    "CANCELLED": "CANCELLED",
    "CANCELED": "CANCELLED",
    "已取消": "CANCELLED",
    "COMPLETED": "COMPLETED",
    "FINISHED": "COMPLETED",
    "已完成": "COMPLETED",
    "RELEASED": "RELEASED",
    "已下达": "RELEASED",
    "IN_PROGRESS": "IN_PROGRESS",
    "进行中": "IN_PROGRESS",
    "执行中": "IN_PROGRESS",
}

_STATUS_CANONICAL_TO_RAW: Dict[str, Set[str]] = {}
for _raw, _canon in STATUS_FILTER_ALIASES.items():
    _STATUS_CANONICAL_TO_RAW.setdefault(_canon, set()).add(_raw)


def parse_column_filters_param(raw: Optional[Any]) -> List[Dict[str, Any]]:
    """解析前端 column_filters JSON 查询参数。"""
    if raw is None or raw == "":
        return []
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
        if isinstance(parsed, list):
            return [x for x in parsed if isinstance(x, dict)]
    return []


def normalize_status_token(raw: Any) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if text in STATUS_FILTER_ALIASES:
        return STATUS_FILTER_ALIASES[text]
    upper = text.upper().replace("-", "_").replace(" ", "_")
    return STATUS_FILTER_ALIASES.get(upper, upper)


def is_status_field(field: str) -> bool:
    fname = str(field or "").strip().lower()
    return fname == "status" or fname.endswith("_status") or fname.endswith(".status")


def expand_status_match_values(value: Any) -> List[str]:
    """将筛选值展开为库内可能出现的全部别名。"""
    canon = normalize_status_token(value)
    if not canon:
        return []
    aliases = _STATUS_CANONICAL_TO_RAW.get(canon)
    if aliases:
        return sorted(aliases)
    return [str(value)]


def _model_has_field(queryset: QuerySet, field: str) -> bool:
    if "." in field:
        return False
    try:
        return field in queryset.model._meta.fields_map  # type: ignore[attr-defined]
    except Exception:
        return False


def apply_column_filters_to_queryset(
    queryset: QuerySet,
    column_filters: Optional[Sequence[Dict[str, Any]]] = None,
    *,
    allowed_fields: Optional[Iterable[str]] = None,
) -> QuerySet:
    """
    将 column_filters 应用到 Tortoise QuerySet。
    仅处理模型直字段；未知字段跳过（不静默改写成其它键）。
    """
    filters = list(column_filters or [])
    if not filters:
        return queryset
    allow = set(allowed_fields) if allowed_fields is not None else None
    q = queryset
    for flt in filters:
        field = str(flt.get("field") or "").strip()
        if not field or "." in field:
            continue
        if allow is not None and field not in allow:
            continue
        if not _model_has_field(q, field):
            continue
        op = str(flt.get("op") or "contains").strip()
        value = flt.get("value")
        value_to = flt.get("value_to")

        if op == "isnull":
            flag = value
            want_null = not (
                flag is False or flag == "false" or flag == 0 or flag == "0"
            )
            empty = Q(**{f"{field}__isnull": True}) | Q(**{field: ""})
            q = q.filter(empty) if want_null else q.exclude(empty)
            continue

        if op == "in":
            values = value if isinstance(value, list) else []
            if not values:
                continue
            if COLUMN_FILTER_NONE in {str(v) for v in values}:
                q = q.filter(id__in=[])
                continue
            has_blank = any(str(v) in {COLUMN_FILTER_BLANK, ""} for v in values)
            concrete = [v for v in values if str(v) not in {COLUMN_FILTER_BLANK, ""}]
            if is_status_field(field):
                raw_vals: List[str] = []
                for v in concrete:
                    raw_vals.extend(expand_status_match_values(v))
            else:
                raw_vals = list(concrete)
            clauses: List[Q] = []
            if raw_vals:
                clauses.append(Q(**{f"{field}__in": raw_vals}))
            if has_blank:
                clauses.append(Q(**{f"{field}__isnull": True}) | Q(**{field: ""}))
            if clauses:
                combined = clauses[0]
                for clause in clauses[1:]:
                    combined |= clause
                q = q.filter(combined)
            continue

        if op == "nin":
            values = value if isinstance(value, list) else []
            if not values:
                continue
            if is_status_field(field):
                denied: List[str] = []
                for v in values:
                    denied.extend(expand_status_match_values(v))
                if denied:
                    q = q.exclude(**{f"{field}__in": denied})
            else:
                q = q.exclude(**{f"{field}__in": values})
            continue

        if op == "between":
            if value is not None and value != "":
                q = q.filter(**{f"{field}__gte": value})
            if value_to is not None and value_to != "":
                q = q.filter(**{f"{field}__lte": value_to})
            continue

        if op in {"gt", "lt", "gte", "lte"}:
            if value is None or value == "":
                continue
            q = q.filter(**{f"{field}__{op}": value})
            continue

        if op in {"eq", "ne"}:
            if is_status_field(field):
                aliases = expand_status_match_values(value)
                if not aliases:
                    continue
                if op == "eq":
                    q = q.filter(**{f"{field}__in": aliases})
                else:
                    q = q.exclude(**{f"{field}__in": aliases})
            else:
                if op == "eq":
                    q = q.filter(**{field: value})
                else:
                    q = q.exclude(**{field: value})
            continue

        if op == "startswith":
            text = str(value or "")
            if text:
                q = q.filter(**{f"{field}__startswith": text})
            continue

        if op == "endswith":
            text = str(value or "")
            if text:
                q = q.filter(**{f"{field}__endswith": text})
            continue

        # contains（默认）
        text = str(value or "")
        if text:
            q = q.filter(**{f"{field}__icontains": text})
    return q
