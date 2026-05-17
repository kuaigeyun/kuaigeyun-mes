"""好力 GO — 设备台账增加设备图片字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment"
        ADD COLUMN IF NOT EXISTS "image_file_uuids" JSONB NOT NULL DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN "haoligo_equipment"."image_file_uuids" IS '设备图片（core 文件 uuid 列表）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment" DROP COLUMN IF EXISTS "image_file_uuids";
    """
