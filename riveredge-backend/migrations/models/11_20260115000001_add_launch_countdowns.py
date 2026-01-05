"""
添加上线倒计时表

P0优先级迁移：创建 apps_kuaizhizao_launch_countdowns 表

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加上线倒计时表
    """
    return """
        -- ============================================
        -- 创建上线倒计时表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_launch_countdowns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "launch_date" TIMESTAMPTZ NOT NULL,
            "snapshot_time" TIMESTAMPTZ,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "progress" JSONB,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_launch_countdowns_tenant_status" UNIQUE ("tenant_id", "status")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_launch_countdowns_tenant_id" ON "apps_kuaizhizao_launch_countdowns" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_launch_countdowns_launch_date" ON "apps_kuaizhizao_launch_countdowns" ("launch_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_launch_countdowns_status" ON "apps_kuaizhizao_launch_countdowns" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_launch_countdowns_uuid" ON "apps_kuaizhizao_launch_countdowns" ("uuid");
        
        -- 添加注释
        COMMENT ON TABLE "apps_kuaizhizao_launch_countdowns" IS '上线倒计时模型';
        COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."launch_date" IS '上线日期';
        COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."snapshot_time" IS '快照时间点（期初数据的基准时间点）';
        COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."status" IS '状态（pending/in_progress/completed/cancelled）';
        COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."progress" IS '导入进度（JSON格式，存储各阶段导入状态）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除上线倒计时表
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_launch_countdowns" CASCADE;
    """

