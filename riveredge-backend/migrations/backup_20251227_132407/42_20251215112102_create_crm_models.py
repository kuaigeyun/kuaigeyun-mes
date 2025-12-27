from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


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


MODELS_STATE = (
    "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"
)
