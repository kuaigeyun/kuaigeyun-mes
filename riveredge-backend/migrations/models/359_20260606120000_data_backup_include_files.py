"""数据备份表增加 include_files：控制是否打包 uploads 附件"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "include_files" BOOL NOT NULL DEFAULT TRUE;
        COMMENT ON COLUMN "core_data_backups"."include_files" IS '是否包含 uploads 附件（false=仅数据表）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "include_files";
        """
