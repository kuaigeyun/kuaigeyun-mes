"""
创建设备管理表

根据设备管理功能需求，创建 core_equipment 表。

包含：
1. core_equipment - 设备基础信息表

Author: Auto (AI Assistant)
Date: 2026-01-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建设备管理表
    """
    return """
        -- ============================================
        -- 1. 创建设备基础信息表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_equipment" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "type" VARCHAR(50),
            "category" VARCHAR(50),
            "brand" VARCHAR(100),
            "model" VARCHAR(100),
            "serial_number" VARCHAR(100),
            "manufacturer" VARCHAR(200),
            "supplier" VARCHAR(200),
            "purchase_date" DATE,
            "installation_date" DATE,
            "warranty_period" INT,
            "technical_parameters" JSONB,
            "workstation_id" INT,
            "workstation_code" VARCHAR(50),
            "workstation_name" VARCHAR(200),
            "work_center_id" INT,
            "work_center_code" VARCHAR(50),
            "work_center_name" VARCHAR(200),
            "status" VARCHAR(50) NOT NULL DEFAULT '正常',
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "description" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_equipment_tenant_code" UNIQUE ("tenant_id", "code")
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_tenant_id" ON "core_equipment" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_code" ON "core_equipment" ("code");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_uuid" ON "core_equipment" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_type" ON "core_equipment" ("type");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_category" ON "core_equipment" ("category");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_workstation_id" ON "core_equipment" ("workstation_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_work_center_id" ON "core_equipment" ("work_center_id");
        CREATE INDEX IF NOT EXISTS "idx_core_equipment_status" ON "core_equipment" ("status");

        -- 添加表注释和字段注释
        COMMENT ON TABLE "core_equipment" IS '设备基础信息表，用于管理生产设备的基础信息，支持多组织隔离';
        COMMENT ON COLUMN "core_equipment"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_equipment"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_equipment"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_equipment"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_equipment"."id" IS '主键ID';
        COMMENT ON COLUMN "core_equipment"."code" IS '设备编码（组织内唯一）';
        COMMENT ON COLUMN "core_equipment"."name" IS '设备名称';
        COMMENT ON COLUMN "core_equipment"."type" IS '设备类型（如：加工设备、检测设备、包装设备等）';
        COMMENT ON COLUMN "core_equipment"."category" IS '设备分类（如：CNC、注塑机、冲压机等）';
        COMMENT ON COLUMN "core_equipment"."brand" IS '品牌';
        COMMENT ON COLUMN "core_equipment"."model" IS '型号';
        COMMENT ON COLUMN "core_equipment"."serial_number" IS '序列号';
        COMMENT ON COLUMN "core_equipment"."manufacturer" IS '制造商';
        COMMENT ON COLUMN "core_equipment"."supplier" IS '供应商';
        COMMENT ON COLUMN "core_equipment"."purchase_date" IS '采购日期';
        COMMENT ON COLUMN "core_equipment"."installation_date" IS '安装日期';
        COMMENT ON COLUMN "core_equipment"."warranty_period" IS '保修期（月）';
        COMMENT ON COLUMN "core_equipment"."technical_parameters" IS '技术参数（JSON格式）';
        COMMENT ON COLUMN "core_equipment"."workstation_id" IS '关联工位ID（可选，关联到工位）';
        COMMENT ON COLUMN "core_equipment"."workstation_code" IS '工位编码';
        COMMENT ON COLUMN "core_equipment"."workstation_name" IS '工位名称';
        COMMENT ON COLUMN "core_equipment"."work_center_id" IS '关联工作中心ID（可选，关联到工作中心）';
        COMMENT ON COLUMN "core_equipment"."work_center_code" IS '工作中心编码';
        COMMENT ON COLUMN "core_equipment"."work_center_name" IS '工作中心名称';
        COMMENT ON COLUMN "core_equipment"."status" IS '设备状态（正常、维修中、停用、报废）';
        COMMENT ON COLUMN "core_equipment"."is_active" IS '是否启用';
        COMMENT ON COLUMN "core_equipment"."description" IS '描述';
        COMMENT ON COLUMN "core_equipment"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除设备管理表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_core_equipment_status";
        DROP INDEX IF EXISTS "idx_core_equipment_work_center_id";
        DROP INDEX IF EXISTS "idx_core_equipment_workstation_id";
        DROP INDEX IF EXISTS "idx_core_equipment_category";
        DROP INDEX IF EXISTS "idx_core_equipment_type";
        DROP INDEX IF EXISTS "idx_core_equipment_uuid";
        DROP INDEX IF EXISTS "idx_core_equipment_code";
        DROP INDEX IF EXISTS "idx_core_equipment_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "core_equipment";
    """
