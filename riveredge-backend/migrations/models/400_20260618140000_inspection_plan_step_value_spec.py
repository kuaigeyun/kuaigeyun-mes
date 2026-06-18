"""
质检方案步骤：step_key、value_type、value_spec
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_inspection_plan_steps"
            ADD COLUMN IF NOT EXISTS "step_key" VARCHAR(36) NULL;
        ALTER TABLE "apps_kuaizhizao_inspection_plan_steps"
            ADD COLUMN IF NOT EXISTS "value_type" VARCHAR(20) NOT NULL DEFAULT 'boolean';
        ALTER TABLE "apps_kuaizhizao_inspection_plan_steps"
            ADD COLUMN IF NOT EXISTS "value_spec" JSONB NULL;

        UPDATE "apps_kuaizhizao_inspection_plan_steps"
        SET "step_key" = gen_random_uuid()::text
        WHERE "step_key" IS NULL;

        UPDATE "apps_kuaizhizao_inspection_plan_steps"
        SET "value_spec" = '{"required": true, "pass_when": true}'::jsonb
        WHERE "value_spec" IS NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."step_key"
            IS '步骤稳定标识（检验单快照引用）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."value_type"
            IS '值类型：boolean/single_select/multi_select/text/numeric';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."value_spec"
            IS '类型规格 JSON';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_inspection_plan_steps"
            DROP COLUMN IF EXISTS "value_spec";
        ALTER TABLE "apps_kuaizhizao_inspection_plan_steps"
            DROP COLUMN IF EXISTS "value_type";
        ALTER TABLE "apps_kuaizhizao_inspection_plan_steps"
            DROP COLUMN IF EXISTS "step_key";
    """
