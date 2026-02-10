"""
创建维护保养计划表

根据设备管理功能需求，创建维护保养计划相关表。

包含：
1. core_maintenance_plans - 维护保养计划表
2. core_maintenance_executions - 维护执行记录表

Author: Auto (AI Assistant)
Date: 2026-01-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建维护保养计划表
    """
    return """
        -- ============================================
        -- 1. 创建维护保养计划表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_maintenance_plans" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "plan_no" VARCHAR(100) NOT NULL,
            "plan_name" VARCHAR(200) NOT NULL,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "plan_type" VARCHAR(50) NOT NULL,
            "maintenance_type" VARCHAR(50) NOT NULL,
            "cycle_type" VARCHAR(50) NOT NULL,
            "cycle_value" INT,
            "cycle_unit" VARCHAR(20),
            "planned_start_date" TIMESTAMPTZ,
            "planned_end_date" TIMESTAMPTZ,
            "responsible_person_id" INT,
            "responsible_person_name" VARCHAR(100),
            "status" VARCHAR(50) NOT NULL DEFAULT '草稿',
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_maintenance_plans_tenant_plan_no" UNIQUE ("tenant_id", "plan_no")
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_plans_tenant_id" ON "core_maintenance_plans" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_plans_plan_no" ON "core_maintenance_plans" ("plan_no");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_plans_equipment_id" ON "core_maintenance_plans" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_plans_equipment_uuid" ON "core_maintenance_plans" ("equipment_uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_plans_status" ON "core_maintenance_plans" ("status");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_plans_planned_start_date" ON "core_maintenance_plans" ("planned_start_date");

        -- 添加表注释和字段注释
        COMMENT ON TABLE "core_maintenance_plans" IS '维护保养计划表，用于管理设备维护保养计划，支持多组织隔离';
        COMMENT ON COLUMN "core_maintenance_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_maintenance_plans"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_maintenance_plans"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_maintenance_plans"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_maintenance_plans"."id" IS '主键ID';
        COMMENT ON COLUMN "core_maintenance_plans"."plan_no" IS '维护计划编号（组织内唯一）';
        COMMENT ON COLUMN "core_maintenance_plans"."plan_name" IS '计划名称';
        COMMENT ON COLUMN "core_maintenance_plans"."equipment_id" IS '设备ID（关联设备）';
        COMMENT ON COLUMN "core_maintenance_plans"."equipment_uuid" IS '设备UUID';
        COMMENT ON COLUMN "core_maintenance_plans"."equipment_name" IS '设备名称';
        COMMENT ON COLUMN "core_maintenance_plans"."plan_type" IS '计划类型（预防性维护、定期维护、临时维护）';
        COMMENT ON COLUMN "core_maintenance_plans"."maintenance_type" IS '维护类型（日常保养、小修、中修、大修）';
        COMMENT ON COLUMN "core_maintenance_plans"."cycle_type" IS '周期类型（按时间、按运行时长、按使用次数）';
        COMMENT ON COLUMN "core_maintenance_plans"."cycle_value" IS '周期值';
        COMMENT ON COLUMN "core_maintenance_plans"."cycle_unit" IS '周期单位（天、小时、次）';
        COMMENT ON COLUMN "core_maintenance_plans"."planned_start_date" IS '计划开始日期';
        COMMENT ON COLUMN "core_maintenance_plans"."planned_end_date" IS '计划结束日期';
        COMMENT ON COLUMN "core_maintenance_plans"."responsible_person_id" IS '负责人ID（用户ID）';
        COMMENT ON COLUMN "core_maintenance_plans"."responsible_person_name" IS '负责人姓名';
        COMMENT ON COLUMN "core_maintenance_plans"."status" IS '计划状态（草稿、已发布、执行中、已完成、已取消）';
        COMMENT ON COLUMN "core_maintenance_plans"."remark" IS '备注';
        COMMENT ON COLUMN "core_maintenance_plans"."deleted_at" IS '删除时间（软删除）';

        -- ============================================
        -- 2. 创建维护执行记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_maintenance_executions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "execution_no" VARCHAR(100) NOT NULL,
            "maintenance_plan_id" INT,
            "maintenance_plan_uuid" VARCHAR(36),
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "execution_date" TIMESTAMPTZ NOT NULL,
            "executor_id" INT,
            "executor_name" VARCHAR(100),
            "execution_content" TEXT,
            "execution_result" VARCHAR(50),
            "maintenance_cost" DECIMAL(10, 2),
            "spare_parts_used" JSONB,
            "status" VARCHAR(50) NOT NULL DEFAULT '草稿',
            "acceptance_person_id" INT,
            "acceptance_person_name" VARCHAR(100),
            "acceptance_date" TIMESTAMPTZ,
            "acceptance_result" VARCHAR(50),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_maintenance_executions_tenant_execution_no" UNIQUE ("tenant_id", "execution_no")
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_executions_tenant_id" ON "core_maintenance_executions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_executions_execution_no" ON "core_maintenance_executions" ("execution_no");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_executions_maintenance_plan_id" ON "core_maintenance_executions" ("maintenance_plan_id");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_executions_equipment_id" ON "core_maintenance_executions" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_executions_execution_date" ON "core_maintenance_executions" ("execution_date");
        CREATE INDEX IF NOT EXISTS "idx_core_maintenance_executions_status" ON "core_maintenance_executions" ("status");

        -- 添加表注释和字段注释
        COMMENT ON TABLE "core_maintenance_executions" IS '维护执行记录表，用于管理设备维护执行记录，支持多组织隔离';
        COMMENT ON COLUMN "core_maintenance_executions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_maintenance_executions"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_maintenance_executions"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_maintenance_executions"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_maintenance_executions"."id" IS '主键ID';
        COMMENT ON COLUMN "core_maintenance_executions"."execution_no" IS '执行记录编号（组织内唯一）';
        COMMENT ON COLUMN "core_maintenance_executions"."maintenance_plan_id" IS '维护计划ID（关联维护计划）';
        COMMENT ON COLUMN "core_maintenance_executions"."maintenance_plan_uuid" IS '维护计划UUID';
        COMMENT ON COLUMN "core_maintenance_executions"."equipment_id" IS '设备ID（关联设备）';
        COMMENT ON COLUMN "core_maintenance_executions"."equipment_uuid" IS '设备UUID';
        COMMENT ON COLUMN "core_maintenance_executions"."equipment_name" IS '设备名称';
        COMMENT ON COLUMN "core_maintenance_executions"."execution_date" IS '执行日期';
        COMMENT ON COLUMN "core_maintenance_executions"."executor_id" IS '执行人员ID（用户ID）';
        COMMENT ON COLUMN "core_maintenance_executions"."executor_name" IS '执行人员姓名';
        COMMENT ON COLUMN "core_maintenance_executions"."execution_content" IS '执行内容';
        COMMENT ON COLUMN "core_maintenance_executions"."execution_result" IS '执行结果（正常、异常、待处理）';
        COMMENT ON COLUMN "core_maintenance_executions"."maintenance_cost" IS '维护成本';
        COMMENT ON COLUMN "core_maintenance_executions"."spare_parts_used" IS '使用备件（JSON格式）';
        COMMENT ON COLUMN "core_maintenance_executions"."status" IS '记录状态（草稿、已确认、已验收）';
        COMMENT ON COLUMN "core_maintenance_executions"."acceptance_person_id" IS '验收人员ID（用户ID）';
        COMMENT ON COLUMN "core_maintenance_executions"."acceptance_person_name" IS '验收人员姓名';
        COMMENT ON COLUMN "core_maintenance_executions"."acceptance_date" IS '验收日期';
        COMMENT ON COLUMN "core_maintenance_executions"."acceptance_result" IS '验收结果（合格、不合格）';
        COMMENT ON COLUMN "core_maintenance_executions"."remark" IS '备注';
        COMMENT ON COLUMN "core_maintenance_executions"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除维护保养计划表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_core_maintenance_executions_status";
        DROP INDEX IF EXISTS "idx_core_maintenance_executions_execution_date";
        DROP INDEX IF EXISTS "idx_core_maintenance_executions_equipment_id";
        DROP INDEX IF EXISTS "idx_core_maintenance_executions_maintenance_plan_id";
        DROP INDEX IF EXISTS "idx_core_maintenance_executions_execution_no";
        DROP INDEX IF EXISTS "idx_core_maintenance_executions_tenant_id";

        DROP INDEX IF EXISTS "idx_core_maintenance_plans_planned_start_date";
        DROP INDEX IF EXISTS "idx_core_maintenance_plans_status";
        DROP INDEX IF EXISTS "idx_core_maintenance_plans_equipment_uuid";
        DROP INDEX IF EXISTS "idx_core_maintenance_plans_equipment_id";
        DROP INDEX IF EXISTS "idx_core_maintenance_plans_plan_no";
        DROP INDEX IF EXISTS "idx_core_maintenance_plans_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "core_maintenance_executions";
        DROP TABLE IF EXISTS "core_maintenance_plans";
    """
