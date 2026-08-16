"""
订单评审单表 + 编码规则 SALES_REVIEW_CODE。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "SALES_REVIEW_CODE"
_RULE_NAME = "订单评审编码规则"
_PREFIX = "SR"
_DESCRIPTION = "订单评审编码规则，格式：SR + 日期（YYYYMMDD）+ 4位序号，每日重置"


def _rule_components_json(prefix: str) -> str:
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
        '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
        '"reset_cycle":"daily","initial_value":1}]'
    )


async def upgrade(db: BaseDBAsyncClient) -> str:
    components = _rule_components_json(_PREFIX).replace("'", "''")
    desc = _DESCRIPTION.replace("'", "''")
    rule_name = _RULE_NAME.replace("'", "''")
    return f"""
CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_reviews" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "review_code" VARCHAR(120) NOT NULL,
    "customer_id" INT NOT NULL,
    "customer_code" VARCHAR(50),
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_contact" VARCHAR(100),
    "customer_phone" VARCHAR(50),
    "project_name" VARCHAR(200) NOT NULL,
    "review_date" DATE,
    "delivery_date" DATE,
    "urgency" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "risk_level" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "settlement_method" VARCHAR(100),
    "payment_cycle" VARCHAR(100),
    "delivery_location" VARCHAR(200),
    "transport_method" VARCHAR(100),
    "material_desc" TEXT,
    "spec_desc" TEXT,
    "process_desc" TEXT,
    "packaging_req" TEXT,
    "production_notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "review_round" INT NOT NULL DEFAULT 0,
    "sales_opinion" TEXT,
    "final_conclusion" TEXT,
    "remarks" TEXT,
    "attachments" JSONB,
    "quotation_id" INT,
    "quotation_code" VARCHAR(120),
    "customer_follow_up_id" INT,
    "sales_order_id" INT,
    "sales_order_code" VARCHAR(50),
    "salesman_id" INT,
    "salesman_name" VARCHAR(100),
    "total_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS "idx_sales_reviews_tenant" ON "apps_kuaizhizao_sales_reviews" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_sales_reviews_code" ON "apps_kuaizhizao_sales_reviews" ("review_code");
CREATE INDEX IF NOT EXISTS "idx_sales_reviews_customer" ON "apps_kuaizhizao_sales_reviews" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_sales_reviews_status" ON "apps_kuaizhizao_sales_reviews" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_sales_reviews_tenant_code_active"
    ON "apps_kuaizhizao_sales_reviews" ("tenant_id", "review_code")
    WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_review_items" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "sales_review_id" INT NOT NULL,
    "line_no" INT NOT NULL DEFAULT 1,
    "material_id" INT,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_spec" VARCHAR(200),
    "material_unit" VARCHAR(20),
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_price" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tech_requirements" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS "idx_sales_review_items_review"
    ON "apps_kuaizhizao_sales_review_items" ("tenant_id", "sales_review_id");

CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_review_dept_opinions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "sales_review_id" INT NOT NULL,
    "review_round" INT NOT NULL,
    "dept_code" VARCHAR(32) NOT NULL,
    "result" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "opinion" TEXT,
    "reviewed_by" INT,
    "reviewed_by_name" VARCHAR(100),
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    CONSTRAINT "uidx_sales_review_dept_opinion_round"
        UNIQUE ("tenant_id", "sales_review_id", "dept_code", "review_round")
);
CREATE INDEX IF NOT EXISTS "idx_sales_review_dept_opinions_review"
    ON "apps_kuaizhizao_sales_review_dept_opinions" ("tenant_id", "sales_review_id", "review_round");

-- 编码规则：按租户补建
INSERT INTO "core_code_rules" (
    "uuid", "tenant_id", "name", "code", "rule_components", "description",
    "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
    "allow_manual_edit", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    t."tenant_id",
    '{rule_name}',
    '{_RULE_CODE}',
    '{components}'::jsonb,
    '{desc}',
    1, 1, 'daily', TRUE, TRUE, TRUE, NOW(), NOW()
FROM (
    SELECT DISTINCT "tenant_id"
    FROM "core_code_rules"
    WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL
) t
WHERE NOT EXISTS (
    SELECT 1 FROM "core_code_rules" r
    WHERE r."tenant_id" = t."tenant_id"
      AND r."code" = '{_RULE_CODE}'
      AND r."deleted_at" IS NULL
);
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaizhizao_sales_review_dept_opinions";
DROP TABLE IF EXISTS "apps_kuaizhizao_sales_review_items";
DROP TABLE IF EXISTS "apps_kuaizhizao_sales_reviews";
"""
