from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "seed_kuaisrm_purchase_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "supplier_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL  DEFAULT 'CNY',
    "delivery_date" TIMESTAMPTZ,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "requirement_id" INT,
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaisr_tenant__ad48ea" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_tenant__64dc0a" ON "seed_kuaisrm_purchase_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_order_n_60b070" ON "seed_kuaisrm_purchase_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_uuid_49b5d7" ON "seed_kuaisrm_purchase_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_status_919f50" ON "seed_kuaisrm_purchase_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_supplie_2850b7" ON "seed_kuaisrm_purchase_orders" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_order_d_41403b" ON "seed_kuaisrm_purchase_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_approva_c31584" ON "seed_kuaisrm_purchase_orders" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_approva_9faa08" ON "seed_kuaisrm_purchase_orders" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_deliver_3edf6d" ON "seed_kuaisrm_purchase_orders" ("delivery_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_created_2cefe8" ON "seed_kuaisrm_purchase_orders" ("created_at");
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."order_date" IS '订单日期';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."supplier_id" IS '供应商ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."status" IS '订单状态（草稿、待审批、已审批、执行中、部分到货、已完成、已关闭、已取消）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."total_amount" IS '订单总金额';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."currency" IS '币种';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."requirement_id" IS '关联需求ID（MaterialRequirement，可选）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."order_items" IS '订单明细（JSON格式）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaisrm_purchase_orders" IS '采购订单模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaisrm_outsourcing_orders" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "supplier_id" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL  DEFAULT 'CNY',
    "delivery_date" TIMESTAMPTZ,
    "progress" INT NOT NULL  DEFAULT 0,
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "requirement_id" INT,
    "order_items" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaisr_tenant__0dd7d5" UNIQUE ("tenant_id", "order_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_tenant__9c063c" ON "seed_kuaisrm_outsourcing_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_order_n_bd87dd" ON "seed_kuaisrm_outsourcing_orders" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_uuid_8c0903" ON "seed_kuaisrm_outsourcing_orders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_status_dbeb15" ON "seed_kuaisrm_outsourcing_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_supplie_c65214" ON "seed_kuaisrm_outsourcing_orders" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_order_d_6bfbb7" ON "seed_kuaisrm_outsourcing_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_approva_4d6a7d" ON "seed_kuaisrm_outsourcing_orders" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_approva_663f3f" ON "seed_kuaisrm_outsourcing_orders" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_deliver_c95eff" ON "seed_kuaisrm_outsourcing_orders" ("delivery_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_progres_e648eb" ON "seed_kuaisrm_outsourcing_orders" ("progress");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_created_552b59" ON "seed_kuaisrm_outsourcing_orders" ("created_at");
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."order_no" IS '订单编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."order_date" IS '订单日期';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."supplier_id" IS '委外供应商ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."status" IS '订单状态（草稿、待审批、已审批、执行中、部分完成、已完成、已关闭、已取消）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."total_amount" IS '订单总金额';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."currency" IS '币种';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."delivery_date" IS '交期要求';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."progress" IS '完成进度（百分比，0-100）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."requirement_id" IS '关联需求ID（MaterialRequirement，可选）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."order_items" IS '订单明细（JSON格式）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaisrm_outsourcing_orders"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaisrm_outsourcing_orders" IS '委外订单模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaisrm_supplier_evaluations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "evaluation_no" VARCHAR(50) NOT NULL,
    "supplier_id" INT NOT NULL,
    "evaluation_period" VARCHAR(20) NOT NULL,
    "evaluation_date" TIMESTAMPTZ NOT NULL,
    "quality_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "delivery_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "price_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "service_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "total_score" DECIMAL(5,2) NOT NULL  DEFAULT 0,
    "evaluation_level" VARCHAR(10),
    "evaluation_result" JSONB,
    "evaluator_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaisr_tenant__8a0de1" UNIQUE ("tenant_id", "evaluation_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_tenant__5a7708" ON "seed_kuaisrm_supplier_evaluations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_evaluat_bb53e4" ON "seed_kuaisrm_supplier_evaluations" ("evaluation_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_uuid_b9dc97" ON "seed_kuaisrm_supplier_evaluations" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_supplie_ed91af" ON "seed_kuaisrm_supplier_evaluations" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_evaluat_2e65c5" ON "seed_kuaisrm_supplier_evaluations" ("evaluation_period");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_evaluat_34c02a" ON "seed_kuaisrm_supplier_evaluations" ("evaluation_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_evaluat_900546" ON "seed_kuaisrm_supplier_evaluations" ("evaluation_level");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_total_s_7e439c" ON "seed_kuaisrm_supplier_evaluations" ("total_score");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_created_5b1f74" ON "seed_kuaisrm_supplier_evaluations" ("created_at");
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."evaluation_no" IS '评估编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."supplier_id" IS '供应商ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."evaluation_period" IS '评估周期（月度、季度、年度）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."evaluation_date" IS '评估日期';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."quality_score" IS '质量评分（0-100）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."delivery_score" IS '交期评分（0-100）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."price_score" IS '价格评分（0-100）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."service_score" IS '服务评分（0-100）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."total_score" IS '综合评分（0-100）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."evaluation_level" IS '评估等级（A、B、C、D）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."evaluation_result" IS '评估结果（JSON格式）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."evaluator_id" IS '评估人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaisrm_supplier_evaluations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaisrm_supplier_evaluations" IS '供应商评估模型';;
        CREATE TABLE IF NOT EXISTS "seed_kuaisrm_purchase_contracts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "contract_no" VARCHAR(50) NOT NULL,
    "contract_name" VARCHAR(200) NOT NULL,
    "supplier_id" INT NOT NULL,
    "contract_date" TIMESTAMPTZ NOT NULL,
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL  DEFAULT '草稿',
    "total_amount" DECIMAL(18,2) NOT NULL  DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL  DEFAULT 'CNY',
    "approval_instance_id" INT,
    "approval_status" VARCHAR(20),
    "contract_content" JSONB,
    "remark" TEXT,
    "owner_id" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_seed_kuaisr_tenant__065dd1" UNIQUE ("tenant_id", "contract_no")
);
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_tenant__3c2845" ON "seed_kuaisrm_purchase_contracts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_contrac_a91edd" ON "seed_kuaisrm_purchase_contracts" ("contract_no");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_uuid_422d72" ON "seed_kuaisrm_purchase_contracts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_status_f5dd22" ON "seed_kuaisrm_purchase_contracts" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_supplie_5b0370" ON "seed_kuaisrm_purchase_contracts" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_contrac_e891ac" ON "seed_kuaisrm_purchase_contracts" ("contract_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_start_d_a165ad" ON "seed_kuaisrm_purchase_contracts" ("start_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_end_dat_07f536" ON "seed_kuaisrm_purchase_contracts" ("end_date");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_approva_062efb" ON "seed_kuaisrm_purchase_contracts" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_approva_cc91c1" ON "seed_kuaisrm_purchase_contracts" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_seed_kuaisr_created_017ea6" ON "seed_kuaisrm_purchase_contracts" ("created_at");
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."id" IS '主键ID';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."contract_no" IS '合同编号（组织内唯一）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."contract_name" IS '合同名称';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."supplier_id" IS '供应商ID（关联master-data）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."contract_date" IS '合同签订日期';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."start_date" IS '合同开始日期';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."end_date" IS '合同结束日期';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."status" IS '合同状态（草稿、待审批、已审批、执行中、已完成、已终止）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."total_amount" IS '合同总金额';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."currency" IS '币种';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."approval_status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."contract_content" IS '合同内容（JSON格式）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."remark" IS '备注';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."owner_id" IS '负责人ID（用户ID）';
COMMENT ON COLUMN "seed_kuaisrm_purchase_contracts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "seed_kuaisrm_purchase_contracts" IS '采购合同模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "seed_kuaisrm_purchase_orders";
        DROP TABLE IF EXISTS "seed_kuaisrm_outsourcing_orders";
        DROP TABLE IF EXISTS "seed_kuaisrm_supplier_evaluations";
        DROP TABLE IF EXISTS "seed_kuaisrm_purchase_contracts";"""
