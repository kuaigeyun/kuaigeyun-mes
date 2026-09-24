"""开放 API 账套表迁移。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_open_api_accounts" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "acct_id" VARCHAR(64) NOT NULL UNIQUE,
            "name" VARCHAR(100) NOT NULL DEFAULT '默认账套',
            "status" VARCHAR(20) NOT NULL DEFAULT 'active',
            "deleted_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_open_api_accounts_tenant_id"
            ON "core_open_api_accounts" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_open_api_accounts_acct_id"
            ON "core_open_api_accounts" ("acct_id");
        COMMENT ON TABLE "core_open_api_accounts" IS '开放 API 账套';

        CREATE TABLE IF NOT EXISTS "core_open_api_apps" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "account_id" INT NOT NULL,
            "app_id" VARCHAR(64) NOT NULL UNIQUE,
            "app_secret_hash" VARCHAR(255) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'active',
            "ip_allowlist" TEXT,
            "expires_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_open_api_apps_tenant_id"
            ON "core_open_api_apps" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_open_api_apps_account_id"
            ON "core_open_api_apps" ("account_id");
        CREATE INDEX IF NOT EXISTS "idx_open_api_apps_app_id"
            ON "core_open_api_apps" ("app_id");
        COMMENT ON TABLE "core_open_api_apps" IS '开放 API 应用';

        CREATE TABLE IF NOT EXISTS "core_open_api_app_grants" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "app_pk" INT NOT NULL,
            "permission_code" VARCHAR(128) NOT NULL,
            "deleted_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_open_api_grant_app_code" UNIQUE ("app_pk", "permission_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_open_api_grants_tenant_id"
            ON "core_open_api_app_grants" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_open_api_grants_app_pk"
            ON "core_open_api_app_grants" ("app_pk");
        COMMENT ON TABLE "core_open_api_app_grants" IS '开放 API 应用授权';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_open_api_app_grants";
        DROP TABLE IF EXISTS "core_open_api_apps";
        DROP TABLE IF EXISTS "core_open_api_accounts";
    """
