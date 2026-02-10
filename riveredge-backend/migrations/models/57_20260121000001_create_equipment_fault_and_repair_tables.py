"""
创建设备故障和维修记录表

根据设备管理功能需求，创建设备故障和维修记录相关表。

包含：
1. core_equipment_faults - 设备故障记录表
2. core_equipment_repairs - 设备维修记录表

Author: Auto (AI Assistant)
Date: 2026-01-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建设备故障和维修记录表
    """
    return """
        -- ============================================
        -- 1. 创建设备故障记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_equipment_faults" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "fault_no" VARCHAR(100) NOT NULL,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "fault_date" TIMESTAMPTZ NOT NULL,
            "fault_type" VARCHAR(50) NOT NULL,
            "fault_description" TEXT NOT NULL,
            "fault_level" VARCHAR(50) NOT NULL,
            "reporter_id" INT,
            "reporter_name" VARCHAR(100),
            "status" VARCHAR(50) NOT NULL DEFAULT '待处理',
            "repair_required" BOOLEAN NOT NULL DEFAULT TRUE,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_equipment_faults_tenant_fault_no" UNIQUE ("tenant_id", "fault_no")
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_faults_tenant_id" ON "core_equipment_faults" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_faults_fault_no" ON "core_equipment_faults" ("fault_no");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_faults_equipment_id" ON "core_equipment_faults" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_faults_equipment_uuid" ON "core_equipment_faults" ("equipment_uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_faults_fault_date" ON "core_equipment_faults" ("fault_date");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_faults_status" ON "core_equipment_faults" ("status");

        -- 添加表注释和字段注释
        COMMENT ON TABLE "core_equipment_faults" IS '设备故障记录表，用于管理设备故障记录，支持多组织隔离';
        COMMENT ON COLUMN "core_equipment_faults"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_equipment_faults"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_equipment_faults"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_equipment_faults"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_equipment_faults"."id" IS '主键ID';
        COMMENT ON COLUMN "core_equipment_faults"."fault_no" IS '故障记录编号（组织内唯一）';
        COMMENT ON COLUMN "core_equipment_faults"."equipment_id" IS '设备ID（关联设备）';
        COMMENT ON COLUMN "core_equipment_faults"."equipment_uuid" IS '设备UUID';
        COMMENT ON COLUMN "core_equipment_faults"."equipment_name" IS '设备名称';
        COMMENT ON COLUMN "core_equipment_faults"."fault_date" IS '故障发生日期';
        COMMENT ON COLUMN "core_equipment_faults"."fault_type" IS '故障类型（机械故障、电气故障、软件故障、其他）';
        COMMENT ON COLUMN "core_equipment_faults"."fault_description" IS '故障描述';
        COMMENT ON COLUMN "core_equipment_faults"."fault_level" IS '故障级别（轻微、一般、严重、紧急）';
        COMMENT ON COLUMN "core_equipment_faults"."reporter_id" IS '报告人ID（用户ID）';
        COMMENT ON COLUMN "core_equipment_faults"."reporter_name" IS '报告人姓名';
        COMMENT ON COLUMN "core_equipment_faults"."status" IS '故障状态（待处理、处理中、已修复、已关闭）';
        COMMENT ON COLUMN "core_equipment_faults"."repair_required" IS '是否需要维修';
        COMMENT ON COLUMN "core_equipment_faults"."remark" IS '备注';
        COMMENT ON COLUMN "core_equipment_faults"."deleted_at" IS '删除时间（软删除）';

        -- ============================================
        -- 2. 创建设备维修记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_equipment_repairs" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "repair_no" VARCHAR(100) NOT NULL,
            "equipment_fault_id" INT,
            "equipment_fault_uuid" VARCHAR(36),
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "repair_date" TIMESTAMPTZ NOT NULL,
            "repair_type" VARCHAR(50) NOT NULL,
            "repair_description" TEXT NOT NULL,
            "repair_cost" DECIMAL(10, 2),
            "repair_parts" JSONB,
            "repairer_id" INT,
            "repairer_name" VARCHAR(100),
            "repair_duration" DECIMAL(10, 2),
            "status" VARCHAR(50) NOT NULL DEFAULT '进行中',
            "repair_result" VARCHAR(50),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_equipment_repairs_tenant_repair_no" UNIQUE ("tenant_id", "repair_no")
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_repairs_tenant_id" ON "core_equipment_repairs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_repairs_repair_no" ON "core_equipment_repairs" ("repair_no");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_repairs_equipment_fault_id" ON "core_equipment_repairs" ("equipment_fault_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_repairs_equipment_id" ON "core_equipment_repairs" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_repairs_repair_date" ON "core_equipment_repairs" ("repair_date");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_repairs_status" ON "core_equipment_repairs" ("status");

        -- 添加表注释和字段注释
        COMMENT ON TABLE "core_equipment_repairs" IS '设备维修记录表，用于管理设备维修记录，支持多组织隔离';
        COMMENT ON COLUMN "core_equipment_repairs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_equipment_repairs"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_equipment_repairs"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_equipment_repairs"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_equipment_repairs"."id" IS '主键ID';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_no" IS '维修记录编号（组织内唯一）';
        COMMENT ON COLUMN "core_equipment_repairs"."equipment_fault_id" IS '设备故障ID（关联故障记录）';
        COMMENT ON COLUMN "core_equipment_repairs"."equipment_fault_uuid" IS '设备故障UUID';
        COMMENT ON COLUMN "core_equipment_repairs"."equipment_id" IS '设备ID（关联设备）';
        COMMENT ON COLUMN "core_equipment_repairs"."equipment_uuid" IS '设备UUID';
        COMMENT ON COLUMN "core_equipment_repairs"."equipment_name" IS '设备名称';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_date" IS '维修日期';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_type" IS '维修类型（现场维修、返厂维修、委外维修）';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_description" IS '维修描述';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_cost" IS '维修成本';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_parts" IS '维修备件（JSON格式）';
        COMMENT ON COLUMN "core_equipment_repairs"."repairer_id" IS '维修人员ID（用户ID）';
        COMMENT ON COLUMN "core_equipment_repairs"."repairer_name" IS '维修人员姓名';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_duration" IS '维修时长（小时）';
        COMMENT ON COLUMN "core_equipment_repairs"."status" IS '维修状态（进行中、已完成、已取消）';
        COMMENT ON COLUMN "core_equipment_repairs"."repair_result" IS '维修结果（成功、失败、部分成功）';
        COMMENT ON COLUMN "core_equipment_repairs"."remark" IS '备注';
        COMMENT ON COLUMN "core_equipment_repairs"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除设备故障和维修记录表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_core_equipment_repairs_status";
        DROP INDEX IF EXISTS "idx_core_equipment_repairs_repair_date";
        DROP INDEX IF EXISTS "idx_core_equipment_repairs_equipment_id";
        DROP INDEX IF EXISTS "idx_core_equipment_repairs_equipment_fault_id";
        DROP INDEX IF EXISTS "idx_core_equipment_repairs_repair_no";
        DROP INDEX IF EXISTS "idx_core_equipment_repairs_tenant_id";

        DROP INDEX IF EXISTS "idx_core_equipment_faults_status";
        DROP INDEX IF EXISTS "idx_core_equipment_faults_fault_date";
        DROP INDEX IF EXISTS "idx_core_equipment_faults_equipment_uuid";
        DROP INDEX IF EXISTS "idx_core_equipment_faults_equipment_id";
        DROP INDEX IF EXISTS "idx_core_equipment_faults_fault_no";
        DROP INDEX IF EXISTS "idx_core_equipment_faults_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "core_equipment_repairs";
        DROP TABLE IF EXISTS "core_equipment_faults";
    """
