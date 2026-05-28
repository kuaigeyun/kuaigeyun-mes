"""
创建采购询价单相关表及编码规则

Author: RiverEdge Team
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
    cgxj = _rule_components("CGXJ").replace("'", "''")
    return f"""
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_inquiries" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "inquiry_code" VARCHAR(50) NOT NULL,
            "inquiry_name" VARCHAR(200),
            "inquiry_date" DATE,
            "quote_deadline" DATE,
            "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            "buyer_id" INT,
            "buyer_name" VARCHAR(100),
            "source_type" VARCHAR(50),
            "source_id" INT,
            "source_code" VARCHAR(50),
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            "review_remarks" TEXT,
            "total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_pi_tenant" ON "apps_kuaizhizao_purchase_inquiries" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_pi_code" ON "apps_kuaizhizao_purchase_inquiries" ("inquiry_code");
        CREATE INDEX IF NOT EXISTS "idx_pi_status" ON "apps_kuaizhizao_purchase_inquiries" ("status");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_pi_tenant_code_active"
            ON "apps_kuaizhizao_purchase_inquiries" ("tenant_id", "inquiry_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_inquiry_items" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "inquiry_id" INT NOT NULL REFERENCES "apps_kuaizhizao_purchase_inquiries"("id") ON DELETE CASCADE,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "unit" VARCHAR(20) NOT NULL DEFAULT '件',
            "quantity" DECIMAL(12,2) NOT NULL,
            "required_date" DATE,
            "source_requisition_item_id" INT,
            "awarded_supplier_id" INT,
            "awarded_quote_item_id" INT,
            "purchase_order_id" INT,
            "purchase_order_item_id" INT,
            "notes" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_pii_inquiry" ON "apps_kuaizhizao_purchase_inquiry_items" ("inquiry_id");
        CREATE INDEX IF NOT EXISTS "idx_pii_req_item" ON "apps_kuaizhizao_purchase_inquiry_items" ("source_requisition_item_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_inquiry_vendors" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "inquiry_id" INT NOT NULL REFERENCES "apps_kuaizhizao_purchase_inquiries"("id") ON DELETE CASCADE,
            "supplier_id" INT NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "status" VARCHAR(30) NOT NULL DEFAULT 'INVITED',
            "portal_token" VARCHAR(64),
            "portal_expires_at" TIMESTAMPTZ,
            "quoted_at" TIMESTAMPTZ,
            "notes" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE ("tenant_id", "inquiry_id", "supplier_id")
        );
        CREATE INDEX IF NOT EXISTS "idx_piv_inquiry" ON "apps_kuaizhizao_purchase_inquiry_vendors" ("inquiry_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_supplier_quotes" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "inquiry_id" INT NOT NULL REFERENCES "apps_kuaizhizao_purchase_inquiries"("id") ON DELETE CASCADE,
            "supplier_id" INT NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "quote_code" VARCHAR(50),
            "quote_date" DATE,
            "valid_until" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            "submission_channel" VARCHAR(20) NOT NULL DEFAULT 'internal',
            "entered_by" INT,
            "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_psq_inquiry" ON "apps_kuaizhizao_purchase_supplier_quotes" ("inquiry_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_supplier_quote_items" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "quote_id" INT NOT NULL REFERENCES "apps_kuaizhizao_purchase_supplier_quotes"("id") ON DELETE CASCADE,
            "inquiry_item_id" INT NOT NULL,
            "quoted_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "unit_price" DECIMAL(12,4) NOT NULL DEFAULT 0,
            "delivery_date" DATE,
            "lead_time_days" INT,
            "is_awarded" BOOLEAN NOT NULL DEFAULT FALSE,
            "notes" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_psqi_quote" ON "apps_kuaizhizao_purchase_supplier_quote_items" ("quote_id");
        CREATE INDEX IF NOT EXISTS "idx_psqi_inquiry_item" ON "apps_kuaizhizao_purchase_supplier_quote_items" ("inquiry_item_id");

        INSERT INTO "core_code_rules" (
            "uuid", "tenant_id", "name", "code", "rule_components", "description",
            "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
            "allow_manual_edit", "created_at", "updated_at"
        )
        SELECT gen_random_uuid()::text, t."tenant_id", '采购询价单编码', 'PURCHASE_INQUIRY_CODE',
            '{cgxj}'::jsonb, '采购询价单 CGXJ+日期+序号', 1, 1, 'daily', TRUE, TRUE, TRUE, NOW(), NOW()
        FROM (SELECT DISTINCT "tenant_id" FROM "core_code_rules" WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL) t
        WHERE NOT EXISTS (
            SELECT 1 FROM "core_code_rules" r WHERE r."tenant_id"=t."tenant_id" AND r."code"='PURCHASE_INQUIRY_CODE' AND r."deleted_at" IS NULL
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_supplier_quote_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_supplier_quotes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_inquiry_vendors";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_inquiry_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_inquiries";
    """
