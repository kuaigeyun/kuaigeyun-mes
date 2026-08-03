"""
设备台账增加单独设备照片字段 photo_file_uuid
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment"
            ADD COLUMN IF NOT EXISTS "photo_file_uuid" VARCHAR(36);
        COMMENT ON COLUMN "apps_kuaizhizao_equipment"."photo_file_uuid"
            IS '设备照片（core_files.uuid）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment"
            DROP COLUMN IF EXISTS "photo_file_uuid";
        """
