"""
新增 PostgreSQL 缓存表与在线用户活动表（替代 Redis 运行时依赖）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_cache_entries" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "namespace" VARCHAR(64) NOT NULL,
            "key" VARCHAR(512) NOT NULL,
            "value" TEXT NOT NULL,
            "expires_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_core_cache_entries_namespace_key"
            ON "core_cache_entries" ("namespace", "key");
        CREATE INDEX IF NOT EXISTS "idx_core_cache_entries_expires_at"
            ON "core_cache_entries" ("expires_at");
        CREATE INDEX IF NOT EXISTS "idx_core_cache_entries_updated_at"
            ON "core_cache_entries" ("updated_at");

        CREATE TABLE IF NOT EXISTS "core_user_activities" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "user_id" INT NOT NULL,
            "last_activity_time" TIMESTAMPTZ NOT NULL,
            "login_ip" VARCHAR(64),
            "login_time" TIMESTAMPTZ,
            "expires_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_core_user_activities_tenant_user"
            ON "core_user_activities" ("tenant_id", "user_id");
        CREATE INDEX IF NOT EXISTS "idx_core_user_activities_last_activity_time"
            ON "core_user_activities" ("last_activity_time");
        CREATE INDEX IF NOT EXISTS "idx_core_user_activities_expires_at"
            ON "core_user_activities" ("expires_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_user_activities";
        DROP TABLE IF EXISTS "core_cache_entries";
    """
