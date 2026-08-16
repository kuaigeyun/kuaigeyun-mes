"""
总账新建表补齐 BaseModel 审计字段（created_by / updated_by 及姓名）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "apps_kuaicaiwu_gl_book_settings",
    "apps_kuaicaiwu_accounting_periods",
    "apps_kuaicaiwu_account_balances",
    "apps_kuaicaiwu_voucher_summaries",
    "apps_kuaicaiwu_gl_transfer_templates",
    "apps_kuaicaiwu_bank_reconcile_items",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    stmts = []
    for table in _TABLES:
        stmts.append(
            f"""
ALTER TABLE "{table}"
    ADD COLUMN IF NOT EXISTS "created_by" INT,
    ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "updated_by" INT,
    ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
"""
        )
    return "\n".join(stmts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    stmts = []
    for table in _TABLES:
        stmts.append(
            f"""
ALTER TABLE "{table}"
    DROP COLUMN IF EXISTS "created_by",
    DROP COLUMN IF EXISTS "created_by_name",
    DROP COLUMN IF EXISTS "updated_by",
    DROP COLUMN IF EXISTS "updated_by_name";
"""
        )
    return "\n".join(stmts)
