"""模具台账与未删除领用单数量同步（领用单、还入单路由共用）。"""

from typing import Optional

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet

# 与维保单创建的细分状态 + 历史「在修」一致，领用单等需统一拦截
MAINTENANCE_OCCUPY_STATUSES = frozenset({"在修", "维修", "保养", "外协维修", "外协保养"})


async def count_active_borrow_sheets(
    tenant_id: int,
    mold_code: str,
    *,
    exclude_id: Optional[int] = None,
) -> int:
    qs = tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(mold_code=mold_code.strip())
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    return await qs.count()


async def sync_mold_ledger_status_for_mold_code(tenant_id: int, mold_code: str) -> None:
    """按未删除领用单数量同步台账状态：有单为「在用」，无单且当前为「在用」则回「待用」。"""
    mcode = mold_code.strip()
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
    if not mold:
        return
    n = await count_active_borrow_sheets(tenant_id, mcode)
    if n > 0:
        if mold.status not in ("报废", "停用") and mold.status != "在用":
            mold.status = "在用"
            await mold.save(update_fields=["status"])
    elif mold.status == "在用":
        mold.status = "待用"
        await mold.save(update_fields=["status"])
