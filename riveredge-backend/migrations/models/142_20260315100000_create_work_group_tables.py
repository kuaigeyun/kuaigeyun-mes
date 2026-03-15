"""
创建工作小组及成员表

为工厂数据新增工作小组主数据，用于将生产人员编制为小组并支持绩效权重。

Author: RiverEdge Team
Date: 2026-03-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建工作小组表、工作小组成员表
    """
    return """
        -- ============================================
        -- 创建工作小组表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_work_groups" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_work_groups_tenant_id" ON "apps_master_data_work_groups" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_work_groups_code" ON "apps_master_data_work_groups" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_work_groups_uuid" ON "apps_master_data_work_groups" ("uuid");

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_work_groups_tenant_code"
        ON "apps_master_data_work_groups" ("tenant_id", "code")
        WHERE "deleted_at" IS NULL;

        COMMENT ON TABLE "apps_master_data_work_groups" IS '工作小组模型 - 将生产人员编制为小组，支持绩效权重';
        COMMENT ON COLUMN "apps_master_data_work_groups"."code" IS '工作小组编码（组织内唯一）';
        COMMENT ON COLUMN "apps_master_data_work_groups"."name" IS '工作小组名称';

        -- ============================================
        -- 创建工作小组成员表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_work_group_members" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "work_group_id" INT NOT NULL REFERENCES "apps_master_data_work_groups" ("id") ON DELETE CASCADE,
            "employee_id" INT NOT NULL,
            "employee_name" VARCHAR(100),
            "performance_weight" DECIMAL(6,4) NOT NULL DEFAULT 1,
            "sort_order" INT NOT NULL DEFAULT 0,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_work_group_members_tenant_id" ON "apps_master_data_work_group_members" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_work_group_members_work_group_id" ON "apps_master_data_work_group_members" ("work_group_id");
        CREATE INDEX IF NOT EXISTS "idx_work_group_members_employee_id" ON "apps_master_data_work_group_members" ("employee_id");

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_work_group_members_work_group_employee"
        ON "apps_master_data_work_group_members" ("work_group_id", "employee_id")
        WHERE "deleted_at" IS NULL;

        COMMENT ON TABLE "apps_master_data_work_group_members" IS '工作小组成员 - 关联小组与员工，支持绩效权重';
        COMMENT ON COLUMN "apps_master_data_work_group_members"."performance_weight" IS '绩效权重（如 0.4 表示 40%）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除工作小组成员表、工作小组表
    """
    return """
        DROP INDEX IF EXISTS "idx_work_group_members_work_group_employee";
        DROP INDEX IF EXISTS "idx_work_group_members_employee_id";
        DROP INDEX IF EXISTS "idx_work_group_members_work_group_id";
        DROP INDEX IF EXISTS "idx_work_group_members_tenant_id";
        DROP TABLE IF EXISTS "apps_master_data_work_group_members";

        DROP INDEX IF EXISTS "idx_apps_master_data_work_groups_tenant_code";
        DROP INDEX IF EXISTS "idx_apps_master_data_work_groups_uuid";
        DROP INDEX IF EXISTS "idx_apps_master_data_work_groups_code";
        DROP INDEX IF EXISTS "idx_apps_master_data_work_groups_tenant_id";
        DROP TABLE IF EXISTS "apps_master_data_work_groups";
    """
