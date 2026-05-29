from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_opportunities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "stage_code" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'open',
    "expected_amount" DECIMAL(18,2),
    "expected_close_date" DATE,
    "owner_id" INT,
    "quotation_id" INT,
    "quotation_code" VARCHAR(50),
    "sales_order_id" INT,
    "sales_order_code" VARCHAR(50),
    "last_follow_up_at" TIMESTAMPTZ,
    "next_follow_up_at" TIMESTAMPTZ,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_so_tenant_customer" ON "apps_kuaizhizao_sales_opportunities" ("tenant_id", "customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_so_tenant_status" ON "apps_kuaizhizao_sales_opportunities" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_so_tenant_stage" ON "apps_kuaizhizao_sales_opportunities" ("tenant_id", "stage_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_so_tenant_quotation" ON "apps_kuaizhizao_sales_opportunities" ("tenant_id", "quotation_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_so_tenant_sales_order" ON "apps_kuaizhizao_sales_opportunities" ("tenant_id", "sales_order_id");
COMMENT ON TABLE "apps_kuaizhizao_sales_opportunities" IS '快格轻制造 - 销售商机';

ALTER TABLE "apps_kuaizhizao_customer_follow_ups" ADD COLUMN IF NOT EXISTS "opportunity_id" INT;
ALTER TABLE "apps_kuaizhizao_customer_follow_ups" ADD COLUMN IF NOT EXISTS "stage_code_before" VARCHAR(50);
ALTER TABLE "apps_kuaizhizao_customer_follow_ups" ADD COLUMN IF NOT EXISTS "stage_code_after" VARCHAR(50);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cfu_tenant_opportunity" ON "apps_kuaizhizao_customer_follow_ups" ("tenant_id", "opportunity_id");
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."opportunity_id" IS '关联销售商机ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."stage_code_before" IS '跟进时商机阶段（变更前）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_follow_ups"."stage_code_after" IS '跟进后商机阶段（变更后）';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_customer_follow_ups" DROP COLUMN IF EXISTS "stage_code_after";
        ALTER TABLE "apps_kuaizhizao_customer_follow_ups" DROP COLUMN IF EXISTS "stage_code_before";
        ALTER TABLE "apps_kuaizhizao_customer_follow_ups" DROP COLUMN IF EXISTS "opportunity_id";
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_opportunities";
"""
