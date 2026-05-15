"""模具台账「加工时间(分钟)」：各还入单与对应领用单创建时间之差的累计。"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

_UTC = timezone.utc

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet
from apps.haoligo.models.mold_return_sheet import HaoligoMoldReturnSheet

_BORROW_REF_ID = re.compile(r"#\s*(\d+)")


def parse_borrow_sheet_id_from_ref(ref: Optional[str]) -> Optional[int]:
    """从「领用单#123」或纯数字等引用中解析领用单主键 id。"""
    if ref is None:
        return None
    s = str(ref).strip()
    if not s:
        return None
    m = _BORROW_REF_ID.search(s)
    if m:
        return int(m.group(1))
    if s.isdigit():
        return int(s)
    return None


def _to_utc(dt: datetime) -> datetime:
    """转为 UTC  aware，避免 naive/aware 混用导致比较或相减报错。"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=_UTC)
    return dt.astimezone(_UTC)


async def recompute_mold_processing_time_minutes(tenant_id: int, mold_code: str) -> None:
    """
    按模具代号重算加工时间：
    对每个未删除还入单，优先用 borrow_sheet_no 指向的领用单；否则取「该还入时间之前、尚未配对」的最近一条领用单。
    每条配对：还入 created_at − 领用 created_at，累计秒数后向下取整为分钟。
    """
    mcode = (mold_code or "").strip()
    if not mcode:
        return

    borrows = (
        await tenant_alive(HaoligoMoldBorrowSheet, tenant_id)
        .filter(mold_code=mcode)
        .order_by("created_at", "id")
        .all()
    )
    returns = (
        await tenant_alive(HaoligoMoldReturnSheet, tenant_id)
        .filter(mold_code=mcode)
        .order_by("created_at", "id")
        .all()
    )
    borrow_by_id = {b.id: b for b in borrows}
    matched_borrow_ids: set[int] = set()
    total_seconds = 0.0

    for ret in returns:
        ret_ts = _to_utc(ret.created_at)
        borrow = None
        bid = parse_borrow_sheet_id_from_ref(ret.borrow_sheet_no)
        if bid is not None and bid in borrow_by_id:
            b = borrow_by_id[bid]
            if b.id not in matched_borrow_ids:
                borrow = b
        if borrow is None:
            candidates = [
                b
                for b in borrows
                if b.id not in matched_borrow_ids and _to_utc(b.created_at) <= ret_ts
            ]
            if candidates:
                borrow = max(candidates, key=lambda b: _to_utc(b.created_at))
        if borrow is None:
            continue
        matched_borrow_ids.add(borrow.id)
        borrow_ts = _to_utc(borrow.created_at)
        delta_sec = (ret_ts - borrow_ts).total_seconds()
        if delta_sec > 0:
            total_seconds += delta_sec

    minutes = max(0, int(total_seconds // 60))

    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
    if not mold:
        return
    cur = mold.processing_time_min
    if (cur if cur is not None else 0) != minutes:
        mold.processing_time_min = minutes
        await mold.save(update_fields=["processing_time_min"])
