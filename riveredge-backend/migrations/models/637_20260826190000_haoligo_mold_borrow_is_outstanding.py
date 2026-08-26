"""好力 GO — 领用单 is_outstanding 落库，待还入列表禁止全表配对。

配对规则与 haoligo `_mold_processing_time` 一致。逻辑必须内联在本文件：
haoligo 为私有仓组装、不进主仓，禁止 import 应用模块。
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from types import SimpleNamespace

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_UTC = timezone.utc
_BORROW_REF_ID = re.compile(r"#\s*(\d+)")

_ALTER = """
        ALTER TABLE "haoligo_mold_borrow_sheet"
            ADD COLUMN IF NOT EXISTS "is_outstanding" BOOL NOT NULL DEFAULT TRUE;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_borrow_outstanding"
            ON "haoligo_mold_borrow_sheet" ("tenant_id", "is_outstanding")
            WHERE "deleted_at" IS NULL;
"""


def _parse_borrow_sheet_id_from_ref(ref: object) -> int | None:
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
    if dt.tzinfo is None:
        return dt.replace(tzinfo=_UTC)
    return dt.astimezone(_UTC)


def _outstanding_ids_in_group(borrows: list, returns: list) -> set[int]:
    """同一租户、同一模具代号内：还入单配对领用单后，尚未被占用的领用单 id。"""
    borrow_by_id = {b.id: b for b in borrows}
    borrow_by_sheet_no: dict[str, object] = {}
    for b in borrows:
        sheet_no = (b.sheet_no or "").strip()
        if sheet_no:
            borrow_by_sheet_no[sheet_no] = b
    matched_borrow_ids: set[int] = set()
    for ret in returns:
        ret_ts = _to_utc(ret.created_at)
        borrow = None
        bid = _parse_borrow_sheet_id_from_ref(ret.borrow_sheet_no)
        if bid is None:
            s = (ret.borrow_sheet_no or "").strip()
            row = borrow_by_sheet_no.get(s) if s else None
            if row is not None:
                bid = row.id
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
    return {b.id for b in borrows if b.id not in matched_borrow_ids}


async def upgrade(db: BaseDBAsyncClient) -> str:
    await db.execute_script(_ALTER)

    borrows = await db.execute_query_dict(
        """
        SELECT id, tenant_id, mold_code, created_at, sheet_no
        FROM haoligo_mold_borrow_sheet
        WHERE deleted_at IS NULL
        ORDER BY created_at, id
        """
    )
    returns = await db.execute_query_dict(
        """
        SELECT id, tenant_id, mold_code, created_at, borrow_sheet_no
        FROM haoligo_mold_return_sheet
        WHERE deleted_at IS NULL
        ORDER BY created_at, id
        """
    )
    grouped_b: dict[tuple[int, str], list] = defaultdict(list)
    grouped_r: dict[tuple[int, str], list] = defaultdict(list)
    for row in borrows:
        key = (int(row["tenant_id"]), str(row["mold_code"] or "").strip())
        grouped_b[key].append(
            SimpleNamespace(
                id=int(row["id"]),
                mold_code=key[1],
                created_at=row["created_at"],
                sheet_no=row.get("sheet_no"),
            )
        )
    for row in returns:
        key = (int(row["tenant_id"]), str(row["mold_code"] or "").strip())
        grouped_r[key].append(
            SimpleNamespace(
                id=int(row["id"]),
                mold_code=key[1],
                created_at=row["created_at"],
                borrow_sheet_no=row.get("borrow_sheet_no"),
            )
        )
    matched: list[int] = []
    for key, b_rows in grouped_b.items():
        if not key[1]:
            matched.extend(b.id for b in b_rows)
            continue
        outstanding = _outstanding_ids_in_group(b_rows, grouped_r.get(key, []))
        matched.extend(b.id for b in b_rows if b.id not in outstanding)
    for i in range(0, len(matched), 2000):
        chunk = matched[i : i + 2000]
        await db.execute_query(
            """
            UPDATE haoligo_mold_borrow_sheet
            SET is_outstanding = FALSE
            WHERE id = ANY($1::int[])
            """,
            [chunk],
        )
    return _ALTER


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_mold_borrow_outstanding";
        ALTER TABLE "haoligo_mold_borrow_sheet" DROP COLUMN IF EXISTS "is_outstanding";
    """
