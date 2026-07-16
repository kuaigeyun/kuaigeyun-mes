"""快财务往来单据审核态同义词收敛：历史「通过」统一为「已审核」。"""

from tortoise import BaseDBAsyncClient

_TABLES = (
    "apps_kuaicaiwu_receivables",
    "apps_kuaicaiwu_payables",
    "apps_kuaicaiwu_purchase_invoices",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    blocks = []
    for table in _TABLES:
        blocks.append(
            f"""
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '{table}'
    ) THEN
        UPDATE {table}
           SET review_status = '已审核'
         WHERE review_status = '通过';
    END IF;
"""
        )
    return f"""
DO $$
BEGIN
{''.join(blocks)}
END $$;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- kuaicaiwu review_status normalize is irreversible"
