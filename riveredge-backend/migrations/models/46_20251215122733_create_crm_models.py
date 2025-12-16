from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_mrp_plans" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "plan_no" VARCHAR(50) NOT NULL,
    "plan_name" VARCHAR(200) NOT NULL,
    "plan_type" VARCHAR(20) NOT NULL  DEFAULT 'MRP',
    "plan_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "calculation_params" JSONB,
    "calculation_result" JSONB,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__31d4b7" UNIQUE ("tenant_id", "plan_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__51de7e" ON "apps_kuaimrp_mrp_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_no_8bb07d" ON "apps_kuaimrp_mrp_plans" ("plan_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_e6975b" ON "apps_kuaimrp_mrp_plans" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_status_b95ab0" ON "apps_kuaimrp_mrp_plans" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_ty_3c61d9" ON "apps_kuaimrp_mrp_plans" ("plan_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_da_a05f07" ON "apps_kuaimrp_mrp_plans" ("plan_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_e752ec" ON "apps_kuaimrp_mrp_plans" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_no" IS '计划编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_name" IS '计划名称';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_type" IS '计划类型（MRP、LRP）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."plan_date" IS '计划日期';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."status" IS '计划状态（草稿、计算中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."calculation_params" IS '计算参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."calculation_result" IS '计算结果统计（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimrp_mrp_plans"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_mrp_plans" IS 'KUAIMRP Mrp plan表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_lrp_batches" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "batch_no" VARCHAR(50) NOT NULL,
    "batch_name" VARCHAR(200) NOT NULL,
    "order_ids" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_date" TIMESTAMPTZ,
    "delivery_date" TIMESTAMPTZ,
    "batch_params" JSONB,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__aad8bd" UNIQUE ("tenant_id", "batch_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__705961" ON "apps_kuaimrp_lrp_batches" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_batch_n_4a88d9" ON "apps_kuaimrp_lrp_batches" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_d9d8e2" ON "apps_kuaimrp_lrp_batches" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_status_bf7d49" ON "apps_kuaimrp_lrp_batches" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_planned_dba0a5" ON "apps_kuaimrp_lrp_batches" ("planned_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_deliver_b1dbf4" ON "apps_kuaimrp_lrp_batches" ("delivery_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_1e136f" ON "apps_kuaimrp_lrp_batches" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."batch_no" IS '批次编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."batch_name" IS '批次名称';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."order_ids" IS '关联订单ID列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."status" IS '批次状态（草稿、计算中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."planned_date" IS '计划日期';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."batch_params" IS '批次参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimrp_lrp_batches"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_lrp_batches" IS 'KUAIMRP Lrp batche表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_material_requirements" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "requirement_no" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "requirement_type" VARCHAR(20) NOT NULL,
    "plan_id" INT,
    "requirement_date" TIMESTAMPTZ NOT NULL,
    "gross_requirement" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "available_stock" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "in_transit_stock" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "safety_stock" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "net_requirement" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "suggested_order_qty" DECIMAL(18,4),
    "suggested_order_date" TIMESTAMPTZ,
    "suggested_type" VARCHAR(20),
    "status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__a5553d" UNIQUE ("tenant_id", "requirement_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__c53ddc" ON "apps_kuaimrp_material_requirements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_78b6a9" ON "apps_kuaimrp_material_requirements" ("requirement_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_f64b28" ON "apps_kuaimrp_material_requirements" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_materia_ddf4a9" ON "apps_kuaimrp_material_requirements" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_d100aa" ON "apps_kuaimrp_material_requirements" ("requirement_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_plan_id_2c004d" ON "apps_kuaimrp_material_requirements" ("plan_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_33144f" ON "apps_kuaimrp_material_requirements" ("requirement_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_status_77151b" ON "apps_kuaimrp_material_requirements" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_d2e499" ON "apps_kuaimrp_material_requirements" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."requirement_no" IS '需求编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."requirement_type" IS '需求类型（MRP、LRP）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."plan_id" IS '关联计划ID（MRPPlan或LRPBatch）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."requirement_date" IS '需求日期';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."gross_requirement" IS '毛需求数量';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."available_stock" IS '可用库存';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."in_transit_stock" IS '在途库存';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."safety_stock" IS '安全库存';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."net_requirement" IS '净需求数量';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."suggested_order_qty" IS '建议采购/生产数量';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."suggested_order_date" IS '建议采购/生产日期';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."suggested_type" IS '建议类型（采购、生产、委外）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."status" IS '需求状态（待处理、已生成计划、已完成）';
COMMENT ON COLUMN "apps_kuaimrp_material_requirements"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_material_requirements" IS 'MRP物料需求表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_requirement_traceabilities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "requirement_id" INT NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" INT,
    "source_no" VARCHAR(100),
    "parent_requirement_id" INT,
    "level" INT NOT NULL  DEFAULT 0,
    "requirement_qty" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__6c5407" ON "apps_kuaimrp_requirement_traceabilities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_38b634" ON "apps_kuaimrp_requirement_traceabilities" ("requirement_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_d14357" ON "apps_kuaimrp_requirement_traceabilities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_source__9c5e03" ON "apps_kuaimrp_requirement_traceabilities" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_source__287c18" ON "apps_kuaimrp_requirement_traceabilities" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_parent__8838cf" ON "apps_kuaimrp_requirement_traceabilities" ("parent_requirement_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_level_365db5" ON "apps_kuaimrp_requirement_traceabilities" ("level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_30d879" ON "apps_kuaimrp_requirement_traceabilities" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."requirement_id" IS '需求ID（关联MaterialRequirement）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."source_type" IS '需求来源类型（销售订单、销售预测、安全库存、独立需求等）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."source_id" IS '需求来源ID';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."source_no" IS '需求来源编号';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."parent_requirement_id" IS '父需求ID（用于需求层级关系）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."level" IS '需求层级（0为最顶层）';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."requirement_qty" IS '需求数量';
COMMENT ON COLUMN "apps_kuaimrp_requirement_traceabilities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_requirement_traceabilities" IS 'KUAIMRP Requirement traceabilitie表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimrp_shortage_alerts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "alert_no" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "requirement_id" INT,
    "shortage_qty" DECIMAL(18,4) NOT NULL,
    "shortage_date" TIMESTAMPTZ NOT NULL,
    "alert_level" VARCHAR(20) NOT NULL  DEFAULT '一般',
    "alert_reason" TEXT,
    "alert_status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "suggested_action" TEXT,
    "handler_id" INT,
    "handled_at" TIMESTAMPTZ,
    "handle_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaimr_tenant__047e85" UNIQUE ("tenant_id", "alert_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_tenant__477817" ON "apps_kuaimrp_shortage_alerts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_alert_n_326937" ON "apps_kuaimrp_shortage_alerts" ("alert_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_uuid_25421f" ON "apps_kuaimrp_shortage_alerts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_materia_f37800" ON "apps_kuaimrp_shortage_alerts" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_require_95ecf1" ON "apps_kuaimrp_shortage_alerts" ("requirement_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_shortag_a31dda" ON "apps_kuaimrp_shortage_alerts" ("shortage_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_alert_l_e2a89a" ON "apps_kuaimrp_shortage_alerts" ("alert_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_alert_s_cc6890" ON "apps_kuaimrp_shortage_alerts" ("alert_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaimr_created_878a0c" ON "apps_kuaimrp_shortage_alerts" ("created_at");
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_no" IS '预警编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."requirement_id" IS '关联需求ID（MaterialRequirement）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."shortage_qty" IS '缺料数量';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."shortage_date" IS '缺料日期';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_level" IS '预警等级（紧急、重要、一般）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_reason" IS '缺料原因';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."alert_status" IS '预警状态（待处理、处理中、已解决、已关闭）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."suggested_action" IS '处理建议';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."handler_id" IS '处理人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."handle_result" IS '处理结果';
COMMENT ON COLUMN "apps_kuaimrp_shortage_alerts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimrp_shortage_alerts" IS 'MRP缺料预警表';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaimrp_mrp_plans";
        DROP TABLE IF EXISTS "apps_kuaimrp_lrp_batches";
        DROP TABLE IF EXISTS "apps_kuaimrp_material_requirements";
        DROP TABLE IF EXISTS "apps_kuaimrp_requirement_traceabilities";
        DROP TABLE IF EXISTS "apps_kuaimrp_shortage_alerts";"""
