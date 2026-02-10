from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_plants" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "address" VARCHAR(500),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__abb742" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__52c71c" ON "apps_master_data_plants" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_064ce6" ON "apps_master_data_plants" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_009e1f" ON "apps_master_data_plants" ("uuid");
COMMENT ON COLUMN "apps_master_data_plants"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_plants"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_plants"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_plants"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_plants"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_plants"."code" IS '厂区编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_plants"."name" IS '厂区名称';
COMMENT ON COLUMN "apps_master_data_plants"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_plants"."address" IS '地址';
COMMENT ON COLUMN "apps_master_data_plants"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_plants"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_plants" IS '厂区模型';;
        ALTER TABLE "apps_master_data_workshops" ADD "plant_id" INT;
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_batches" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "batch_no" VARCHAR(100) NOT NULL,
    "production_date" DATE,
    "expiry_date" DATE,
    "supplier_batch_no" VARCHAR(100),
    "quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'in_stock',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__3e4638" UNIQUE ("tenant_id", "material_id", "batch_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__e4a8f8" ON "apps_master_data_material_batches" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_materia_380418" ON "apps_master_data_material_batches" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_batch_n_cdbf53" ON "apps_master_data_material_batches" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_master_status_769e3e" ON "apps_master_data_material_batches" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_master_expiry__cd3f4b" ON "apps_master_data_material_batches" ("expiry_date");
COMMENT ON COLUMN "apps_master_data_workshops"."plant_id" IS '所属厂区';
COMMENT ON COLUMN "apps_master_data_material_batches"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_material_batches"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_material_batches"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_batches"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_batches"."id" IS '批号ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "apps_master_data_material_batches"."batch_no" IS '批号（必填，同一物料下唯一）';
COMMENT ON COLUMN "apps_master_data_material_batches"."production_date" IS '生产日期（可选）';
COMMENT ON COLUMN "apps_master_data_material_batches"."expiry_date" IS '有效期（可选，用于有保质期的物料）';
COMMENT ON COLUMN "apps_master_data_material_batches"."supplier_batch_no" IS '供应商批号（可选）';
COMMENT ON COLUMN "apps_master_data_material_batches"."quantity" IS '批号数量（当前库存数量）';
COMMENT ON COLUMN "apps_master_data_material_batches"."status" IS '批号状态（在库、已出库、已过期、已报废等）';
COMMENT ON COLUMN "apps_master_data_material_batches"."remark" IS '备注（可选）';
COMMENT ON COLUMN "apps_master_data_material_batches"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_material_batches"."material_id" IS '关联物料（内部使用自增ID）';
COMMENT ON TABLE "apps_master_data_material_batches" IS '物料批号模型';;
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_serials" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "serial_no" VARCHAR(100) NOT NULL,
    "production_date" DATE,
    "factory_date" DATE,
    "supplier_serial_no" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL  DEFAULT 'in_stock',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__8f56c3" UNIQUE ("tenant_id", "serial_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__a101c6" ON "apps_master_data_material_serials" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_materia_0701d1" ON "apps_master_data_material_serials" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_serial__1f0fdd" ON "apps_master_data_material_serials" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_master_status_2da4d8" ON "apps_master_data_material_serials" ("status");
COMMENT ON COLUMN "apps_master_data_material_serials"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_material_serials"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_material_serials"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_serials"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_serials"."id" IS '序列号ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "apps_master_data_material_serials"."serial_no" IS '序列号（必填，全局唯一）';
COMMENT ON COLUMN "apps_master_data_material_serials"."production_date" IS '生产日期（可选）';
COMMENT ON COLUMN "apps_master_data_material_serials"."factory_date" IS '出厂日期（可选）';
COMMENT ON COLUMN "apps_master_data_material_serials"."supplier_serial_no" IS '供应商序列号（可选）';
COMMENT ON COLUMN "apps_master_data_material_serials"."status" IS '序列号状态（在库、已出库、已销售、已报废、已退货等）';
COMMENT ON COLUMN "apps_master_data_material_serials"."remark" IS '备注（可选）';
COMMENT ON COLUMN "apps_master_data_material_serials"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_material_serials"."material_id" IS '关联物料（内部使用自增ID）';
COMMENT ON TABLE "apps_master_data_material_serials" IS '物料序列号模型';;
        CREATE INDEX "idx_apps_master_plant_i_5c3511" ON "apps_master_data_workshops" ("plant_id");
        ALTER TABLE "apps_master_data_workshops" ADD CONSTRAINT "fk_apps_mas_apps_mas_05eb1aa0" FOREIGN KEY ("plant_id") REFERENCES "apps_master_data_plants" ("id") ON DELETE CASCADE;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_workshops" DROP CONSTRAINT "fk_apps_mas_apps_mas_05eb1aa0";
        DROP INDEX "idx_apps_master_plant_i_5c3511";
        ALTER TABLE "apps_master_data_workshops" DROP COLUMN "plant_id";
        DROP TABLE IF EXISTS "apps_master_data_plants";
        DROP TABLE IF EXISTS "apps_master_data_material_batches";
        DROP TABLE IF EXISTS "apps_master_data_material_serials";"""
