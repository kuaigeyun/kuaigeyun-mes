"""项目建议书对齐纸质模板字段（销售发起区 + 开发要求 + 供应商评审行）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaiplm_project_proposals"
    ADD COLUMN IF NOT EXISTS "product_lines" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "proposing_dept" VARCHAR(32),
    ADD COLUMN IF NOT EXISTS "proposer_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "proposed_at" DATE,
    ADD COLUMN IF NOT EXISTS "sample_date" DATE,
    ADD COLUMN IF NOT EXISTS "mass_production_date" DATE,
    ADD COLUMN IF NOT EXISTS "sample_quantity" VARCHAR(80),
    ADD COLUMN IF NOT EXISTS "customer_code" VARCHAR(80),
    ADD COLUMN IF NOT EXISTS "contact_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "contact_email" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "customer_product_model" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "customer_material_types" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "dev_req_types" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "company_product_model" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "cost_change_notes" TEXT,
    ADD COLUMN IF NOT EXISTS "supplier_assessment_lines" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "procurement_reviewer_name" VARCHAR(100);
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaiplm_project_proposals"
    DROP COLUMN IF EXISTS "procurement_reviewer_name",
    DROP COLUMN IF EXISTS "supplier_assessment_lines",
    DROP COLUMN IF EXISTS "cost_change_notes",
    DROP COLUMN IF EXISTS "company_product_model",
    DROP COLUMN IF EXISTS "dev_req_types",
    DROP COLUMN IF EXISTS "customer_material_types",
    DROP COLUMN IF EXISTS "customer_product_model",
    DROP COLUMN IF EXISTS "contact_email",
    DROP COLUMN IF EXISTS "contact_phone",
    DROP COLUMN IF EXISTS "contact_name",
    DROP COLUMN IF EXISTS "customer_code",
    DROP COLUMN IF EXISTS "sample_quantity",
    DROP COLUMN IF EXISTS "mass_production_date",
    DROP COLUMN IF EXISTS "sample_date",
    DROP COLUMN IF EXISTS "proposed_at",
    DROP COLUMN IF EXISTS "proposer_name",
    DROP COLUMN IF EXISTS "proposing_dept",
    DROP COLUMN IF EXISTS "product_lines";
"""
