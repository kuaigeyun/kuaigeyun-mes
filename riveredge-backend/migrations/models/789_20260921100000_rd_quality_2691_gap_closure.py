"""26.9.1 研发质量缺口：交付物料号、试流工序字段、投诉双时效、评价预警天数。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_project_deliverables"
            ADD COLUMN IF NOT EXISTS "material_code" VARCHAR(80),
            ADD COLUMN IF NOT EXISTS "legacy_material_code" VARCHAR(80);
        COMMENT ON COLUMN "apps_kuaiplm_rd_project_deliverables"."material_code"
            IS '关联料号（测试报告/部品规格书等写路径真源）';
        COMMENT ON COLUMN "apps_kuaiplm_rd_project_deliverables"."legacy_material_code"
            IS '沿用旧料号（料号变更时显式关联，禁止读侧猜测）';

        ALTER TABLE "apps_kuaiplm_rd_project_deliverable_versions"
            ADD COLUMN IF NOT EXISTS "material_code" VARCHAR(80),
            ADD COLUMN IF NOT EXISTS "legacy_material_code" VARCHAR(80);

        ALTER TABLE "apps_kuaiplm_trial_flow_steps"
            ADD COLUMN IF NOT EXISTS "step_description" TEXT,
            ADD COLUMN IF NOT EXISTS "defect_rate" DECIMAL(8,4);
        COMMENT ON COLUMN "apps_kuaiplm_trial_flow_steps"."step_description"
            IS '工序描述（整机试流等填报）';
        COMMENT ON COLUMN "apps_kuaiplm_trial_flow_steps"."defect_rate"
            IS '不良率（整机试流等填报，0-100）';

        ALTER TABLE "apps_kuaizhizao_quality_complaints"
            ADD COLUMN IF NOT EXISTS "containment_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "corrective_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "corrective_sla_workdays" INT;
        COMMENT ON COLUMN "apps_kuaizhizao_quality_complaints"."containment_due_at"
            IS '围堵时效截止（客诉：提交日站点 17:00）';
        COMMENT ON COLUMN "apps_kuaizhizao_quality_complaints"."corrective_due_at"
            IS '纠正措施时效截止（客诉：工作日推算）';

        ALTER TABLE "apps_kuaizhizao_supplier_eval_plans"
            ADD COLUMN IF NOT EXISTS "reminder_lead_days" INT NOT NULL DEFAULT 7;
        COMMENT ON COLUMN "apps_kuaizhizao_supplier_eval_plans"."reminder_lead_days"
            IS '评价截止前提醒提前天数（租户计划级可配）';

        ALTER TABLE "apps_kuaizhizao_supplier_eval_env_docs"
            ADD COLUMN IF NOT EXISTS "reminder_lead_days" INT;
        COMMENT ON COLUMN "apps_kuaizhizao_supplier_eval_env_docs"."reminder_lead_days"
            IS '到期前提醒提前天数；空则默认 30';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_project_deliverables"
            DROP COLUMN IF EXISTS "material_code",
            DROP COLUMN IF EXISTS "legacy_material_code";
        ALTER TABLE "apps_kuaiplm_rd_project_deliverable_versions"
            DROP COLUMN IF EXISTS "material_code",
            DROP COLUMN IF EXISTS "legacy_material_code";
        ALTER TABLE "apps_kuaiplm_trial_flow_steps"
            DROP COLUMN IF EXISTS "step_description",
            DROP COLUMN IF EXISTS "defect_rate";
        ALTER TABLE "apps_kuaizhizao_quality_complaints"
            DROP COLUMN IF EXISTS "containment_due_at",
            DROP COLUMN IF EXISTS "corrective_due_at",
            DROP COLUMN IF EXISTS "corrective_sla_workdays";
        ALTER TABLE "apps_kuaizhizao_supplier_eval_plans"
            DROP COLUMN IF EXISTS "reminder_lead_days";
        ALTER TABLE "apps_kuaizhizao_supplier_eval_env_docs"
            DROP COLUMN IF EXISTS "reminder_lead_days";
    """
