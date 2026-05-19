"""好力 GO — 点检项数值取值范围；点检单行快照。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_inspection_param"
            ADD COLUMN IF NOT EXISTS "numeric_min" DECIMAL(20, 6),
            ADD COLUMN IF NOT EXISTS "numeric_max" DECIMAL(20, 6);
        COMMENT ON COLUMN "haoligo_inspection_param"."numeric_min" IS '数值型取值下限（含），空表示不限制';
        COMMENT ON COLUMN "haoligo_inspection_param"."numeric_max" IS '数值型取值上限（含），空表示不限制';

        ALTER TABLE "haoligo_equipment_spot_check_line"
            ADD COLUMN IF NOT EXISTS "numeric_min" DECIMAL(20, 6),
            ADD COLUMN IF NOT EXISTS "numeric_max" DECIMAL(20, 6);
        COMMENT ON COLUMN "haoligo_equipment_spot_check_line"."numeric_min" IS '数值型取值下限快照（含）';
        COMMENT ON COLUMN "haoligo_equipment_spot_check_line"."numeric_max" IS '数值型取值上限快照（含）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_spot_check_line"
            DROP COLUMN IF EXISTS "numeric_max",
            DROP COLUMN IF EXISTS "numeric_min";
        ALTER TABLE "haoligo_inspection_param"
            DROP COLUMN IF EXISTS "numeric_max",
            DROP COLUMN IF EXISTS "numeric_min";
    """
