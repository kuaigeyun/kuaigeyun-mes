from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_maintenance_plans" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "plan_no" VARCHAR(100) NOT NULL,
    "plan_name" VARCHAR(200) NOT NULL,
    "equipment_id" INT NOT NULL,
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
    CONSTRAINT "uid_apps_kuaiea_tenant__427961" UNIQUE ("tenant_id", "plan_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__166777" ON "apps_kuaieam_maintenance_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_plan_no_8fd146" ON "apps_kuaieam_maintenance_plans" ("plan_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_266a82" ON "apps_kuaieam_maintenance_plans" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_afe02b" ON "apps_kuaieam_maintenance_plans" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_planned_3f8ded" ON "apps_kuaieam_maintenance_plans" ("planned_start_date");
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."plan_no" IS '维护计划编号';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."plan_name" IS '计划名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."plan_type" IS '计划类型（预防性维护、定期维护、临时维护）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."maintenance_type" IS '维护类型（日常保养、小修、中修、大修）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."cycle_type" IS '周期类型（按时间、按运行时长、按使用次数）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."cycle_value" IS '周期值';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."cycle_unit" IS '周期单位（天、小时、次）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."planned_start_date" IS '计划开始日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."planned_end_date" IS '计划结束日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."responsible_person_id" IS '负责人ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."responsible_person_name" IS '负责人姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."status" IS '计划状态';
COMMENT ON COLUMN "apps_kuaieam_maintenance_plans"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_maintenance_plans" IS 'EAM维护计划表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_maintenance_workorders" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "workorder_no" VARCHAR(100) NOT NULL,
    "plan_id" INT,
    "plan_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "workorder_type" VARCHAR(50) NOT NULL,
    "maintenance_type" VARCHAR(50) NOT NULL,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '中',
    "planned_start_date" TIMESTAMPTZ,
    "planned_end_date" TIMESTAMPTZ,
    "actual_start_date" TIMESTAMPTZ,
    "actual_end_date" TIMESTAMPTZ,
    "assigned_person_id" INT,
    "assigned_person_name" VARCHAR(100),
    "executor_id" INT,
    "executor_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '待分配',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__1cde53" UNIQUE ("tenant_id", "workorder_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__651cf7" ON "apps_kuaieam_maintenance_workorders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_workord_0c8506" ON "apps_kuaieam_maintenance_workorders" ("workorder_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_plan_id_29153c" ON "apps_kuaieam_maintenance_workorders" ("plan_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_af9d18" ON "apps_kuaieam_maintenance_workorders" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_e1cf16" ON "apps_kuaieam_maintenance_workorders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_planned_b7c060" ON "apps_kuaieam_maintenance_workorders" ("planned_start_date");
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."workorder_no" IS '工单编号';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."plan_id" IS '维护计划ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."plan_uuid" IS '维护计划UUID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."workorder_type" IS '工单类型（计划维护、故障维修、临时维护）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."maintenance_type" IS '维护类型（日常保养、小修、中修、大修）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."priority" IS '优先级（高、中、低）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."planned_start_date" IS '计划开始时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."planned_end_date" IS '计划结束时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."actual_start_date" IS '实际开始时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."actual_end_date" IS '实际结束时间';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."assigned_person_id" IS '分配人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."assigned_person_name" IS '分配人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."executor_id" IS '执行人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."executor_name" IS '执行人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."status" IS '工单状态';
COMMENT ON COLUMN "apps_kuaieam_maintenance_workorders"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_maintenance_workorders" IS 'EAM维护工单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_maintenance_executions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "execution_no" VARCHAR(100) NOT NULL,
    "workorder_id" INT,
    "workorder_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
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
    CONSTRAINT "uid_apps_kuaiea_tenant__a895ca" UNIQUE ("tenant_id", "execution_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__018412" ON "apps_kuaieam_maintenance_executions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_executi_26c787" ON "apps_kuaieam_maintenance_executions" ("execution_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_workord_885717" ON "apps_kuaieam_maintenance_executions" ("workorder_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_1cabe7" ON "apps_kuaieam_maintenance_executions" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_executi_8ae746" ON "apps_kuaieam_maintenance_executions" ("execution_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_eadcca" ON "apps_kuaieam_maintenance_executions" ("status");
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_no" IS '执行记录编号';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."workorder_id" IS '维护工单ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."workorder_uuid" IS '维护工单UUID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_date" IS '执行日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."executor_id" IS '执行人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."executor_name" IS '执行人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_content" IS '执行内容';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."execution_result" IS '执行结果（正常、异常、待处理）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."maintenance_cost" IS '维护成本';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."spare_parts_used" IS '使用备件（JSON格式）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."status" IS '记录状态';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_person_id" IS '验收人员ID';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_person_name" IS '验收人员姓名';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_date" IS '验收日期';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."acceptance_result" IS '验收结果（合格、不合格）';
COMMENT ON COLUMN "apps_kuaieam_maintenance_executions"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_maintenance_executions" IS 'EAM维护执行记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_failure_reports" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "report_no" VARCHAR(100) NOT NULL,
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "failure_type" VARCHAR(50) NOT NULL,
    "failure_level" VARCHAR(20) NOT NULL  DEFAULT '一般',
    "failure_description" TEXT NOT NULL,
    "reporter_id" INT,
    "reporter_name" VARCHAR(100),
    "report_date" TIMESTAMPTZ NOT NULL,
    "assigned_person_id" INT,
    "assigned_person_name" VARCHAR(100),
    "assigned_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待分配',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__e64673" UNIQUE ("tenant_id", "report_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__18edd7" ON "apps_kuaieam_failure_reports" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_report__5c5e90" ON "apps_kuaieam_failure_reports" ("report_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_f33727" ON "apps_kuaieam_failure_reports" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_failure_3cc66e" ON "apps_kuaieam_failure_reports" ("failure_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_failure_39a18a" ON "apps_kuaieam_failure_reports" ("failure_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_50934b" ON "apps_kuaieam_failure_reports" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_report__d92a20" ON "apps_kuaieam_failure_reports" ("report_date");
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."report_no" IS '报修单编号';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."failure_type" IS '故障类型（机械故障、电气故障、软件故障、其他）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."failure_level" IS '故障等级（一般、严重、紧急）';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."failure_description" IS '故障描述';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."reporter_id" IS '报修人ID';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."reporter_name" IS '报修人姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."report_date" IS '报修日期';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."assigned_person_id" IS '分配人员ID';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."assigned_person_name" IS '分配人员姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."assigned_date" IS '分配日期';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."status" IS '报修状态';
COMMENT ON COLUMN "apps_kuaieam_failure_reports"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_failure_reports" IS 'EAM故障报修表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_failure_handlings" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "handling_no" VARCHAR(100) NOT NULL,
    "report_id" INT,
    "report_uuid" VARCHAR(36),
    "equipment_id" INT NOT NULL,
    "equipment_name" VARCHAR(200) NOT NULL,
    "handling_start_date" TIMESTAMPTZ,
    "handling_end_date" TIMESTAMPTZ,
    "handler_id" INT,
    "handler_name" VARCHAR(100),
    "handling_method" TEXT,
    "handling_result" VARCHAR(50),
    "root_cause" TEXT,
    "handling_cost" DECIMAL(10,2),
    "spare_parts_used" JSONB,
    "status" VARCHAR(50) NOT NULL  DEFAULT '处理中',
    "acceptance_person_id" INT,
    "acceptance_person_name" VARCHAR(100),
    "acceptance_date" TIMESTAMPTZ,
    "acceptance_result" VARCHAR(50),
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__31d606" UNIQUE ("tenant_id", "handling_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__d6043c" ON "apps_kuaieam_failure_handlings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_handlin_0cb962" ON "apps_kuaieam_failure_handlings" ("handling_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_report__1230ca" ON "apps_kuaieam_failure_handlings" ("report_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_equipme_aee458" ON "apps_kuaieam_failure_handlings" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_f885be" ON "apps_kuaieam_failure_handlings" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_handlin_b102bd" ON "apps_kuaieam_failure_handlings" ("handling_start_date");
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_no" IS '处理单编号';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."report_id" IS '故障报修ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."report_uuid" IS '故障报修UUID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."equipment_id" IS '设备ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."equipment_name" IS '设备名称';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_start_date" IS '处理开始时间';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_end_date" IS '处理结束时间';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handler_id" IS '处理人员ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handler_name" IS '处理人员姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_method" IS '处理方法';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_result" IS '处理结果（已修复、部分修复、无法修复、待确认）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."root_cause" IS '根本原因';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."handling_cost" IS '处理成本';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."spare_parts_used" IS '使用备件（JSON格式）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."status" IS '处理状态';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_person_id" IS '验收人员ID';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_person_name" IS '验收人员姓名';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_date" IS '验收日期';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."acceptance_result" IS '验收结果（合格、不合格）';
COMMENT ON COLUMN "apps_kuaieam_failure_handlings"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_failure_handlings" IS 'EAM故障处理表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_spare_part_demands" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "demand_no" VARCHAR(100) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(100),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_code" VARCHAR(100),
    "demand_quantity" INT NOT NULL,
    "demand_date" TIMESTAMPTZ NOT NULL,
    "required_date" TIMESTAMPTZ,
    "applicant_id" INT,
    "applicant_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__dd52a6" UNIQUE ("tenant_id", "demand_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__764329" ON "apps_kuaieam_spare_part_demands" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_demand__2dd577" ON "apps_kuaieam_spare_part_demands" ("demand_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_source__9d294b" ON "apps_kuaieam_spare_part_demands" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_materia_5e26ad" ON "apps_kuaieam_spare_part_demands" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_1efd1f" ON "apps_kuaieam_spare_part_demands" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_demand__afc00d" ON "apps_kuaieam_spare_part_demands" ("demand_date");
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."demand_no" IS '需求单编号';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."source_type" IS '来源类型（维护计划、故障维修、库存预警）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."demand_quantity" IS '需求数量';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."demand_date" IS '需求日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."required_date" IS '要求到货日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."applicant_id" IS '申请人ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."applicant_name" IS '申请人姓名';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."status" IS '需求状态';
COMMENT ON COLUMN "apps_kuaieam_spare_part_demands"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_spare_part_demands" IS 'EAM备件需求表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_spare_part_purchases" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "purchase_no" VARCHAR(100) NOT NULL,
    "demand_id" INT,
    "demand_uuid" VARCHAR(36),
    "material_id" INT NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_code" VARCHAR(100),
    "purchase_quantity" INT NOT NULL,
    "unit_price" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2),
    "supplier_id" INT,
    "supplier_name" VARCHAR(200),
    "purchase_date" TIMESTAMPTZ NOT NULL,
    "expected_delivery_date" TIMESTAMPTZ,
    "actual_delivery_date" TIMESTAMPTZ,
    "purchaser_id" INT,
    "purchaser_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__5e8bf2" UNIQUE ("tenant_id", "purchase_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__349ac3" ON "apps_kuaieam_spare_part_purchases" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_purchas_7a8ae0" ON "apps_kuaieam_spare_part_purchases" ("purchase_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_demand__9f19fe" ON "apps_kuaieam_spare_part_purchases" ("demand_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_materia_0c075f" ON "apps_kuaieam_spare_part_purchases" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_supplie_a73dbe" ON "apps_kuaieam_spare_part_purchases" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_0d321a" ON "apps_kuaieam_spare_part_purchases" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_purchas_544913" ON "apps_kuaieam_spare_part_purchases" ("purchase_date");
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchase_no" IS '采购单编号';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."demand_id" IS '备件需求ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."demand_uuid" IS '备件需求UUID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchase_quantity" IS '采购数量';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."unit_price" IS '单价';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."total_amount" IS '总金额';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."supplier_id" IS '供应商ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."supplier_name" IS '供应商名称';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchase_date" IS '采购日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."expected_delivery_date" IS '预计到货日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."actual_delivery_date" IS '实际到货日期';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchaser_id" IS '采购人员ID';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."purchaser_name" IS '采购人员姓名';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."status" IS '采购状态';
COMMENT ON COLUMN "apps_kuaieam_spare_part_purchases"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_spare_part_purchases" IS 'EAM备件采购表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_tooling_usages" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "usage_no" VARCHAR(100) NOT NULL,
    "tooling_id" INT NOT NULL,
    "tooling_name" VARCHAR(200) NOT NULL,
    "tooling_code" VARCHAR(100),
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(100),
    "usage_date" TIMESTAMPTZ NOT NULL,
    "usage_count" INT NOT NULL  DEFAULT 1,
    "total_usage_count" INT,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '使用中',
    "return_date" TIMESTAMPTZ,
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__736d96" UNIQUE ("tenant_id", "usage_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__c7ed54" ON "apps_kuaieam_tooling_usages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_n_35c97b" ON "apps_kuaieam_tooling_usages" ("usage_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tooling_ce7c40" ON "apps_kuaieam_tooling_usages" ("tooling_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_source__275318" ON "apps_kuaieam_tooling_usages" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_d_6d2382" ON "apps_kuaieam_tooling_usages" ("usage_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_3c7646" ON "apps_kuaieam_tooling_usages" ("status");
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."usage_no" IS '使用记录编号';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tooling_id" IS '工装夹具ID';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tooling_name" IS '工装夹具名称';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."tooling_code" IS '工装夹具编码';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."source_type" IS '来源类型（生产订单、工单）';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."usage_date" IS '使用日期';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."usage_count" IS '使用次数';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."total_usage_count" IS '累计使用次数';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."operator_id" IS '操作人员ID';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."operator_name" IS '操作人员姓名';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."status" IS '使用状态';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."return_date" IS '归还日期';
COMMENT ON COLUMN "apps_kuaieam_tooling_usages"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_tooling_usages" IS 'EAM工装夹具使用记录表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaieam_mold_usages" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "usage_no" VARCHAR(100) NOT NULL,
    "mold_id" INT NOT NULL,
    "mold_name" VARCHAR(200) NOT NULL,
    "mold_code" VARCHAR(100),
    "source_type" VARCHAR(50),
    "source_id" INT,
    "source_no" VARCHAR(100),
    "usage_date" TIMESTAMPTZ NOT NULL,
    "usage_count" INT NOT NULL  DEFAULT 1,
    "total_usage_count" INT,
    "operator_id" INT,
    "operator_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL  DEFAULT '使用中',
    "return_date" TIMESTAMPTZ,
    "remark" TEXT,
    CONSTRAINT "uid_apps_kuaiea_tenant__5c7fe8" UNIQUE ("tenant_id", "usage_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_tenant__f9677f" ON "apps_kuaieam_mold_usages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_n_4f961f" ON "apps_kuaieam_mold_usages" ("usage_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_mold_id_1db37e" ON "apps_kuaieam_mold_usages" ("mold_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_source__913959" ON "apps_kuaieam_mold_usages" ("source_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_usage_d_873ac6" ON "apps_kuaieam_mold_usages" ("usage_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaiea_status_9aa224" ON "apps_kuaieam_mold_usages" ("status");
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."usage_no" IS '使用记录编号';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."mold_id" IS '模具ID';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."mold_name" IS '模具名称';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."mold_code" IS '模具编码';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."source_type" IS '来源类型（生产订单、工单）';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."source_id" IS '来源ID';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."source_no" IS '来源编号';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."usage_date" IS '使用日期';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."usage_count" IS '使用次数';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."total_usage_count" IS '累计使用次数';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."operator_id" IS '操作人员ID';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."operator_name" IS '操作人员姓名';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."status" IS '使用状态';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."return_date" IS '归还日期';
COMMENT ON COLUMN "apps_kuaieam_mold_usages"."remark" IS '备注';
COMMENT ON TABLE "apps_kuaieam_mold_usages" IS 'EAM模具使用记录表';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaieam_maintenance_plans";
        DROP TABLE IF EXISTS "apps_kuaieam_maintenance_workorders";
        DROP TABLE IF EXISTS "apps_kuaieam_maintenance_executions";
        DROP TABLE IF EXISTS "apps_kuaieam_failure_reports";
        DROP TABLE IF EXISTS "apps_kuaieam_failure_handlings";
        DROP TABLE IF EXISTS "apps_kuaieam_spare_part_demands";
        DROP TABLE IF EXISTS "apps_kuaieam_spare_part_purchases";
        DROP TABLE IF EXISTS "apps_kuaieam_tooling_usages";
        DROP TABLE IF EXISTS "apps_kuaieam_mold_usages";"""
