"""好力 GO — 设备产出单增加备注字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_output_record"
            ADD COLUMN IF NOT EXISTS "remark" TEXT;
        COMMENT ON COLUMN "haoligo_equipment_output_record"."remark" IS '备注';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_output_record"
            DROP COLUMN IF EXISTS "remark";
    """
