"""好力 GO — 移动端发布记录表"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mobile_release" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "platform" VARCHAR(16) NOT NULL,
            "app_version" VARCHAR(32) NOT NULL,
            "version_code" INT NOT NULL,
            "runtime_version" VARCHAR(64) NOT NULL,
            "update_type" VARCHAR(8) NOT NULL,
            "requires_native" BOOL NOT NULL DEFAULT FALSE,
            "force_update" BOOL NOT NULL DEFAULT FALSE,
            "min_version_code" INT NOT NULL DEFAULT 0,
            "release_notes" TEXT NOT NULL DEFAULT '',
            "bundle_id" VARCHAR(64),
            "apk_filename" VARCHAR(256),
            "apk_sha256" VARCHAR(64),
            "apk_size_bytes" BIGINT,
            "ota_relative_path" VARCHAR(512),
            "is_active" BOOL NOT NULL DEFAULT FALSE,
            "rollout_percent" INT NOT NULL DEFAULT 100,
            "published_at" TIMESTAMPTZ,
            "created_by" VARCHAR(128)
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mobile_release_platform_active"
            ON "haoligo_mobile_release" ("platform", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mobile_release_platform_vc"
            ON "haoligo_mobile_release" ("platform", "version_code");
        COMMENT ON TABLE "haoligo_mobile_release" IS '好力GO - 移动端发布（平台级）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mobile_release";
    """
