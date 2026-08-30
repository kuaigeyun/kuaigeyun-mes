"""
创建官方接口库表

平台级：kuaigeyun.com 官方 SaaS 存储社区提交的接口包；tenant_id 恒为 NULL。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "infra_official_api_library_packs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT NULL,
            "created_by_name" VARCHAR(100) NULL,
            "updated_by" INT NULL,
            "updated_by_name" VARCHAR(100) NULL,
            "pack_id" VARCHAR(80) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "description" TEXT NULL,
            "connector_type" VARCHAR(50) NOT NULL,
            "category_name" VARCHAR(50) NOT NULL,
            "category_code" VARCHAR(50) NOT NULL,
            "category_description" VARCHAR(200) NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'published',
            "items" JSONB NOT NULL,
            "submitter_hint" VARCHAR(200) NULL,
            "source_host_hint" VARCHAR(200) NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_infra_official_api_library_packs_pack_id"
            ON "infra_official_api_library_packs" ("pack_id");
        CREATE INDEX IF NOT EXISTS "idx_infra_official_api_library_packs_status"
            ON "infra_official_api_library_packs" ("status");
        CREATE INDEX IF NOT EXISTS "idx_infra_official_api_library_packs_connector_type"
            ON "infra_official_api_library_packs" ("connector_type");
        CREATE INDEX IF NOT EXISTS "idx_infra_official_api_library_packs_category_name"
            ON "infra_official_api_library_packs" ("category_name");
        CREATE INDEX IF NOT EXISTS "idx_infra_official_api_library_packs_created_at"
            ON "infra_official_api_library_packs" ("created_at");

        COMMENT ON TABLE "infra_official_api_library_packs" IS '官方接口库包（社区提交）';
        COMMENT ON COLUMN "infra_official_api_library_packs"."pack_id" IS '接口包唯一键';
        COMMENT ON COLUMN "infra_official_api_library_packs"."items" IS '接口条目定义快照';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_infra_official_api_library_packs_created_at";
        DROP INDEX IF EXISTS "idx_infra_official_api_library_packs_category_name";
        DROP INDEX IF EXISTS "idx_infra_official_api_library_packs_connector_type";
        DROP INDEX IF EXISTS "idx_infra_official_api_library_packs_status";
        DROP INDEX IF EXISTS "idx_infra_official_api_library_packs_pack_id";
        DROP TABLE IF EXISTS "infra_official_api_library_packs";
    """
