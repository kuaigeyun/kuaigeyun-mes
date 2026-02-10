"""
添加设备维护提醒相关模型

根据功能点2.6.7：设备维护提醒

包含：
1. apps_kuaizhizao_maintenance_reminders - 设备维护提醒记录

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加设备维护提醒相关模型
    """
    return """
        -- ============================================
        -- 1. 创建设备维护提醒记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_maintenance_reminders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "maintenance_plan_id" INT,
            "maintenance_plan_uuid" VARCHAR(36),
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_code" VARCHAR(50) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "reminder_type" VARCHAR(50) NOT NULL,
            "reminder_date" TIMESTAMPTZ NOT NULL,
            "planned_maintenance_date" TIMESTAMPTZ NOT NULL,
            "days_until_due" INT NOT NULL,
            "reminder_message" TEXT,
            "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
            "read_at" TIMESTAMPTZ,
            "read_by" INT,
            "is_handled" BOOLEAN NOT NULL DEFAULT FALSE,
            "handled_at" TIMESTAMPTZ,
            "handled_by" INT,
            "handled_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_tenant_id" ON "apps_kuaizhizao_maintenance_reminders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_maintenance_plan_id" ON "apps_kuaizhizao_maintenance_reminders" ("maintenance_plan_id");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_equipment_id" ON "apps_kuaizhizao_maintenance_reminders" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_reminder_type" ON "apps_kuaizhizao_maintenance_reminders" ("reminder_type");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_reminder_date" ON "apps_kuaizhizao_maintenance_reminders" ("reminder_date");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_is_read" ON "apps_kuaizhizao_maintenance_reminders" ("is_read");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_is_handled" ON "apps_kuaizhizao_maintenance_reminders" ("is_handled");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_created_at" ON "apps_kuaizhizao_maintenance_reminders" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_maintenance_reminders_uuid" ON "apps_kuaizhizao_maintenance_reminders" ("uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除设备维护提醒相关模型
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_maintenance_reminders_uuid";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_created_at";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_is_handled";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_is_read";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_reminder_date";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_reminder_type";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_equipment_id";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_maintenance_plan_id";
        DROP INDEX IF EXISTS "idx_maintenance_reminders_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "apps_kuaizhizao_maintenance_reminders";
    """
