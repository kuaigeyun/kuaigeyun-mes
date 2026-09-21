"""生产工单推送金蝶：绑定字段（连接器/Save接口/定时）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding"
            ADD COLUMN IF NOT EXISTS "push_connection_code" VARCHAR(64);
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding"
            ADD COLUMN IF NOT EXISTS "push_save_api_uuid" VARCHAR(36);
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding"
            ADD COLUMN IF NOT EXISTS "push_sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full';
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding"
            ADD COLUMN IF NOT EXISTS "push_schedule_interval_minutes" INT NOT NULL DEFAULT 15;
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding"
            ADD COLUMN IF NOT EXISTS "push_last_success_at" TIMESTAMPTZ;
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding"
            ADD COLUMN IF NOT EXISTS "push_last_attempt_at" TIMESTAMPTZ;
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding"
            ADD COLUMN IF NOT EXISTS "push_last_error" TEXT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding" DROP COLUMN IF EXISTS "push_last_error";
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding" DROP COLUMN IF EXISTS "push_last_attempt_at";
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding" DROP COLUMN IF EXISTS "push_last_success_at";
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding" DROP COLUMN IF EXISTS "push_schedule_interval_minutes";
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding" DROP COLUMN IF EXISTS "push_sync_mode";
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding" DROP COLUMN IF EXISTS "push_save_api_uuid";
        ALTER TABLE "apps_kuaizhizao_work_order_sync_binding" DROP COLUMN IF EXISTS "push_connection_code";
    """
