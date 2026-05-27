"""维保单 / 外协维保单与完修单对模具台账状态的影响。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from tortoise import connections

from apps.haoligo.api._mold_ledger_sync import (
    count_active_borrow_sheets,
    sync_mold_ledger_status_for_mold_code,
)
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_maintenance_complete import (
    MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_TO_STATUS,
)
from apps.haoligo.constants.mold_status import MAINTENANCE_OCCUPY_STATUSES
from apps.haoligo.models.mold import HaoligoMold


def mold_status_label_for_maintenance_sheet(*, is_outsource: bool, service_type: str) -> str:
    """厂内/外协维保单对应的模具台账展示状态（与领用单「维保占用」校验集合一致）。"""
    st = (service_type or "维修").strip()
    if is_outsource:
        return "外协维修" if st != "保养" else "保养"
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
    新建厂内或外协维保单后：明细中的模具（非报废、非停用）置为约定状态：
    厂内维修→「维修」、厂内保养→「保养」、外协维修→「外协维修」、外协单保养类型→「保养」。
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
    若存在「尚未确认完修」的厂内或外协维保单引用该模具，按最新一张解析台账状态；否则 None。

    「已完修」指：厂内维保单已存在关联的维保完修单；外协维保单已存在关联的外协维保完修单（均未软删）。
    """
    conn = connections.get("default")
    m = mold_code.strip()
    if not m:
        return None
    rows = await conn.execute_query_dict(
        """
        WITH hits AS (
          SELECT ms.id, 'inhouse'::text AS src, ms.service_type
          FROM haoligo_mold_maintenance_sheet ms
          WHERE ms.tenant_id = $1 AND ms.deleted_at IS NULL
            AND COALESCE(NULLIF(trim(ms.sheet_status), ''), '已通过') = '已通过'
            AND NOT EXISTS (
              SELECT 1 FROM haoligo_mold_maintenance_complete_sheet c
              WHERE c.tenant_id = ms.tenant_id AND c.deleted_at IS NULL
                AND c.source_maintenance_sheet_id = ms.id
            )
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(ms.line_items, '[]'::jsonb)) AS elem
              WHERE trim(coalesce(elem->>'mold_code', '')) = $2
            )
          UNION ALL
          SELECT os.id, 'out'::text AS src, os.service_type
          FROM haoligo_mold_outsource_maintenance_sheet os
          WHERE os.tenant_id = $1 AND os.deleted_at IS NULL
            AND COALESCE(NULLIF(trim(os.sheet_status), ''), '已通过') = '已通过'
            AND NOT EXISTS (
              SELECT 1 FROM haoligo_mold_outsource_maintenance_complete_sheet oc
              WHERE oc.tenant_id = os.tenant_id AND oc.deleted_at IS NULL
                AND oc.source_outsource_maintenance_sheet_id = os.id
                AND COALESCE(NULLIF(trim(oc.sheet_status), ''), '已通过') = '已通过'
            )
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(os.line_items, '[]'::jsonb)) AS elem
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


@dataclass(frozen=True)
class _MaintenanceCompleteOutcome:
    service_type: str
    repair_result: str | None


def mold_status_label_for_maintenance_complete(
    *,
    service_type: str,
    repair_result: str | None,
) -> str | None:
    """
    维保/外协维保完修结论 → 台账 status。

    - 保养完修：固定「待用」。
    - 维修完修：按维修结果映射；映射值为 None 时返回 None，由领用单规则决定「在用 / 待用」。
    - 外协维修完修（无维修结果字段）：返回 None，按领用单回落。
    """
    st = (service_type or "维修").strip()
    if st == "保养":
        return "待用"
    rr = (repair_result or "").strip()
    if not rr:
        return None
    return MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_TO_STATUS.get(rr)


async def resolve_latest_maintenance_complete_outcome_for_mold(
    tenant_id: int,
    mold_code: str,
) -> _MaintenanceCompleteOutcome | None:
    """取该模具最近一张未删除完修单（厂内或外协）上对应行的结论。"""
    conn = connections.get("default")
    m = mold_code.strip()
    if not m:
        return None
    rows = await conn.execute_query_dict(
        """
        WITH hits AS (
          SELECT c.id,
                 trim(coalesce(c.service_type, '维修')) AS service_type,
                 nullif(trim(coalesce(elem->>'repair_result', '')), '') AS repair_result
          FROM haoligo_mold_maintenance_complete_sheet c
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.line_items, '[]'::jsonb)) AS elem
          WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
            AND trim(coalesce(elem->>'mold_code', '')) = $2
          UNION ALL
          SELECT oc.id,
                 trim(coalesce(oc.service_type, '维修')) AS service_type,
                 nullif(trim(coalesce(elem->>'repair_result', '')), '') AS repair_result
          FROM haoligo_mold_outsource_maintenance_complete_sheet oc
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(oc.line_items, '[]'::jsonb)) AS elem
          WHERE oc.tenant_id = $1 AND oc.deleted_at IS NULL
            AND COALESCE(NULLIF(trim(oc.sheet_status), ''), '已通过') = '已通过'
            AND trim(coalesce(elem->>'mold_code', '')) = $2
        )
        SELECT service_type, repair_result FROM hits ORDER BY id DESC LIMIT 1
        """,
        [tenant_id, m],
    )
    if not rows:
        return None
    r = rows[0]
    rr = r.get("repair_result")
    return _MaintenanceCompleteOutcome(
        service_type=str(r.get("service_type") or "维修").strip(),
        repair_result=str(rr).strip() if rr else None,
    )


async def _apply_mold_status_target(tenant_id: int, mold: HaoligoMold, target: str | None) -> None:
    """target 为 None 时按领用单同步在用/待用；否则写入固定台账状态。"""
    mcode = mold.mold_code.strip()
    if target is None:
        await _release_mold_when_no_open_maintenance(tenant_id, mcode)
        return
    if mold.status != target:
        mold.status = target
        await mold.save(update_fields=["status"])


async def _release_mold_when_no_open_maintenance(tenant_id: int, mcode: str) -> None:
    """无未完修维保时：按领用单规则同步在用/待用；若仍卡在维保占用态则落到在用或待用。"""
    await sync_mold_ledger_status_for_mold_code(tenant_id, mcode)
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
    if not mold or mold.status in ("报废", "停用"):
        return
    if mold.status not in MAINTENANCE_OCCUPY_STATUSES:
        return
    n = await count_active_borrow_sheets(tenant_id, mcode)
    mold.status = "在用" if n > 0 else "待用"
    await mold.save(update_fields=["status"])


async def refresh_mold_status_from_open_maintenance(tenant_id: int, mold_code: str) -> None:
    """维保单/完修单变更后：未完修维保单 → 占用态；已完修 → 按完修结论；否则领用规则（在用/待用）。"""
    mcode = (mold_code or "").strip()
    if not mcode:
        return
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
    if not mold or mold.status in ("报废", "停用"):
        return
    label = await resolve_maintenance_status_for_mold(tenant_id, mcode)
    if label:
        if mold.status != label:
            mold.status = label
            await mold.save(update_fields=["status"])
        return
    outcome = await resolve_latest_maintenance_complete_outcome_for_mold(tenant_id, mcode)
    if outcome:
        target = mold_status_label_for_maintenance_complete(
            service_type=outcome.service_type,
            repair_result=outcome.repair_result,
        )
        await _apply_mold_status_target(tenant_id, mold, target)
        return
    await _release_mold_when_no_open_maintenance(tenant_id, mcode)


async def refresh_mold_status_if_no_open_maintenance_sheet(tenant_id: int, mold_code: str) -> None:
    """维保单删除等之后：按未完修维保单重算；无则回到领用规则。"""
    await refresh_mold_status_from_open_maintenance(tenant_id, mold_code)


async def refresh_mold_status_after_maintenance_completed(tenant_id: int, mold_code: str) -> None:
    """维保/外协维保完修单创建、更新、删除后：按未完修维保单或最近完修结论重算台账状态。"""
    await refresh_mold_status_from_open_maintenance(tenant_id, mold_code)
