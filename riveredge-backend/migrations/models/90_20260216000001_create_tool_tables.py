"""
创建工装管理表

根据工装管理功能需求，创建工装及领用、维保、校验相关表。

包含：
1. apps_kuaizhizao_tools - 工装基础信息表
2. apps_kuaizhizao_tool_usages - 工装领用归还记录表
3. apps_kuaizhizao_tool_maintenances - 工装维保记录表
4. apps_kuaizhizao_tool_calibrations - 工装校验记录表

Author: Auto (AI Assistant)
Date: 2026-02-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建工装管理表
    """
    return """
        -- 1. 工装基础信息表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tools" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "type" VARCHAR(50),
            "spec" VARCHAR(200),
            "manufacturer" VARCHAR(200),
            "supplier" VARCHAR(200),
            "purchase_date" DATE,
            "warranty_expiry" DATE,
            "status" VARCHAR(50) NOT NULL DEFAULT '正常',
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "maintenance_period" INT,
            "last_maintenance_date" DATE,
            "next_maintenance_date" DATE,
            "needs_calibration" BOOLEAN NOT NULL DEFAULT FALSE,
            "calibration_period" INT,
            "last_calibration_date" DATE,
            "next_calibration_date" DATE,
            "total_usage_count" INT NOT NULL DEFAULT 0,
            "description" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizhizao_tools_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tools_tenant_id" ON "apps_kuaizhizao_tools" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tools_code" ON "apps_kuaizhizao_tools" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tools_uuid" ON "apps_kuaizhizao_tools" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tools_type" ON "apps_kuaizhizao_tools" ("type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tools_status" ON "apps_kuaizhizao_tools" ("status");

        -- 2. 工装领用归还记录表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_usages" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "usage_no" VARCHAR(100) NOT NULL,
            "operator_id" INT,
            "operator_name" VARCHAR(100),
            "department_name" VARCHAR(100),
            "source_type" VARCHAR(50),
            "source_no" VARCHAR(100),
            "checkout_date" TIMESTAMPTZ NOT NULL,
            "checkin_date" TIMESTAMPTZ,
            "status" VARCHAR(50) NOT NULL DEFAULT '使用中',
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_usages_tenant_id" ON "apps_kuaizhizao_tool_usages" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_usages_tool_id" ON "apps_kuaizhizao_tool_usages" ("tool_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_usages_status" ON "apps_kuaizhizao_tool_usages" ("status");

        -- 3. 工装维保记录表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_maintenances" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "maintenance_type" VARCHAR(50) NOT NULL,
            "maintenance_date" DATE NOT NULL,
            "executor" VARCHAR(100),
            "content" TEXT,
            "result" VARCHAR(50) NOT NULL DEFAULT '完成',
            "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_maintenances_tenant_id" ON "apps_kuaizhizao_tool_maintenances" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_maintenances_tool_id" ON "apps_kuaizhizao_tool_maintenances" ("tool_id");

        -- 4. 工装校验记录表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_calibrations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "calibration_date" DATE NOT NULL,
            "calibration_org" VARCHAR(200),
            "certificate_no" VARCHAR(100),
            "result" VARCHAR(50) NOT NULL,
            "expiry_date" DATE,
            "attachment_uuid" VARCHAR(36),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_calibrations_tenant_id" ON "apps_kuaizhizao_tool_calibrations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_calibrations_tool_id" ON "apps_kuaizhizao_tool_calibrations" ("tool_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除工装管理表
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_calibrations";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_maintenances";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_usages";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tools";
    """
