"""
创建质检方案及步骤表

包含：
1. apps_kuaizhizao_inspection_plans - 质检方案表
2. apps_kuaizhizao_inspection_plan_steps - 质检方案步骤表

Author: RiverEdge Team
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建质检方案表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inspection_plans" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "plan_code" VARCHAR(50) NOT NULL,
            "plan_name" VARCHAR(200) NOT NULL,
            "plan_type" VARCHAR(50) NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "operation_id" INT,
            "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizhizao_inspection_plans_tenant_plan_code" UNIQUE ("tenant_id", "plan_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plans_tenant_id" ON "apps_kuaizhizao_inspection_plans" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plans_plan_code" ON "apps_kuaizhizao_inspection_plans" ("plan_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plans_plan_type" ON "apps_kuaizhizao_inspection_plans" ("plan_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plans_material_id" ON "apps_kuaizhizao_inspection_plans" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plans_is_active" ON "apps_kuaizhizao_inspection_plans" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plans_created_at" ON "apps_kuaizhizao_inspection_plans" ("created_at");
        COMMENT ON TABLE "apps_kuaizhizao_inspection_plans" IS '快格轻制造 - 质检方案';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."plan_code" IS '方案编码（组织内唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."plan_name" IS '方案名称';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."plan_type" IS '类型（incoming/process/finished）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."material_id" IS '适用物料ID（可选）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."material_code" IS '物料编码（冗余）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."material_name" IS '物料名称（冗余）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."operation_id" IS '适用工序ID（过程检验时）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."version" IS '版本号';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."is_active" IS '是否启用';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."remarks" IS '备注';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."deleted_at" IS '删除时间（软删除）';

        -- ============================================
        -- 2. 创建质检方案步骤表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inspection_plan_steps" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "plan_id" INT NOT NULL REFERENCES "apps_kuaizhizao_inspection_plans"("id") ON DELETE CASCADE,
            "sequence" INT NOT NULL DEFAULT 0,
            "inspection_item" VARCHAR(200) NOT NULL,
            "inspection_method" VARCHAR(200),
            "acceptance_criteria" TEXT,
            "sampling_type" VARCHAR(20) NOT NULL DEFAULT 'full',
            "quality_standard_id" INT,
            "remarks" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plan_steps_plan_id" ON "apps_kuaizhizao_inspection_plan_steps" ("plan_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_inspection_plan_steps_sequence" ON "apps_kuaizhizao_inspection_plan_steps" ("sequence");
        COMMENT ON TABLE "apps_kuaizhizao_inspection_plan_steps" IS '快格轻制造 - 质检方案步骤';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."plan_id" IS '关联质检方案ID';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."sequence" IS '步骤序号';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."inspection_item" IS '检验项目名称';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."inspection_method" IS '检验方法';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."acceptance_criteria" IS '合格标准';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."sampling_type" IS '抽样方式（full/sampling）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."quality_standard_id" IS '引用的质检标准ID（可选）';
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."remarks" IS '备注';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_inspection_plan_steps";
        DROP TABLE IF EXISTS "apps_kuaizhizao_inspection_plans";
    """
