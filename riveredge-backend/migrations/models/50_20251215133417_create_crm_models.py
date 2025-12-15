from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_inspection_tasks" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__567c4b" UNIQUE ("tenant_id", "task_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__7fb104" ON "seed_kuaiqms_inspection_tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_task_no_9b988a" ON "seed_kuaiqms_inspection_tasks" ("task_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_d7a06d" ON "seed_kuaiqms_inspection_tasks" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_inspect_b11fca" ON "seed_kuaiqms_inspection_tasks" ("inspection_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__b5ef36" ON "seed_kuaiqms_inspection_tasks" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__e9b27d" ON "seed_kuaiqms_inspection_tasks" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__7af79e" ON "seed_kuaiqms_inspection_tasks" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_materia_4b9b17" ON "seed_kuaiqms_inspection_tasks" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_batch_n_d6fce7" ON "seed_kuaiqms_inspection_tasks" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_serial__c2697f" ON "seed_kuaiqms_inspection_tasks" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_inspect_688673" ON "seed_kuaiqms_inspection_tasks" ("inspector_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_b84a45" ON "seed_kuaiqms_inspection_tasks" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_planned_373c15" ON "seed_kuaiqms_inspection_tasks" ("planned_inspection_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_04ad84" ON "seed_kuaiqms_inspection_tasks" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."task_no" IS '检验任务编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."inspection_type" IS '检验类型（来料检验、过程检验、成品检验、委外来料检验）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."source_type" IS '来源类型（采购订单、生产订单、工单、委外订单）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."source_id" IS '来源ID';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."source_no" IS '来源编号';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."material_name" IS '物料名称';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."quantity" IS '检验数量';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."inspector_id" IS '检验员ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."inspector_name" IS '检验员姓名';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."inspection_standard_id" IS '检验标准ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."inspection_standard_name" IS '检验标准名称';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."planned_inspection_date" IS '计划检验日期';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."status" IS '任务状态（待检验、检验中、已完成、已取消）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_inspection_tasks"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_inspection_tasks" IS '质量检验任务模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_inspection_records" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__3613a7" UNIQUE ("tenant_id", "record_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__5fb064" ON "seed_kuaiqms_inspection_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_record__57d5c2" ON "seed_kuaiqms_inspection_records" ("record_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_fbeef6" ON "seed_kuaiqms_inspection_records" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_task_id_5c52e3" ON "seed_kuaiqms_inspection_records" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_task_uu_433f86" ON "seed_kuaiqms_inspection_records" ("task_uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_inspect_4c812d" ON "seed_kuaiqms_inspection_records" ("inspection_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_materia_4e9623" ON "seed_kuaiqms_inspection_records" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_batch_n_e09059" ON "seed_kuaiqms_inspection_records" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_serial__113176" ON "seed_kuaiqms_inspection_records" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_inspect_203529" ON "seed_kuaiqms_inspection_records" ("inspector_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_inspect_0200f5" ON "seed_kuaiqms_inspection_records" ("inspection_result");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_inspect_366ed9" ON "seed_kuaiqms_inspection_records" ("inspection_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_6de90b" ON "seed_kuaiqms_inspection_records" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_f86152" ON "seed_kuaiqms_inspection_records" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."record_no" IS '检验记录编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."task_id" IS '检验任务ID（关联InspectionTask）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."task_uuid" IS '检验任务UUID';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspection_type" IS '检验类型（来料检验、过程检验、成品检验、委外来料检验）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."material_name" IS '物料名称';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."quantity" IS '检验数量';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."qualified_quantity" IS '合格数量';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."defective_quantity" IS '不合格数量';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspection_result" IS '检验结果（合格、不合格、让步接收）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspection_date" IS '检验日期';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspector_id" IS '检验员ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspector_name" IS '检验员姓名';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspection_standard_id" IS '检验标准ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspection_standard_name" IS '检验标准名称';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."inspection_data" IS '检验数据（JSON格式，存储检验项和检验值）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."status" IS '记录状态（草稿、已确认、已审核）';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_inspection_records"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_inspection_records" IS '质量检验记录模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_nonconforming_products" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__7f3e44" UNIQUE ("tenant_id", "record_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__5376ce" ON "seed_kuaiqms_nonconforming_products" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_record__41394a" ON "seed_kuaiqms_nonconforming_products" ("record_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_738737" ON "seed_kuaiqms_nonconforming_products" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__2c0844" ON "seed_kuaiqms_nonconforming_products" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__dd225d" ON "seed_kuaiqms_nonconforming_products" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__606e2b" ON "seed_kuaiqms_nonconforming_products" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_materia_1e08e0" ON "seed_kuaiqms_nonconforming_products" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_batch_n_fd8fd9" ON "seed_kuaiqms_nonconforming_products" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_serial__a8c300" ON "seed_kuaiqms_nonconforming_products" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_defect__80eefe" ON "seed_kuaiqms_nonconforming_products" ("defect_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_5279c0" ON "seed_kuaiqms_nonconforming_products" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_c34853" ON "seed_kuaiqms_nonconforming_products" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."record_no" IS '不合格品记录编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."source_type" IS '来源类型（检验记录、生产报工、客户投诉等）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."source_id" IS '来源ID';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."source_no" IS '来源编号';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."material_name" IS '物料名称';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."quantity" IS '不合格数量';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."defect_type" IS '缺陷类型（关联master-data）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."defect_type_name" IS '缺陷类型名称';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."defect_description" IS '缺陷描述';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."defect_cause" IS '缺陷原因';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."impact_assessment" IS '影响评估（高、中、低）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."impact_scope" IS '影响范围描述';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."status" IS '记录状态（待处理、处理中、已处理、已关闭）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_products"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_nonconforming_products" IS '不合格品记录模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_nonconforming_handlings" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__c30ed4" UNIQUE ("tenant_id", "handling_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__4cfa71" ON "seed_kuaiqms_nonconforming_handlings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_handlin_85244c" ON "seed_kuaiqms_nonconforming_handlings" ("handling_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_5334be" ON "seed_kuaiqms_nonconforming_handlings" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_nonconf_6a41a3" ON "seed_kuaiqms_nonconforming_handlings" ("nonconforming_product_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_nonconf_58d33f" ON "seed_kuaiqms_nonconforming_handlings" ("nonconforming_product_uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_handlin_710107" ON "seed_kuaiqms_nonconforming_handlings" ("handling_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_handlin_42dca5" ON "seed_kuaiqms_nonconforming_handlings" ("handling_executor_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_fe9f4d" ON "seed_kuaiqms_nonconforming_handlings" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_handlin_ce328d" ON "seed_kuaiqms_nonconforming_handlings" ("handling_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_72046f" ON "seed_kuaiqms_nonconforming_handlings" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_no" IS '处理单编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."nonconforming_product_id" IS '不合格品记录ID（关联NonconformingProduct）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."nonconforming_product_uuid" IS '不合格品记录UUID';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_type" IS '处理类型（返工、返修、报废、让步接收）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_plan" IS '处理方案';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_executor_id" IS '处理执行人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_executor_name" IS '处理执行人姓名';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_date" IS '处理日期';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_result" IS '处理结果（成功、失败、部分成功）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."handling_quantity" IS '处理数量';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."status" IS '处理状态（待处理、处理中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_nonconforming_handlings"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_nonconforming_handlings" IS '不合格品处理模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_quality_traceabilities" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__148943" UNIQUE ("tenant_id", "trace_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__f5692e" ON "seed_kuaiqms_quality_traceabilities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_trace_n_635177" ON "seed_kuaiqms_quality_traceabilities" ("trace_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_ad4797" ON "seed_kuaiqms_quality_traceabilities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_trace_t_9b1d35" ON "seed_kuaiqms_quality_traceabilities" ("trace_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_batch_n_dbb189" ON "seed_kuaiqms_quality_traceabilities" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_serial__6ca36e" ON "seed_kuaiqms_quality_traceabilities" ("serial_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_materia_a802d1" ON "seed_kuaiqms_quality_traceabilities" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_283437" ON "seed_kuaiqms_quality_traceabilities" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_d70d9f" ON "seed_kuaiqms_quality_traceabilities" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."trace_no" IS '追溯编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."trace_type" IS '追溯类型（批次追溯、序列号追溯、质量档案）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."serial_no" IS '序列号（可选）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."material_id" IS '物料ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."material_name" IS '物料名称';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."trace_data" IS '追溯数据（JSON格式，存储追溯路径和相关信息）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."status" IS '追溯状态（有效、已关闭）';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_quality_traceabilities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_quality_traceabilities" IS '质量追溯模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_iso_audits" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__2d5085" UNIQUE ("tenant_id", "audit_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__24b3ac" ON "seed_kuaiqms_iso_audits" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_audit_n_8d7a23" ON "seed_kuaiqms_iso_audits" ("audit_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_4199f5" ON "seed_kuaiqms_iso_audits" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_audit_t_03712e" ON "seed_kuaiqms_iso_audits" ("audit_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_iso_sta_19f59e" ON "seed_kuaiqms_iso_audits" ("iso_standard");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_auditor_6ce518" ON "seed_kuaiqms_iso_audits" ("auditor_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_audit_r_22eb8d" ON "seed_kuaiqms_iso_audits" ("audit_result");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_28f0c4" ON "seed_kuaiqms_iso_audits" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_audit_d_bf87c1" ON "seed_kuaiqms_iso_audits" ("audit_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_4d5edc" ON "seed_kuaiqms_iso_audits" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."audit_no" IS '审核编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."audit_type" IS '审核类型（内审、外审）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."iso_standard" IS 'ISO标准（ISO 9001、ISO 14001、ISO 45001、IATF 16949等）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."audit_scope" IS '审核范围';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."audit_date" IS '审核日期';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."auditor_id" IS '审核员ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."auditor_name" IS '审核员姓名';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."audit_result" IS '审核结果（通过、不通过、待整改）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."findings" IS '审核发现（JSON格式，存储审核问题和整改项）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."status" IS '审核状态（计划中、执行中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_iso_audits"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_iso_audits" IS 'ISO质量审核模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_capas" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__15922a" UNIQUE ("tenant_id", "capa_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__1e7ef8" ON "seed_kuaiqms_capas" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_capa_no_f096fc" ON "seed_kuaiqms_capas" ("capa_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_9755ef" ON "seed_kuaiqms_capas" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_capa_ty_30a9c8" ON "seed_kuaiqms_capas" ("capa_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__1aad88" ON "seed_kuaiqms_capas" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__772e18" ON "seed_kuaiqms_capas" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_source__7412d9" ON "seed_kuaiqms_capas" ("source_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_respons_8d59c5" ON "seed_kuaiqms_capas" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_e3d17d" ON "seed_kuaiqms_capas" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_planned_39421b" ON "seed_kuaiqms_capas" ("planned_completion_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_7fd426" ON "seed_kuaiqms_capas" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_capas"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_capas"."capa_no" IS 'CAPA编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."capa_type" IS 'CAPA类型（纠正措施、预防措施）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."source_type" IS '来源类型（审核发现、不合格品、客户投诉等）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."source_id" IS '来源ID';
COMMENT ON COLUMN "seed_kuaiqms_capas"."source_no" IS '来源编号';
COMMENT ON COLUMN "seed_kuaiqms_capas"."problem_description" IS '问题描述';
COMMENT ON COLUMN "seed_kuaiqms_capas"."root_cause" IS '根本原因';
COMMENT ON COLUMN "seed_kuaiqms_capas"."corrective_action" IS '纠正措施';
COMMENT ON COLUMN "seed_kuaiqms_capas"."preventive_action" IS '预防措施';
COMMENT ON COLUMN "seed_kuaiqms_capas"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "seed_kuaiqms_capas"."planned_completion_date" IS '计划完成日期';
COMMENT ON COLUMN "seed_kuaiqms_capas"."actual_completion_date" IS '实际完成日期';
COMMENT ON COLUMN "seed_kuaiqms_capas"."effectiveness_evaluation" IS '有效性评估';
COMMENT ON COLUMN "seed_kuaiqms_capas"."status" IS 'CAPA状态（待执行、执行中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaiqms_capas"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_capas"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_capas" IS 'CAPA（纠正预防措施）模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_continuous_improvements" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__1c44cc" UNIQUE ("tenant_id", "improvement_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__562fdc" ON "seed_kuaiqms_continuous_improvements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_improve_2ee34d" ON "seed_kuaiqms_continuous_improvements" ("improvement_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_41d553" ON "seed_kuaiqms_continuous_improvements" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_improve_dfc703" ON "seed_kuaiqms_continuous_improvements" ("improvement_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_respons_6ca32f" ON "seed_kuaiqms_continuous_improvements" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_e40e4a" ON "seed_kuaiqms_continuous_improvements" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_planned_2cd73c" ON "seed_kuaiqms_continuous_improvements" ("planned_start_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_planned_815550" ON "seed_kuaiqms_continuous_improvements" ("planned_end_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_859e47" ON "seed_kuaiqms_continuous_improvements" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."improvement_no" IS '改进编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."improvement_type" IS '改进类型（流程改进、质量改进、效率改进等）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."improvement_title" IS '改进标题';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."improvement_description" IS '改进描述';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."improvement_plan" IS '改进计划';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."actual_start_date" IS '实际开始日期';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."actual_end_date" IS '实际结束日期';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."improvement_result" IS '改进结果';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."effectiveness_evaluation" IS '有效性评估';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."status" IS '改进状态（计划中、执行中、已完成、已关闭）';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_continuous_improvements"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_continuous_improvements" IS '持续改进模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_quality_objectives" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__b9b190" UNIQUE ("tenant_id", "objective_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__589b0b" ON "seed_kuaiqms_quality_objectives" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_objecti_3a18b8" ON "seed_kuaiqms_quality_objectives" ("objective_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_d07c00" ON "seed_kuaiqms_quality_objectives" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_period_9de87e" ON "seed_kuaiqms_quality_objectives" ("period");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_respons_06eab9" ON "seed_kuaiqms_quality_objectives" ("responsible_person_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_7f5654" ON "seed_kuaiqms_quality_objectives" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_period__4be7b4" ON "seed_kuaiqms_quality_objectives" ("period_start_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_period__51c399" ON "seed_kuaiqms_quality_objectives" ("period_end_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_6ef8dd" ON "seed_kuaiqms_quality_objectives" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."objective_no" IS '目标编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."objective_name" IS '目标名称';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."objective_description" IS '目标描述';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."target_value" IS '目标值';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."current_value" IS '当前值';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."unit" IS '单位';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."period" IS '周期（年度、季度、月度）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."period_start_date" IS '周期开始日期';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."period_end_date" IS '周期结束日期';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."achievement_rate" IS '达成率（百分比）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."status" IS '目标状态（进行中、已完成、未达成、已关闭）';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_quality_objectives"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_quality_objectives" IS '质量目标模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaiqms_quality_indicators" (
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
    CONSTRAINT "uid_seed_kuaiqm_tenant__2840f6" UNIQUE ("tenant_id", "indicator_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_tenant__8de2fd" ON "seed_kuaiqms_quality_indicators" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_indicat_e5f3a9" ON "seed_kuaiqms_quality_indicators" ("indicator_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_uuid_3b07ed" ON "seed_kuaiqms_quality_indicators" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_indicat_4baca0" ON "seed_kuaiqms_quality_indicators" ("indicator_type");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_status_2da102" ON "seed_kuaiqms_quality_indicators" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaiqm_created_3a906b" ON "seed_kuaiqms_quality_indicators" ("created_at");
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."indicator_no" IS '指标编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."indicator_name" IS '指标名称';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."indicator_description" IS '指标描述';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."indicator_type" IS '指标类型（来料合格率、过程合格率、成品合格率等）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."target_value" IS '目标值';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."current_value" IS '当前值';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."unit" IS '单位';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."calculation_method" IS '计算方法';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."data_source" IS '数据来源';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."monitoring_frequency" IS '监控频率（每日、每周、每月）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."alert_threshold" IS '预警阈值';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."status" IS '指标状态（启用、停用）';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaiqms_quality_indicators"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaiqms_quality_indicators" IS '质量指标模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "seed_kuaiqms_inspection_tasks";
        DROP TABLE IF EXISTS "seed_kuaiqms_inspection_records";
        DROP TABLE IF EXISTS "seed_kuaiqms_nonconforming_products";
        DROP TABLE IF EXISTS "seed_kuaiqms_nonconforming_handlings";
        DROP TABLE IF EXISTS "seed_kuaiqms_quality_traceabilities";
        DROP TABLE IF EXISTS "seed_kuaiqms_iso_audits";
        DROP TABLE IF EXISTS "seed_kuaiqms_capas";
        DROP TABLE IF EXISTS "seed_kuaiqms_continuous_improvements";
        DROP TABLE IF EXISTS "seed_kuaiqms_quality_objectives";
        DROP TABLE IF EXISTS "seed_kuaiqms_quality_indicators";"""
