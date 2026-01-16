"""
添加设备状态监控相关模型

根据功能点2.6.6：设备状态监控

包含：
1. apps_kuaizhizao_equipment_status_monitors - 设备状态监控记录
2. apps_kuaizhizao_equipment_status_histories - 设备状态历史记录

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加设备状态监控相关模型
    """
    return """
        -- ============================================
        -- 1. 创建设备状态监控记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_status_monitors" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_code" VARCHAR(50) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "status" VARCHAR(50) NOT NULL DEFAULT '正常',
            "is_online" BOOLEAN NOT NULL DEFAULT FALSE,
            "runtime_hours" DECIMAL(10, 2),
            "last_maintenance_date" TIMESTAMPTZ,
            "next_maintenance_date" TIMESTAMPTZ,
            "temperature" DECIMAL(8, 2),
            "pressure" DECIMAL(10, 2),
            "vibration" DECIMAL(10, 2),
            "other_parameters" JSONB,
            "data_source" VARCHAR(50) NOT NULL DEFAULT 'manual',
            "monitored_at" TIMESTAMPTZ NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_tenant_id" ON "apps_kuaizhizao_equipment_status_monitors" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_equipment_id" ON "apps_kuaizhizao_equipment_status_monitors" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_equipment_uuid" ON "apps_kuaizhizao_equipment_status_monitors" ("equipment_uuid");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_status" ON "apps_kuaizhizao_equipment_status_monitors" ("status");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_is_online" ON "apps_kuaizhizao_equipment_status_monitors" ("is_online");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_monitored_at" ON "apps_kuaizhizao_equipment_status_monitors" ("monitored_at");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_created_at" ON "apps_kuaizhizao_equipment_status_monitors" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_monitors_uuid" ON "apps_kuaizhizao_equipment_status_monitors" ("uuid");

        -- ============================================
        -- 2. 创建设备状态历史记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_status_histories" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "from_status" VARCHAR(50),
            "to_status" VARCHAR(50) NOT NULL,
            "status_changed_at" TIMESTAMPTZ NOT NULL,
            "changed_by" INT,
            "changed_by_name" VARCHAR(100),
            "reason" VARCHAR(200),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_histories_tenant_id" ON "apps_kuaizhizao_equipment_status_histories" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_histories_equipment_id" ON "apps_kuaizhizao_equipment_status_histories" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_histories_equipment_uuid" ON "apps_kuaizhizao_equipment_status_histories" ("equipment_uuid");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_histories_status_changed_at" ON "apps_kuaizhizao_equipment_status_histories" ("status_changed_at");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_histories_to_status" ON "apps_kuaizhizao_equipment_status_histories" ("to_status");
        CREATE INDEX IF NOT EXISTS "idx_equipment_status_histories_uuid" ON "apps_kuaizhizao_equipment_status_histories" ("uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除设备状态监控相关模型
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_equipment_status_histories_uuid";
        DROP INDEX IF EXISTS "idx_equipment_status_histories_to_status";
        DROP INDEX IF EXISTS "idx_equipment_status_histories_status_changed_at";
        DROP INDEX IF EXISTS "idx_equipment_status_histories_equipment_uuid";
        DROP INDEX IF EXISTS "idx_equipment_status_histories_equipment_id";
        DROP INDEX IF EXISTS "idx_equipment_status_histories_tenant_id";

        DROP INDEX IF EXISTS "idx_equipment_status_monitors_uuid";
        DROP INDEX IF EXISTS "idx_equipment_status_monitors_created_at";
        DROP INDEX IF EXISTS "idx_equipment_status_monitors_monitored_at";
        DROP INDEX IF EXISTS "idx_equipment_status_monitors_is_online";
        DROP INDEX IF EXISTS "idx_equipment_status_monitors_status";
        DROP INDEX IF EXISTS "idx_equipment_status_monitors_equipment_uuid";
        DROP INDEX IF EXISTS "idx_equipment_status_monitors_equipment_id";
        DROP INDEX IF EXISTS "idx_equipment_status_monitors_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_status_histories";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_status_monitors";
    """
