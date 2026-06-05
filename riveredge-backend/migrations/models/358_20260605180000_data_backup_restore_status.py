"""数据备份表增加恢复状态字段"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "restore_status" VARCHAR(20);
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "restore_started_at" TIMESTAMPTZ;
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "restore_completed_at" TIMESTAMPTZ;
        ALTER TABLE "core_data_backups" ADD COLUMN IF NOT EXISTS "restore_error_message" TEXT;
        COMMENT ON COLUMN "core_data_backups"."restore_status" IS '最近一次恢复状态：pending/running/success/failed';
        COMMENT ON COLUMN "core_data_backups"."restore_started_at" IS '最近一次恢复开始时间';
        COMMENT ON COLUMN "core_data_backups"."restore_completed_at" IS '最近一次恢复完成时间';
        COMMENT ON COLUMN "core_data_backups"."restore_error_message" IS '最近一次恢复错误信息';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "restore_error_message";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "restore_completed_at";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "restore_started_at";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "restore_status";
        """
