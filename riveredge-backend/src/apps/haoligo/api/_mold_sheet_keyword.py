"""模具单据列表 keyword 模糊搜索：头字段 + line_items 内模具代号/名称 + 模具台账反查。"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Type

from tortoise import connections
from tortoise.expressions import Q
from tortoise.models import Model

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold


def normalize_list_keyword(keyword: str | None) -> str | None:
    if keyword is None:
        return None
    k = str(keyword).strip()
    return k or None


async def mold_codes_matching_keyword(tenant_id: int, keyword: str, *, limit: int = 100) -> list[str]:
    k = keyword.strip()
    if not k:
        return []
    rows = await (
        tenant_alive(HaoligoMold, tenant_id)
        .filter(Q(mold_code__icontains=k) | Q(name__icontains=k))
        .limit(limit)
        .values_list("mold_code", flat=True)
    )
    seen: dict[str, None] = {}
    for code in rows:
        c = str(code).strip()
        if c:
            seen.setdefault(c, None)
    return list(seen.keys())


async def _line_items_keyword_sheet_ids(
    tenant_id: int,
    model: Type[Model],
    keyword: str,
    ledger_mold_codes: list[str],
) -> list[int]:
    k = keyword.strip()
    if not k:
        return []
    table = model._meta.db_table
    conn = connections.get("default")
    pattern = f"%{k}%"
    codes = [c for c in ledger_mold_codes if c]
    if codes:
        sql = f"""
            SELECT id FROM {table}
            WHERE tenant_id = $1 AND deleted_at IS NULL
              AND (
                line_items::text ILIKE $2
                OR EXISTS (
                  SELECT 1 FROM jsonb_array_elements(
                    CASE
                      WHEN line_items IS NULL THEN '[]'::jsonb
                      WHEN jsonb_typeof(line_items::jsonb) = 'array' THEN line_items::jsonb
                      ELSE '[]'::jsonb
                    END
                  ) AS elem
                  WHERE elem->>'mold_code' = ANY($3::text[])
                )
              )
            LIMIT 5000
        """
        rows = await conn.execute_query_dict(sql, [tenant_id, pattern, codes])
    else:
        sql = f"""
            SELECT id FROM {table}
            WHERE tenant_id = $1 AND deleted_at IS NULL
              AND line_items::text ILIKE $2
            LIMIT 5000
        """
        rows = await conn.execute_query_dict(sql, [tenant_id, pattern])
    return [int(row["id"]) for row in rows]


async def apply_mold_line_items_sheet_keyword_filter(
    qs: Any,
    tenant_id: int,
    keyword: str | None,
    header_q_builder: Callable[[str], Q],
    model: Type[Model],
) -> Any:
    k = normalize_list_keyword(keyword)
    if not k:
        return qs
    ledger_codes = await mold_codes_matching_keyword(tenant_id, k)
    q = header_q_builder(k)
    line_ids = await _line_items_keyword_sheet_ids(tenant_id, model, k, ledger_codes)
    if line_ids:
        q |= Q(id__in=line_ids)
    return qs.filter(q)


async def apply_direct_mold_field_keyword_filter(
    qs: Any,
    tenant_id: int,
    keyword: str | None,
    header_q_builder: Callable[[str], Q],
) -> Any:
    k = normalize_list_keyword(keyword)
    if not k:
        return qs
    q = header_q_builder(k)
    ledger_codes = await mold_codes_matching_keyword(tenant_id, k)
    if ledger_codes:
        q |= Q(mold_code__in=ledger_codes)
    return qs.filter(q)


def outsource_maintenance_header_keyword_q(k: str) -> Q:
    return (
        Q(outsourced_unit_name__icontains=k)
        | Q(outsourced_unit_code__icontains=k)
        | Q(department_name__icontains=k)
        | Q(applicant_name__icontains=k)
        | Q(sheet_no__icontains=k)
        | Q(source_order_no__icontains=k)
        | Q(service_type__icontains=k)
    )


def outsource_complete_header_keyword_q(k: str) -> Q:
    return (
        Q(source_order_no__icontains=k)
        | Q(sheet_no__icontains=k)
        | Q(outsourced_unit_name__icontains=k)
        | Q(applicant_name__icontains=k)
        | Q(department_name__icontains=k)
    )


def inhouse_maintenance_header_keyword_q(k: str) -> Q:
    return (
        Q(department_name__icontains=k)
        | Q(applicant_name__icontains=k)
        | Q(sheet_no__icontains=k)
        | Q(source_order_no__icontains=k)
        | Q(service_type__icontains=k)
    )


def borrow_sheet_header_keyword_q(k: str) -> Q:
    return (
        Q(source_order_no__icontains=k)
        | Q(sheet_no__icontains=k)
        | Q(mold_code__icontains=k)
        | Q(mold_name__icontains=k)
        | Q(department_name__icontains=k)
        | Q(finished_product_code__icontains=k)
        | Q(finished_product_name__icontains=k)
    )


def return_sheet_header_keyword_q(k: str) -> Q:
    return (
        Q(production_order_no__icontains=k)
        | Q(borrow_sheet_no__icontains=k)
        | Q(sheet_no__icontains=k)
        | Q(mold_code__icontains=k)
        | Q(mold_name__icontains=k)
        | Q(issue_department_name__icontains=k)
        | Q(finished_product_code__icontains=k)
        | Q(finished_product_name__icontains=k)
    )


def trial_sheet_header_keyword_q(k: str) -> Q:
    return (
        Q(purchase_order_no__icontains=k)
        | Q(sheet_no__icontains=k)
        | Q(mold_code__icontains=k)
        | Q(mold_name__icontains=k)
        | Q(supplier_name__icontains=k)
        | Q(supplier_code__icontains=k)
        | Q(trial_user_name__icontains=k)
        | Q(production_trial_user_name__icontains=k)
        | Q(workflow_phase__icontains=k)
        | Q(adjustment_points__icontains=k)
    )
