from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_type" VARCHAR(50) NOT NULL  DEFAULT '计划订单',
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "completed_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "source_order_id" INT,
    "source_order_no" VARCHAR(50),
    "route_id" INT,
    "route_name" VARCHAR(200),
    "priority" VARCHAR(20) NOT NULL  DEFAULT '中',
    "owner_id" INT,
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__a1b2c3" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__d4e5f6" ON "apps_kuaimes_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_no_g7h8i9" ON "apps_kuaimes_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_j0k1l2" ON "apps_kuaimes_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_m3n4o5" ON "apps_kuaimes_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_t_p6q7r8" ON "apps_kuaimes_orders" ("order_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_s9t0u1" ON "apps_kuaimes_orders" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_v2w3x4" ON "apps_kuaimes_orders" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_y5z6a7" ON "apps_kuaimes_orders" ("planned_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_source__b8c9d0" ON "apps_kuaimes_orders" ("source_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_e1f2g3" ON "apps_kuaimes_orders" ("created_at");
COMMENT ON TABLE "apps_kuaimes_orders" IS 'MES生产订单表';
COMMENT ON COLUMN "apps_kuaimes_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_orders"."order_type" IS '订单类型（计划订单、紧急订单、返工订单）';
COMMENT ON COLUMN "apps_kuaimes_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_orders"."quantity" IS '计划数量';
COMMENT ON COLUMN "apps_kuaimes_orders"."completed_quantity" IS '完成数量';
COMMENT ON COLUMN "apps_kuaimes_orders"."status" IS '订单状态（草稿、已确认、已下发、执行中、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_id" IS '来源订单ID（销售订单、计划订单等）';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_id" IS '工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_name" IS '工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_orders"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaimes_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_orders"."deleted_at" IS '删除时间（软删除）';
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_work_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "work_order_no" VARCHAR(50) NOT NULL,
    "order_id" INT,
    "order_uuid" VARCHAR(36),
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "completed_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "route_id" INT,
    "route_name" VARCHAR(200),
    "current_operation" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "work_center_id" INT,
    "work_center_name" VARCHAR(200),
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__53bf79" UNIQUE ("tenant_id", "work_order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__6b31b7" ON "apps_kuaimes_work_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_10c61a" ON "apps_kuaimes_work_orders" ("work_order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_e26a5f" ON "apps_kuaimes_work_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_i_b112f5" ON "apps_kuaimes_work_orders" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_order_u_e52e7c" ON "apps_kuaimes_work_orders" ("order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_f304a2" ON "apps_kuaimes_work_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_156097" ON "apps_kuaimes_work_orders" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_ce_df641a" ON "apps_kuaimes_work_orders" ("work_center_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_fdc9d6" ON "apps_kuaimes_work_orders" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_0a61f4" ON "apps_kuaimes_work_orders" ("planned_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_ba9cfe" ON "apps_kuaimes_work_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_id" IS '来源订单ID（销售订单、计划订单等）';
COMMENT ON COLUMN "apps_kuaimes_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."order_type" IS '订单类型（计划订单、紧急订单、返工订单）';
COMMENT ON COLUMN "apps_kuaimes_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_id" IS '工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_orders"."completed_quantity" IS '完成数量';
COMMENT ON COLUMN "apps_kuaimes_orders"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaimes_orders"."source_order_no" IS '来源订单编号';
COMMENT ON COLUMN "apps_kuaimes_orders"."route_name" IS '工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."work_order_no" IS '工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."order_id" IS '生产订单ID（关联Order）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."order_uuid" IS '生产订单UUID';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."quantity" IS '计划数量';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."completed_quantity" IS '完成数量';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."defective_quantity" IS '不良品数量';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."route_id" IS '工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."route_name" IS '工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."current_operation" IS '当前工序';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."status" IS '工单状态（草稿、已下发、执行中、暂停、已完成、已关闭、已取消）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."work_center_id" IS '工作中心ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."work_center_name" IS '工作中心名称';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."operator_id" IS '操作员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."operator_name" IS '操作员姓名';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_work_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_work_orders" IS 'MES工单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_production_reports" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "report_no" VARCHAR(50) NOT NULL,
    "work_order_id" INT,
    "work_order_uuid" VARCHAR(36),
    "operation_id" INT,
    "operation_name" VARCHAR(200),
    "report_date" TIMESTAMPTZ NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "qualified_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_reason" TEXT,
    "work_hours" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "work_center_id" INT,
    "work_center_name" VARCHAR(200),
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__185a1e" UNIQUE ("tenant_id", "report_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__5417c8" ON "apps_kuaimes_production_reports" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_report__d03568" ON "apps_kuaimes_production_reports" ("report_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_207d5a" ON "apps_kuaimes_production_reports" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_1f08a6" ON "apps_kuaimes_production_reports" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_8f1d1c" ON "apps_kuaimes_production_reports" ("work_order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_operati_b4415a" ON "apps_kuaimes_production_reports" ("operation_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_report__fd31a3" ON "apps_kuaimes_production_reports" ("report_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_operato_9b89a4" ON "apps_kuaimes_production_reports" ("operator_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_ce_9796d7" ON "apps_kuaimes_production_reports" ("work_center_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_batch_n_801c61" ON "apps_kuaimes_production_reports" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_serial__c23b9e" ON "apps_kuaimes_production_reports" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_db851a" ON "apps_kuaimes_production_reports" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_a2bc82" ON "apps_kuaimes_production_reports" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_production_reports"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."report_no" IS '报工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_order_id" IS '工单ID（关联WorkOrder）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_order_uuid" IS '工单UUID';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operation_id" IS '工序ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operation_name" IS '工序名称';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."report_date" IS '报工日期';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."quantity" IS '报工数量';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."qualified_quantity" IS '合格数量';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."defective_quantity" IS '不良品数量';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."defective_reason" IS '不良品原因';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_hours" IS '工时（小时）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operator_id" IS '操作员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."operator_name" IS '操作员姓名';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_center_id" IS '工作中心ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."work_center_name" IS '工作中心名称';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."status" IS '报工状态（草稿、已确认、已审核）';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_production_reports"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_production_reports" IS 'MES生产报工表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_traceabilities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "trace_no" VARCHAR(50) NOT NULL,
    "trace_type" VARCHAR(50) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "work_order_id" INT,
    "work_order_uuid" VARCHAR(36),
    "operation_id" INT,
    "operation_name" VARCHAR(200),
    "material_id" INT,
    "material_name" VARCHAR(200),
    "material_batch_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "trace_data" JSONB,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__b05410" UNIQUE ("tenant_id", "trace_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__cb87a3" ON "apps_kuaimes_traceabilities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_trace_n_8a8e02" ON "apps_kuaimes_traceabilities" ("trace_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_71a4fa" ON "apps_kuaimes_traceabilities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_trace_t_6f8c8b" ON "apps_kuaimes_traceabilities" ("trace_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_batch_n_ee4a90" ON "apps_kuaimes_traceabilities" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_serial__54b66a" ON "apps_kuaimes_traceabilities" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_79c0e0" ON "apps_kuaimes_traceabilities" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_d59c3b" ON "apps_kuaimes_traceabilities" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_or_bd29a4" ON "apps_kuaimes_traceabilities" ("work_order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_operati_26682e" ON "apps_kuaimes_traceabilities" ("operation_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_materia_7aeadd" ON "apps_kuaimes_traceabilities" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_materia_ba13b9" ON "apps_kuaimes_traceabilities" ("material_batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_e7c547" ON "apps_kuaimes_traceabilities" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."trace_no" IS '追溯编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."trace_type" IS '追溯类型（批次追溯、序列号追溯）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."batch_no" IS '批次号';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."serial_no" IS '序列号';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."work_order_id" IS '工单ID（关联WorkOrder）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."work_order_uuid" IS '工单UUID';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."operation_id" IS '工序ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."operation_name" IS '工序名称';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."material_id" IS '原材料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."material_name" IS '原材料名称';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."material_batch_no" IS '原材料批次号';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."quantity" IS '数量';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."trace_data" IS '追溯数据（JSON格式）';
COMMENT ON COLUMN "apps_kuaimes_traceabilities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_traceabilities" IS 'MES生产追溯表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaimes_rework_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "rework_order_no" VARCHAR(50) NOT NULL,
    "original_work_order_id" INT,
    "original_work_order_uuid" VARCHAR(36),
    "product_id" INT NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "rework_reason" TEXT NOT NULL,
    "rework_type" VARCHAR(50) NOT NULL,
    "route_id" INT,
    "route_name" VARCHAR(200),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "work_center_id" INT,
    "work_center_name" VARCHAR(200),
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "cost" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaime_tenant__f9033b" UNIQUE ("tenant_id", "rework_order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_tenant__3fdc94" ON "apps_kuaimes_rework_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_rework__ab8bc5" ON "apps_kuaimes_rework_orders" ("rework_order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_uuid_2d2d79" ON "apps_kuaimes_rework_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_origina_f2cb27" ON "apps_kuaimes_rework_orders" ("original_work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_origina_127c47" ON "apps_kuaimes_rework_orders" ("original_work_order_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_status_0d9d4c" ON "apps_kuaimes_rework_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_product_c05af5" ON "apps_kuaimes_rework_orders" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_work_ce_cac766" ON "apps_kuaimes_rework_orders" ("work_center_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_planned_75cc0b" ON "apps_kuaimes_rework_orders" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaime_created_a1b2de" ON "apps_kuaimes_rework_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."rework_order_no" IS '返修工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."original_work_order_id" IS '原工单ID（关联WorkOrder）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."original_work_order_uuid" IS '原工单UUID';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."product_id" IS '产品ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."product_name" IS '产品名称';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."quantity" IS '返修数量';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."rework_reason" IS '返修原因';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."rework_type" IS '返修类型（返工、返修、报废）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."route_id" IS '返修工艺路线ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."route_name" IS '返修工艺路线名称';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."status" IS '返修状态（草稿、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."work_center_id" IS '工作中心ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."work_center_name" IS '工作中心名称';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."operator_id" IS '操作员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."operator_name" IS '操作员姓名';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."cost" IS '返修成本';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaimes_rework_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaimes_rework_orders" IS 'MES返修工单表';;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaimes_work_orders";
        DROP TABLE IF EXISTS "apps_kuaimes_production_reports";
        DROP TABLE IF EXISTS "apps_kuaimes_traceabilities";
        DROP TABLE IF EXISTS "apps_kuaimes_rework_orders";
        DROP TABLE IF EXISTS "apps_kuaimes_orders";"""
