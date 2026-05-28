"""
创建销售/采购变更单表及编码规则

Author: AI Assistant
Date: 2026-05-28
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


def _rule_components(prefix: str) -> str:
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
        '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
        '"reset_cycle":"daily","initial_value":1}]'
    )


async def upgrade(db: BaseDBAsyncClient) -> str:
    soc = _rule_components("SOC").replace("'", "''")
    poc = _rule_components("POC").replace("'", "''")
    return f"""
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_order_change_orders" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "change_code" VARCHAR(50) NOT NULL UNIQUE,
            "source_order_id" INT NOT NULL,
            "source_order_code" VARCHAR(50) NOT NULL,
            "change_version" INT NOT NULL DEFAULT 1,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "change_reason" TEXT NOT NULL,
            "change_category" VARCHAR(30) NOT NULL DEFAULT 'MIXED',
            "effective_date" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            "review_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "before_total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "after_total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "before_total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "after_total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "delta_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "applied_at" TIMESTAMPTZ,
            "applied_by" INT,
            "header_changes" JSONB,
            "attachments" JSONB,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_soc_change_tenant" ON "apps_kuaizhizao_sales_order_change_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_soc_change_source" ON "apps_kuaizhizao_sales_order_change_orders" ("source_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_order_change_items" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "change_order_id" INT NOT NULL REFERENCES "apps_kuaizhizao_sales_order_change_orders"("id") ON DELETE CASCADE,
            "line_no" INT NOT NULL DEFAULT 1,
            "source_item_id" INT,
            "change_type" VARCHAR(30) NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20),
            "before_quantity" DECIMAL(12,2),
            "after_quantity" DECIMAL(12,2),
            "before_unit_price" DECIMAL(12,4),
            "after_unit_price" DECIMAL(12,4),
            "before_delivery_date" DATE,
            "after_delivery_date" DATE,
            "before_amount" DECIMAL(14,2),
            "after_amount" DECIMAL(14,2),
            "delta_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_soc_change_item_order" ON "apps_kuaizhizao_sales_order_change_items" ("change_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_order_change_orders" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "change_code" VARCHAR(50) NOT NULL UNIQUE,
            "source_order_id" INT NOT NULL,
            "source_order_code" VARCHAR(50) NOT NULL,
            "change_version" INT NOT NULL DEFAULT 1,
            "supplier_id" INT NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "change_reason" TEXT NOT NULL,
            "change_category" VARCHAR(30) NOT NULL DEFAULT 'MIXED',
            "effective_date" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            "review_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "before_total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "after_total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "before_total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "after_total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "delta_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "applied_at" TIMESTAMPTZ,
            "applied_by" INT,
            "header_changes" JSONB,
            "attachments" JSONB,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_poc_change_tenant" ON "apps_kuaizhizao_purchase_order_change_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_poc_change_source" ON "apps_kuaizhizao_purchase_order_change_orders" ("source_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_order_change_items" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "change_order_id" INT NOT NULL REFERENCES "apps_kuaizhizao_purchase_order_change_orders"("id") ON DELETE CASCADE,
            "line_no" INT NOT NULL DEFAULT 1,
            "source_item_id" INT,
            "change_type" VARCHAR(30) NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20),
            "before_quantity" DECIMAL(12,2),
            "after_quantity" DECIMAL(12,2),
            "before_unit_price" DECIMAL(12,4),
            "after_unit_price" DECIMAL(12,4),
            "before_delivery_date" DATE,
            "after_delivery_date" DATE,
            "before_amount" DECIMAL(14,2),
            "after_amount" DECIMAL(14,2),
            "delta_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_poc_change_item_order" ON "apps_kuaizhizao_purchase_order_change_items" ("change_order_id");

        INSERT INTO "core_code_rules" (
            "uuid", "tenant_id", "name", "code", "rule_components", "description",
            "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
            "allow_manual_edit", "created_at", "updated_at"
        )
        SELECT gen_random_uuid()::text, t."tenant_id", '销售变更单编码', 'SALES_ORDER_CHANGE_CODE',
            '{soc}'::jsonb, '销售变更单 SOC+日期+序号', 1, 1, 'daily', TRUE, TRUE, TRUE, NOW(), NOW()
        FROM (SELECT DISTINCT "tenant_id" FROM "core_code_rules" WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL) t
        WHERE NOT EXISTS (
            SELECT 1 FROM "core_code_rules" r WHERE r."tenant_id"=t."tenant_id" AND r."code"='SALES_ORDER_CHANGE_CODE' AND r."deleted_at" IS NULL
        );

        INSERT INTO "core_code_rules" (
            "uuid", "tenant_id", "name", "code", "rule_components", "description",
            "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
            "allow_manual_edit", "created_at", "updated_at"
        )
        SELECT gen_random_uuid()::text, t."tenant_id", '采购变更单编码', 'PURCHASE_ORDER_CHANGE_CODE',
            '{poc}'::jsonb, '采购变更单 POC+日期+序号', 1, 1, 'daily', TRUE, TRUE, TRUE, NOW(), NOW()
        FROM (SELECT DISTINCT "tenant_id" FROM "core_code_rules" WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL) t
        WHERE NOT EXISTS (
            SELECT 1 FROM "core_code_rules" r WHERE r."tenant_id"=t."tenant_id" AND r."code"='PURCHASE_ORDER_CHANGE_CODE' AND r."deleted_at" IS NULL
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_order_change_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_order_change_orders";
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_order_change_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_order_change_orders";
    """
