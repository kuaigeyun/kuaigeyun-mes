from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_leads" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "lead_no" VARCHAR(50) NOT NULL,
    "lead_source" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT '新线索',
    "customer_name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(100),
    "contact_phone" VARCHAR(20),
    "contact_email" VARCHAR(100),
    "address" TEXT,
    "score" INT NOT NULL  DEFAULT 0,
    "assigned_to" INT,
    "convert_status" VARCHAR(20),
    "convert_time" TIMESTAMPTZ,
    "convert_reason" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__810b7c" UNIQUE ("tenant_id", "lead_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__bbfa20" ON "apps_kuaicrm_leads" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_lead_no_5a0035" ON "apps_kuaicrm_leads" ("lead_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_611138" ON "apps_kuaicrm_leads" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_45f2b7" ON "apps_kuaicrm_leads" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_assigne_e29feb" ON "apps_kuaicrm_leads" ("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_lead_so_110b67" ON "apps_kuaicrm_leads" ("lead_source");
COMMENT ON COLUMN "apps_kuaicrm_leads"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_leads"."lead_no" IS '线索编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."lead_source" IS '线索来源（展会、网站、转介绍、电话营销等）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."status" IS '线索状态（新线索、跟进中、已转化、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."customer_name" IS '客户名称';
COMMENT ON COLUMN "apps_kuaicrm_leads"."contact_name" IS '联系人';
COMMENT ON COLUMN "apps_kuaicrm_leads"."contact_phone" IS '联系电话';
COMMENT ON COLUMN "apps_kuaicrm_leads"."contact_email" IS '联系邮箱';
COMMENT ON COLUMN "apps_kuaicrm_leads"."address" IS '地址';
COMMENT ON COLUMN "apps_kuaicrm_leads"."score" IS '线索评分';
COMMENT ON COLUMN "apps_kuaicrm_leads"."assigned_to" IS '分配给（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."convert_status" IS '转化状态（未转化、已转化为商机、已转化为客户）';
COMMENT ON COLUMN "apps_kuaicrm_leads"."convert_time" IS '转化时间';
COMMENT ON COLUMN "apps_kuaicrm_leads"."convert_reason" IS '转化原因';
COMMENT ON COLUMN "apps_kuaicrm_leads"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_leads" IS 'KUAICRM Lead表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_opportunities" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "oppo_no" VARCHAR(50) NOT NULL,
    "oppo_name" VARCHAR(200) NOT NULL,
    "customer_id" INT,
    "stage" VARCHAR(50) NOT NULL  DEFAULT '初步接触',
    "amount" DECIMAL(18,2),
    "expected_close_date" TIMESTAMPTZ,
    "source" VARCHAR(50),
    "lead_id" INT,
    "owner_id" INT,
    "probability" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "status" VARCHAR(20) NOT NULL  DEFAULT '进行中',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__8af6b9" UNIQUE ("tenant_id", "oppo_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__09a4dc" ON "apps_kuaicrm_opportunities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_oppo_no_c0b7cd" ON "apps_kuaicrm_opportunities" ("oppo_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_2036b9" ON "apps_kuaicrm_opportunities" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_stage_ec4731" ON "apps_kuaicrm_opportunities" ("stage");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_eb743c" ON "apps_kuaicrm_opportunities" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_owner_i_de8230" ON "apps_kuaicrm_opportunities" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_289235" ON "apps_kuaicrm_opportunities" ("customer_id");
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."oppo_no" IS '商机编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."oppo_name" IS '商机名称';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."stage" IS '商机阶段（初步接触、需求确认、方案报价、商务谈判、成交）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."amount" IS '商机金额';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."expected_close_date" IS '预计成交日期';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."source" IS '商机来源（线索转化、直接创建）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."lead_id" IS '关联线索ID（如果来自线索转化）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."owner_id" IS '负责人（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."probability" IS '成交概率（0-100）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."status" IS '商机状态（进行中、已成交、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_opportunities"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_opportunities" IS 'CRM商机表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_sales_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "customer_id" INT NOT NULL,
    "opportunity_id" INT,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待审批',
    "total_amount" DECIMAL(18,2) NOT NULL,
    "delivery_date" TIMESTAMPTZ,
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__64f939" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__0b7650" ON "apps_kuaicrm_sales_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_order_n_a914f5" ON "apps_kuaicrm_sales_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_3b8d8a" ON "apps_kuaicrm_sales_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_625f7d" ON "apps_kuaicrm_sales_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_89cfbe" ON "apps_kuaicrm_sales_orders" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_opportu_4fc920" ON "apps_kuaicrm_sales_orders" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_order_d_c15239" ON "apps_kuaicrm_sales_orders" ("order_date");
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."order_date" IS '订单日期';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."opportunity_id" IS '关联商机ID（可选，从商机转化）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."status" IS '订单状态（待审批、已审批、生产中、已交付、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."total_amount" IS '订单金额';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaicrm_sales_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_sales_orders" IS 'CRM销售订单表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_service_workorders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "workorder_no" VARCHAR(50) NOT NULL,
    "workorder_type" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '待分配',
    "priority" VARCHAR(20) NOT NULL  DEFAULT '普通',
    "service_content" TEXT NOT NULL,
    "assigned_to" INT,
    "start_time" TIMESTAMPTZ,
    "end_time" TIMESTAMPTZ,
    "execution_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__135aaf" UNIQUE ("tenant_id", "workorder_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__d09ed0" ON "apps_kuaicrm_service_workorders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_workord_0364f9" ON "apps_kuaicrm_service_workorders" ("workorder_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_ca6a58" ON "apps_kuaicrm_service_workorders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_status_c2f734" ON "apps_kuaicrm_service_workorders" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_workord_f66e4d" ON "apps_kuaicrm_service_workorders" ("workorder_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_6d6f22" ON "apps_kuaicrm_service_workorders" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_assigne_1ea323" ON "apps_kuaicrm_service_workorders" ("assigned_to");
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."workorder_no" IS '工单编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."workorder_type" IS '工单类型（安装、维修、保养、咨询等）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."status" IS '工单状态（待分配、已分配、执行中、已完成、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."priority" IS '优先级（普通、紧急、加急）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."service_content" IS '服务内容';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."assigned_to" IS '分配给（用户ID）';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."start_time" IS '开始时间';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."end_time" IS '结束时间';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."execution_result" IS '执行结果';
COMMENT ON COLUMN "apps_kuaicrm_service_workorders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_service_workorders" IS 'KUAICRM Ervice workorder表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_warranties" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "warranty_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "product_info" TEXT NOT NULL,
    "warranty_type" VARCHAR(50) NOT NULL,
    "warranty_period" INT NOT NULL,
    "warranty_start_date" TIMESTAMPTZ,
    "warranty_end_date" TIMESTAMPTZ,
    "warranty_status" VARCHAR(20) NOT NULL  DEFAULT '有效',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__08f18a" UNIQUE ("tenant_id", "warranty_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__9cd195" ON "apps_kuaicrm_warranties" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_warrant_6d554e" ON "apps_kuaicrm_warranties" ("warranty_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_588cb4" ON "apps_kuaicrm_warranties" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_warrant_658f2a" ON "apps_kuaicrm_warranties" ("warranty_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_2c264e" ON "apps_kuaicrm_warranties" ("customer_id");
COMMENT ON COLUMN "apps_kuaicrm_warranties"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_no" IS '保修编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."product_info" IS '产品信息';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_type" IS '保修类型';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_period" IS '保修期限（月）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_start_date" IS '保修开始日期';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_end_date" IS '保修结束日期';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."warranty_status" IS '保修状态（有效、已过期、已取消）';
COMMENT ON COLUMN "apps_kuaicrm_warranties"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_warranties" IS 'KUAICRM Warrantie表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_complaints" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "complaint_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "complaint_type" VARCHAR(50) NOT NULL,
    "complaint_content" TEXT NOT NULL,
    "handle_status" VARCHAR(20) NOT NULL  DEFAULT '待处理',
    "handle_result" TEXT,
    "handle_time" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__93b042" UNIQUE ("tenant_id", "complaint_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__4d3564" ON "apps_kuaicrm_complaints" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_complai_98074f" ON "apps_kuaicrm_complaints" ("complaint_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_aaf9c3" ON "apps_kuaicrm_complaints" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_handle__959af9" ON "apps_kuaicrm_complaints" ("handle_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_26dbad" ON "apps_kuaicrm_complaints" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_complai_cb239e" ON "apps_kuaicrm_complaints" ("complaint_type");
COMMENT ON COLUMN "apps_kuaicrm_complaints"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."complaint_no" IS '投诉编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."complaint_type" IS '投诉类型';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."complaint_content" IS '投诉内容';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."handle_status" IS '处理状态（待处理、处理中、已处理、已关闭）';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."handle_result" IS '处理结果';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."handle_time" IS '处理时间';
COMMENT ON COLUMN "apps_kuaicrm_complaints"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_complaints" IS 'KUAICRM Complaint表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_installations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "installation_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "installation_date" TIMESTAMPTZ NOT NULL,
    "installation_address" TEXT NOT NULL,
    "installation_status" VARCHAR(20) NOT NULL  DEFAULT '待安装',
    "installation_result" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__fc1f12" UNIQUE ("tenant_id", "installation_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__28aac5" ON "apps_kuaicrm_installations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_install_f87483" ON "apps_kuaicrm_installations" ("installation_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_7785cc" ON "apps_kuaicrm_installations" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_install_34513c" ON "apps_kuaicrm_installations" ("installation_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_d820a1" ON "apps_kuaicrm_installations" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_install_a0d798" ON "apps_kuaicrm_installations" ("installation_date");
COMMENT ON COLUMN "apps_kuaicrm_installations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_no" IS '安装编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_date" IS '安装日期';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_address" IS '安装地址';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_status" IS '安装状态（待安装、安装中、已完成、已取消）';
COMMENT ON COLUMN "apps_kuaicrm_installations"."installation_result" IS '安装结果';
COMMENT ON COLUMN "apps_kuaicrm_installations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_installations" IS 'KUAICRM Intallation表';;
        CREATE TABLE IF NOT EXISTS "apps_kuaicrm_service_contracts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "contract_no" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "contract_type" VARCHAR(50) NOT NULL,
    "contract_start_date" TIMESTAMPTZ NOT NULL,
    "contract_end_date" TIMESTAMPTZ NOT NULL,
    "contract_status" VARCHAR(20) NOT NULL  DEFAULT '有效',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicr_tenant__b8c3ab" UNIQUE ("tenant_id", "contract_no")
);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_tenant__469669" ON "apps_kuaicrm_service_contracts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_contrac_2a9f4b" ON "apps_kuaicrm_service_contracts" ("contract_no");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_uuid_03b543" ON "apps_kuaicrm_service_contracts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_contrac_96e538" ON "apps_kuaicrm_service_contracts" ("contract_status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_custome_8b6627" ON "apps_kuaicrm_service_contracts" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicr_contrac_a7223e" ON "apps_kuaicrm_service_contracts" ("contract_type");
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_no" IS '合同编号（组织内唯一）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."customer_id" IS '客户ID（关联master-data）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_type" IS '合同类型';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_start_date" IS '合同开始日期';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_end_date" IS '合同结束日期';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."contract_status" IS '合同状态（有效、已到期、已终止）';
COMMENT ON COLUMN "apps_kuaicrm_service_contracts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaicrm_service_contracts" IS 'CRM服务合同表';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaicrm_leads";
        DROP TABLE IF EXISTS "apps_kuaicrm_opportunities";
        DROP TABLE IF EXISTS "apps_kuaicrm_sales_orders";
        DROP TABLE IF EXISTS "apps_kuaicrm_service_workorders";
        DROP TABLE IF EXISTS "apps_kuaicrm_warranties";
        DROP TABLE IF EXISTS "apps_kuaicrm_complaints";
        DROP TABLE IF EXISTS "apps_kuaicrm_installations";
        DROP TABLE IF EXISTS "apps_kuaicrm_service_contracts";"""
