"""
质检方案编码改为软删除部分唯一索引

apps_kuaizhizao_inspection_plans 原先表级 UNIQUE(tenant_id, plan_code)，
与软删除语义冲突：删除后编码仍被占用，创建时业务预检放过、落库 IntegrityError → 500。

与主数据迁移 63 一致：仅未删除行唯一，允许软删后重用编码。

Author: RiverEdge Team
Date: 2026-08-17
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uid_apps_kuaizhizao_inspection_plans_tenant_plan_code'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_inspection_plans"
                DROP CONSTRAINT "uid_apps_kuaizhizao_inspection_plans_tenant_plan_code";
            END IF;
        END $$;

        DROP INDEX IF EXISTS "uid_apps_kuaizhizao_inspection_plans_tenant_plan_code";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_inspection_plans_tenant_plan_code_active";

        CREATE UNIQUE INDEX IF NOT EXISTS
            "idx_apps_kuaizhizao_inspection_plans_tenant_plan_code_active"
        ON "apps_kuaizhizao_inspection_plans" ("tenant_id", "plan_code")
        WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_inspection_plans_tenant_plan_code_active";

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uid_apps_kuaizhizao_inspection_plans_tenant_plan_code'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_inspection_plans"
                ADD CONSTRAINT "uid_apps_kuaizhizao_inspection_plans_tenant_plan_code"
                UNIQUE ("tenant_id", "plan_code");
            END IF;
        END $$;
    """
