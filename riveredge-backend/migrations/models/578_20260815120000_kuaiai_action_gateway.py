"""
KU-AI ActionGateway 待确认令牌与审计表

Author: Auto
Date: 2026-08-15
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiai_action_pending_tokens" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "token" VARCHAR(64) NOT NULL UNIQUE,
            "action_code" VARCHAR(64) NOT NULL,
            "title" VARCHAR(300) NOT NULL,
            "description" TEXT NOT NULL,
            "payload" JSONB NOT NULL DEFAULT '{}',
            "expires_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_action_pending_tenant_user"
            ON "apps_kuaiai_action_pending_tokens" ("tenant_id", "user_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_action_pending_expires"
            ON "apps_kuaiai_action_pending_tokens" ("expires_at");

        CREATE TABLE IF NOT EXISTS "apps_kuaiai_action_audit_logs" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "user_id" INT,
            "action_code" VARCHAR(64) NOT NULL,
            "status" VARCHAR(32) NOT NULL,
            "detail_hash" VARCHAR(32),
            "detail" JSONB,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_action_audit_tenant_created"
            ON "apps_kuaiai_action_audit_logs" ("tenant_id", "created_at");
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_action_audit_code"
            ON "apps_kuaiai_action_audit_logs" ("action_code");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaiai_action_audit_logs";
        DROP TABLE IF EXISTS "apps_kuaiai_action_pending_tokens";
    """
