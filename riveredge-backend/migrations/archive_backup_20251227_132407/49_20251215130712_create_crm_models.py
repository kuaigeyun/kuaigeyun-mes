from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


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
COMMENT ON TABLE "apps_kuaimes_rework_orders" IS 'MES返修工单表';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaimes_work_orders";
        DROP TABLE IF EXISTS "apps_kuaimes_production_reports";
        DROP TABLE IF EXISTS "apps_kuaimes_traceabilities";
        DROP TABLE IF EXISTS "apps_kuaimes_rework_orders";
        DROP TABLE IF EXISTS "apps_kuaimes_orders";"""


MODELS_STATE = (
    "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"
    "43+ATnSWTJW8MydKWQjU6lVyEVxJeBfFSz7C7mBPgTbpDFDbrMorrt2Y/W9USJbzX1bs4r"
    "Y8qDxfu+x93MoorzabrVxnLr8t29Kne7BL8tuU+WJXeb1FSEfcrLxjzlsyfyJYli+TMIuz"
    "SegyZaT8d3ZnTt3v7sLNesvzVpFSPtd8J7H0OZrVmivalLU7oc/uqvJCXfe8yWt4l1egrb"
    "00AqxYNcKJHOJsweLvzZ8l+SXpKfknuxknvzKdNrTbKZ9S9kzmue4rJudajlzdsYksxT39"
    "YH+8Hi6VemZsiZrHcya6HyM5CslRSI5CchSSo5AcheQoJEcNkxwsee39F2Rt91YaGYkcZc"
    "RTMUiRUuMeVqKOTT0yAj9E69I99DSTYl6WZpnaxlSOPnd65QaONopLP8CyJpoZf2EzH6+w"
    "s+DxoMcAXVM2NIxGgj6Gc7cRrWgh5AHzhsMejCF184TLdiYwIUaPkJmcQDpQpP8c0iq71D"
    "Q1lW2lb2TRxD6jAFGWO2KwWVXDtbYRcu08N6psazVua6s7NM0MxGe5Owg9RT4LDIk3dFEf"
    "dl3ZwHBE6RvBfZ13czenbu7dQao7fj2YSr7RXjsEqp/KluDFjC0dL5bIF0K+kHmPvkY2qY"
    "kQ0Y4ppPBnejOFfs4snG6D3a/kj+s2Ja2ZQrrnnnRMoX162uzzwpmXVZRuZAqBshqqUFGl"
    "rjgbR+xXemuhtkjJIEJ60PD0oPXCpfcFOb5PEUYaM3Wj1UI+r7SlCrWpC2lDz4M2JM95+h"
    "qwR7szhsBqwb6tGDJ3MIDUBabydkpI7edf33Nf5if6j7KefElirAggOuqxIe0s5gvxTlkF"
    "77Oy1GhzN6vk++ASfap7I0GEkmaAQoT6mB7PZ7gGM6pHGIfqY7QfWSafuGhpy1apzLU8Rp"
    "/ZizM1Qj4cwM7Gp0i2OKTB4by9gPJrlhw4Y4NTKX8OEkIzFouyYDirZQ/kor6/M6cKyrfe"
    "/3z9+JGc6bJ+TOPsNPrH5Ru/QIxCupnZCSu8ZkfC+H/Qz5qzIRSsm+sSZm9ZmdwfJU1JGk"
    "eVSFQed/JnK7HmwTgSbyEbIzM4iNTYFLtXjZVBhSUkESGJCElESCJCEhGSiJBENNgQUBz6"
    "/iuytn+rrYwDLvZ1XAzCgTBWYsnqShOT2Qrvc/QMbHWVMNQAw3wgWkkN3nefD2wQyROxPT"
    "tHO1D7VEZz53CB4XE9MAtR1/Rw+7Y+oPLQG3UlTmQFgNW2MpyozI2wlykUdtUahVVCbFbs"
    "rWljMGvr44XD21mNTVoxtK6R4SytjbQOb2kY1bViZbWB4SysjU8Pb2ElFm7FyJo2hrPzjc"
    "D+COO5CiJYOnjWtDSc3e/DRcbvCnvH0TbdM/yJ9E6s6aGPqmVvGHK2b3f5uJ427PhqAkc5"
    "FIoEDjAecjTQj1cCmjHsjbdNGlDBzG7419ipA0MDtgajgchHRD7ivQyscqTc4iaqjL3e5M"
    "RfTqdjeskavnz78bjbHb/+/fS6DTlR99yTjpwYpfvNsSy8SVjp66mRnAgfEr+V5ERRDSAi"
    "Hsi/LkX1OfsQGYbf2RMgY5p8/Lp6L44pySShER8vpABcfuP3DYYhLAfrWrveSq7RWXoc3C"
    "koDsgznDrPUJ6+jFtU9LEOKQILCqxGmuf82sJyXGhSbJ2lQ0dWXJzQ/Bk9y/Gbxvkv7iJm"
    "0uJhkXW4SubFqS8vk8zZR7PxyHSBNa9Eb5vOKXLSaOVgYxiq5cGVf/AjSkHcnICnLmN8VM"
    "3o7dIhnU7waZXwhoQzJJwh4QwJZ0g4Q8IZEs6QcGZ5CChOWv8VWdu/1Vamsi7feaY1sO7K"
    "jq8lg1caGUk9ZMSzvsFwoOowWO810M5AUjta9+duE1qR2lHcL0unRk0r1hGMFpOm8C17wB"
    "AaWLwSaOto1PvD3Pq2h9vym/3wh97vC8uHJrD526tY2B2UtyJpUXY2lbRAQQsEkGwLWtwV"
    "YK8BkHojREB+4vfsK0kQbun9p6/boER1zz7VyVhInPvyiS25S8uiChedj9c0IgAsyn8Qfz"
    "8FKZcorFbCb6hD7YoBkSWIlnpJkp3vXRIk7fUq6p7nntk6SgooA3GkqeNI8pSUM/l1PrdG"
    "NQdWBxaCipbD2qULKvFnWu6PQ0tmZmTIZUAJJEy5Ovc8wV99j+KXbrwKy7vOtXoLgkO0IN"
    "QYQaSw5VXcqViy6l88MwgsWtX3kL6xTJnjqhm6NZBreSxdvdlh78NmHP4BjBalTLr8Y9iq"
    "qr4dfIw2wG4bpLufywr5HtXG5YVQYgERL0S8EPFCxAsRL0S8EPEaRWLBHuJVbWUq63LH07"
    "eB9Rf68JbMrjQxPvF9uj6JQXysjMXYOd9I9U9vHskOnLmJYkQA5oY9B5F+mdegXM1ObecB"
    "Oq8iXvrwoB3r1rY1lZFrNhxgYLzzCO3t3uiWnFvUPBXb94iWGDA0HJPN2bndTK5pY7C83K"
    "lkQiP8h/BfGxTELOT37/8PbQ2IWQ=="
)
