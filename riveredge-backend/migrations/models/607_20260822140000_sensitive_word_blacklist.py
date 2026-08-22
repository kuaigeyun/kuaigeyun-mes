"""敏感词黑名单与组织级敏感词放行表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "infra_sensitive_word_violations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "user_id" INT,
            "client_ip" VARCHAR(64) NOT NULL,
            "request_path" VARCHAR(500) NOT NULL,
            "field_path" VARCHAR(255) NOT NULL,
            "matched_word" VARCHAR(128) NOT NULL,
            "content_snippet" TEXT,
            "strike_count" INT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_infra_sw_violations_tenant_created"
            ON "infra_sensitive_word_violations" ("tenant_id", "created_at");
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_infra_sensitive_word_violations_uuid"
            ON "infra_sensitive_word_violations" ("uuid");

        CREATE TABLE IF NOT EXISTS "infra_sensitive_word_bans" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "user_id" INT NOT NULL,
            "client_ip" VARCHAR(64) NOT NULL,
            "banned_at" TIMESTAMPTZ NOT NULL,
            "unbanned_at" TIMESTAMPTZ,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "trigger_request_path" VARCHAR(500),
            "trigger_field_path" VARCHAR(255),
            "trigger_matched_word" VARCHAR(128),
            "trigger_content_snippet" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_infra_sw_bans_tenant_active"
            ON "infra_sensitive_word_bans" ("tenant_id", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_infra_sw_bans_tenant_user_ip"
            ON "infra_sensitive_word_bans" ("tenant_id", "user_id", "client_ip");
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_infra_sensitive_word_bans_uuid"
            ON "infra_sensitive_word_bans" ("uuid");

        CREATE TABLE IF NOT EXISTS "infra_tenant_sensitive_word_allowlist" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "word" VARCHAR(128) NOT NULL,
            "note" VARCHAR(255)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_infra_tenant_sw_allowlist_tenant_word"
            ON "infra_tenant_sensitive_word_allowlist" ("tenant_id", "word");
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_infra_tenant_sensitive_word_allowlist_uuid"
            ON "infra_tenant_sensitive_word_allowlist" ("uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "infra_tenant_sensitive_word_allowlist";
        DROP TABLE IF EXISTS "infra_sensitive_word_bans";
        DROP TABLE IF EXISTS "infra_sensitive_word_violations";
    """
