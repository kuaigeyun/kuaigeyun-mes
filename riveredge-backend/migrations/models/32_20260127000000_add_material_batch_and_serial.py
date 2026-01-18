"""
添加物料批号和序列号表迁移

创建MaterialBatch和MaterialSerial表，支持批号和序列号管理功能。

变更内容：
- 创建apps_master_data_material_batches表（物料批号表）
- 创建apps_master_data_material_serials表（物料序列号表）
- 添加必要的索引和约束

根据《05-详细开发计划-第四阶段.md》的功能点4.3.4设计。

Author: Luigi Lu
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建物料批号和序列号表
    """
    return """
        -- ============================================
        -- 创建物料批号表（apps_master_data_material_batches）
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_batches" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE,
            "batch_no" VARCHAR(100) NOT NULL,
            "production_date" DATE,
            "expiry_date" DATE,
            "supplier_batch_no" VARCHAR(100),
            "quantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'in_stock',
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_master_batch_tenant_material_batch" UNIQUE ("tenant_id", "material_id", "batch_no")
        );
        
        -- 添加索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_batch_tenant_id" ON "apps_master_data_material_batches" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_batch_material_id" ON "apps_master_data_material_batches" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_batch_batch_no" ON "apps_master_data_material_batches" ("batch_no");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_batch_status" ON "apps_master_data_material_batches" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_batch_expiry_date" ON "apps_master_data_material_batches" ("expiry_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_batch_uuid" ON "apps_master_data_material_batches" ("uuid");
        
        -- 添加表注释和字段注释
        COMMENT ON TABLE "apps_master_data_material_batches" IS '物料批号表';
        COMMENT ON COLUMN "apps_master_data_material_batches"."id" IS '批号ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."material_id" IS '关联物料ID（外键）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."batch_no" IS '批号（必填，同一物料下唯一）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."production_date" IS '生产日期（可选）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."expiry_date" IS '有效期（可选，用于有保质期的物料）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."supplier_batch_no" IS '供应商批号（可选）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."quantity" IS '批号数量（当前库存数量）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."status" IS '批号状态（在库、已出库、已过期、已报废等）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."remark" IS '备注（可选）';
        COMMENT ON COLUMN "apps_master_data_material_batches"."deleted_at" IS '删除时间（软删除）';
        
        -- ============================================
        -- 创建物料序列号表（apps_master_data_material_serials）
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_serials" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE,
            "serial_no" VARCHAR(100) NOT NULL,
            "production_date" DATE,
            "factory_date" DATE,
            "supplier_serial_no" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'in_stock',
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_master_serial_tenant_serial" UNIQUE ("tenant_id", "serial_no")
        );
        
        -- 添加索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_serial_tenant_id" ON "apps_master_data_material_serials" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_serial_material_id" ON "apps_master_data_material_serials" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_serial_serial_no" ON "apps_master_data_material_serials" ("serial_no");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_serial_status" ON "apps_master_data_material_serials" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_serial_uuid" ON "apps_master_data_material_serials" ("uuid");
        
        -- 添加表注释和字段注释
        COMMENT ON TABLE "apps_master_data_material_serials" IS '物料序列号表';
        COMMENT ON COLUMN "apps_master_data_material_serials"."id" IS '序列号ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."material_id" IS '关联物料ID（外键）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."serial_no" IS '序列号（必填，全局唯一）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."production_date" IS '生产日期（可选）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."factory_date" IS '出厂日期（可选）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."supplier_serial_no" IS '供应商序列号（可选）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."status" IS '序列号状态（在库、已出库、已销售、已报废、已退货等）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."remark" IS '备注（可选）';
        COMMENT ON COLUMN "apps_master_data_material_serials"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除物料批号和序列号表
    """
    return """
        -- 删除序列号表
        DROP TABLE IF EXISTS "apps_master_data_material_serials";
        
        -- 删除批号表
        DROP TABLE IF EXISTS "apps_master_data_material_batches";
    """
