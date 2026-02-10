"""
创建模具管理表

根据模具管理功能需求，创建模具和模具使用记录相关表。

包含：
1. core_molds - 模具基础信息表
2. core_mold_usages - 模具使用记录表

Author: Auto (AI Assistant)
Date: 2026-01-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建模具管理表
    """
    return """
        -- ============================================
        -- 1. 创建模具基础信息表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_molds" (
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
            "status" VARCHAR(50) NOT NULL DEFAULT '正常',
            "total_usage_count" INT NOT NULL DEFAULT 0,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "description" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_molds_tenant_code" UNIQUE ("tenant_id", "code")
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_molds_tenant_id" ON "core_molds" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_molds_code" ON "core_molds" ("code");
        CREATE INDEX IF NOT EXISTS "idx_core_molds_uuid" ON "core_molds" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_molds_type" ON "core_molds" ("type");
        CREATE INDEX IF NOT EXISTS "idx_core_molds_status" ON "core_molds" ("status");

        -- 添加表注释和字段注释
        COMMENT ON TABLE "core_molds" IS '模具基础信息表，用于管理模具基础信息，支持多组织隔离';
        COMMENT ON COLUMN "core_molds"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_molds"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_molds"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_molds"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_molds"."id" IS '主键ID';
        COMMENT ON COLUMN "core_molds"."code" IS '模具编码（组织内唯一）';
        COMMENT ON COLUMN "core_molds"."name" IS '模具名称';
        COMMENT ON COLUMN "core_molds"."type" IS '模具类型（注塑模具、压铸模具、冲压模具、其他）';
        COMMENT ON COLUMN "core_molds"."category" IS '模具分类';
        COMMENT ON COLUMN "core_molds"."brand" IS '品牌';
        COMMENT ON COLUMN "core_molds"."model" IS '型号';
        COMMENT ON COLUMN "core_molds"."serial_number" IS '序列号';
        COMMENT ON COLUMN "core_molds"."manufacturer" IS '制造商';
        COMMENT ON COLUMN "core_molds"."supplier" IS '供应商';
        COMMENT ON COLUMN "core_molds"."purchase_date" IS '采购日期';
        COMMENT ON COLUMN "core_molds"."installation_date" IS '安装日期';
        COMMENT ON COLUMN "core_molds"."warranty_period" IS '保修期（月）';
        COMMENT ON COLUMN "core_molds"."technical_parameters" IS '技术参数（JSON格式）';
        COMMENT ON COLUMN "core_molds"."status" IS '模具状态（正常、维修中、停用、报废）';
        COMMENT ON COLUMN "core_molds"."total_usage_count" IS '累计使用次数';
        COMMENT ON COLUMN "core_molds"."is_active" IS '是否启用';
        COMMENT ON COLUMN "core_molds"."description" IS '描述';
        COMMENT ON COLUMN "core_molds"."deleted_at" IS '删除时间（软删除）';

        -- ============================================
        -- 2. 创建模具使用记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_mold_usages" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "usage_no" VARCHAR(100) NOT NULL,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "mold_name" VARCHAR(200) NOT NULL,
            "mold_code" VARCHAR(100),
            "source_type" VARCHAR(50),
            "source_id" INT,
            "source_no" VARCHAR(100),
            "usage_date" TIMESTAMPTZ NOT NULL,
            "usage_count" INT NOT NULL DEFAULT 1,
            "operator_id" INT,
            "operator_name" VARCHAR(100),
            "status" VARCHAR(50) NOT NULL DEFAULT '使用中',
            "return_date" TIMESTAMPTZ,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_mold_usages_tenant_usage_no" UNIQUE ("tenant_id", "usage_no")
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_mold_usages_tenant_id" ON "core_mold_usages" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_mold_usages_usage_no" ON "core_mold_usages" ("usage_no");
        CREATE INDEX IF NOT EXISTS "idx_core_mold_usages_mold_id" ON "core_mold_usages" ("mold_id");
        CREATE INDEX IF NOT EXISTS "idx_core_mold_usages_mold_uuid" ON "core_mold_usages" ("mold_uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_mold_usages_source_type" ON "core_mold_usages" ("source_type");
        CREATE INDEX IF NOT EXISTS "idx_core_mold_usages_usage_date" ON "core_mold_usages" ("usage_date");
        CREATE INDEX IF NOT EXISTS "idx_core_mold_usages_status" ON "core_mold_usages" ("status");

        -- 添加表注释和字段注释
        COMMENT ON TABLE "core_mold_usages" IS '模具使用记录表，用于管理模具使用记录，支持多组织隔离';
        COMMENT ON COLUMN "core_mold_usages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_mold_usages"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_mold_usages"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_mold_usages"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_mold_usages"."id" IS '主键ID';
        COMMENT ON COLUMN "core_mold_usages"."usage_no" IS '使用记录编号（组织内唯一）';
        COMMENT ON COLUMN "core_mold_usages"."mold_id" IS '模具ID（关联模具）';
        COMMENT ON COLUMN "core_mold_usages"."mold_uuid" IS '模具UUID';
        COMMENT ON COLUMN "core_mold_usages"."mold_name" IS '模具名称';
        COMMENT ON COLUMN "core_mold_usages"."mold_code" IS '模具编码';
        COMMENT ON COLUMN "core_mold_usages"."source_type" IS '来源类型（生产订单、工单）';
        COMMENT ON COLUMN "core_mold_usages"."source_id" IS '来源ID';
        COMMENT ON COLUMN "core_mold_usages"."source_no" IS '来源编号';
        COMMENT ON COLUMN "core_mold_usages"."usage_date" IS '使用日期';
        COMMENT ON COLUMN "core_mold_usages"."usage_count" IS '使用次数';
        COMMENT ON COLUMN "core_mold_usages"."operator_id" IS '操作人员ID（用户ID）';
        COMMENT ON COLUMN "core_mold_usages"."operator_name" IS '操作人员姓名';
        COMMENT ON COLUMN "core_mold_usages"."status" IS '使用状态（使用中、已归还、已报废）';
        COMMENT ON COLUMN "core_mold_usages"."return_date" IS '归还日期';
        COMMENT ON COLUMN "core_mold_usages"."remark" IS '备注';
        COMMENT ON COLUMN "core_mold_usages"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除模具管理表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_core_mold_usages_status";
        DROP INDEX IF EXISTS "idx_core_mold_usages_usage_date";
        DROP INDEX IF EXISTS "idx_core_mold_usages_source_type";
        DROP INDEX IF EXISTS "idx_core_mold_usages_mold_uuid";
        DROP INDEX IF EXISTS "idx_core_mold_usages_mold_id";
        DROP INDEX IF EXISTS "idx_core_mold_usages_usage_no";
        DROP INDEX IF EXISTS "idx_core_mold_usages_tenant_id";

        DROP INDEX IF EXISTS "idx_core_molds_status";
        DROP INDEX IF EXISTS "idx_core_molds_type";
        DROP INDEX IF EXISTS "idx_core_molds_uuid";
        DROP INDEX IF EXISTS "idx_core_molds_code";
        DROP INDEX IF EXISTS "idx_core_molds_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "core_mold_usages";
        DROP TABLE IF EXISTS "core_molds";
    """
