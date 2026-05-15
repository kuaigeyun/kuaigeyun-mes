"""维保单 / 外协维保单与完修单对模具台账状态的影响。"""

from __future__ import annotations

from typing import Any, Iterable

from tortoise import connections

from apps.haoligo.api._mold_ledger_sync import sync_mold_ledger_status_for_mold_code
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold


def mold_status_label_for_maintenance_sheet(*, is_outsource: bool, service_type: str) -> str:
    """厂内/外协维保单对应的模具台账展示状态（与领用单「维保占用」校验集合一致）。"""
    st = (service_type or "维修").strip()
    if is_outsource:
        return "外协保养" if st == "保养" else "外协维修"
    return "保养" if st == "保养" else "维修"


def unique_mold_codes_from_stored_line_items(line_items: Iterable[Any]) -> list[str]:
    """从已落库的 line_items 列表（dict 或带 mold_code 的对象）收集去重后的模具代号。"""
    seen: dict[str, None] = {}
    for item in line_items or []:
        if isinstance(item, dict):
            mc = str(item.get("mold_code") or "").strip()
        else:
            mc = str(getattr(item, "mold_code", "") or "").strip()
        if mc:
            seen.setdefault(mc, None)
    return list(seen.keys())


async def apply_mold_status_on_maintenance_sheet_created(
    tenant_id: int,
    *,
    is_outsource: bool,
    service_type: str,
    stored_line_items: list[dict[str, Any]],
) -> None:
    """
    新建厂内或外协维保单后：明细中的模具（非报废、非停用）置为细分状态：
    厂内维修→「维修」、厂内保养→「保养」、外协维修→「外协维修」、外协保养→「外协保养」。
    """
    target = mold_status_label_for_maintenance_sheet(is_outsource=is_outsource, service_type=service_type)
    codes = unique_mold_codes_from_stored_line_items(stored_line_items)
    if not codes:
        return
    molds = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code__in=codes).all()
    by_code = {m.mold_code.strip(): m for m in molds}
    for code in codes:
        m = by_code.get(code)
        if not m:
            continue
        if m.status in ("报废", "停用"):
            continue
        if m.status == target:
            continue
        m.status = target
        await m.save(update_fields=["status"])


async def resolve_maintenance_status_for_mold(tenant_id: int, mold_code: str) -> str | None:
    """
    若存在未软删的厂内或外协维保单引用该模具，按「最新一张相关维保单」解析应对的台账状态；否则 None。
    """
    conn = connections.get("default")
    m = mold_code.strip()
    if not m:
        return None
    rows = await conn.execute_query_dict(
        """
        WITH hits AS (
          SELECT id, 'inhouse'::text AS src, service_type
          FROM haoligo_mold_maintenance_sheet
          WHERE tenant_id = $1 AND deleted_at IS NULL
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(line_items, '[]'::jsonb)) AS elem
              WHERE trim(coalesce(elem->>'mold_code', '')) = $2
            )
          UNION ALL
          SELECT id, 'out'::text AS src, service_type
          FROM haoligo_mold_outsource_maintenance_sheet
          WHERE tenant_id = $1 AND deleted_at IS NULL
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(line_items, '[]'::jsonb)) AS elem
              WHERE trim(coalesce(elem->>'mold_code', '')) = $2
            )
        )
        SELECT src, service_type FROM hits ORDER BY id DESC LIMIT 1
        """,
        [tenant_id, m],
    )
    if not rows:
        return None
    r = rows[0]
    src = str(r.get("src") or "")
    st = str(r.get("service_type") or "维修").strip()
    return mold_status_label_for_maintenance_sheet(is_outsource=(src == "out"), service_type=st)


async def refresh_mold_status_if_no_open_maintenance_sheet(tenant_id: int, mold_code: str) -> None:
    """维保单删除等之后：若仍有其他维保单引用则对齐细分状态；否则按领用单同步在用/待用。"""
    mcode = (mold_code or "").strip()
    if not mcode:
        return
    label = await resolve_maintenance_status_for_mold(tenant_id, mcode)
    if label:
        mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
        if mold and mold.status not in ("报废", "停用"):
            if mold.status != label:
                mold.status = label
                await mold.save(update_fields=["status"])
        return
    await sync_mold_ledger_status_for_mold_code(tenant_id, mcode)


async def refresh_mold_status_after_maintenance_completed(tenant_id: int, mold_code: str) -> None:
    """维保/外协维保完修单创建后：模具按领用单规则回到在用或待用（不依赖维保单是否仍存档）。"""
    mcode = (mold_code or "").strip()
    if not mcode:
        return
    await sync_mold_ledger_status_for_mold_code(tenant_id, mcode)
