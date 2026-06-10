"""平台级客户端发布迁移：通用 client_release + 从 haoligo 表迁移。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_client_products" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "client_key" VARCHAR(64) NOT NULL UNIQUE,
            "display_name" VARCHAR(128) NOT NULL,
            "app_code" VARCHAR(64),
            "client_kind" VARCHAR(32) NOT NULL,
            "platform_target" VARCHAR(16) NOT NULL,
            "supports_ota" BOOL NOT NULL DEFAULT FALSE,
            "login_tile_slot" VARCHAR(16) NOT NULL DEFAULT 'none',
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "sort_order" INT NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS "core_client_releases" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "client_key" VARCHAR(64) NOT NULL,
            "platform" VARCHAR(16) NOT NULL,
            "app_version" VARCHAR(32) NOT NULL,
            "version_code" INT NOT NULL DEFAULT 0,
            "runtime_version" VARCHAR(64),
            "update_type" VARCHAR(16) NOT NULL,
            "requires_native" BOOL NOT NULL DEFAULT FALSE,
            "force_update" BOOL NOT NULL DEFAULT FALSE,
            "min_version_code" INT NOT NULL DEFAULT 0,
            "release_notes" TEXT NOT NULL DEFAULT '',
            "bundle_id" VARCHAR(64),
            "artifact_filename" VARCHAR(256),
            "artifact_sha256" VARCHAR(64),
            "artifact_size_bytes" BIGINT,
            "artifact_ext" VARCHAR(16),
            "ota_relative_path" VARCHAR(512),
            "rollout_percent" INT NOT NULL DEFAULT 100,
            "is_active" BOOL NOT NULL DEFAULT FALSE,
            "published_at" TIMESTAMPTZ,
            "created_by" VARCHAR(128)
        );
        CREATE INDEX IF NOT EXISTS "idx_core_client_releases_key_active"
            ON "core_client_releases" ("client_key", "platform", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_core_client_releases_key_vc"
            ON "core_client_releases" ("client_key", "version_code");

        INSERT INTO "core_client_products" (
            uuid, client_key, display_name, app_code, client_kind, platform_target,
            supports_ota, login_tile_slot, is_active, sort_order
        ) VALUES
            (gen_random_uuid()::text, 'haoligo', '好力 GO 移动端', 'haoligo', 'mobile_app', 'android', TRUE, 'none', TRUE, 10),
            (gen_random_uuid()::text, 'touch-terminal-windows', '触屏工位机终端', 'kuaizhizao', 'touch_terminal', 'windows', FALSE, 'windows', TRUE, 20),
            (gen_random_uuid()::text, 'touch-terminal-android', '移动端 PDA', 'kuaizhizao', 'handheld_pda', 'android', FALSE, 'android', TRUE, 30)
        ON CONFLICT (client_key) DO NOTHING;

        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'haoligo_mobile_release'
            ) THEN
                INSERT INTO "core_client_releases" (
                    uuid, client_key, platform, app_version, version_code, runtime_version,
                    update_type, requires_native, force_update, min_version_code, release_notes,
                    bundle_id, artifact_filename, artifact_sha256, artifact_size_bytes, artifact_ext,
                    ota_relative_path, rollout_percent, is_active, published_at, created_by
                )
                SELECT
                    uuid,
                    'haoligo',
                    platform,
                    app_version,
                    version_code,
                    runtime_version,
                    CASE WHEN update_type = 'apk' THEN 'package' ELSE update_type END,
                    requires_native,
                    force_update,
                    min_version_code,
                    release_notes,
                    bundle_id,
                    apk_filename,
                    apk_sha256,
                    apk_size_bytes,
                    CASE WHEN apk_filename IS NOT NULL THEN 'apk' ELSE NULL END,
                    ota_relative_path,
                    rollout_percent,
                    is_active,
                    published_at,
                    created_by
                FROM "haoligo_mobile_release";
                DROP TABLE "haoligo_mobile_release";
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_client_releases";
        DROP TABLE IF EXISTS "core_client_products";
    """
