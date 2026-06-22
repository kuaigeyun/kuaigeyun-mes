"""移动端 FCM 等设备 token 注册表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_mobile_push_device" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "user_id" INT NOT NULL,
            "provider" VARCHAR(20) NOT NULL DEFAULT 'fcm',
            "platform" VARCHAR(20) NOT NULL,
            "token" VARCHAR(512) NOT NULL,
            "device_id" VARCHAR(128),
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "last_seen_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_core_mobile_push_device_tenant_id"
            ON "core_mobile_push_device" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_mobile_push_device_user_id"
            ON "core_mobile_push_device" ("user_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_core_mobile_push_device_tenant_token"
            ON "core_mobile_push_device" ("tenant_id", "token");
        CREATE INDEX IF NOT EXISTS "idx_core_mobile_push_device_active_lookup"
            ON "core_mobile_push_device" ("tenant_id", "user_id", "is_active", "provider");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_mobile_push_device";
    """
