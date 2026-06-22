"""好力 GO — 厂内维修单 / 外协维修单增加紧急程度。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_sheet"
        ADD COLUMN IF NOT EXISTS "urgency_level" VARCHAR(16) NOT NULL DEFAULT '一般';

        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
        ADD COLUMN IF NOT EXISTS "urgency_level" VARCHAR(16) NOT NULL DEFAULT '一般';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_sheet"
        DROP COLUMN IF EXISTS "urgency_level";

        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
        DROP COLUMN IF EXISTS "urgency_level";
    """
