from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" ADD "volume" DECIMAL(12,4) NOT NULL  DEFAULT 0;
        ALTER TABLE "apps_master_data_materials" ADD "weight" DECIMAL(12,4) NOT NULL  DEFAULT 0;
        CREATE TABLE IF NOT EXISTS "apps_master_data_bom_changes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "change_type" VARCHAR(50) NOT NULL,
    "change_content" JSONB,
    "change_reason" TEXT,
    "change_impact" JSONB,
    "bom_code" VARCHAR(100),
    "from_version" VARCHAR(50),
    "to_version" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "applicant_id" INT NOT NULL,
    "approver_id" INT,
    "approval_comment" TEXT,
    "applied_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__8f3864" ON "apps_master_data_bom_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_materia_08dd65" ON "apps_master_data_bom_changes" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_status_a724b8" ON "apps_master_data_bom_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_master_change__60940b" ON "apps_master_data_bom_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_apps_master_applica_3a72fa" ON "apps_master_data_bom_changes" ("applicant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_created_6834e2" ON "apps_master_data_bom_changes" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_apps_master_bom_cod_98946a" ON "apps_master_data_bom_changes" ("bom_code");
COMMENT ON COLUMN "apps_master_data_materials"."volume" IS '体积 (m³)';
COMMENT ON COLUMN "apps_master_data_materials"."weight" IS '重量 (kg)';
COMMENT ON COLUMN "apps_master_data_bom_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_master_data_bom_changes"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_master_data_bom_changes"."id" IS '变更记录ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."change_type" IS '变更类型（item_add:新增子件, item_remove:删除子件, item_modify:修改子件, version_change:版本变更, effective_change:生效日期变更, other:其他）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."change_content" IS '变更内容（JSON格式，详细记录变更前后对比、影响的BOM明细等）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "apps_master_data_bom_changes"."change_impact" IS '变更影响分析（JSON格式，记录影响的工单、需求、成本等）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."bom_code" IS '关联的 BOM 编码（可选）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."from_version" IS '变更前版本（可选）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."to_version" IS '变更后版本（可选）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."status" IS '变更状态（pending:待审批, approved:已审批, rejected:已拒绝, executed:已执行, cancelled:已取消）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."applicant_id" IS '申请人ID';
COMMENT ON COLUMN "apps_master_data_bom_changes"."approver_id" IS '审批人ID（可选）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."approval_comment" IS '审批意见（可选）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."applied_at" IS '应用时间（变更执行时间）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_bom_changes"."material_id" IS '关联主物料（BOM 父件）';
COMMENT ON TABLE "apps_master_data_bom_changes" IS '基础数据管理 - BOM 工程变更';;
        CREATE TABLE IF NOT EXISTS "apps_master_data_process_route_changes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "change_type" VARCHAR(50) NOT NULL,
    "change_content" JSONB,
    "change_reason" TEXT,
    "change_impact" JSONB,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "applicant_id" INT NOT NULL,
    "approver_id" INT,
    "approval_comment" TEXT,
    "applied_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "process_route_id" INT NOT NULL REFERENCES "apps_master_data_process_routes" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__5de069" ON "apps_master_data_process_route_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_process_7b1946" ON "apps_master_data_process_route_changes" ("process_route_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_status_7a2852" ON "apps_master_data_process_route_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_master_change__dca0a9" ON "apps_master_data_process_route_changes" ("change_type");
CREATE INDEX IF NOT EXISTS "idx_apps_master_applica_98fa8b" ON "apps_master_data_process_route_changes" ("applicant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_created_80a83e" ON "apps_master_data_process_route_changes" ("created_at");
COMMENT ON COLUMN "apps_master_data_process_route_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."id" IS '变更记录ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_type" IS '变更类型（operation_change:工序变更, time_change:标准工时变更, sop_change:SOP变更, other:其他）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_content" IS '变更内容（JSON格式，详细记录变更内容）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_reason" IS '变更原因';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."change_impact" IS '变更影响分析（JSON格式，记录影响的工单、影响程度等）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."status" IS '变更状态（pending:待审批, approved:已审批, rejected:已拒绝, executed:已执行, cancelled:已取消）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."applicant_id" IS '申请人ID';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."approver_id" IS '审批人ID（可选）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."approval_comment" IS '审批意见（可选）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."applied_at" IS '应用时间（变更执行时间）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_process_route_changes"."process_route_id" IS '关联工艺路线（内部使用自增ID）';
COMMENT ON TABLE "apps_master_data_process_route_changes" IS '基础数据管理 - 工艺路线变更';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_order_changes" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "change_type" VARCHAR(50) NOT NULL,
    "field_name" VARCHAR(100),
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "operator_id" INT NOT NULL,
    "operator_name" VARCHAR(100) NOT NULL,
    "order_id" INT NOT NULL REFERENCES "apps_kuaizhizao_purchase_orders" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."change_type" IS '变更类型 (Modify/Cancel/Price/Quantity)';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."field_name" IS '变更字段';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."old_value" IS '旧值';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."new_value" IS '新值';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."reason" IS '变更原因';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."operator_id" IS '操作人ID';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."operator_name" IS '操作人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_changes"."order_id" IS '关联订单';
COMMENT ON TABLE "apps_kuaizhizao_purchase_order_changes" IS '快格轻制造 - 采购订单变更日志';;
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" ADD "additional_fees_details" JSONB;
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" ADD "landing_cost" DECIMAL(12,2) NOT NULL  DEFAULT 0;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "assembly_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'draft',
    "product_material_id" INT NOT NULL,
    "product_material_code" VARCHAR(50) NOT NULL,
    "product_material_name" VARCHAR(200) NOT NULL,
    "total_quantity" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "total_items" INT NOT NULL  DEFAULT 0,
    "remarks" TEXT,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "executed_by" INT,
    "executed_by_name" VARCHAR(100),
    "executed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__775b89" ON "apps_kuaizhizao_assembly_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_14b9bd" ON "apps_kuaizhizao_assembly_orders" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembl_e4ee48" ON "apps_kuaizhizao_assembly_orders" ("assembly_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_dda61f" ON "apps_kuaizhizao_assembly_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_e9c3bd" ON "apps_kuaizhizao_assembly_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_items"."additional_fees_details" IS '杂费分摊明细 (JSON)';
COMMENT ON COLUMN "apps_kuaizhizao_purchase_order_items"."landing_cost" IS '分摊杂费/落地成本';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."code" IS '组装单号';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."assembly_date" IS '组装日期';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."status" IS '状态（draft/in_progress/completed/cancelled）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."product_material_id" IS '成品物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."product_material_code" IS '成品物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."product_material_name" IS '成品物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."total_quantity" IS '组装数量（成品数量）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."total_items" IS '组件明细数';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."created_by_name" IS '创建人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."updated_by_name" IS '更新人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."executed_by" IS '执行人ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."executed_by_name" IS '执行人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."executed_at" IS '执行时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_assembly_orders" IS '快格轻制造 - 组装单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_order_items" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "assembly_order_id" INT NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__0ed041" ON "apps_kuaizhizao_assembly_order_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembl_1ad017" ON "apps_kuaizhizao_assembly_order_items" ("assembly_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_f6da23" ON "apps_kuaizhizao_assembly_order_items" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_2a235d" ON "apps_kuaizhizao_assembly_order_items" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."assembly_order_id" IS '组装单ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."material_id" IS '组件物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."material_code" IS '组件物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."material_name" IS '组件物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."quantity" IS '消耗数量';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."unit_price" IS '单价';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."amount" IS '金额';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."status" IS '状态（pending/consumed）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_order_items"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_assembly_order_items" IS '快格轻制造 - 组装单明细';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_material_bindings" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "assembly_order_id" INT NOT NULL,
    "assembly_order_item_id" INT,
    "parent_material_id" INT NOT NULL,
    "parent_material_code" VARCHAR(50) NOT NULL,
    "parent_material_name" VARCHAR(200) NOT NULL,
    "parent_batch_no" VARCHAR(100),
    "child_material_id" INT NOT NULL,
    "child_material_code" VARCHAR(50) NOT NULL,
    "child_material_name" VARCHAR(200) NOT NULL,
    "child_batch_no" VARCHAR(100) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "executed_by" INT NOT NULL,
    "executed_by_name" VARCHAR(100) NOT NULL,
    "executed_at" TIMESTAMPTZ NOT NULL,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__cc9b06" ON "apps_kuaizhizao_assembly_material_bindings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembl_7944a7" ON "apps_kuaizhizao_assembly_material_bindings" ("assembly_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembl_0ecc21" ON "apps_kuaizhizao_assembly_material_bindings" ("assembly_order_item_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_parent__ccf7f6" ON "apps_kuaizhizao_assembly_material_bindings" ("parent_material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_child_m_a7bc06" ON "apps_kuaizhizao_assembly_material_bindings" ("child_material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_execute_e166fc" ON "apps_kuaizhizao_assembly_material_bindings" ("executed_at");
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."assembly_order_id" IS '组装单ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."assembly_order_item_id" IS '组装单明细ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."parent_material_id" IS '父件（成品）物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."parent_material_code" IS '父件物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."parent_material_name" IS '父件物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."parent_batch_no" IS '父件批次号（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."child_material_id" IS '子件物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."child_material_code" IS '子件物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."child_material_name" IS '子件物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."child_batch_no" IS '子件批次号';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."quantity" IS '消耗数量';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."executed_by" IS '执行人ID';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."executed_by_name" IS '执行人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."executed_at" IS '执行时间';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_assembly_material_bindings"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_assembly_material_bindings" IS '快格轻制造 - 装配物料绑定';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_backflush_records" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "work_order_id" INT NOT NULL,
    "work_order_code" VARCHAR(50) NOT NULL,
    "operation_id" INT,
    "operation_code" VARCHAR(50),
    "report_id" INT NOT NULL,
    "report_quantity" DECIMAL(18,4) NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_unit" VARCHAR(20),
    "batch_no" VARCHAR(100),
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200),
    "warehouse_type" VARCHAR(20),
    "bom_quantity" DECIMAL(18,4) NOT NULL,
    "backflush_quantity" DECIMAL(18,4) NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ,
    "processed_by" INT,
    "processed_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__1c993f" ON "apps_kuaizhizao_backflush_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_or_063cca" ON "apps_kuaizhizao_backflush_records" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_operati_8fd9f9" ON "apps_kuaizhizao_backflush_records" ("operation_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_report__58aca1" ON "apps_kuaizhizao_backflush_records" ("report_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_66fab3" ON "apps_kuaizhizao_backflush_records" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batch_n_769693" ON "apps_kuaizhizao_backflush_records" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_45a3b1" ON "apps_kuaizhizao_backflush_records" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."work_order_id" IS '工单ID';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."work_order_code" IS '工单编码';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."operation_id" IS '工序单ID';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."operation_code" IS '工序单编码';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."report_id" IS '报工记录ID';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."report_quantity" IS '报工数量';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."material_unit" IS '单位';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."batch_no" IS '批号';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."warehouse_id" IS '出库仓库ID（线边仓或主仓库）';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."warehouse_name" IS '出库仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."warehouse_type" IS '仓库类型';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."bom_quantity" IS 'BOM单位用量';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."backflush_quantity" IS '倒冲数量';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."status" IS '状态（pending=待处理, completed=已完成, failed=失败, cancelled=已取消）';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."error_message" IS '错误信息（失败时记录）';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."processed_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."processed_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."processed_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_backflush_records"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_backflush_records" IS '快格轻制造 - 物料倒冲记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_batching_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "work_order_id" INT,
    "work_order_code" VARCHAR(50),
    "production_plan_id" INT,
    "batching_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'draft',
    "total_items" INT NOT NULL  DEFAULT 0,
    "target_warehouse_id" INT,
    "target_warehouse_name" VARCHAR(200),
    "remarks" TEXT,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "executed_by" INT,
    "executed_by_name" VARCHAR(100),
    "executed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__42ee23" ON "apps_kuaizhizao_batching_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_02d3c9" ON "apps_kuaizhizao_batching_orders" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_or_76961a" ON "apps_kuaizhizao_batching_orders" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batchin_33a291" ON "apps_kuaizhizao_batching_orders" ("batching_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_93f473" ON "apps_kuaizhizao_batching_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_6e766c" ON "apps_kuaizhizao_batching_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."code" IS '配料单号';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."warehouse_id" IS '拣选源仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."warehouse_name" IS '拣选源仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."work_order_id" IS '关联工单ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."work_order_code" IS '关联工单编码';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."production_plan_id" IS '关联生产计划ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."batching_date" IS '配料日期';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."status" IS '状态（draft/picking/completed/cancelled）';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."total_items" IS '物料种类数';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."target_warehouse_id" IS '目标线边仓ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."target_warehouse_name" IS '目标线边仓名称';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."created_by_name" IS '创建人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."updated_by_name" IS '更新人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."executed_by" IS '执行人ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."executed_by_name" IS '执行人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."executed_at" IS '执行时间';
COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_batching_orders" IS '快格轻制造 - 配料单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_batching_order_items" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "batching_order_id" INT NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "unit" VARCHAR(20) NOT NULL  DEFAULT '',
    "required_quantity" DECIMAL(12,2) NOT NULL,
    "picked_quantity" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "location_id" INT,
    "location_code" VARCHAR(50),
    "batch_no" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__6be205" ON "apps_kuaizhizao_batching_order_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batchin_06b151" ON "apps_kuaizhizao_batching_order_items" ("batching_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_4537d6" ON "apps_kuaizhizao_batching_order_items" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_0c3bce" ON "apps_kuaizhizao_batching_order_items" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."batching_order_id" IS '配料单ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."unit" IS '单位';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."required_quantity" IS '需求数量';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."picked_quantity" IS '已拣数量';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."location_id" IS '库位ID';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."location_code" IS '库位编码';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."batch_no" IS '批次号';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."status" IS '状态（pending/picked）';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_batching_order_items"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_batching_order_items" IS '快格轻制造 - 配料单明细';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_computation_configs" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "config_code" VARCHAR(50) NOT NULL,
    "config_name" VARCHAR(200) NOT NULL,
    "config_scope" VARCHAR(50) NOT NULL  DEFAULT 'global',
    "material_id" INT,
    "material_code" VARCHAR(50),
    "material_name" VARCHAR(200),
    "warehouse_id" INT,
    "warehouse_code" VARCHAR(50),
    "warehouse_name" VARCHAR(200),
    "computation_params" JSONB NOT NULL,
    "is_template" BOOL NOT NULL  DEFAULT False,
    "template_name" VARCHAR(200),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "priority" INT NOT NULL  DEFAULT 0,
    "description" TEXT,
    "created_by" INT,
    "updated_by" INT,
    CONSTRAINT "uid_apps_kuaizh_tenant__8171b9" UNIQUE ("tenant_id", "config_code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__9d8f0d" ON "apps_kuaizhizao_computation_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__42f9d4" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "config_scope");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__d224cd" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__fd7ed3" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__66fe7c" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "is_template");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__3ad70a" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_config__c4d919" ON "apps_kuaizhizao_computation_configs" ("config_code");
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."config_code" IS '配置编码';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."config_name" IS '配置名称';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."config_scope" IS '配置维度（global/material/warehouse/material_warehouse）';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."material_id" IS '物料ID（当config_scope为material或material_warehouse时必填）';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."warehouse_id" IS '仓库ID（当config_scope为warehouse或material_warehouse时必填）';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."warehouse_code" IS '仓库编码';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."computation_params" IS '计算参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."is_template" IS '是否为模板';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."template_name" IS '模板名称（当is_template为true时使用）';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."priority" IS '优先级';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."description" IS '配置描述';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_computation_configs"."updated_by" IS '更新人ID';
COMMENT ON TABLE "apps_kuaizhizao_computation_configs" IS '快格轻制造 - 需求计算参数配置';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_barcode_mapping_rules" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "customer_id" INT,
    "customer_name" VARCHAR(200),
    "barcode_pattern" VARCHAR(500) NOT NULL,
    "barcode_type" VARCHAR(10) NOT NULL  DEFAULT '1d',
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "parsing_rule" JSONB,
    "is_enabled" BOOL NOT NULL  DEFAULT True,
    "priority" INT NOT NULL  DEFAULT 0,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__986c5d" ON "apps_kuaizhizao_barcode_mapping_rules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_custome_4ef48c" ON "apps_kuaizhizao_barcode_mapping_rules" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_9cd69c" ON "apps_kuaizhizao_barcode_mapping_rules" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_is_enab_a41ad5" ON "apps_kuaizhizao_barcode_mapping_rules" ("is_enabled");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_priorit_db0c08" ON "apps_kuaizhizao_barcode_mapping_rules" ("priority");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_72e3c8" ON "apps_kuaizhizao_barcode_mapping_rules" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."code" IS '映射规则编码';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."name" IS '映射规则名称';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."customer_id" IS '客户ID（可选，如果为空则适用于所有客户）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."customer_name" IS '客户名称（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."barcode_pattern" IS '条码模式（正则表达式）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."barcode_type" IS '条码类型（1d/2d）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."material_id" IS '映射到的物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."material_code" IS '映射到的物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."material_name" IS '映射到的物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."parsing_rule" IS '解析规则（JSON格式，定义如何从条码中提取信息）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."is_enabled" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."priority" IS '优先级（数字越大优先级越高）';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_barcode_mapping_rules" IS '快格轻制造 - 条码映射规则';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_material_registrations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "registration_code" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "barcode" VARCHAR(500) NOT NULL,
    "barcode_type" VARCHAR(10) NOT NULL  DEFAULT '1d',
    "parsed_data" JSONB,
    "mapped_material_id" INT,
    "mapped_material_code" VARCHAR(50),
    "mapped_material_name" VARCHAR(200),
    "mapping_rule_id" INT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "registration_date" TIMESTAMPTZ NOT NULL,
    "registered_by" INT NOT NULL,
    "registered_by_name" VARCHAR(100) NOT NULL,
    "warehouse_id" INT,
    "warehouse_name" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "processed_at" TIMESTAMPTZ,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__ae9d0e" ON "apps_kuaizhizao_customer_material_registrations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_custome_a48588" ON "apps_kuaizhizao_customer_material_registrations" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_159248" ON "apps_kuaizhizao_customer_material_registrations" ("barcode");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mapped__02cc76" ON "apps_kuaizhizao_customer_material_registrations" ("mapped_material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_registr_3134a3" ON "apps_kuaizhizao_customer_material_registrations" ("registration_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_78022d" ON "apps_kuaizhizao_customer_material_registrations" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_685efc" ON "apps_kuaizhizao_customer_material_registrations" ("created_at");
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
COMMENT ON TABLE "apps_kuaizhizao_customer_material_registrations" IS '快格轻制造 - 客户来料登记';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_delay_exceptions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "work_order_id" INT NOT NULL,
    "work_order_code" VARCHAR(50) NOT NULL,
    "planned_end_date" TIMESTAMPTZ NOT NULL,
    "actual_end_date" TIMESTAMPTZ,
    "delay_days" INT NOT NULL,
    "delay_reason" VARCHAR(500),
    "alert_level" VARCHAR(20) NOT NULL  DEFAULT 'medium',
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "suggested_action" VARCHAR(50),
    "handled_by" INT,
    "handled_by_name" VARCHAR(100),
    "handled_at" TIMESTAMPTZ,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__d2cacf" ON "apps_kuaizhizao_delivery_delay_exceptions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_or_37433d" ON "apps_kuaizhizao_delivery_delay_exceptions" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_l_4fd9ef" ON "apps_kuaizhizao_delivery_delay_exceptions" ("alert_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_2c8cc2" ON "apps_kuaizhizao_delivery_delay_exceptions" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_66d7ea" ON "apps_kuaizhizao_delivery_delay_exceptions" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."work_order_id" IS '工单ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."work_order_code" IS '工单编码';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."actual_end_date" IS '实际结束日期（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."delay_days" IS '延期天数';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."delay_reason" IS '延期原因';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."alert_level" IS '预警级别';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."status" IS '处理状态';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."suggested_action" IS '建议操作';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."handled_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."handled_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_delay_exceptions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_delivery_delay_exceptions" IS '快格轻制造 - 交期延期异常';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_notices" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "notice_code" VARCHAR(50) NOT NULL UNIQUE,
    "sales_delivery_id" INT,
    "sales_delivery_code" VARCHAR(50),
    "sales_order_id" INT,
    "sales_order_code" VARCHAR(50),
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_contact" VARCHAR(100),
    "customer_phone" VARCHAR(50),
    "planned_delivery_date" DATE,
    "carrier" VARCHAR(100),
    "tracking_number" VARCHAR(100),
    "shipping_address" TEXT,
    "status" VARCHAR(20) NOT NULL  DEFAULT '待发送',
    "sent_at" TIMESTAMPTZ,
    "signed_at" TIMESTAMPTZ,
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__2fe222" ON "apps_kuaizhizao_delivery_notices" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_notice__521290" ON "apps_kuaizhizao_delivery_notices" ("notice_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sales_d_3e6ea5" ON "apps_kuaizhizao_delivery_notices" ("sales_delivery_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sales_o_47ee58" ON "apps_kuaizhizao_delivery_notices" ("sales_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_custome_172aff" ON "apps_kuaizhizao_delivery_notices" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_69f084" ON "apps_kuaizhizao_delivery_notices" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."notice_code" IS '通知单编码';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."sales_delivery_id" IS '销售出库单ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."sales_delivery_code" IS '销售出库单编码';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."sales_order_id" IS '销售订单ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."sales_order_code" IS '销售订单编码';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."customer_id" IS '客户ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."customer_name" IS '客户名称';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."customer_contact" IS '客户联系人';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."customer_phone" IS '客户电话';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."planned_delivery_date" IS '预计送达日期';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."carrier" IS '承运商/物流方式';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."tracking_number" IS '运单号';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."shipping_address" IS '收货地址';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."status" IS '通知状态';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."sent_at" IS '发送时间';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."signed_at" IS '签收时间';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."total_quantity" IS '总数量';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_delivery_notices" IS '快格轻制造 - 送货单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_disassembly_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "disassembly_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'draft',
    "product_material_id" INT NOT NULL,
    "product_material_code" VARCHAR(50) NOT NULL,
    "product_material_name" VARCHAR(200) NOT NULL,
    "total_quantity" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "total_items" INT NOT NULL  DEFAULT 0,
    "remarks" TEXT,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "executed_by" INT,
    "executed_by_name" VARCHAR(100),
    "executed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__223b78" ON "apps_kuaizhizao_disassembly_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_84a782" ON "apps_kuaizhizao_disassembly_orders" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disasse_d4a74f" ON "apps_kuaizhizao_disassembly_orders" ("disassembly_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_3b8d58" ON "apps_kuaizhizao_disassembly_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_dd2738" ON "apps_kuaizhizao_disassembly_orders" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."code" IS '拆卸单号';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."disassembly_date" IS '拆卸日期';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."status" IS '状态（draft/in_progress/completed/cancelled）';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."product_material_id" IS '成品物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."product_material_code" IS '成品物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."product_material_name" IS '成品物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."total_quantity" IS '拆卸数量（成品数量）';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."total_items" IS '组件产出数';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."created_by_name" IS '创建人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."updated_by_name" IS '更新人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."executed_by" IS '执行人ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."executed_by_name" IS '执行人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."executed_at" IS '执行时间';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_disassembly_orders" IS '快格轻制造 - 拆卸单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_disassembly_order_items" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "disassembly_order_id" INT NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__4e6582" ON "apps_kuaizhizao_disassembly_order_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disasse_ca17f1" ON "apps_kuaizhizao_disassembly_order_items" ("disassembly_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_b9a476" ON "apps_kuaizhizao_disassembly_order_items" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_7059a0" ON "apps_kuaizhizao_disassembly_order_items" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."disassembly_order_id" IS '拆卸单ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."material_id" IS '组件物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."material_code" IS '组件物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."material_name" IS '组件物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."quantity" IS '产出数量';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."unit_price" IS '单价';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."amount" IS '金额';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."status" IS '状态（pending/produced）';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_disassembly_order_items"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_disassembly_order_items" IS '快格轻制造 - 拆卸单明细';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_document_node_timings" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "document_type" VARCHAR(50) NOT NULL,
    "document_id" INT NOT NULL,
    "document_code" VARCHAR(50) NOT NULL,
    "node_name" VARCHAR(100) NOT NULL,
    "node_code" VARCHAR(50) NOT NULL,
    "start_time" TIMESTAMPTZ,
    "end_time" TIMESTAMPTZ,
    "duration_seconds" INT,
    "duration_hours" DECIMAL(10,2),
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__261c6c" ON "apps_kuaizhizao_document_node_timings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_documen_76fb9c" ON "apps_kuaizhizao_document_node_timings" ("document_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_documen_aa58fe" ON "apps_kuaizhizao_document_node_timings" ("document_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_node_co_f2acaf" ON "apps_kuaizhizao_document_node_timings" ("node_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_start_t_9c229c" ON "apps_kuaizhizao_document_node_timings" ("start_time");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_end_tim_a6ecfa" ON "apps_kuaizhizao_document_node_timings" ("end_time");
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."document_type" IS '单据类型';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."document_id" IS '单据ID';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."document_code" IS '单据编码';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."node_name" IS '节点名称';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."node_code" IS '节点编码';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."start_time" IS '节点开始时间';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."end_time" IS '节点结束时间';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."duration_seconds" IS '节点耗时（秒）';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."duration_hours" IS '节点耗时（小时，排除非工作时间）';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."operator_id" IS '操作人ID';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."operator_name" IS '操作人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_document_node_timings" IS '快格轻制造 - 单据节点耗时';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
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
    "status" VARCHAR(50) NOT NULL  DEFAULT '正常',
    "is_active" BOOL NOT NULL  DEFAULT True,
    "total_running_hours" INT NOT NULL  DEFAULT 0,
    "total_cycle_count" INT NOT NULL  DEFAULT 0,
    "needs_calibration" BOOL NOT NULL  DEFAULT False,
    "calibration_period" INT,
    "last_calibration_date" DATE,
    "next_calibration_date" DATE,
    "description" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__d96d5d" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__126f02" ON "apps_kuaizhizao_equipment" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_code_ef19be" ON "apps_kuaizhizao_equipment" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_uuid_40dddc" ON "apps_kuaizhizao_equipment" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_type_993641" ON "apps_kuaizhizao_equipment" ("type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_categor_5c569e" ON "apps_kuaizhizao_equipment" ("category");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_worksta_c8e354" ON "apps_kuaizhizao_equipment" ("workstation_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_ce_ba1940" ON "apps_kuaizhizao_equipment" ("work_center_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_5ce182" ON "apps_kuaizhizao_equipment" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."code" IS '设备编码（组织内唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."type" IS '设备类型（如：加工设备、检测设备、包装设备等）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."category" IS '设备分类（如：CNC、注塑机、冲压机等）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."brand" IS '品牌';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."model" IS '型号';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."serial_number" IS '序列号';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."manufacturer" IS '制造商';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."supplier" IS '供应商';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."purchase_date" IS '采购日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."installation_date" IS '安装日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."warranty_period" IS '保修期（月）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."technical_parameters" IS '技术参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."workstation_id" IS '关联工位ID（可选，关联到工位）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."workstation_code" IS '工位编码';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."workstation_name" IS '工位名称';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."work_center_id" IS '关联工作中心ID（可选，关联到工作中心）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."work_center_code" IS '工作中心编码';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."work_center_name" IS '工作中心名称';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."status" IS '设备状态（正常、维修中、停用、校验中、报废）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."total_running_hours" IS '累计运行小时数';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."total_cycle_count" IS '累计循环次数/冲压次数';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."needs_calibration" IS '是否需要校验';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."calibration_period" IS '校验周期（天）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."last_calibration_date" IS '上次校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."next_calibration_date" IS '下次校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."description" IS '描述';
COMMENT ON COLUMN "apps_kuaizhizao_equipment"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_equipment" IS '快格轻制造 - 设备';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_calibrations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "calibration_date" DATE NOT NULL,
    "result" VARCHAR(50) NOT NULL,
    "certificate_no" VARCHAR(100),
    "expiry_date" DATE,
    "attachment_uuid" VARCHAR(36),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__a49ff5" ON "apps_kuaizhizao_equipment_calibrations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_6313ba" ON "apps_kuaizhizao_equipment_calibrations" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_calibra_b5985b" ON "apps_kuaizhizao_equipment_calibrations" ("calibration_date");
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."calibration_date" IS '校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."result" IS '校验结果（合格、不合格、限制使用）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."certificate_no" IS '证书编号';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."expiry_date" IS '有效期至';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."attachment_uuid" IS '报告附件ID';
COMMENT ON TABLE "apps_kuaizhizao_equipment_calibrations" IS '快格轻制造 - 设备校准记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_faults" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "fault_no" VARCHAR(100) NOT NULL,
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "fault_date" TIMESTAMPTZ NOT NULL,
    "fault_type" VARCHAR(50) NOT NULL,
    "fault_description" TEXT NOT NULL,
    "fault_level" VARCHAR(50) NOT NULL,
    "reporter_id" INT,
    "reporter_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '待处理',
    "repair_required" BOOL NOT NULL  DEFAULT True,
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__186942" UNIQUE ("tenant_id", "fault_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__050a74" ON "apps_kuaizhizao_equipment_faults" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_fault_n_4b8fde" ON "apps_kuaizhizao_equipment_faults" ("fault_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_bd7f44" ON "apps_kuaizhizao_equipment_faults" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_1d209c" ON "apps_kuaizhizao_equipment_faults" ("equipment_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_fault_d_70fb43" ON "apps_kuaizhizao_equipment_faults" ("fault_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_e9b2da" ON "apps_kuaizhizao_equipment_faults" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."fault_no" IS '故障记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."equipment_id" IS '设备ID（关联设备）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."fault_date" IS '故障发生日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."fault_type" IS '故障类型（机械故障、电气故障、软件故障、其他）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."fault_description" IS '故障描述';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."fault_level" IS '故障级别（轻微、一般、严重、紧急）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."reporter_id" IS '报告人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."reporter_name" IS '报告人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."status" IS '故障状态（待处理、处理中、已修复、已关闭）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."repair_required" IS '是否需要维修';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_equipment_faults" IS '快格轻制造 - 设备故障';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_repairs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "repair_no" VARCHAR(100) NOT NULL,
    "equipment_fault_id" INT,
    "equipment_fault_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "repair_date" TIMESTAMPTZ NOT NULL,
    "repair_type" VARCHAR(50) NOT NULL,
    "repair_description" TEXT NOT NULL,
    "repair_cost" DECIMAL(10,2),
    "repair_parts" JSONB,
    "repairer_id" INT,
    "repairer_name" VARCHAR(100),
    "repair_duration" DECIMAL(10,2),
    "status" VARCHAR(50) NOT NULL  DEFAULT '进行中',
    "repair_result" VARCHAR(50),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__8d6eda" UNIQUE ("tenant_id", "repair_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__7f7403" ON "apps_kuaizhizao_equipment_repairs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_repair__e42601" ON "apps_kuaizhizao_equipment_repairs" ("repair_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_7a73e4" ON "apps_kuaizhizao_equipment_repairs" ("equipment_fault_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_a8e09b" ON "apps_kuaizhizao_equipment_repairs" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_repair__282c40" ON "apps_kuaizhizao_equipment_repairs" ("repair_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_47b1c6" ON "apps_kuaizhizao_equipment_repairs" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_no" IS '维修记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."equipment_fault_id" IS '设备故障ID（关联故障记录）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."equipment_fault_uuid" IS '设备故障UUID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."equipment_id" IS '设备ID（关联设备）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_date" IS '维修日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_type" IS '维修类型（现场维修、返厂维修、委外维修）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_description" IS '维修描述';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_cost" IS '维修成本';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_parts" IS '维修备件（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repairer_id" IS '维修人员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repairer_name" IS '维修人员姓名';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_duration" IS '维修时长（小时）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."status" IS '维修状态（进行中、已完成、已取消）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."repair_result" IS '维修结果（成功、失败、部分成功）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_equipment_repairs" IS '快格轻制造 - 设备维修记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_point_inspection_plans" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "plan_no" VARCHAR(50) NOT NULL,
    "plan_name" VARCHAR(200) NOT NULL,
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "inspection_items" JSONB NOT NULL,
    "cycle_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '启用',
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "description" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__4e2289" UNIQUE ("tenant_id", "plan_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__3e90e8" ON "apps_kuaizhizao_equipment_point_inspection_plans" ("tenant_id");
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."plan_no" IS '计划编号';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."plan_name" IS '计划名称';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."inspection_items" IS '点检项目（JSON格式，包含：项目名称、标准、检查方法）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."cycle_type" IS '周期类型（每天、每周、每月）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."status" IS '状态（启用、停用）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."responsible_person_id" IS '负责人ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_plans"."responsible_person_name" IS '负责人姓名';
COMMENT ON TABLE "apps_kuaizhizao_equipment_point_inspection_plans" IS '快格轻制造 - 设备点检计划';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_point_inspection_records" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "record_no" VARCHAR(50) NOT NULL,
    "plan_id" INT,
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "inspection_date" DATE NOT NULL,
    "inspector_id" INT,
    "inspector_name" VARCHAR(100),
    "results" JSONB NOT NULL,
    "has_abnormality" BOOL NOT NULL  DEFAULT False,
    "abnormality_description" TEXT,
    "fault_report_uuid" VARCHAR(36),
    "status" VARCHAR(50) NOT NULL  DEFAULT '已完成',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__0cb767" ON "apps_kuaizhizao_equipment_point_inspection_records" ("tenant_id");
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."record_no" IS '记录编号';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."plan_id" IS '关联计划ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."inspection_date" IS '点检日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."inspector_id" IS '点检人ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."inspector_name" IS '点检人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."results" IS '点检结果详情（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."has_abnormality" IS '是否存在异常';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."abnormality_description" IS '异常描述';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."fault_report_uuid" IS '关联故障记录UUID（如果触发报修）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_point_inspection_records"."status" IS '记录状态（待点检、已完成）';
COMMENT ON TABLE "apps_kuaizhizao_equipment_point_inspection_records" IS '快格轻制造 - 设备点检记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_status_histories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "from_status" VARCHAR(50),
    "to_status" VARCHAR(50) NOT NULL,
    "status_changed_at" TIMESTAMPTZ NOT NULL,
    "changed_by" INT,
    "changed_by_name" VARCHAR(100),
    "reason" VARCHAR(200),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__7140fd" ON "apps_kuaizhizao_equipment_status_histories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_1ff58a" ON "apps_kuaizhizao_equipment_status_histories" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_49e8b2" ON "apps_kuaizhizao_equipment_status_histories" ("equipment_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status__db0254" ON "apps_kuaizhizao_equipment_status_histories" ("status_changed_at");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_to_stat_527888" ON "apps_kuaizhizao_equipment_status_histories" ("to_status");
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."from_status" IS '原状态';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."to_status" IS '新状态';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."status_changed_at" IS '状态变更时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."changed_by" IS '变更人ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."changed_by_name" IS '变更人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."reason" IS '变更原因';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_histories"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_equipment_status_histories" IS '快格轻制造 - 设备状态历史';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_status_monitors" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "equipment_code" VARCHAR(50) NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '正常',
    "is_online" BOOL NOT NULL  DEFAULT False,
    "runtime_hours" DECIMAL(10,2),
    "last_maintenance_date" TIMESTAMPTZ,
    "next_maintenance_date" TIMESTAMPTZ,
    "temperature" DECIMAL(8,2),
    "pressure" DECIMAL(10,2),
    "vibration" DECIMAL(10,2),
    "other_parameters" JSONB,
    "data_source" VARCHAR(50) NOT NULL  DEFAULT 'manual',
    "monitored_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__cbf30a" ON "apps_kuaizhizao_equipment_status_monitors" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_930637" ON "apps_kuaizhizao_equipment_status_monitors" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_7d6555" ON "apps_kuaizhizao_equipment_status_monitors" ("equipment_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_abbb01" ON "apps_kuaizhizao_equipment_status_monitors" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_is_onli_377a0b" ON "apps_kuaizhizao_equipment_status_monitors" ("is_online");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_monitor_b0f73b" ON "apps_kuaizhizao_equipment_status_monitors" ("monitored_at");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_2ad4dd" ON "apps_kuaizhizao_equipment_status_monitors" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."equipment_code" IS '设备编码';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."status" IS '设备状态（正常、运行中、待机、维修中、故障、停用）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."is_online" IS '是否在线';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."runtime_hours" IS '运行时长（小时）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."last_maintenance_date" IS '上次维护日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."next_maintenance_date" IS '下次维护日期';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."temperature" IS '温度（摄氏度）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."pressure" IS '压力';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."vibration" IS '振动值';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."other_parameters" IS '其他参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."data_source" IS '数据来源（manual/SCADA/sensor）';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."monitored_at" IS '监控时间';
COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_equipment_status_monitors" IS '快格轻制造 - 设备状态监控';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_exception_process_histories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "process_record_id" INT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "action_by" INT NOT NULL,
    "action_by_name" VARCHAR(100) NOT NULL,
    "action_at" TIMESTAMPTZ NOT NULL,
    "from_step" VARCHAR(50),
    "to_step" VARCHAR(50),
    "comment" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__ffe50c" ON "apps_kuaizhizao_exception_process_histories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_process_3a5b59" ON "apps_kuaizhizao_exception_process_histories" ("process_record_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_action_40b6bf" ON "apps_kuaizhizao_exception_process_histories" ("action");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_action__efbd56" ON "apps_kuaizhizao_exception_process_histories" ("action_by");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_action__7a17b4" ON "apps_kuaizhizao_exception_process_histories" ("action_at");
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."process_record_id" IS '处理记录ID';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."action" IS '操作类型';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."action_by" IS '操作人ID';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."action_by_name" IS '操作人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."action_at" IS '操作时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."from_step" IS '来源步骤';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."to_step" IS '目标步骤';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."comment" IS '操作说明';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_histories"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_exception_process_histories" IS '快格轻制造 - 异常处理历史';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_exception_process_records" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "exception_type" VARCHAR(50) NOT NULL,
    "exception_id" INT NOT NULL,
    "process_status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "current_step" VARCHAR(50) NOT NULL  DEFAULT 'detected',
    "assigned_to" INT,
    "assigned_to_name" VARCHAR(100),
    "assigned_at" TIMESTAMPTZ,
    "inngest_run_id" VARCHAR(100),
    "process_config" JSONB,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__302dc9" ON "apps_kuaizhizao_exception_process_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_excepti_d2670c" ON "apps_kuaizhizao_exception_process_records" ("exception_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_excepti_d3c6fd" ON "apps_kuaizhizao_exception_process_records" ("exception_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_process_57e1e2" ON "apps_kuaizhizao_exception_process_records" ("process_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_current_a5bf6d" ON "apps_kuaizhizao_exception_process_records" ("current_step");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assigne_27ee8b" ON "apps_kuaizhizao_exception_process_records" ("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_ed571f" ON "apps_kuaizhizao_exception_process_records" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."exception_type" IS '异常类型';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."exception_id" IS '异常记录ID';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."process_status" IS '处理流程状态';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."current_step" IS '当前步骤';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."assigned_to" IS '分配给（用户ID）';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."assigned_to_name" IS '分配给（用户名）';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."assigned_at" IS '分配时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."inngest_run_id" IS 'Inngest运行ID';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."process_config" IS '流程配置（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."started_at" IS '开始时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."completed_at" IS '完成时间';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_exception_process_records"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_exception_process_records" IS '快格轻制造 - 异常处理记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inspection_plans" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "plan_code" VARCHAR(50) NOT NULL,
    "plan_name" VARCHAR(200) NOT NULL,
    "plan_type" VARCHAR(50) NOT NULL,
    "material_id" INT,
    "material_code" VARCHAR(50),
    "material_name" VARCHAR(200),
    "operation_id" INT,
    "version" VARCHAR(20) NOT NULL  DEFAULT '1.0',
    "is_active" BOOL NOT NULL  DEFAULT True,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__c29506" UNIQUE ("tenant_id", "plan_code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__63082f" ON "apps_kuaizhizao_inspection_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_plan_co_508af8" ON "apps_kuaizhizao_inspection_plans" ("plan_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_plan_ty_fe6e6d" ON "apps_kuaizhizao_inspection_plans" ("plan_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_fb03e1" ON "apps_kuaizhizao_inspection_plans" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_is_acti_51b8ed" ON "apps_kuaizhizao_inspection_plans" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_7ef883" ON "apps_kuaizhizao_inspection_plans" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."plan_code" IS '方案编码';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."plan_name" IS '方案名称';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."plan_type" IS '类型（incoming/process/finished）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."material_id" IS '适用物料ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."material_code" IS '物料编码（冗余）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."material_name" IS '物料名称（冗余）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."operation_id" IS '适用工序ID（过程检验时）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."version" IS '版本号';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_inspection_plans" IS '快格轻制造 - 质检方案';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inspection_plan_steps" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "sequence" INT NOT NULL  DEFAULT 0,
    "inspection_item" VARCHAR(200) NOT NULL,
    "inspection_method" VARCHAR(200),
    "acceptance_criteria" TEXT,
    "sampling_type" VARCHAR(20) NOT NULL  DEFAULT 'full',
    "quality_standard_id" INT,
    "remarks" TEXT,
    "plan_id" INT NOT NULL REFERENCES "apps_kuaizhizao_inspection_plans" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__c41de7" ON "apps_kuaizhizao_inspection_plan_steps" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_plan_id_3f4cff" ON "apps_kuaizhizao_inspection_plan_steps" ("plan_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sequenc_78f04e" ON "apps_kuaizhizao_inspection_plan_steps" ("sequence");
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."sequence" IS '步骤序号';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."inspection_item" IS '检验项目名称';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."inspection_method" IS '检验方法';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."acceptance_criteria" IS '合格标准';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."sampling_type" IS '抽样方式（full/sampling）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."quality_standard_id" IS '引用的质检标准ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_inspection_plan_steps"."plan_id" IS '关联质检方案';
COMMENT ON TABLE "apps_kuaizhizao_inspection_plan_steps" IS '快格轻制造 - 质检方案步骤';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_alerts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "alert_rule_id" INT,
    "alert_type" VARCHAR(20) NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "current_quantity" DECIMAL(12,2) NOT NULL,
    "threshold_value" DECIMAL(12,2) NOT NULL,
    "alert_level" VARCHAR(20) NOT NULL  DEFAULT 'warning',
    "alert_message" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "handled_by" INT,
    "handled_by_name" VARCHAR(100),
    "handled_at" TIMESTAMPTZ,
    "handling_notes" TEXT,
    "triggered_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__5cdd03" ON "apps_kuaizhizao_inventory_alerts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_r_cf8ee8" ON "apps_kuaizhizao_inventory_alerts" ("alert_rule_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_t_cbb81a" ON "apps_kuaizhizao_inventory_alerts" ("alert_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_a7ad3e" ON "apps_kuaizhizao_inventory_alerts" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_f5ef1d" ON "apps_kuaizhizao_inventory_alerts" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_0ca133" ON "apps_kuaizhizao_inventory_alerts" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_l_d362b6" ON "apps_kuaizhizao_inventory_alerts" ("alert_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_trigger_855eb5" ON "apps_kuaizhizao_inventory_alerts" ("triggered_at");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_fcb2ce" ON "apps_kuaizhizao_inventory_alerts" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_rule_id" IS '预警规则ID（关联InventoryAlertRule）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_type" IS '预警类型（low_stock/high_stock/expired）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."current_quantity" IS '当前库存数量';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."threshold_value" IS '阈值数值';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_level" IS '预警级别（info/warning/critical）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_message" IS '预警消息';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."status" IS '状态（pending/processing/resolved/ignored）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handled_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handled_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handling_notes" IS '处理备注';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."triggered_at" IS '触发时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."resolved_at" IS '解决时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_inventory_alerts" IS '快格轻制造 - 库存预警';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_alert_rules" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "alert_type" VARCHAR(20) NOT NULL,
    "material_id" INT,
    "material_code" VARCHAR(50),
    "material_name" VARCHAR(200),
    "warehouse_id" INT,
    "warehouse_name" VARCHAR(200),
    "threshold_type" VARCHAR(20) NOT NULL,
    "threshold_value" DECIMAL(12,2) NOT NULL,
    "is_enabled" BOOL NOT NULL  DEFAULT True,
    "notify_users" JSONB,
    "notify_roles" JSONB,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__4c81ad" ON "apps_kuaizhizao_inventory_alert_rules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_t_768c92" ON "apps_kuaizhizao_inventory_alert_rules" ("alert_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_98472c" ON "apps_kuaizhizao_inventory_alert_rules" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_6937ed" ON "apps_kuaizhizao_inventory_alert_rules" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_is_enab_05116e" ON "apps_kuaizhizao_inventory_alert_rules" ("is_enabled");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_b1024a" ON "apps_kuaizhizao_inventory_alert_rules" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."code" IS '预警规则编码';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."name" IS '预警规则名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."alert_type" IS '预警类型（low_stock/high_stock/expired）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."material_id" IS '物料ID（可选，如果为空则适用于所有物料）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."material_code" IS '物料编码（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."material_name" IS '物料名称（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."warehouse_id" IS '仓库ID（可选，如果为空则适用于所有仓库）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."warehouse_name" IS '仓库名称（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."threshold_type" IS '阈值类型（quantity/percentage/days）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."threshold_value" IS '阈值数值';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."is_enabled" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."notify_users" IS '通知用户ID列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."notify_roles" IS '通知角色ID列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_inventory_alert_rules" IS '快格轻制造 - 库存预警规则';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_transfers" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "from_warehouse_id" INT NOT NULL,
    "from_warehouse_name" VARCHAR(200) NOT NULL,
    "to_warehouse_id" INT NOT NULL,
    "to_warehouse_name" VARCHAR(200) NOT NULL,
    "transfer_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'draft',
    "total_items" INT NOT NULL  DEFAULT 0,
    "total_quantity" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "transfer_reason" TEXT,
    "remarks" TEXT,
    "executed_by" INT,
    "executed_by_name" VARCHAR(100),
    "executed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__906988" ON "apps_kuaizhizao_inventory_transfers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_from_wa_06c5f4" ON "apps_kuaizhizao_inventory_transfers" ("from_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_to_ware_3540e8" ON "apps_kuaizhizao_inventory_transfers" ("to_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_transfe_3fb7d1" ON "apps_kuaizhizao_inventory_transfers" ("transfer_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_465930" ON "apps_kuaizhizao_inventory_transfers" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_80d8a0" ON "apps_kuaizhizao_inventory_transfers" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."code" IS '调拨单号';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."from_warehouse_id" IS '调出仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."from_warehouse_name" IS '调出仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."to_warehouse_id" IS '调入仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."to_warehouse_name" IS '调入仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."transfer_date" IS '调拨日期';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."status" IS '状态（draft/in_progress/completed/cancelled）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."total_items" IS '调拨物料总数';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."total_quantity" IS '调拨总数量';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."total_amount" IS '调拨总金额';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."transfer_reason" IS '调拨原因';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."executed_by" IS '执行人ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."executed_by_name" IS '执行人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."executed_at" IS '执行时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_inventory_transfers" IS '快格轻制造 - 库存调拨单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_transfer_items" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "transfer_id" INT NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "from_warehouse_id" INT NOT NULL,
    "from_location_id" INT,
    "from_location_code" VARCHAR(50),
    "to_warehouse_id" INT NOT NULL,
    "to_location_id" INT,
    "to_location_code" VARCHAR(50),
    "batch_no" VARCHAR(100),
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__0424f9" ON "apps_kuaizhizao_inventory_transfer_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_transfe_40d5cb" ON "apps_kuaizhizao_inventory_transfer_items" ("transfer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_6ba825" ON "apps_kuaizhizao_inventory_transfer_items" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_from_wa_eab28d" ON "apps_kuaizhizao_inventory_transfer_items" ("from_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_to_ware_b7fee9" ON "apps_kuaizhizao_inventory_transfer_items" ("to_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_9596ff" ON "apps_kuaizhizao_inventory_transfer_items" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."transfer_id" IS '调拨单ID（关联InventoryTransfer）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."from_warehouse_id" IS '调出仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."from_location_id" IS '调出库位ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."from_location_code" IS '调出库位编码（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."to_warehouse_id" IS '调入仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."to_location_id" IS '调入库位ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."to_location_code" IS '调入库位编码（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."quantity" IS '调拨数量';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."unit_price" IS '单价';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."amount" IS '金额';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."status" IS '状态（pending/transferred）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_inventory_transfer_items" IS '快格轻制造 - 库存调拨单明细';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_launch_countdowns" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "launch_date" TIMESTAMPTZ NOT NULL,
    "snapshot_time" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "progress" JSONB,
    "notes" TEXT,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__ac2f60" UNIQUE ("tenant_id", "status")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__57f0b2" ON "apps_kuaizhizao_launch_countdowns" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_launch__dceef1" ON "apps_kuaizhizao_launch_countdowns" ("launch_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_70735f" ON "apps_kuaizhizao_launch_countdowns" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_uuid_71ee93" ON "apps_kuaizhizao_launch_countdowns" ("uuid");
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."launch_date" IS '上线日期';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."snapshot_time" IS '快照时间点（期初数据的基准时间点）';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."status" IS '状态（pending/in_progress/completed/cancelled）';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."progress" IS '导入进度（JSON格式，存储各阶段导入状态）';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_launch_countdowns"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_launch_countdowns" IS '快格轻制造 - 上线倒计时';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_line_side_inventory" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200),
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_spec" VARCHAR(500),
    "material_unit" VARCHAR(20),
    "batch_no" VARCHAR(100),
    "production_date" DATE,
    "expiry_date" DATE,
    "quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "reserved_quantity" DECIMAL(18,4) NOT NULL  DEFAULT 0,
    "work_order_id" INT,
    "work_order_code" VARCHAR(50),
    "source_type" VARCHAR(20),
    "source_doc_id" INT,
    "source_doc_code" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL  DEFAULT 'available',
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__5383f7" ON "apps_kuaizhizao_line_side_inventory" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_534a0b" ON "apps_kuaizhizao_line_side_inventory" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_8da74b" ON "apps_kuaizhizao_line_side_inventory" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batch_n_09457c" ON "apps_kuaizhizao_line_side_inventory" ("batch_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_or_834e87" ON "apps_kuaizhizao_line_side_inventory" ("work_order_id");
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."warehouse_id" IS '线边仓ID';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."warehouse_name" IS '线边仓名称';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."material_spec" IS '规格型号';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."material_unit" IS '单位';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."batch_no" IS '批号';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."production_date" IS '生产日期';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."expiry_date" IS '有效期';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."quantity" IS '库存数量';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."reserved_quantity" IS '预留数量';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."work_order_id" IS '关联工单ID';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."work_order_code" IS '关联工单编码';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."source_type" IS '来源类型（transfer=调拨, direct=直接入库）';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."source_doc_id" IS '来源单据ID';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."source_doc_code" IS '来源单据编码';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."status" IS '状态（available=可用, reserved=已预留, consumed=已消耗）';
COMMENT ON COLUMN "apps_kuaizhizao_line_side_inventory"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_line_side_inventory" IS '快格轻制造 - 线边仓库存';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_maintenance_executions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "execution_no" VARCHAR(100) NOT NULL,
    "maintenance_plan_id" INT,
    "maintenance_plan_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "execution_date" TIMESTAMPTZ NOT NULL,
    "executor_id" INT,
    "executor_name" VARCHAR(100),
    "execution_content" TEXT,
    "execution_result" VARCHAR(50),
    "maintenance_cost" DECIMAL(10,2),
    "spare_parts_used" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "acceptance_person_id" INT,
    "acceptance_person_name" VARCHAR(100),
    "acceptance_date" TIMESTAMPTZ,
    "acceptance_result" VARCHAR(50),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__a57165" UNIQUE ("tenant_id", "execution_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__e23afc" ON "apps_kuaizhizao_maintenance_executions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_executi_888f61" ON "apps_kuaizhizao_maintenance_executions" ("execution_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mainten_9629d6" ON "apps_kuaizhizao_maintenance_executions" ("maintenance_plan_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_c37ffa" ON "apps_kuaizhizao_maintenance_executions" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_executi_035718" ON "apps_kuaizhizao_maintenance_executions" ("execution_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_ba84cc" ON "apps_kuaizhizao_maintenance_executions" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."execution_no" IS '执行记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."maintenance_plan_id" IS '维护计划ID（关联维护计划）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."maintenance_plan_uuid" IS '维护计划UUID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."equipment_id" IS '设备ID（关联设备）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."execution_date" IS '执行日期';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."executor_id" IS '执行人员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."executor_name" IS '执行人员姓名';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."execution_content" IS '执行内容';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."execution_result" IS '执行结果（正常、异常、待处理）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."maintenance_cost" IS '维护成本';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."spare_parts_used" IS '使用备件（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."status" IS '记录状态（草稿、已确认、已验收）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."acceptance_person_id" IS '验收人员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."acceptance_person_name" IS '验收人员姓名';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."acceptance_date" IS '验收日期';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."acceptance_result" IS '验收结果（合格、不合格）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_maintenance_executions" IS '快格轻制造 - 保养执行记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_maintenance_plans" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "plan_no" VARCHAR(100) NOT NULL,
    "plan_name" VARCHAR(200) NOT NULL,
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "plan_type" VARCHAR(50) NOT NULL,
    "maintenance_type" VARCHAR(50) NOT NULL,
    "cycle_type" VARCHAR(50) NOT NULL,
    "cycle_value" INT,
    "cycle_unit" VARCHAR(20),
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__32145b" UNIQUE ("tenant_id", "plan_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__3466a9" ON "apps_kuaizhizao_maintenance_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_plan_no_493f0d" ON "apps_kuaizhizao_maintenance_plans" ("plan_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_a83210" ON "apps_kuaizhizao_maintenance_plans" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_d800a0" ON "apps_kuaizhizao_maintenance_plans" ("equipment_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_6eb59c" ON "apps_kuaizhizao_maintenance_plans" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_planned_82b741" ON "apps_kuaizhizao_maintenance_plans" ("planned_start_date");
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."plan_no" IS '维护计划编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."plan_name" IS '计划名称';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."equipment_id" IS '设备ID（关联设备）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."plan_type" IS '计划类型（预防性维护、定期维护、临时维护）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."maintenance_type" IS '维护类型（日常保养、小修、中修、大修）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."cycle_type" IS '周期类型（按时间、按运行时长、按使用次数）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."cycle_value" IS '周期值';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."cycle_unit" IS '周期单位（天、小时、次）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."responsible_person_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."status" IS '计划状态（草稿、已发布、执行中、已完成、已取消）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_maintenance_plans" IS '快格轻制造 - 保养计划';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_maintenance_reminders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "maintenance_plan_id" INT,
    "maintenance_plan_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_uuid" VARCHAR(36) NOT NULL,
    "equipment_code" VARCHAR(50) NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "reminder_type" VARCHAR(50) NOT NULL,
    "reminder_date" TIMESTAMPTZ NOT NULL,
    "planned_maintenance_date" TIMESTAMPTZ NOT NULL,
    "days_until_due" INT NOT NULL,
    "reminder_message" TEXT,
    "is_read" BOOL NOT NULL  DEFAULT False,
    "read_at" TIMESTAMPTZ,
    "read_by" INT,
    "is_handled" BOOL NOT NULL  DEFAULT False,
    "handled_at" TIMESTAMPTZ,
    "handled_by" INT,
    "handled_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__6b40bf" ON "apps_kuaizhizao_maintenance_reminders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mainten_ba9bc0" ON "apps_kuaizhizao_maintenance_reminders" ("maintenance_plan_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_equipme_7e3685" ON "apps_kuaizhizao_maintenance_reminders" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_reminde_c4dcb8" ON "apps_kuaizhizao_maintenance_reminders" ("reminder_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_reminde_a4de70" ON "apps_kuaizhizao_maintenance_reminders" ("reminder_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_is_read_e83d67" ON "apps_kuaizhizao_maintenance_reminders" ("is_read");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_is_hand_c4d885" ON "apps_kuaizhizao_maintenance_reminders" ("is_handled");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_cbfa84" ON "apps_kuaizhizao_maintenance_reminders" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."maintenance_plan_id" IS '维护计划ID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."maintenance_plan_uuid" IS '维护计划UUID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."equipment_uuid" IS '设备UUID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."equipment_code" IS '设备编码';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."reminder_type" IS '提醒类型（due_soon/overdue）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."reminder_date" IS '提醒日期';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."planned_maintenance_date" IS '计划维护日期';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."days_until_due" IS '距离到期天数（负数表示已过期）';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."reminder_message" IS '提醒消息';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."is_read" IS '是否已读';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."read_at" IS '已读时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."read_by" IS '已读人ID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."is_handled" IS '是否已处理';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."handled_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."handled_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_maintenance_reminders" IS '快格轻制造 - 保养提醒';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_borrows" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "borrow_code" VARCHAR(50) NOT NULL UNIQUE,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(100) NOT NULL,
    "borrower_id" INT,
    "borrower_name" VARCHAR(100),
    "department" VARCHAR(100),
    "expected_return_date" DATE,
    "borrow_time" TIMESTAMPTZ,
    "reviewer_id" INT,
    "reviewer_name" VARCHAR(100),
    "review_time" TIMESTAMPTZ,
    "review_status" VARCHAR(20) NOT NULL  DEFAULT '待审核',
    "review_remarks" TEXT,
    "status" VARCHAR(20) NOT NULL  DEFAULT '待借出',
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__4dd160" ON "apps_kuaizhizao_material_borrows" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_borrow__a8ee7c" ON "apps_kuaizhizao_material_borrows" ("borrow_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_a12c5b" ON "apps_kuaizhizao_material_borrows" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_borrowe_cfd080" ON "apps_kuaizhizao_material_borrows" ("borrower_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_e62f98" ON "apps_kuaizhizao_material_borrows" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."borrow_code" IS '借料单编码';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."warehouse_id" IS '借出仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."warehouse_name" IS '借出仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."borrower_id" IS '借料人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."borrower_name" IS '借料人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."department" IS '部门';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."expected_return_date" IS '预计归还日期';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."borrow_time" IS '实际借出时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."reviewer_id" IS '审核人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."reviewer_name" IS '审核人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."review_time" IS '审核时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."review_status" IS '审核状态';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."review_remarks" IS '审核备注';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."status" IS '借料状态';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."total_quantity" IS '总借出数量';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_material_borrows" IS '快格轻制造 - 借料单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_call_requests" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "work_order_id" INT NOT NULL,
    "work_order_code" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_unit" VARCHAR(20),
    "requested_quantity" DECIMAL(12,4) NOT NULL,
    "delivered_quantity" DECIMAL(12,4) NOT NULL  DEFAULT 0,
    "source_warehouse_id" INT,
    "target_warehouse_id" INT,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "priority" VARCHAR(20) NOT NULL  DEFAULT 'normal',
    "caller_id" INT NOT NULL,
    "caller_name" VARCHAR(100) NOT NULL,
    "handler_id" INT,
    "handler_name" VARCHAR(100),
    "needed_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "remarks" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__47523f" ON "apps_kuaizhizao_material_call_requests" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_or_9ea839" ON "apps_kuaizhizao_material_call_requests" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_a7c251" ON "apps_kuaizhizao_material_call_requests" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_code_ecefcd" ON "apps_kuaizhizao_material_call_requests" ("code");
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."code" IS '叫料单号';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."work_order_id" IS '关联工单ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."work_order_code" IS '工单编码';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."material_unit" IS '单位';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."requested_quantity" IS '请求数量';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."delivered_quantity" IS '已送达数量';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."source_warehouse_id" IS '来源仓库ID（通常为主仓）';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."target_warehouse_id" IS '目标仓库ID（通常为线边仓）';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."status" IS '状态';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."priority" IS '优先级（low/normal/high/urgent）';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."caller_id" IS '发起人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."caller_name" IS '发起人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."handler_id" IS '处理人/配料人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."handler_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."needed_at" IS '期望送达时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."completed_at" IS '完成时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_material_call_requests" IS '快格轻制造 - 叫料请求';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_returns" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "return_code" VARCHAR(50) NOT NULL UNIQUE,
    "borrow_id" INT NOT NULL,
    "borrow_code" VARCHAR(50) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(100) NOT NULL,
    "returner_id" INT,
    "returner_name" VARCHAR(100),
    "return_time" TIMESTAMPTZ,
    "reviewer_id" INT,
    "reviewer_name" VARCHAR(100),
    "review_time" TIMESTAMPTZ,
    "review_status" VARCHAR(20) NOT NULL  DEFAULT '待审核',
    "review_remarks" TEXT,
    "status" VARCHAR(20) NOT NULL  DEFAULT '待归还',
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__caa798" ON "apps_kuaizhizao_material_returns" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_return__b898d2" ON "apps_kuaizhizao_material_returns" ("return_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_borrow__563b31" ON "apps_kuaizhizao_material_returns" ("borrow_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_5ef167" ON "apps_kuaizhizao_material_returns" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_8d60e4" ON "apps_kuaizhizao_material_returns" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."return_code" IS '还料单编码';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."borrow_id" IS '借料单ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."borrow_code" IS '借料单编码';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."warehouse_id" IS '归还仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."warehouse_name" IS '归还仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."returner_id" IS '归还人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."returner_name" IS '归还人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."return_time" IS '实际归还时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."reviewer_id" IS '审核人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."reviewer_name" IS '审核人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."review_time" IS '审核时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."review_status" IS '审核状态';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."review_remarks" IS '审核备注';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."status" IS '还料状态';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."total_quantity" IS '总归还数量';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_material_returns" IS '快格轻制造 - 还料单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_shortage_exceptions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "work_order_id" INT NOT NULL,
    "work_order_code" VARCHAR(50) NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "shortage_quantity" DECIMAL(12,2) NOT NULL,
    "available_quantity" DECIMAL(12,2) NOT NULL,
    "required_quantity" DECIMAL(12,2) NOT NULL,
    "alert_level" VARCHAR(20) NOT NULL  DEFAULT 'medium',
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "alternative_material_id" INT,
    "alternative_material_code" VARCHAR(50),
    "alternative_material_name" VARCHAR(200),
    "suggested_action" VARCHAR(50),
    "handled_by" INT,
    "handled_by_name" VARCHAR(100),
    "handled_at" TIMESTAMPTZ,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__f83eff" ON "apps_kuaizhizao_material_shortage_exceptions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_or_8690e5" ON "apps_kuaizhizao_material_shortage_exceptions" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_87553a" ON "apps_kuaizhizao_material_shortage_exceptions" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_l_911bc1" ON "apps_kuaizhizao_material_shortage_exceptions" ("alert_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_9dc2ea" ON "apps_kuaizhizao_material_shortage_exceptions" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_4d96eb" ON "apps_kuaizhizao_material_shortage_exceptions" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."work_order_id" IS '工单ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."work_order_code" IS '工单编码';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."shortage_quantity" IS '缺料数量';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."available_quantity" IS '可用数量';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."required_quantity" IS '需求数量';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."alert_level" IS '预警级别';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."status" IS '处理状态';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."alternative_material_id" IS '替代物料ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."alternative_material_code" IS '替代物料编码（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."alternative_material_name" IS '替代物料名称（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."suggested_action" IS '建议操作';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."handled_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."handled_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_material_shortage_exceptions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_material_shortage_exceptions" IS '快格轻制造 - 缺料异常';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_molds" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
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
    "status" VARCHAR(50) NOT NULL  DEFAULT '正常',
    "total_usage_count" INT NOT NULL  DEFAULT 0,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "cavity_count" INT,
    "design_lifetime" INT,
    "maintenance_interval" INT,
    "needs_calibration" BOOL NOT NULL  DEFAULT False,
    "calibration_period" INT,
    "last_calibration_date" DATE,
    "next_calibration_date" DATE,
    "description" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__54e128" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__02a15d" ON "apps_kuaizhizao_molds" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_code_251dd4" ON "apps_kuaizhizao_molds" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_uuid_c033f2" ON "apps_kuaizhizao_molds" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_type_a427be" ON "apps_kuaizhizao_molds" ("type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_fa3d4e" ON "apps_kuaizhizao_molds" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_molds"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."code" IS '模具编码（组织内唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."name" IS '模具名称';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."type" IS '模具类型（注塑模具、压铸模具、冲压模具、其他）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."category" IS '模具分类';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."brand" IS '品牌';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."model" IS '型号';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."serial_number" IS '序列号';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."manufacturer" IS '制造商';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."supplier" IS '供应商';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."purchase_date" IS '采购日期';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."installation_date" IS '安装日期';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."warranty_period" IS '保修期（月）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."technical_parameters" IS '技术参数（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."status" IS '模具状态（正常、维修中、停用、校验中、报废）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."total_usage_count" IS '累计使用次数';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."cavity_count" IS '腔数/模数，一次成型产出件数，用于产量→使用次数换算';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."design_lifetime" IS '设计寿命（使用次数），用于寿命预警';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."maintenance_interval" IS '保养间隔（使用次数）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."needs_calibration" IS '是否需要校验';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."calibration_period" IS '校验周期（天）';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."last_calibration_date" IS '上次校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."next_calibration_date" IS '下次校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."description" IS '描述';
COMMENT ON COLUMN "apps_kuaizhizao_molds"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_molds" IS '快格轻制造 - 模具';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_calibrations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "mold_id" INT NOT NULL,
    "mold_uuid" VARCHAR(36) NOT NULL,
    "calibration_date" DATE NOT NULL,
    "result" VARCHAR(50) NOT NULL,
    "certificate_no" VARCHAR(100),
    "expiry_date" DATE,
    "attachment_uuid" VARCHAR(36),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__553141" ON "apps_kuaizhizao_mold_calibrations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mold_id_2847f0" ON "apps_kuaizhizao_mold_calibrations" ("mold_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_calibra_83db40" ON "apps_kuaizhizao_mold_calibrations" ("calibration_date");
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."calibration_date" IS '校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."result" IS '校验结果（合格、不合格、准用）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."certificate_no" IS '证书编号';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."expiry_date" IS '有效期至';
COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."attachment_uuid" IS '附件ID';
COMMENT ON TABLE "apps_kuaizhizao_mold_calibrations" IS '快格轻制造 - 模具校准记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_usages" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "usage_no" VARCHAR(100) NOT NULL,
    "mold_id" INT NOT NULL,
    "mold_uuid" VARCHAR(36) NOT NULL,
    "mold_name" VARCHAR(200) NOT NULL,
    "mold_code" VARCHAR(100),
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(100),
    "reporting_record_id" INT,
    "usage_date" TIMESTAMPTZ NOT NULL,
    "usage_count" INT NOT NULL  DEFAULT 1,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '使用中',
    "return_date" TIMESTAMPTZ,
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__a53fd4" UNIQUE ("tenant_id", "usage_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__c3b1d0" ON "apps_kuaizhizao_mold_usages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_usage_n_607372" ON "apps_kuaizhizao_mold_usages" ("usage_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mold_id_a9a688" ON "apps_kuaizhizao_mold_usages" ("mold_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mold_uu_6d2ef4" ON "apps_kuaizhizao_mold_usages" ("mold_uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_source__122c7f" ON "apps_kuaizhizao_mold_usages" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_usage_d_fab245" ON "apps_kuaizhizao_mold_usages" ("usage_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_620908" ON "apps_kuaizhizao_mold_usages" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_reporti_0e0306" ON "apps_kuaizhizao_mold_usages" ("reporting_record_id");
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."usage_no" IS '使用记录编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."mold_id" IS '模具ID（关联模具）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."mold_uuid" IS '模具UUID';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."mold_name" IS '模具名称';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."mold_code" IS '模具编码';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."source_type" IS '来源类型（生产订单、工单）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."reporting_record_id" IS '报工记录ID，用于关联报工避免重复累计';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."usage_date" IS '使用日期';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."usage_count" IS '使用次数';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."operator_id" IS '操作人员ID（用户ID）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."operator_name" IS '操作人员姓名';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."status" IS '使用状态（使用中、已归还、已报废）';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."return_date" IS '归还日期';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."remark" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_mold_usages" IS '快格轻制造 - 模具使用记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_other_inbounds" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "inbound_code" VARCHAR(50) NOT NULL UNIQUE,
    "reason_type" VARCHAR(20) NOT NULL,
    "reason_desc" TEXT,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(100) NOT NULL,
    "receipt_time" TIMESTAMPTZ,
    "receiver_id" INT,
    "receiver_name" VARCHAR(100),
    "reviewer_id" INT,
    "reviewer_name" VARCHAR(100),
    "review_time" TIMESTAMPTZ,
    "review_status" VARCHAR(20) NOT NULL  DEFAULT '待审核',
    "review_remarks" TEXT,
    "status" VARCHAR(20) NOT NULL  DEFAULT '待入库',
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__7cb08b" ON "apps_kuaizhizao_other_inbounds" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inbound_0ea91d" ON "apps_kuaizhizao_other_inbounds" ("inbound_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_4cb7f8" ON "apps_kuaizhizao_other_inbounds" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_reason__8af64e" ON "apps_kuaizhizao_other_inbounds" ("reason_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_391e10" ON "apps_kuaizhizao_other_inbounds" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."inbound_code" IS '入库单编码';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."reason_type" IS '原因类型：盘盈/样品/报废/其他';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."reason_desc" IS '原因说明';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."warehouse_id" IS '入库仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."warehouse_name" IS '入库仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."receipt_time" IS '实际入库时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."receiver_id" IS '入库人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."receiver_name" IS '入库人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."reviewer_id" IS '审核人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."reviewer_name" IS '审核人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."review_time" IS '审核时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."review_status" IS '审核状态';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."review_remarks" IS '审核备注';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."status" IS '入库状态';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."total_quantity" IS '总入库数量';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_other_inbounds" IS '快格轻制造 - 其他入库单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_other_outbounds" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "outbound_code" VARCHAR(50) NOT NULL UNIQUE,
    "reason_type" VARCHAR(20) NOT NULL,
    "reason_desc" TEXT,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(100) NOT NULL,
    "delivery_time" TIMESTAMPTZ,
    "deliverer_id" INT,
    "deliverer_name" VARCHAR(100),
    "reviewer_id" INT,
    "reviewer_name" VARCHAR(100),
    "review_time" TIMESTAMPTZ,
    "review_status" VARCHAR(20) NOT NULL  DEFAULT '待审核',
    "review_remarks" TEXT,
    "status" VARCHAR(20) NOT NULL  DEFAULT '待出库',
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__474c8d" ON "apps_kuaizhizao_other_outbounds" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outboun_a0cba1" ON "apps_kuaizhizao_other_outbounds" ("outbound_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_a49c99" ON "apps_kuaizhizao_other_outbounds" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_reason__fed439" ON "apps_kuaizhizao_other_outbounds" ("reason_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_133104" ON "apps_kuaizhizao_other_outbounds" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."outbound_code" IS '出库单编码';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."reason_type" IS '原因类型：盘亏/样品/报废/其他';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."reason_desc" IS '原因说明';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."warehouse_id" IS '出库仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."warehouse_name" IS '出库仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."delivery_time" IS '实际出库时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."deliverer_id" IS '出库人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."deliverer_name" IS '出库人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."reviewer_id" IS '审核人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."reviewer_name" IS '审核人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."review_time" IS '审核时间';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."review_status" IS '审核状态';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."review_remarks" IS '审核备注';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."status" IS '出库状态';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."total_quantity" IS '总出库数量';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_other_outbounds" IS '快格轻制造 - 其他出库单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quality_exceptions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "exception_type" VARCHAR(50) NOT NULL,
    "work_order_id" INT,
    "work_order_code" VARCHAR(50),
    "material_id" INT,
    "material_code" VARCHAR(50),
    "material_name" VARCHAR(200),
    "batch_no" VARCHAR(50),
    "inspection_record_id" INT,
    "problem_description" TEXT NOT NULL,
    "severity" VARCHAR(20) NOT NULL  DEFAULT 'minor',
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "root_cause" TEXT,
    "corrective_action" TEXT,
    "preventive_action" TEXT,
    "responsible_person_id" INT,
    "responsible_person_name" VARCHAR(100),
    "planned_completion_date" TIMESTAMPTZ,
    "actual_completion_date" TIMESTAMPTZ,
    "verification_result" TEXT,
    "handled_by" INT,
    "handled_by_name" VARCHAR(100),
    "handled_at" TIMESTAMPTZ,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__efd172" ON "apps_kuaizhizao_quality_exceptions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_excepti_5f40fd" ON "apps_kuaizhizao_quality_exceptions" ("exception_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_or_c5c4d7" ON "apps_kuaizhizao_quality_exceptions" ("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_ddb043" ON "apps_kuaizhizao_quality_exceptions" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_severit_8a5522" ON "apps_kuaizhizao_quality_exceptions" ("severity");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_96f9a0" ON "apps_kuaizhizao_quality_exceptions" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_de1b70" ON "apps_kuaizhizao_quality_exceptions" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."exception_type" IS '异常类型';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."work_order_id" IS '关联工单ID';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."work_order_code" IS '关联工单编码';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."material_id" IS '关联物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."material_code" IS '关联物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."material_name" IS '关联物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."batch_no" IS '批次号';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."inspection_record_id" IS '关联检验记录ID';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."problem_description" IS '问题描述';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."severity" IS '严重程度';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."status" IS '处理状态';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."root_cause" IS '根本原因';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."corrective_action" IS '纠正措施';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."preventive_action" IS '预防措施';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."responsible_person_id" IS '责任人ID';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."responsible_person_name" IS '责任人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."planned_completion_date" IS '计划完成日期';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."actual_completion_date" IS '实际完成日期';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."verification_result" IS '验证结果';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."handled_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."handled_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_quality_exceptions" IS '快格轻制造 - 质量异常';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quality_standards" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "standard_code" VARCHAR(50) NOT NULL UNIQUE,
    "standard_name" VARCHAR(200) NOT NULL,
    "standard_type" VARCHAR(50) NOT NULL,
    "material_id" INT,
    "material_code" VARCHAR(50),
    "material_name" VARCHAR(200),
    "inspection_items" JSONB,
    "inspection_methods" JSONB,
    "acceptance_criteria" JSONB,
    "version" VARCHAR(20) NOT NULL  DEFAULT '1.0',
    "effective_date" DATE,
    "expiry_date" DATE,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__4fe58e" ON "apps_kuaizhizao_quality_standards" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_standar_b1c596" ON "apps_kuaizhizao_quality_standards" ("standard_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_822b69" ON "apps_kuaizhizao_quality_standards" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_standar_529bba" ON "apps_kuaizhizao_quality_standards" ("standard_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_is_acti_8e5b96" ON "apps_kuaizhizao_quality_standards" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_068558" ON "apps_kuaizhizao_quality_standards" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."standard_code" IS '标准编码';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."standard_name" IS '标准名称';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."standard_type" IS '标准类型（incoming/process/finished）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."material_id" IS '关联物料ID（为空则适用于所有物料）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."material_code" IS '关联物料编码（冗余字段）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."material_name" IS '关联物料名称（冗余字段）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."inspection_items" IS '检验项目列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."inspection_methods" IS '检验方法列表（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."acceptance_criteria" IS '合格标准（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."version" IS '版本号';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."effective_date" IS '生效日期';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."expiry_date" IS '失效日期';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_quality_standards"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_quality_standards" IS '快格轻制造 - 质量检验标准';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quotations" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "quotation_code" VARCHAR(50) NOT NULL UNIQUE,
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_contact" VARCHAR(100),
    "customer_phone" VARCHAR(20),
    "quotation_date" DATE NOT NULL,
    "valid_until" DATE,
    "delivery_date" DATE,
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(20) NOT NULL  DEFAULT '草稿',
    "reviewer_id" INT,
    "reviewer_name" VARCHAR(100),
    "review_time" TIMESTAMPTZ,
    "review_status" VARCHAR(20) NOT NULL  DEFAULT '待审核',
    "review_remarks" TEXT,
    "salesman_id" INT,
    "salesman_name" VARCHAR(100),
    "shipping_address" TEXT,
    "shipping_method" VARCHAR(50),
    "payment_terms" VARCHAR(100),
    "sales_order_id" INT,
    "sales_order_code" VARCHAR(50),
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__ecc5ae" ON "apps_kuaizhizao_quotations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotati_3478eb" ON "apps_kuaizhizao_quotations" ("quotation_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_custome_9540db" ON "apps_kuaizhizao_quotations" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_8b5017" ON "apps_kuaizhizao_quotations" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotati_124e61" ON "apps_kuaizhizao_quotations" ("quotation_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sales_o_589eae" ON "apps_kuaizhizao_quotations" ("sales_order_id");
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."quotation_code" IS '报价单编码';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."customer_id" IS '客户ID';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."customer_name" IS '客户名称';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."customer_contact" IS '客户联系人';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."customer_phone" IS '客户电话';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."quotation_date" IS '报价日期';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."valid_until" IS '有效期至';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."delivery_date" IS '预计交货日期';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."total_quantity" IS '总数量';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."status" IS '报价状态';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."reviewer_id" IS '审核人ID';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."reviewer_name" IS '审核人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."review_time" IS '审核时间';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."review_status" IS '审核状态';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."review_remarks" IS '审核备注';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."salesman_id" IS '销售员ID';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."salesman_name" IS '销售员姓名';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."shipping_address" IS '收货地址';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."shipping_method" IS '发货方式';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."payment_terms" IS '付款条件';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."sales_order_id" IS '关联销售订单ID（转订单后）';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."sales_order_code" IS '关联销售订单编码';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_quotations"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_quotations" IS '快格轻制造 - 报价单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_receipt_notices" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "notice_code" VARCHAR(50) NOT NULL UNIQUE,
    "purchase_order_id" INT NOT NULL,
    "purchase_order_code" VARCHAR(50) NOT NULL,
    "supplier_id" INT NOT NULL,
    "supplier_name" VARCHAR(200) NOT NULL,
    "supplier_contact" VARCHAR(100),
    "supplier_phone" VARCHAR(50),
    "warehouse_id" INT,
    "warehouse_name" VARCHAR(100),
    "planned_receipt_date" DATE,
    "status" VARCHAR(20) NOT NULL  DEFAULT '待收货',
    "notified_at" TIMESTAMPTZ,
    "purchase_receipt_id" INT,
    "purchase_receipt_code" VARCHAR(50),
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__1fe958" ON "apps_kuaizhizao_receipt_notices" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_notice__fd906f" ON "apps_kuaizhizao_receipt_notices" ("notice_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchas_7f2957" ON "apps_kuaizhizao_receipt_notices" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_supplie_6e8987" ON "apps_kuaizhizao_receipt_notices" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_6b0ede" ON "apps_kuaizhizao_receipt_notices" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."notice_code" IS '通知单编码';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."purchase_order_id" IS '采购订单ID';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."purchase_order_code" IS '采购订单编码';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."supplier_id" IS '供应商ID';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."supplier_name" IS '供应商名称';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."supplier_contact" IS '供应商联系人';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."supplier_phone" IS '供应商电话';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."warehouse_id" IS '入库仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."warehouse_name" IS '入库仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."planned_receipt_date" IS '计划收货日期';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."status" IS '通知状态';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."notified_at" IS '通知仓库时间';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."purchase_receipt_id" IS '采购入库单ID（已入库时关联）';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."purchase_receipt_code" IS '采购入库单编码';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."total_quantity" IS '总数量';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_receipt_notices" IS '快格轻制造 - 收货通知单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_replenishment_suggestions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "current_quantity" DECIMAL(12,2) NOT NULL,
    "safety_stock" DECIMAL(12,2),
    "min_stock" DECIMAL(12,2),
    "max_stock" DECIMAL(12,2),
    "suggested_quantity" DECIMAL(12,2) NOT NULL,
    "priority" VARCHAR(20) NOT NULL  DEFAULT 'medium',
    "suggestion_type" VARCHAR(20) NOT NULL  DEFAULT 'low_stock',
    "estimated_delivery_days" INT,
    "suggested_order_date" TIMESTAMPTZ,
    "supplier_id" INT,
    "supplier_name" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "processed_by" INT,
    "processed_by_name" VARCHAR(100),
    "processed_at" TIMESTAMPTZ,
    "processing_notes" TEXT,
    "alert_id" INT,
    "related_demand_id" INT,
    "related_demand_code" VARCHAR(50),
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__79b451" ON "apps_kuaizhizao_replenishment_suggestions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_cf5bbb" ON "apps_kuaizhizao_replenishment_suggestions" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_2ff9a3" ON "apps_kuaizhizao_replenishment_suggestions" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_818129" ON "apps_kuaizhizao_replenishment_suggestions" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_priorit_6bcd45" ON "apps_kuaizhizao_replenishment_suggestions" ("priority");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_suggest_18b37f" ON "apps_kuaizhizao_replenishment_suggestions" ("suggestion_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_e08aa3" ON "apps_kuaizhizao_replenishment_suggestions" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."current_quantity" IS '当前库存数量';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."safety_stock" IS '安全库存';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."min_stock" IS '最低库存';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."max_stock" IS '最高库存';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."suggested_quantity" IS '建议补货数量';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."priority" IS '优先级（high/medium/low）';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."suggestion_type" IS '建议类型（low_stock/demand_based/seasonal）';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."estimated_delivery_days" IS '预计交货天数';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."suggested_order_date" IS '建议下单日期';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."supplier_id" IS '供应商ID';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."supplier_name" IS '供应商名称';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."status" IS '状态（pending/processed/ignored）';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processed_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processed_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processed_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."processing_notes" IS '处理备注';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."alert_id" IS '关联的预警ID';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."related_demand_id" IS '关联的需求ID';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."related_demand_code" IS '关联的需求编码';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_replenishment_suggestions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_replenishment_suggestions" IS '快格轻制造 - 补货建议';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sample_trials" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "trial_code" VARCHAR(50) NOT NULL UNIQUE,
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_contact" VARCHAR(100),
    "customer_phone" VARCHAR(50),
    "trial_purpose" VARCHAR(200),
    "trial_period_start" DATE,
    "trial_period_end" DATE,
    "sales_order_id" INT,
    "sales_order_code" VARCHAR(50),
    "other_outbound_id" INT,
    "other_outbound_code" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL  DEFAULT '草稿',
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__5c57c6" ON "apps_kuaizhizao_sample_trials" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_trial_c_e01621" ON "apps_kuaizhizao_sample_trials" ("trial_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_custome_50a44e" ON "apps_kuaizhizao_sample_trials" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_247e1d" ON "apps_kuaizhizao_sample_trials" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sales_o_4b187a" ON "apps_kuaizhizao_sample_trials" ("sales_order_id");
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."trial_code" IS '试用单编码';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."customer_id" IS '客户ID';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."customer_name" IS '客户名称';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."customer_contact" IS '客户联系人';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."customer_phone" IS '客户电话';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."trial_purpose" IS '试用目的';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."trial_period_start" IS '试用开始日期';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."trial_period_end" IS '试用结束日期';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."sales_order_id" IS '关联销售订单ID（转订单后）';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."sales_order_code" IS '关联销售订单编码';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."other_outbound_id" IS '关联其他出库单ID（样品出库）';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."other_outbound_code" IS '关联其他出库单编码';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."status" IS '试用状态';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."total_quantity" IS '总数量';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_sample_trials"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_sample_trials" IS '快格轻制造 - 样品试用单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_scheduling_configs" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "config_code" VARCHAR(50) NOT NULL,
    "config_name" VARCHAR(200) NOT NULL,
    "constraints" JSONB NOT NULL,
    "is_default" BOOL NOT NULL  DEFAULT False,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "description" TEXT,
    "created_by" INT,
    "updated_by" INT,
    CONSTRAINT "uid_apps_kuaizh_tenant__cac96e" UNIQUE ("tenant_id", "config_code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__748e81" ON "apps_kuaizhizao_scheduling_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__11fe3e" ON "apps_kuaizhizao_scheduling_configs" ("tenant_id", "is_default");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__6c302e" ON "apps_kuaizhizao_scheduling_configs" ("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_config__18ac04" ON "apps_kuaizhizao_scheduling_configs" ("config_code");
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."config_code" IS '配置编码';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."config_name" IS '配置名称';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."constraints" IS '排程约束（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."is_default" IS '是否为默认配置';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."description" IS '配置描述';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_scheduling_configs"."updated_by" IS '更新人ID';
COMMENT ON TABLE "apps_kuaizhizao_scheduling_configs" IS '快格轻制造 - 排程配置';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_shipment_notices" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "notice_code" VARCHAR(50) NOT NULL UNIQUE,
    "sales_order_id" INT NOT NULL,
    "sales_order_code" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_contact" VARCHAR(100),
    "customer_phone" VARCHAR(50),
    "warehouse_id" INT,
    "warehouse_name" VARCHAR(100),
    "planned_ship_date" DATE,
    "shipping_address" TEXT,
    "status" VARCHAR(20) NOT NULL  DEFAULT '待发货',
    "notified_at" TIMESTAMPTZ,
    "sales_delivery_id" INT,
    "sales_delivery_code" VARCHAR(50),
    "total_quantity" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__072172" ON "apps_kuaizhizao_shipment_notices" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_notice__00abfd" ON "apps_kuaizhizao_shipment_notices" ("notice_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sales_o_e694b0" ON "apps_kuaizhizao_shipment_notices" ("sales_order_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_custome_e2b0a8" ON "apps_kuaizhizao_shipment_notices" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_3197b3" ON "apps_kuaizhizao_shipment_notices" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."tenant_id" IS '租户ID';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."notice_code" IS '通知单编码';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."sales_order_id" IS '销售订单ID';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."sales_order_code" IS '销售订单编码';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."customer_id" IS '客户ID';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."customer_name" IS '客户名称';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."customer_contact" IS '客户联系人';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."customer_phone" IS '客户电话';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."warehouse_id" IS '出库仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."warehouse_name" IS '出库仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."planned_ship_date" IS '计划发货日期';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."shipping_address" IS '收货地址';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."status" IS '通知状态';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."notified_at" IS '通知仓库时间';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."sales_delivery_id" IS '销售出库单ID（已出库时关联）';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."sales_delivery_code" IS '销售出库单编码';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."total_quantity" IS '总数量';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."notes" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."is_active" IS '是否有效';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."created_by" IS '创建人ID';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."updated_by" IS '更新人ID';
COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."deleted_at" IS '删除时间';
COMMENT ON TABLE "apps_kuaizhizao_shipment_notices" IS '快格轻制造 - 发货通知单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_spare_parts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "part_no" VARCHAR(100) NOT NULL,
    "part_name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100),
    "spec" VARCHAR(200),
    "unit" VARCHAR(20) NOT NULL  DEFAULT '个',
    "brand" VARCHAR(100),
    "supplier" VARCHAR(200),
    "safety_stock" INT NOT NULL  DEFAULT 0,
    "price" DECIMAL(10,2),
    "associated_equipment_categories" JSONB,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__29fa1d" UNIQUE ("tenant_id", "part_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__d6c1b2" ON "apps_kuaizhizao_spare_parts" ("tenant_id");
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."part_no" IS '备件编号';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."part_name" IS '备件名称';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."category" IS '备件分类（密封件、轴承、传感器等）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."spec" IS '规格型号';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."unit" IS '计量单位';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."brand" IS '品牌';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."supplier" IS '供应商';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."safety_stock" IS '安全库存';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."price" IS '参考单价';
COMMENT ON COLUMN "apps_kuaizhizao_spare_parts"."associated_equipment_categories" IS '适用设备类型列表';
COMMENT ON TABLE "apps_kuaizhizao_spare_parts" IS '快格轻制造 - 备品备件基础信息';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_spare_part_inventories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "spare_part_id" INT NOT NULL,
    "spare_part_uuid" VARCHAR(36) NOT NULL,
    "warehouse_location" VARCHAR(100),
    "stock_quantity" INT NOT NULL  DEFAULT 0,
    "last_in_date" TIMESTAMPTZ,
    "last_out_date" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__f32b38" UNIQUE ("tenant_id", "spare_part_id", "warehouse_location")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__2a5da1" ON "apps_kuaizhizao_spare_part_inventories" ("tenant_id");
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."spare_part_id" IS '关联备件ID';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."spare_part_uuid" IS '关联备件UUID';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."warehouse_location" IS '库位名称';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_inventories"."stock_quantity" IS '当前库存数量';
COMMENT ON TABLE "apps_kuaizhizao_spare_part_inventories" IS '快格轻制造 - 备品备件库存';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_spare_part_stock_records" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "record_no" VARCHAR(100) NOT NULL,
    "spare_part_id" INT NOT NULL,
    "spare_part_uuid" VARCHAR(36) NOT NULL,
    "operation_type" VARCHAR(50) NOT NULL,
    "quantity" INT NOT NULL,
    "after_quantity" INT NOT NULL,
    "rel_type" VARCHAR(50),
    "rel_id" INT,
    "rel_uuid" VARCHAR(36),
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "remark" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__8b8411" ON "apps_kuaizhizao_spare_part_stock_records" ("tenant_id");
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."record_no" IS '流水号';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."spare_part_id" IS '关联备件ID';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."spare_part_uuid" IS '关联备件UUID';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."operation_type" IS '操作类型（入库、出库、盘点、退回）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."quantity" IS '变动数量';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."after_quantity" IS '变动后库存';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."rel_type" IS '关联业务类型（维修、保养、工单）';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."rel_id" IS '关联业务ID';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."rel_uuid" IS '关联业务UUID';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."operator_id" IS '操作人ID';
COMMENT ON COLUMN "apps_kuaizhizao_spare_part_stock_records"."operator_name" IS '操作人姓名';
COMMENT ON TABLE "apps_kuaizhizao_spare_part_stock_records" IS '快格轻制造 - 备品备件出入库流水';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_state_transition_logs" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INT NOT NULL,
    "from_state" VARCHAR(50) NOT NULL,
    "to_state" VARCHAR(50) NOT NULL,
    "transition_reason" VARCHAR(200),
    "transition_comment" TEXT,
    "operator_id" INT NOT NULL,
    "operator_name" VARCHAR(100) NOT NULL,
    "transition_time" TIMESTAMPTZ NOT NULL,
    "related_entity_type" VARCHAR(50),
    "related_entity_id" INT
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__7ff497" ON "apps_kuaizhizao_state_transition_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__a5f805" ON "apps_kuaizhizao_state_transition_logs" ("tenant_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__495d7c" ON "apps_kuaizhizao_state_transition_logs" ("tenant_id", "operator_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_transit_98cb45" ON "apps_kuaizhizao_state_transition_logs" ("transition_time");
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."entity_type" IS '实体类型（如：demand）';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."entity_id" IS '实体ID';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."from_state" IS '源状态';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."to_state" IS '目标状态';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."transition_reason" IS '流转原因';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."transition_comment" IS '流转备注';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."operator_id" IS '操作人ID';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."operator_name" IS '操作人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."transition_time" IS '流转时间';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."related_entity_type" IS '关联实体类型';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_logs"."related_entity_id" IS '关联实体ID';
COMMENT ON TABLE "apps_kuaizhizao_state_transition_logs" IS '快格轻制造 - 状态流转日志';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_state_transition_rules" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "entity_type" VARCHAR(50) NOT NULL,
    "from_state" VARCHAR(50) NOT NULL,
    "to_state" VARCHAR(50) NOT NULL,
    "transition_conditions" JSONB,
    "required_permission" VARCHAR(100),
    "required_role" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "description" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__4da7ac" ON "apps_kuaizhizao_state_transition_rules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__3c2889" ON "apps_kuaizhizao_state_transition_rules" ("tenant_id", "entity_type", "from_state");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__99ed0c" ON "apps_kuaizhizao_state_transition_rules" ("tenant_id", "entity_type", "to_state");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__ebb77e" ON "apps_kuaizhizao_state_transition_rules" ("tenant_id", "is_active");
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."entity_type" IS '实体类型（如：demand）';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."from_state" IS '源状态';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."to_state" IS '目标状态';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."transition_conditions" IS '流转条件（JSON格式）';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."required_permission" IS '所需权限';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."required_role" IS '所需角色';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_state_transition_rules"."description" IS '规则描述';
COMMENT ON TABLE "apps_kuaizhizao_state_transition_rules" IS '快格轻制造 - 状态流转规则';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_stocktakings" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "stocktaking_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'draft',
    "stocktaking_type" VARCHAR(20) NOT NULL  DEFAULT 'full',
    "total_items" INT NOT NULL  DEFAULT 0,
    "counted_items" INT NOT NULL  DEFAULT 0,
    "total_differences" INT NOT NULL  DEFAULT 0,
    "total_difference_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "remarks" TEXT,
    "approved_by" INT,
    "approved_by_name" VARCHAR(100),
    "approved_at" TIMESTAMPTZ,
    "completed_by" INT,
    "completed_by_name" VARCHAR(100),
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__22a6ba" ON "apps_kuaizhizao_stocktakings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_2123a0" ON "apps_kuaizhizao_stocktakings" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stockta_99865d" ON "apps_kuaizhizao_stocktakings" ("stocktaking_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_571edd" ON "apps_kuaizhizao_stocktakings" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_4353df" ON "apps_kuaizhizao_stocktakings" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."code" IS '盘点单号';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."stocktaking_date" IS '盘点日期';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."status" IS '状态（draft/in_progress/completed/cancelled）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."stocktaking_type" IS '盘点类型（full/partial/cycle）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."total_items" IS '盘点物料总数';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."counted_items" IS '已盘点物料数';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."total_differences" IS '差异总数';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."total_difference_amount" IS '差异总金额';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."approved_by" IS '审核人ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."approved_by_name" IS '审核人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."approved_at" IS '审核时间';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."completed_by" IS '完成人ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."completed_by_name" IS '完成人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."completed_at" IS '完成时间';
COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_stocktakings" IS '快格轻制造 - 盘点单';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_stocktaking_items" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "stocktaking_id" INT NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "warehouse_id" INT NOT NULL,
    "location_id" INT,
    "location_code" VARCHAR(50),
    "batch_no" VARCHAR(100),
    "book_quantity" DECIMAL(12,2) NOT NULL,
    "actual_quantity" DECIMAL(12,2),
    "difference_quantity" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "difference_amount" DECIMAL(12,2) NOT NULL  DEFAULT 0,
    "counted_by" INT,
    "counted_by_name" VARCHAR(100),
    "counted_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__5ef1a8" ON "apps_kuaizhizao_stocktaking_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stockta_54764e" ON "apps_kuaizhizao_stocktaking_items" ("stocktaking_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_fd8c2f" ON "apps_kuaizhizao_stocktaking_items" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_3794da" ON "apps_kuaizhizao_stocktaking_items" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_f163a7" ON "apps_kuaizhizao_stocktaking_items" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_counted_e40166" ON "apps_kuaizhizao_stocktaking_items" ("counted_at");
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."stocktaking_id" IS '盘点单ID（关联Stocktaking）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."location_id" IS '库位ID（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."location_code" IS '库位编码（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."batch_no" IS '批次号（可选）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."book_quantity" IS '账面数量';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."actual_quantity" IS '实际数量';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."difference_quantity" IS '差异数量';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."unit_price" IS '单价';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."difference_amount" IS '差异金额';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."counted_by" IS '盘点人ID';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."counted_by_name" IS '盘点人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."counted_at" IS '盘点时间';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."status" IS '状态（pending/counted/adjusted）';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."remarks" IS '备注';
COMMENT ON COLUMN "apps_kuaizhizao_stocktaking_items"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_stocktaking_items" IS '快格轻制造 - 盘点单明细';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tools" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50),
    "spec" VARCHAR(200),
    "manufacturer" VARCHAR(200),
    "supplier" VARCHAR(200),
    "purchase_date" DATE,
    "warranty_expiry" DATE,
    "status" VARCHAR(50) NOT NULL  DEFAULT '正常',
    "is_active" BOOL NOT NULL  DEFAULT True,
    "maintenance_period" INT,
    "last_maintenance_date" DATE,
    "next_maintenance_date" DATE,
    "needs_calibration" BOOL NOT NULL  DEFAULT False,
    "calibration_period" INT,
    "last_calibration_date" DATE,
    "next_calibration_date" DATE,
    "total_usage_count" INT NOT NULL  DEFAULT 0,
    "description" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaizh_tenant__0254b5" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__d5b52d" ON "apps_kuaizhizao_tools" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_code_1213c6" ON "apps_kuaizhizao_tools" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_type_36ae2f" ON "apps_kuaizhizao_tools" ("type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_c9f036" ON "apps_kuaizhizao_tools" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_tools"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."code" IS '工装编码';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."name" IS '工装名称';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."type" IS '工装类型（夹具、治具、检具、刀具、其他）';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."spec" IS '规格型号';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."manufacturer" IS '制造商';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."supplier" IS '供应商';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."purchase_date" IS '采购日期';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."warranty_expiry" IS '保修到期日';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."status" IS '工装状态（正常、领用中、维修中、校验中、停用、报废）';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."maintenance_period" IS '保养周期（天）';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."last_maintenance_date" IS '上次保养日期';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."next_maintenance_date" IS '下次保养日期';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."needs_calibration" IS '是否需要校验';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."calibration_period" IS '校验周期（天）';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."last_calibration_date" IS '上次校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."next_calibration_date" IS '下次校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."total_usage_count" IS '累计使用次数';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."description" IS '备注说明';
COMMENT ON COLUMN "apps_kuaizhizao_tools"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_tools" IS '快格轻制造 - 工装';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_calibrations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tool_id" INT NOT NULL,
    "tool_uuid" VARCHAR(36) NOT NULL,
    "calibration_date" DATE NOT NULL,
    "calibration_org" VARCHAR(200),
    "certificate_no" VARCHAR(100),
    "result" VARCHAR(50) NOT NULL,
    "expiry_date" DATE,
    "attachment_uuid" VARCHAR(36),
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__680286" ON "apps_kuaizhizao_tool_calibrations" ("tenant_id");
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."calibration_date" IS '校验日期';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."calibration_org" IS '校验机构';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."certificate_no" IS '证书编号';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."result" IS '校验结果（合格、不合格、准用）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."expiry_date" IS '有效期至';
COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."attachment_uuid" IS '报告附件UUID';
COMMENT ON TABLE "apps_kuaizhizao_tool_calibrations" IS '快格轻制造 - 工装校验记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_maintenances" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tool_id" INT NOT NULL,
    "tool_uuid" VARCHAR(36) NOT NULL,
    "maintenance_type" VARCHAR(50) NOT NULL,
    "maintenance_date" DATE NOT NULL,
    "executor" VARCHAR(100),
    "content" TEXT,
    "result" VARCHAR(50) NOT NULL  DEFAULT '完成',
    "cost" DECIMAL(10,2) NOT NULL  DEFAULT 0,
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__d86e64" ON "apps_kuaizhizao_tool_maintenances" ("tenant_id");
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."maintenance_type" IS '维保类型（日常保养、定期保养、故障维修）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."maintenance_date" IS '维保日期';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."executor" IS '执行人';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."content" IS '维保内容';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."result" IS '维保结果';
COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."cost" IS '维保费用';
COMMENT ON TABLE "apps_kuaizhizao_tool_maintenances" IS '快格轻制造 - 工装维保记录';;
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_usages" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tool_id" INT NOT NULL,
    "tool_uuid" VARCHAR(36) NOT NULL,
    "usage_no" VARCHAR(100) NOT NULL,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "department_name" VARCHAR(100),
    "source_type" VARCHAR(50),
    "source_no" VARCHAR(100),
    "checkout_date" TIMESTAMPTZ NOT NULL,
    "checkin_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '使用中',
    "remark" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__21da40" ON "apps_kuaizhizao_tool_usages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tool_id_c6f1f8" ON "apps_kuaizhizao_tool_usages" ("tool_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_7819f0" ON "apps_kuaizhizao_tool_usages" ("status");
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."tool_id" IS '工装ID';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."tool_uuid" IS '工装UUID';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."usage_no" IS '领用单号';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."operator_id" IS '领用人ID';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."operator_name" IS '领用人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."department_name" IS '领用部门';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."source_type" IS '来源业务类型（工单等）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."source_no" IS '来源业务单号';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."checkout_date" IS '领用时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."checkin_date" IS '归还时间';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."status" IS '状态（使用中、已归还）';
COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaizhizao_tool_usages" IS '快格轻制造 - 工装领用归还记录';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" DROP COLUMN "volume";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN "weight";
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" DROP COLUMN "additional_fees_details";
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" DROP COLUMN "landing_cost";
        DROP TABLE IF EXISTS "apps_master_data_bom_changes";
        DROP TABLE IF EXISTS "apps_master_data_process_route_changes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_order_changes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_assembly_orders";
        DROP TABLE IF EXISTS "apps_kuaizhizao_assembly_order_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_assembly_material_bindings";
        DROP TABLE IF EXISTS "apps_kuaizhizao_backflush_records";
        DROP TABLE IF EXISTS "apps_kuaizhizao_batching_orders";
        DROP TABLE IF EXISTS "apps_kuaizhizao_batching_order_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_computation_configs";
        DROP TABLE IF EXISTS "apps_kuaizhizao_barcode_mapping_rules";
        DROP TABLE IF EXISTS "apps_kuaizhizao_customer_material_registrations";
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_delay_exceptions";
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_notices";
        DROP TABLE IF EXISTS "apps_kuaizhizao_disassembly_orders";
        DROP TABLE IF EXISTS "apps_kuaizhizao_disassembly_order_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_document_node_timings";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_calibrations";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_faults";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_repairs";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_point_inspection_plans";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_point_inspection_records";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_status_histories";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_status_monitors";
        DROP TABLE IF EXISTS "apps_kuaizhizao_exception_process_histories";
        DROP TABLE IF EXISTS "apps_kuaizhizao_exception_process_records";
        DROP TABLE IF EXISTS "apps_kuaizhizao_inspection_plans";
        DROP TABLE IF EXISTS "apps_kuaizhizao_inspection_plan_steps";
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_alerts";
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_alert_rules";
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_transfers";
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_transfer_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_launch_countdowns";
        DROP TABLE IF EXISTS "apps_kuaizhizao_line_side_inventory";
        DROP TABLE IF EXISTS "apps_kuaizhizao_maintenance_executions";
        DROP TABLE IF EXISTS "apps_kuaizhizao_maintenance_plans";
        DROP TABLE IF EXISTS "apps_kuaizhizao_maintenance_reminders";
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_borrows";
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_call_requests";
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_returns";
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_shortage_exceptions";
        DROP TABLE IF EXISTS "apps_kuaizhizao_molds";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_calibrations";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_usages";
        DROP TABLE IF EXISTS "apps_kuaizhizao_other_inbounds";
        DROP TABLE IF EXISTS "apps_kuaizhizao_other_outbounds";
        DROP TABLE IF EXISTS "apps_kuaizhizao_quality_exceptions";
        DROP TABLE IF EXISTS "apps_kuaizhizao_quality_standards";
        DROP TABLE IF EXISTS "apps_kuaizhizao_quotations";
        DROP TABLE IF EXISTS "apps_kuaizhizao_receipt_notices";
        DROP TABLE IF EXISTS "apps_kuaizhizao_replenishment_suggestions";
        DROP TABLE IF EXISTS "apps_kuaizhizao_sample_trials";
        DROP TABLE IF EXISTS "apps_kuaizhizao_scheduling_configs";
        DROP TABLE IF EXISTS "apps_kuaizhizao_shipment_notices";
        DROP TABLE IF EXISTS "apps_kuaizhizao_spare_parts";
        DROP TABLE IF EXISTS "apps_kuaizhizao_spare_part_inventories";
        DROP TABLE IF EXISTS "apps_kuaizhizao_spare_part_stock_records";
        DROP TABLE IF EXISTS "apps_kuaizhizao_state_transition_logs";
        DROP TABLE IF EXISTS "apps_kuaizhizao_state_transition_rules";
        DROP TABLE IF EXISTS "apps_kuaizhizao_stocktakings";
        DROP TABLE IF EXISTS "apps_kuaizhizao_stocktaking_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tools";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_calibrations";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_maintenances";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_usages";"""
