"""
创建快格报表 (kuaireport) 应用表

apps_kuaireport_reports、apps_kuaireport_dashboards、apps_kuaireport_data_sources
迁移 93 和 74 依赖这些表存在，需在之前创建。

Author: Auto (AI Assistant)
Date: 2026-02-19
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaireport_reports" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "description" TEXT,
            "category" VARCHAR(20) NOT NULL DEFAULT 'custom',
            "is_system" BOOL NOT NULL DEFAULT False,
            "owner_id" INT,
            "report_config" JSONB,
            "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            "is_shared" BOOL NOT NULL DEFAULT False,
            "share_token" VARCHAR(64),
            "share_expires_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            CONSTRAINT "uid_apps_kuaireport_reports_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaireport_reports_tenant_code" ON "apps_kuaireport_reports" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaireport_reports_tenant_status" ON "apps_kuaireport_reports" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaireport_reports_tenant_category" ON "apps_kuaireport_reports" ("tenant_id", "category");
        ALTER TABLE "apps_kuaireport_reports" ADD COLUMN IF NOT EXISTS "owner_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaireport_reports_tenant_owner" ON "apps_kuaireport_reports" ("tenant_id", "owner_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaireport_dashboards" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "name" VARCHAR(100) NOT NULL,
            "layout_config" JSONB,
            "widgets_config" JSONB,
            "theme_config" JSONB,
            "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            "description" TEXT,
            "is_shared" BOOL NOT NULL DEFAULT False,
            "share_token" VARCHAR(64),
            "share_expires_at" TIMESTAMPTZ,
            "thumbnail" VARCHAR(500),
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaireport_dashboards_tenant_code" ON "apps_kuaireport_dashboards" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaireport_dashboards_tenant_status" ON "apps_kuaireport_dashboards" ("tenant_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaireport_data_sources" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "name" VARCHAR(100) NOT NULL,
            "type" VARCHAR(20) NOT NULL DEFAULT 'static',
            "config" JSONB,
            "description" TEXT,
            "is_default" BOOL NOT NULL DEFAULT False,
            "is_system" BOOL NOT NULL DEFAULT False,
            "created_by" INT,
            "updated_by" INT
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaireport_data_sources_tenant_type" ON "apps_kuaireport_data_sources" ("tenant_id", "type");

        COMMENT ON TABLE "apps_kuaireport_reports" IS '快格报表 - 报表定义';
        COMMENT ON TABLE "apps_kuaireport_dashboards" IS '快格报表 - 大屏定义';
        COMMENT ON TABLE "apps_kuaireport_data_sources" IS '快格报表 - 数据源';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaireport_data_sources";
        DROP TABLE IF EXISTS "apps_kuaireport_dashboards";
        DROP TABLE IF EXISTS "apps_kuaireport_reports";
    """
