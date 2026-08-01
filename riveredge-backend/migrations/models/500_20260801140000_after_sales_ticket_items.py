from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_after_sales_ticket_items" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "ticket_id" INT NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(100),
            "material_name" VARCHAR(200),
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20),
            "batch_no" VARCHAR(100),
            "quantity" DECIMAL(14,4),
            "claim_amount" DECIMAL(14,2),
            "notes" TEXT,
            "line_no" INT NOT NULL DEFAULT 1
        );
        COMMENT ON TABLE "apps_kuaizhizao_after_sales_ticket_items" IS '快格轻制造 - 售后服务工单明细';
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_item_ticket"
            ON "apps_kuaizhizao_after_sales_ticket_items" ("tenant_id", "ticket_id");
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_item_material"
            ON "apps_kuaizhizao_after_sales_ticket_items" ("material_id");

        INSERT INTO "apps_kuaizhizao_after_sales_ticket_items" (
            "uuid", "tenant_id", "created_at", "updated_at",
            "created_by", "created_by_name", "updated_by", "updated_by_name",
            "ticket_id", "material_code", "material_name", "batch_no",
            "quantity", "claim_amount", "line_no"
        )
        SELECT
            gen_random_uuid()::text,
            t."tenant_id",
            t."created_at",
            t."updated_at",
            t."created_by",
            t."created_by_name",
            t."updated_by",
            t."updated_by_name",
            t."id",
            t."material_code",
            t."material_name",
            t."batch_no",
            t."quantity",
            t."claim_amount",
            1
        FROM "apps_kuaizhizao_after_sales_tickets" t
        WHERE t."deleted_at" IS NULL
          AND (
            COALESCE(NULLIF(TRIM(t."material_code"), ''), NULL) IS NOT NULL
            OR COALESCE(NULLIF(TRIM(t."material_name"), ''), NULL) IS NOT NULL
            OR COALESCE(NULLIF(TRIM(t."batch_no"), ''), NULL) IS NOT NULL
            OR t."quantity" IS NOT NULL
          );

        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" DROP COLUMN IF EXISTS "material_code";
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" DROP COLUMN IF EXISTS "material_name";
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" DROP COLUMN IF EXISTS "batch_no";
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" DROP COLUMN IF EXISTS "quantity";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" ADD COLUMN IF NOT EXISTS "material_code" VARCHAR(100);
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" ADD COLUMN IF NOT EXISTS "material_name" VARCHAR(200);
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" ADD COLUMN IF NOT EXISTS "batch_no" VARCHAR(100);
        ALTER TABLE "apps_kuaizhizao_after_sales_tickets" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(14,4);
        DROP TABLE IF EXISTS "apps_kuaizhizao_after_sales_ticket_items";
    """
