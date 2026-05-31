"""好力 GO — 点检项分类主数据；点检参数可选关联分类。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
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
        CREATE INDEX IF NOT EXISTS "idx_haoligo_inspection_param_category_tenant"
            ON "haoligo_inspection_param_category" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_inspection_param_category_code"
            ON "haoligo_inspection_param_category" ("code");
        COMMENT ON TABLE "haoligo_inspection_param_category" IS '好力GO - 点检项分类';

        ALTER TABLE "haoligo_inspection_param"
            ADD COLUMN IF NOT EXISTS "category_id" INT REFERENCES "haoligo_inspection_param_category" ("id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_inspection_param_category_id"
            ON "haoligo_inspection_param" ("category_id");
        COMMENT ON COLUMN "haoligo_inspection_param"."category_id" IS '点检项分类';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_inspection_param" DROP COLUMN IF EXISTS "category_id";
        DROP TABLE IF EXISTS "haoligo_inspection_param_category";
    """
