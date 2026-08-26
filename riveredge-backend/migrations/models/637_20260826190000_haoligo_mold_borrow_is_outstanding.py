"""好力 GO — 领用单 is_outstanding 落库，待还入列表禁止全表配对。"""

from collections import defaultdict
from types import SimpleNamespace

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_ALTER = """
        ALTER TABLE "haoligo_mold_borrow_sheet"
            ADD COLUMN IF NOT EXISTS "is_outstanding" BOOL NOT NULL DEFAULT TRUE;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_borrow_outstanding"
            ON "haoligo_mold_borrow_sheet" ("tenant_id", "is_outstanding")
            WHERE "deleted_at" IS NULL;
"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    await db.execute_script(_ALTER)
    from apps.haoligo.api._mold_processing_time import _outstanding_ids_from_rows

    borrows = await db.execute_query_dict(
        """
        SELECT id, tenant_id, mold_code, created_at, sheet_no
        FROM haoligo_mold_borrow_sheet
        WHERE deleted_at IS NULL
        """
    )
    returns = await db.execute_query_dict(
        """
        SELECT id, tenant_id, mold_code, created_at, borrow_sheet_no
        FROM haoligo_mold_return_sheet
        WHERE deleted_at IS NULL
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
        outstanding = _outstanding_ids_from_rows(b_rows, grouped_r.get(key, []))
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
