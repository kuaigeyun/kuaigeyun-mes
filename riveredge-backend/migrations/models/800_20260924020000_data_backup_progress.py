"""数据备份表增加 progress / progress_message，供列表进度条展示"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "progress" INT NOT NULL DEFAULT 0;
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "progress_message" VARCHAR(255);
        COMMENT ON COLUMN "core_data_backups"."progress" IS '备份进度百分比 0-100';
        COMMENT ON COLUMN "core_data_backups"."progress_message" IS '备份进度说明';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "progress_message";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "progress";
        """
