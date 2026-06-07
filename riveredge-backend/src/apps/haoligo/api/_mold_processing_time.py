"""模具台账「加工时间(分钟)」：各还入单与对应领用单创建时间之差的累计。"""

from __future__ import annotations

import re
from collections import defaultdict
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


async def resolve_borrow_sheet_id_from_ref(tenant_id: int, ref: Optional[str]) -> Optional[int]:
    """优先解析「领用单#id」；否则按领用单单号（sheet_no）匹配。"""
    bid = parse_borrow_sheet_id_from_ref(ref)
    if bid is not None:
        return bid
    s = (ref or "").strip()
    if not s:
        return None
    row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(sheet_no=s).first()
    if row:
        return row.id
    return None


def _to_utc(dt: datetime) -> datetime:
    """转为 UTC  aware，避免 naive/aware 混用导致比较或相减报错。"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=_UTC)
    return dt.astimezone(_UTC)


async def matched_borrow_ids_for_returns(
    tenant_id: int,
    borrows: list[HaoligoMoldBorrowSheet],
    returns: list[HaoligoMoldReturnSheet],
) -> set[int]:
    """还入单与领用单配对后，返回已被还入单占用的领用单 id 集合。"""
    pairs = await pair_return_sheets_to_borrow_sheets(tenant_id, borrows, returns)
    return {borrow.id for borrow, _ in pairs}


async def pair_return_sheets_to_borrow_sheets(
    tenant_id: int,
    borrows: list[HaoligoMoldBorrowSheet],
    returns: list[HaoligoMoldReturnSheet],
) -> list[tuple[HaoligoMoldBorrowSheet, HaoligoMoldReturnSheet]]:
    """按与加工时间相同的规则，将还入单逐条配对到领用单。"""
    borrow_by_id = {b.id: b for b in borrows}
    matched_borrow_ids: set[int] = set()
    pairs: list[tuple[HaoligoMoldBorrowSheet, HaoligoMoldReturnSheet]] = []
    for ret in returns:
        ret_ts = _to_utc(ret.created_at)
        borrow = None
        bid = await resolve_borrow_sheet_id_from_ref(tenant_id, ret.borrow_sheet_no)
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
        pairs.append((borrow, ret))
    return pairs


async def outstanding_borrow_ids_for_tenant(tenant_id: int) -> set[int]:
    """尚未被还入单配对的领用单 id（即仍「已领用」）。"""
    borrows = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).order_by("created_at", "id").all()
    returns = await tenant_alive(HaoligoMoldReturnSheet, tenant_id).order_by("created_at", "id").all()
    borrows_by_mold: dict[str, list[HaoligoMoldBorrowSheet]] = defaultdict(list)
    returns_by_mold: dict[str, list[HaoligoMoldReturnSheet]] = defaultdict(list)
    for row in borrows:
        borrows_by_mold[(row.mold_code or "").strip()].append(row)
    for row in returns:
        returns_by_mold[(row.mold_code or "").strip()].append(row)
    outstanding: set[int] = set()
    for mcode, mold_borrows in borrows_by_mold.items():
        if not mcode:
            continue
        matched = await matched_borrow_ids_for_returns(
            tenant_id,
            mold_borrows,
            returns_by_mold.get(mcode, []),
        )
        for borrow in mold_borrows:
            if borrow.id not in matched:
                outstanding.add(borrow.id)
    return outstanding


def borrow_return_status_label(borrow_id: int, outstanding_ids: set[int]) -> str:
    return "已领用" if borrow_id in outstanding_ids else "已还入"


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
    pairs = await pair_return_sheets_to_borrow_sheets(tenant_id, borrows, returns)
    total_seconds = 0.0
    for borrow, ret in pairs:
        ret_ts = _to_utc(ret.created_at)
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
