"""
快报表专业能力增强：分享密码、订阅/授权/审计/版本表。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaireport_reports"
            ADD COLUMN IF NOT EXISTS "share_password_hash" VARCHAR(128);
        ALTER TABLE "apps_kuaireport_reports"
            ADD COLUMN IF NOT EXISTS "share_allow_ip_cidrs" JSONB;
        ALTER TABLE "apps_kuaireport_reports"
            ADD COLUMN IF NOT EXISTS "current_version" INT NOT NULL DEFAULT 0;

        ALTER TABLE "apps_kuaireport_dashboards"
            ADD COLUMN IF NOT EXISTS "share_password_hash" VARCHAR(128);
        ALTER TABLE "apps_kuaireport_dashboards"
            ADD COLUMN IF NOT EXISTS "share_allow_ip_cidrs" JSONB;
        ALTER TABLE "apps_kuaireport_dashboards"
            ADD COLUMN IF NOT EXISTS "current_version" INT NOT NULL DEFAULT 0;
        ALTER TABLE "apps_kuaireport_dashboards"
            ADD COLUMN IF NOT EXISTS "tv_config" JSONB;

        CREATE TABLE IF NOT EXISTS "apps_kuaireport_report_subscriptions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "report_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "cron" VARCHAR(64) NOT NULL DEFAULT '0 8 * * 1-5',
            "channel" VARCHAR(20) NOT NULL DEFAULT 'inbox',
            "recipient_user_ids" JSONB NOT NULL DEFAULT '[]',
            "recipient_emails" JSONB NOT NULL DEFAULT '[]',
            "filters" JSONB,
            "attach_excel" BOOL NOT NULL DEFAULT TRUE,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "scheduled_task_uuid" VARCHAR(36),
            "last_run_at" TIMESTAMPTZ,
            "last_run_status" VARCHAR(20),
            "last_run_error" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_sub_tenant_report"
            ON "apps_kuaireport_report_subscriptions" ("tenant_id", "report_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_sub_tenant_active"
            ON "apps_kuaireport_report_subscriptions" ("tenant_id", "is_active");

        CREATE TABLE IF NOT EXISTS "apps_kuaireport_share_grants" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "resource_type" VARCHAR(20) NOT NULL,
            "resource_id" INT NOT NULL,
            "role_id" INT NOT NULL,
            "permission" VARCHAR(20) NOT NULL DEFAULT 'view',
            CONSTRAINT "uid_kuaireport_share_grant" UNIQUE (
                "tenant_id", "resource_type", "resource_id", "role_id", "permission"
            )
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_grant_resource"
            ON "apps_kuaireport_share_grants" ("tenant_id", "resource_type", "resource_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaireport_share_access_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "resource_type" VARCHAR(20) NOT NULL,
            "resource_id" INT NOT NULL,
            "share_token" VARCHAR(64) NOT NULL,
            "action" VARCHAR(32) NOT NULL DEFAULT 'view',
            "client_ip" VARCHAR(64),
            "user_agent" VARCHAR(255),
            "success" BOOL NOT NULL DEFAULT TRUE,
            "detail" VARCHAR(255)
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_share_log_resource"
            ON "apps_kuaireport_share_access_logs" ("tenant_id", "resource_type", "resource_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_share_log_token"
            ON "apps_kuaireport_share_access_logs" ("tenant_id", "share_token");

        CREATE TABLE IF NOT EXISTS "apps_kuaireport_report_versions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "report_id" INT NOT NULL,
            "version_no" INT NOT NULL,
            "snapshot" JSONB NOT NULL,
            "note" VARCHAR(200),
            "created_by_user_id" INT,
            CONSTRAINT "uid_kuaireport_report_ver" UNIQUE ("tenant_id", "report_id", "version_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_report_ver"
            ON "apps_kuaireport_report_versions" ("tenant_id", "report_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaireport_dashboard_versions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "dashboard_id" INT NOT NULL,
            "version_no" INT NOT NULL,
            "snapshot" JSONB NOT NULL,
            "note" VARCHAR(200),
            "created_by_user_id" INT,
            CONSTRAINT "uid_kuaireport_dash_ver" UNIQUE ("tenant_id", "dashboard_id", "version_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_dash_ver"
            ON "apps_kuaireport_dashboard_versions" ("tenant_id", "dashboard_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaireport_dashboard_versions";
        DROP TABLE IF EXISTS "apps_kuaireport_report_versions";
        DROP TABLE IF EXISTS "apps_kuaireport_share_access_logs";
        DROP TABLE IF EXISTS "apps_kuaireport_share_grants";
        DROP TABLE IF EXISTS "apps_kuaireport_report_subscriptions";
    """
