"""
迁移 14 已创建 apps_kuaizhizao_customer_material_registrations（列 code）；
迁移 161 中 CREATE TABLE IF NOT EXISTS 会跳过建表，但列注释依赖 registration_code。

从 161 拆出本迁移：用 pg_catalog 检测旧列 code 并重命名为 registration_code，
再补列与约束对齐，最后 COMMENT。独立小文件避免超大 SQL 中 DO 块未按预期执行。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    INNER JOIN pg_catalog.pg_class c ON a.attrelid = c.oid AND c.relkind = 'r'
    INNER JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'apps_kuaizhizao_customer_material_registrations'
      AND a.attname = 'code'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    ALTER TABLE "apps_kuaizhizao_customer_material_registrations" RENAME COLUMN "code" TO "registration_code";
  END IF;
END $$;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "parsed_data" JSONB;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ;
UPDATE "apps_kuaizhizao_customer_material_registrations" SET "barcode" = COALESCE("barcode", '');
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ALTER COLUMN "barcode" TYPE VARCHAR(500);
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ALTER COLUMN "barcode" SET NOT NULL;
UPDATE "apps_kuaizhizao_customer_material_registrations" SET "registered_by" = COALESCE("registered_by", 0);
UPDATE "apps_kuaizhizao_customer_material_registrations" SET "registered_by_name" = COALESCE("registered_by_name", '');
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ALTER COLUMN "registered_by" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ALTER COLUMN "registered_by_name" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ALTER COLUMN "quantity" TYPE DECIMAL(12,2);
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."registration_code" IS '登记编码';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."customer_id" IS '客户ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."customer_name" IS '客户名称';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."barcode" IS '客户条码（一维码或二维码）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."barcode_type" IS '条码类型（1d/2d）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."parsed_data" IS '解析后的数据（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."mapped_material_id" IS '映射到的物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."mapped_material_code" IS '映射到的物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."mapped_material_name" IS '映射到的物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."mapping_rule_id" IS '使用的映射规则ID（关联BarcodeMappingRule）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."quantity" IS '来料数量';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."registration_date" IS '登记日期';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."registered_by" IS '登记人ID';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."registered_by_name" IS '登记人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."warehouse_id" IS '入库仓库ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."warehouse_name" IS '入库仓库名称（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."status" IS '状态（pending/processed/cancelled）';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."processed_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_customer_material_registrations" IS '快格轻制造 - 客户来料登记';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
