"""好力 GO — 点检项分类改为设备类别一级分类；移除独立点检项分类表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_inspection_param"
            ADD COLUMN IF NOT EXISTS "level1_category" VARCHAR(200);
        COMMENT ON COLUMN "haoligo_inspection_param"."level1_category" IS '设备类别一级分类';

        UPDATE "haoligo_inspection_param" p
        SET "level1_category" = c."name"
        FROM "haoligo_inspection_param_category" c
        WHERE p."category_id" = c."id"
          AND p."category_id" IS NOT NULL
          AND (p."level1_category" IS NULL OR p."level1_category" = '');

        ALTER TABLE "haoligo_inspection_param" DROP COLUMN IF EXISTS "category_id";
        DROP TABLE IF EXISTS "haoligo_inspection_param_category";

        CREATE INDEX IF NOT EXISTS "idx_haoligo_inspection_param_level1_category"
            ON "haoligo_inspection_param" ("level1_category");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_inspection_param_category" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            CONSTRAINT "uid_haoligo_inspection_param_category_tenant_code"
                UNIQUE ("tenant_id", "code")
        );

        ALTER TABLE "haoligo_inspection_param"
            ADD COLUMN IF NOT EXISTS "category_id" INT REFERENCES "haoligo_inspection_param_category" ("id") ON DELETE SET NULL;

        ALTER TABLE "haoligo_inspection_param" DROP COLUMN IF EXISTS "level1_category";
    """
