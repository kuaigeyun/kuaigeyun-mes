from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_upkeep_param_set" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mups_tenant" ON "haoligo_mold_upkeep_param_set" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_mups_tenant_code"
            ON "haoligo_mold_upkeep_param_set" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_mold_upkeep_param" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "requirement" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mup_tenant" ON "haoligo_mold_upkeep_param" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_mup_tenant_code"
            ON "haoligo_mold_upkeep_param" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_mold_upkeep_param_set_item" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_required" BOOLEAN NOT NULL DEFAULT TRUE,
            "param_id" INT NOT NULL REFERENCES "haoligo_mold_upkeep_param"("id") ON DELETE CASCADE,
            "set_id" INT NOT NULL REFERENCES "haoligo_mold_upkeep_param_set"("id") ON DELETE CASCADE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mupsi_tenant" ON "haoligo_mold_upkeep_param_set_item" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mupsi_set" ON "haoligo_mold_upkeep_param_set_item" ("set_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_mupsi_set_param"
            ON "haoligo_mold_upkeep_param_set_item" ("set_id", "param_id") WHERE "deleted_at" IS NULL;

        ALTER TABLE "haoligo_mold"
            ADD COLUMN IF NOT EXISTS "upkeep_param_set_id" INT REFERENCES "haoligo_mold_upkeep_param_set"("id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_upkeep_set" ON "haoligo_mold" ("upkeep_param_set_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "upkeep_param_set_id";
        DROP TABLE IF EXISTS "haoligo_mold_upkeep_param_set_item";
        DROP TABLE IF EXISTS "haoligo_mold_upkeep_param";
        DROP TABLE IF EXISTS "haoligo_mold_upkeep_param_set";
    """
