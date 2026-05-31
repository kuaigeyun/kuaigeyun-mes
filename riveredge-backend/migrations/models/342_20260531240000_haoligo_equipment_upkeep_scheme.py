from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_equipment_upkeep_param_set" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eups_tenant" ON "haoligo_equipment_upkeep_param_set" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_eups_tenant_code"
            ON "haoligo_equipment_upkeep_param_set" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_upkeep_param" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "requirement" TEXT,
            "value_type" VARCHAR(32) NOT NULL DEFAULT 'text',
            "default_value" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eup_tenant" ON "haoligo_equipment_upkeep_param" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_eup_tenant_code"
            ON "haoligo_equipment_upkeep_param" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_upkeep_param_set_item" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_required" BOOLEAN NOT NULL DEFAULT TRUE,
            "param_id" INT NOT NULL REFERENCES "haoligo_equipment_upkeep_param"("id") ON DELETE CASCADE,
            "set_id" INT NOT NULL REFERENCES "haoligo_equipment_upkeep_param_set"("id") ON DELETE CASCADE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eupsi_tenant" ON "haoligo_equipment_upkeep_param_set_item" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eupsi_set" ON "haoligo_equipment_upkeep_param_set_item" ("set_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_eupsi_set_param"
            ON "haoligo_equipment_upkeep_param_set_item" ("set_id", "param_id") WHERE "deleted_at" IS NULL;

        ALTER TABLE "haoligo_equipment"
            ADD COLUMN IF NOT EXISTS "upkeep_param_set_id" INT REFERENCES "haoligo_equipment_upkeep_param_set"("id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_upkeep_set" ON "haoligo_equipment" ("upkeep_param_set_id");

        ALTER TABLE "haoligo_equipment_upkeep_sheet"
            ADD COLUMN IF NOT EXISTS "upkeep_param_set_id" INT REFERENCES "haoligo_equipment_upkeep_param_set"("id") ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS "upkeep_param_set_code" VARCHAR(64),
            ADD COLUMN IF NOT EXISTS "upkeep_param_set_name" VARCHAR(200);

        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
            ADD COLUMN IF NOT EXISTS "upkeep_param_set_id" INT,
            ADD COLUMN IF NOT EXISTS "upkeep_record_lines" JSONB;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
            DROP COLUMN IF EXISTS "upkeep_record_lines",
            DROP COLUMN IF EXISTS "upkeep_param_set_id";
        ALTER TABLE "haoligo_equipment_upkeep_sheet"
            DROP COLUMN IF EXISTS "upkeep_param_set_name",
            DROP COLUMN IF EXISTS "upkeep_param_set_code",
            DROP COLUMN IF EXISTS "upkeep_param_set_id";
        ALTER TABLE "haoligo_equipment" DROP COLUMN IF EXISTS "upkeep_param_set_id";
        DROP TABLE IF EXISTS "haoligo_equipment_upkeep_param_set_item";
        DROP TABLE IF EXISTS "haoligo_equipment_upkeep_param";
        DROP TABLE IF EXISTS "haoligo_equipment_upkeep_param_set";
    """
