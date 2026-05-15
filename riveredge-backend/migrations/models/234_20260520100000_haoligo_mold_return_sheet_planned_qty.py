"""还入单增加计划数量（从领用单带入，与领用单计划数量对齐）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_return_sheet"
        ADD COLUMN IF NOT EXISTS "planned_qty" DECIMAL(18,4);
        COMMENT ON COLUMN "haoligo_mold_return_sheet"."planned_qty" IS '计划数量（从领用单带入）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "planned_qty";
    """
