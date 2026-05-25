"""好力 GO — 点检项增加点检要求；点检单行快照。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_inspection_param"
            ADD COLUMN IF NOT EXISTS "requirement" TEXT;
        COMMENT ON COLUMN "haoligo_inspection_param"."requirement" IS '点检要求';

        ALTER TABLE "haoligo_equipment_spot_check_line"
            ADD COLUMN IF NOT EXISTS "param_requirement" TEXT;
        COMMENT ON COLUMN "haoligo_equipment_spot_check_line"."param_requirement" IS '点检要求快照';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_spot_check_line"
            DROP COLUMN IF EXISTS "param_requirement";
        ALTER TABLE "haoligo_inspection_param"
            DROP COLUMN IF EXISTS "requirement";
    """
