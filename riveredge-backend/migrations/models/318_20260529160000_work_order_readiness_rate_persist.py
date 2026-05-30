"""工单表持久化齐套率及 BOM 组件索引（库存变动时定向刷新）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_orders"
            ADD COLUMN IF NOT EXISTS "readiness_rate" DECIMAL(5,2) NULL;
        ALTER TABLE "apps_kuaizhizao_work_orders"
            ADD COLUMN IF NOT EXISTS "readiness_rate_updated_at" TIMESTAMPTZ NULL;
        ALTER TABLE "apps_kuaizhizao_work_orders"
            ADD COLUMN IF NOT EXISTS "readiness_component_ids" JSONB NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."readiness_rate"
            IS '齐套率 (%)，BOM+库存计算结果持久化';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."readiness_rate_updated_at"
            IS '齐套率最后计算时间';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."readiness_component_ids"
            IS '齐套 BOM 组件物料 ID 列表，用于库存变动时定向刷新';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_orders"
            DROP COLUMN IF EXISTS "readiness_component_ids";
        ALTER TABLE "apps_kuaizhizao_work_orders"
            DROP COLUMN IF EXISTS "readiness_rate_updated_at";
        ALTER TABLE "apps_kuaizhizao_work_orders"
            DROP COLUMN IF EXISTS "readiness_rate";
    """
