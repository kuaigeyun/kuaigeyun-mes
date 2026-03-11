"""添加 source_type 字段到数据备份表，用于区分系统生成与用户上传的备份"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(20) NOT NULL DEFAULT 'generated';
        COMMENT ON COLUMN "core_data_backups"."source_type" IS '备份来源：generated=系统生成，uploaded=用户上传';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "source_type";
        """
