"""好力 GO — 设备产出单增加通知人员。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_output_record"
        ADD COLUMN IF NOT EXISTS "notify_user_ids" JSONB NOT NULL DEFAULT '[]';

        COMMENT ON COLUMN "haoligo_equipment_output_record"."notify_user_ids"
            IS '保存时站内信通知接收人用户 ID 列表';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_output_record"
        DROP COLUMN IF EXISTS "notify_user_ids";
    """
