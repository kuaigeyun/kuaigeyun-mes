from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_templates" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "template_code" VARCHAR(50) NOT NULL,
            "template_name" VARCHAR(200) NOT NULL,
            "product_material_id" INT NOT NULL,
            "product_material_code" VARCHAR(50) NOT NULL,
            "product_material_name" VARCHAR(200) NOT NULL,
            "base_quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
            "source_type" VARCHAR(20) NOT NULL DEFAULT 'manual',
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "total_items" INT NOT NULL DEFAULT 0,
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uidx_assembly_templates_tenant_code" UNIQUE ("tenant_id", "template_code")
        );

        CREATE INDEX IF NOT EXISTS "idx_assembly_templates_tenant_id"
            ON "apps_kuaizhizao_assembly_templates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_assembly_templates_product_material_id"
            ON "apps_kuaizhizao_assembly_templates" ("product_material_id");
        CREATE INDEX IF NOT EXISTS "idx_assembly_templates_is_active"
            ON "apps_kuaizhizao_assembly_templates" ("is_active");

        COMMENT ON TABLE "apps_kuaizhizao_assembly_templates" IS '快格轻制造 - 组装模板';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_template_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "template_id" INT NOT NULL REFERENCES "apps_kuaizhizao_assembly_templates" ("id") ON DELETE CASCADE,
            "sequence" INT NOT NULL DEFAULT 0,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "quantity_per_base" DECIMAL(12,4) NOT NULL,
            "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_assembly_template_items_tenant_id"
            ON "apps_kuaizhizao_assembly_template_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_assembly_template_items_template_id"
            ON "apps_kuaizhizao_assembly_template_items" ("template_id");
        CREATE INDEX IF NOT EXISTS "idx_assembly_template_items_material_id"
            ON "apps_kuaizhizao_assembly_template_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_assembly_template_items" IS '快格轻制造 - 组装模板明细';

        ALTER TABLE "apps_kuaizhizao_assembly_orders"
            ADD COLUMN IF NOT EXISTS "assembly_template_id" INT;
        ALTER TABLE "apps_kuaizhizao_assembly_orders"
            ADD COLUMN IF NOT EXISTS "assembly_template_code" VARCHAR(50);
        COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."assembly_template_id" IS '套用的组装模板ID';
        COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."assembly_template_code" IS '套用的组装模板编码';
    """
