"""好力 GO — 设备验收轮次：调试/试产图片附件。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_acceptance_round"
            ADD COLUMN IF NOT EXISTS "commissioning_attachment_file_uuids" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "haoligo_equipment_acceptance_round"
            ADD COLUMN IF NOT EXISTS "trial_attachment_file_uuids" JSONB NOT NULL DEFAULT '[]';
        COMMENT ON COLUMN "haoligo_equipment_acceptance_round"."commissioning_attachment_file_uuids"
            IS '调试图片附件 UUID 列表';
        COMMENT ON COLUMN "haoligo_equipment_acceptance_round"."trial_attachment_file_uuids"
            IS '试产图片附件 UUID 列表';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_acceptance_round"
            DROP COLUMN IF EXISTS "trial_attachment_file_uuids";
        ALTER TABLE "haoligo_equipment_acceptance_round"
            DROP COLUMN IF EXISTS "commissioning_attachment_file_uuids";
    """
