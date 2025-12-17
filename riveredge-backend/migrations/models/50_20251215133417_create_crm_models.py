from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_inspection_tasks" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "task_no" VARCHAR(50) NOT NULL,
    "inspection_type" VARCHAR(50) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(50),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL,
    "inspector_id" INT,
    "inspector_name" VARCHAR(100),
    "inspection_standard_id" INT,
    "inspection_standard_name" VARCHAR(200),
    "planned_inspection_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待检验',
    "priority" VARCHAR(20) NOT NULL  DEFAULT '中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__567c4b" UNIQUE ("tenant_id", "task_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__7fb104" ON "apps_kuaiqms_inspection_tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_task_no_9b988a" ON "apps_kuaiqms_inspection_tasks" ("task_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_d7a06d" ON "apps_kuaiqms_inspection_tasks" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_b11fca" ON "apps_kuaiqms_inspection_tasks" ("inspection_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__b5ef36" ON "apps_kuaiqms_inspection_tasks" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__e9b27d" ON "apps_kuaiqms_inspection_tasks" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__7af79e" ON "apps_kuaiqms_inspection_tasks" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_4b9b17" ON "apps_kuaiqms_inspection_tasks" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_d6fce7" ON "apps_kuaiqms_inspection_tasks" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__c2697f" ON "apps_kuaiqms_inspection_tasks" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_688673" ON "apps_kuaiqms_inspection_tasks" ("inspector_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_b84a45" ON "apps_kuaiqms_inspection_tasks" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_373c15" ON "apps_kuaiqms_inspection_tasks" ("planned_inspection_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_04ad84" ON "apps_kuaiqms_inspection_tasks" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."task_no" IS '检验任务编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspection_type" IS '检验类型（来料检验、过程检验、成品检验、委外来料检验）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."source_type" IS '来源类型（采购订单、生产订单、工单、委外订单）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."quantity" IS '检验数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspector_id" IS '检验员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspector_name" IS '检验员姓名';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspection_standard_id" IS '检验标准ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."inspection_standard_name" IS '检验标准名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."planned_inspection_date" IS '计划检验日期';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."status" IS '任务状态（待检验、检验中、已完成、已取消）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_inspection_tasks"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_inspection_tasks" IS 'QMS质量检验任务表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_inspection_records" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "record_no" VARCHAR(50) NOT NULL,
    "task_id" INT,
    "task_uuid" VARCHAR(36),
    "inspection_type" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL,
    "qualified_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "defective_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "inspection_result" VARCHAR(50) NOT NULL,
    "inspection_date" TIMESTAMPTZ NOT NULL,
    "inspector_id" INT,
    "inspector_name" VARCHAR(100),
    "inspection_standard_id" INT,
    "inspection_standard_name" VARCHAR(200),
    "inspection_data" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__3613a7" UNIQUE ("tenant_id", "record_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__5fb064" ON "apps_kuaiqms_inspection_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_record__57d5c2" ON "apps_kuaiqms_inspection_records" ("record_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_fbeef6" ON "apps_kuaiqms_inspection_records" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_task_id_5c52e3" ON "apps_kuaiqms_inspection_records" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_task_uu_433f86" ON "apps_kuaiqms_inspection_records" ("task_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_4c812d" ON "apps_kuaiqms_inspection_records" ("inspection_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_4e9623" ON "apps_kuaiqms_inspection_records" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_e09059" ON "apps_kuaiqms_inspection_records" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__113176" ON "apps_kuaiqms_inspection_records" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_203529" ON "apps_kuaiqms_inspection_records" ("inspector_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_0200f5" ON "apps_kuaiqms_inspection_records" ("inspection_result");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_inspect_366ed9" ON "apps_kuaiqms_inspection_records" ("inspection_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_6de90b" ON "apps_kuaiqms_inspection_records" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_f86152" ON "apps_kuaiqms_inspection_records" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."record_no" IS '检验记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."task_id" IS '检验任务ID（关联InspectionTask）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."task_uuid" IS '检验任务UUID';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_type" IS '检验类型（来料检验、过程检验、成品检验、委外来料检验）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."quantity" IS '检验数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."qualified_quantity" IS '合格数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."defective_quantity" IS '不合格数量';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_result" IS '检验结果（合格、不合格、让步接收）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_date" IS '检验日期';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspector_id" IS '检验员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspector_name" IS '检验员姓名';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_standard_id" IS '检验标准ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_standard_name" IS '检验标准名称';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."inspection_data" IS '检验数据（JSON格式，存储检验项和检验值）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."status" IS '记录状态（草稿、已确认、已审核）';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_inspection_records"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_inspection_records" IS 'QMS质量检验记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_nonconforming_products" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "record_no" VARCHAR(50) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(50),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "quantity" DECIMAL(18,4) NOT NULL,
    "defect_type" INT,
    "defect_type_name" VARCHAR(200),
    "defect_description" TEXT NOT NULL,
    "defect_cause" TEXT,
    "impact_assessment" VARCHAR(20),
    "impact_scope" TEXT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__7f3e44" UNIQUE ("tenant_id", "record_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__5376ce" ON "apps_kuaiqms_nonconforming_products" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_record__41394a" ON "apps_kuaiqms_nonconforming_products" ("record_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_738737" ON "apps_kuaiqms_nonconforming_products" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__2c0844" ON "apps_kuaiqms_nonconforming_products" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__dd225d" ON "apps_kuaiqms_nonconforming_products" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__606e2b" ON "apps_kuaiqms_nonconforming_products" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_1e08e0" ON "apps_kuaiqms_nonconforming_products" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_fd8fd9" ON "apps_kuaiqms_nonconforming_products" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__a8c300" ON "apps_kuaiqms_nonconforming_products" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_defect__80eefe" ON "apps_kuaiqms_nonconforming_products" ("defect_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_5279c0" ON "apps_kuaiqms_nonconforming_products" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_c34853" ON "apps_kuaiqms_nonconforming_products" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."record_no" IS '不合格品记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."source_type" IS '来源类型（检验记录、生产报工、客户投诉等）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."quantity" IS '不合格数量';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_type" IS '缺陷类型（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_type_name" IS '缺陷类型名称';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_description" IS '缺陷描述';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."defect_cause" IS '缺陷原因';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."impact_assessment" IS '影响评估（高、中、低）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."impact_scope" IS '影响范围描述';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."status" IS '记录状态（待处理、处理中、已处理、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_products"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_nonconforming_products" IS 'QMS不合格品记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_nonconforming_handlings" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "handling_no" VARCHAR(50) NOT NULL,
    "nonconforming_product_id" INT,
    "nonconforming_product_uuid" VARCHAR(36),
    "handling_type" VARCHAR(50) NOT NULL,
    "handling_plan" TEXT NOT NULL,
    "handling_executor_id" INT,
    "handling_executor_name" VARCHAR(100),
    "handling_date" TIMESTAMPTZ,
    "handling_result" VARCHAR(50),
    "handling_quantity" DECIMAL(18,4),
    "status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__c30ed4" UNIQUE ("tenant_id", "handling_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__4cfa71" ON "apps_kuaiqms_nonconforming_handlings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_85244c" ON "apps_kuaiqms_nonconforming_handlings" ("handling_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_5334be" ON "apps_kuaiqms_nonconforming_handlings" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_nonconf_6a41a3" ON "apps_kuaiqms_nonconforming_handlings" ("nonconforming_product_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_nonconf_58d33f" ON "apps_kuaiqms_nonconforming_handlings" ("nonconforming_product_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_710107" ON "apps_kuaiqms_nonconforming_handlings" ("handling_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_42dca5" ON "apps_kuaiqms_nonconforming_handlings" ("handling_executor_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_fe9f4d" ON "apps_kuaiqms_nonconforming_handlings" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_handlin_ce328d" ON "apps_kuaiqms_nonconforming_handlings" ("handling_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_72046f" ON "apps_kuaiqms_nonconforming_handlings" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_no" IS '处理单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."nonconforming_product_id" IS '不合格品记录ID（关联NonconformingProduct）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."nonconforming_product_uuid" IS '不合格品记录UUID';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_type" IS '处理类型（返工、返修、报废、让步接收）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_plan" IS '处理方案';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_executor_id" IS '处理执行人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_executor_name" IS '处理执行人姓名';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_date" IS '处理日期';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_result" IS '处理结果（成功、失败、部分成功）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."handling_quantity" IS '处理数量';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."status" IS '处理状态（待处理、处理中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_nonconforming_handlings"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_nonconforming_handlings" IS 'QMS不合格品处理表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_quality_traceabilities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "trace_no" VARCHAR(50) NOT NULL,
    "trace_type" VARCHAR(50) NOT NULL,
    "batch_no" VARCHAR(50),
    "serial_no" VARCHAR(50),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "trace_data" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '有效',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__148943" UNIQUE ("tenant_id", "trace_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__f5692e" ON "apps_kuaiqms_quality_traceabilities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_trace_n_635177" ON "apps_kuaiqms_quality_traceabilities" ("trace_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_ad4797" ON "apps_kuaiqms_quality_traceabilities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_trace_t_9b1d35" ON "apps_kuaiqms_quality_traceabilities" ("trace_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_batch_n_dbb189" ON "apps_kuaiqms_quality_traceabilities" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_serial__6ca36e" ON "apps_kuaiqms_quality_traceabilities" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_materia_a802d1" ON "apps_kuaiqms_quality_traceabilities" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_283437" ON "apps_kuaiqms_quality_traceabilities" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_d70d9f" ON "apps_kuaiqms_quality_traceabilities" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."trace_no" IS '追溯编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."trace_type" IS '追溯类型（批次追溯、序列号追溯、质量档案）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."trace_data" IS '追溯数据（JSON格式，存储追溯路径和相关信息）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."status" IS '追溯状态（有效、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_quality_traceabilities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_quality_traceabilities" IS 'QMS质量追溯表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_iso_audits" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "audit_no" VARCHAR(50) NOT NULL,
    "audit_type" VARCHAR(50) NOT NULL,
    "iso_standard" VARCHAR(100),
    "audit_scope" TEXT,
    "audit_date" TIMESTAMPTZ,
    "auditor_id" INT,
    "auditor_name" VARCHAR(100),
    "audit_result" VARCHAR(50),
    "findings" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '计划中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__2d5085" UNIQUE ("tenant_id", "audit_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__24b3ac" ON "apps_kuaiqms_iso_audits" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_n_8d7a23" ON "apps_kuaiqms_iso_audits" ("audit_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_4199f5" ON "apps_kuaiqms_iso_audits" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_t_03712e" ON "apps_kuaiqms_iso_audits" ("audit_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_iso_sta_19f59e" ON "apps_kuaiqms_iso_audits" ("iso_standard");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_auditor_6ce518" ON "apps_kuaiqms_iso_audits" ("auditor_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_r_22eb8d" ON "apps_kuaiqms_iso_audits" ("audit_result");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_28f0c4" ON "apps_kuaiqms_iso_audits" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_audit_d_bf87c1" ON "apps_kuaiqms_iso_audits" ("audit_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_4d5edc" ON "apps_kuaiqms_iso_audits" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_no" IS '审核编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_type" IS '审核类型（内审、外审）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."iso_standard" IS 'ISO标准（ISO 9001、ISO 14001、ISO 45001、IATF 16949等）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_scope" IS '审核范围';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_date" IS '审核日期';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."auditor_id" IS '审核员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."auditor_name" IS '审核员姓名';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."audit_result" IS '审核结果（通过、不通过、待整改）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."findings" IS '审核发现（JSON格式，存储审核问题和整改项）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."status" IS '审核状态（计划中、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_iso_audits"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_iso_audits" IS 'QMS ISO质量审核表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_capas" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "capa_no" VARCHAR(50) NOT NULL,
    "capa_type" VARCHAR(50) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(50),
    "problem_description" TEXT NOT NULL,
    "root_cause" TEXT,
    "corrective_action" TEXT,
    "preventive_action" TEXT,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "planned_completion_date" TIMESTAMPTZ,
    "actual_completion_date" TIMESTAMPTZ,
    "effectiveness_evaluation" TEXT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待执行',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__15922a" UNIQUE ("tenant_id", "capa_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__1e7ef8" ON "apps_kuaiqms_capas" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_capa_no_f096fc" ON "apps_kuaiqms_capas" ("capa_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_9755ef" ON "apps_kuaiqms_capas" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_capa_ty_30a9c8" ON "apps_kuaiqms_capas" ("capa_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__1aad88" ON "apps_kuaiqms_capas" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__772e18" ON "apps_kuaiqms_capas" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_source__7412d9" ON "apps_kuaiqms_capas" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_respons_8d59c5" ON "apps_kuaiqms_capas" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_e3d17d" ON "apps_kuaiqms_capas" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_39421b" ON "apps_kuaiqms_capas" ("planned_completion_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_7fd426" ON "apps_kuaiqms_capas" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_capas"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_capas"."capa_no" IS 'CAPA编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."capa_type" IS 'CAPA类型（纠正措施、预防措施）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."source_type" IS '来源类型（审核发现、不合格品、客户投诉等）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaiqms_capas"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaiqms_capas"."problem_description" IS '问题描述';
COMMENT ON COLUMN "apps_kuaiqms_capas"."root_cause" IS '根本原因';
COMMENT ON COLUMN "apps_kuaiqms_capas"."corrective_action" IS '纠正措施';
COMMENT ON COLUMN "apps_kuaiqms_capas"."preventive_action" IS '预防措施';
COMMENT ON COLUMN "apps_kuaiqms_capas"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaiqms_capas"."planned_completion_date" IS '计划完成日期';
COMMENT ON COLUMN "apps_kuaiqms_capas"."actual_completion_date" IS '实际完成日期';
COMMENT ON COLUMN "apps_kuaiqms_capas"."effectiveness_evaluation" IS '有效性评估';
COMMENT ON COLUMN "apps_kuaiqms_capas"."status" IS 'CAPA状态（待执行、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_capas"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_capas"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_capas" IS 'QMS CAPA（纠正预防措施）表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_continuous_improvements" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "improvement_no" VARCHAR(50) NOT NULL,
    "improvement_type" VARCHAR(50) NOT NULL,
    "improvement_title" VARCHAR(200) NOT NULL,
    "improvement_description" TEXT NOT NULL,
    "improvement_plan" TEXT,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "improvement_result" TEXT,
    "effectiveness_evaluation" TEXT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '计划中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__1c44cc" UNIQUE ("tenant_id", "improvement_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__562fdc" ON "apps_kuaiqms_continuous_improvements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_improve_2ee34d" ON "apps_kuaiqms_continuous_improvements" ("improvement_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_41d553" ON "apps_kuaiqms_continuous_improvements" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_improve_dfc703" ON "apps_kuaiqms_continuous_improvements" ("improvement_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_respons_6ca32f" ON "apps_kuaiqms_continuous_improvements" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_e40e4a" ON "apps_kuaiqms_continuous_improvements" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_2cd73c" ON "apps_kuaiqms_continuous_improvements" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_planned_815550" ON "apps_kuaiqms_continuous_improvements" ("planned_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_859e47" ON "apps_kuaiqms_continuous_improvements" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_no" IS '改进编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_type" IS '改进类型（流程改进、质量改进、效率改进等）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_title" IS '改进标题';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_description" IS '改进描述';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_plan" IS '改进计划';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."improvement_result" IS '改进结果';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."effectiveness_evaluation" IS '有效性评估';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."status" IS '改进状态（计划中、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_continuous_improvements"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_continuous_improvements" IS 'QMS持续改进表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_quality_objectives" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "objective_no" VARCHAR(50) NOT NULL,
    "objective_name" VARCHAR(200) NOT NULL,
    "objective_description" TEXT,
    "target_value" DECIMAL(18,4) NOT NULL,
    "current_value" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "unit" VARCHAR(50),
    "period" VARCHAR(50) NOT NULL,
    "period_start_date" TIMESTAMPTZ,
    "period_end_date" TIMESTAMPTZ,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "achievement_rate" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(50) NOT NULL  DEFAULT '进行中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__b9b190" UNIQUE ("tenant_id", "objective_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__589b0b" ON "apps_kuaiqms_quality_objectives" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_objecti_3a18b8" ON "apps_kuaiqms_quality_objectives" ("objective_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_d07c00" ON "apps_kuaiqms_quality_objectives" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_period_9de87e" ON "apps_kuaiqms_quality_objectives" ("period");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_respons_06eab9" ON "apps_kuaiqms_quality_objectives" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_7f5654" ON "apps_kuaiqms_quality_objectives" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_period__4be7b4" ON "apps_kuaiqms_quality_objectives" ("period_start_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_period__51c399" ON "apps_kuaiqms_quality_objectives" ("period_end_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_6ef8dd" ON "apps_kuaiqms_quality_objectives" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."objective_no" IS '目标编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."objective_name" IS '目标名称';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."objective_description" IS '目标描述';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."target_value" IS '目标值';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."current_value" IS '当前值';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."unit" IS '单位';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."period" IS '周期（年度、季度、月度）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."period_start_date" IS '周期开始日期';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."period_end_date" IS '周期结束日期';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."achievement_rate" IS '达成率（百分比）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."status" IS '目标状态（进行中、已完成、未达成、已关闭）';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_quality_objectives"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_quality_objectives" IS 'QMS质量目标表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaiqms_quality_indicators" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "indicator_no" VARCHAR(50) NOT NULL,
    "indicator_name" VARCHAR(200) NOT NULL,
    "indicator_description" TEXT,
    "indicator_type" VARCHAR(100) NOT NULL,
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "unit" VARCHAR(50),
    "calculation_method" TEXT,
    "data_source" VARCHAR(200),
    "monitoring_frequency" VARCHAR(50),
    "alert_threshold" DECIMAL(18,4),
    "status" VARCHAR(50) NOT NULL  DEFAULT '启用',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaiqm_tenant__2840f6" UNIQUE ("tenant_id", "indicator_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_tenant__8de2fd" ON "apps_kuaiqms_quality_indicators" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_indicat_e5f3a9" ON "apps_kuaiqms_quality_indicators" ("indicator_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_uuid_3b07ed" ON "apps_kuaiqms_quality_indicators" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_indicat_4baca0" ON "apps_kuaiqms_quality_indicators" ("indicator_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_status_2da102" ON "apps_kuaiqms_quality_indicators" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiqm_created_3a906b" ON "apps_kuaiqms_quality_indicators" ("created_at");
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_no" IS '指标编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_name" IS '指标名称';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_description" IS '指标描述';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."indicator_type" IS '指标类型（来料合格率、过程合格率、成品合格率等）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."target_value" IS '目标值';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."current_value" IS '当前值';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."unit" IS '单位';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."calculation_method" IS '计算方法';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."data_source" IS '数据来源';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."monitoring_frequency" IS '监控频率（每日、每周、每月）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."alert_threshold" IS '预警阈值';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."status" IS '指标状态（启用、停用）';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaiqms_quality_indicators"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaiqms_quality_indicators" IS 'QMS质量指标表';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaiqms_inspection_tasks";
        DROP TABLE IF EXISTS "apps_kuaiqms_inspection_records";
        DROP TABLE IF EXISTS "apps_kuaiqms_nonconforming_products";
        DROP TABLE IF EXISTS "apps_kuaiqms_nonconforming_handlings";
        DROP TABLE IF EXISTS "apps_kuaiqms_quality_traceabilities";
        DROP TABLE IF EXISTS "apps_kuaiqms_iso_audits";
        DROP TABLE IF EXISTS "apps_kuaiqms_capas";
        DROP TABLE IF EXISTS "apps_kuaiqms_continuous_improvements";
        DROP TABLE IF EXISTS "apps_kuaiqms_quality_objectives";
        DROP TABLE IF EXISTS "apps_kuaiqms_quality_indicators";"""


MODELS_STATE = (
    "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"
    "YRGmxGQWrgwI6Q3z//P05/Dfg="
)
