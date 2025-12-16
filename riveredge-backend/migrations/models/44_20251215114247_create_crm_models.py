from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_approval_histories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "approval_instance_id" INT NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "action_by" INT NOT NULL,
    "action_at" TIMESTAMPTZ NOT NULL,
    "comment" TEXT,
    "from_node" VARCHAR(100),
    "to_node" VARCHAR(100),
    "from_approver_id" INT,
    "to_approver_id" INT
);
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__89d1d6" ON "core_approval_histories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_approva_a2dd10" ON "core_approval_histories" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_uuid_9a1b94" ON "core_approval_histories" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action_bd31f0" ON "core_approval_histories" ("action");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action__0f4144" ON "core_approval_histories" ("action_by");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action__b16310" ON "core_approval_histories" ("action_at");
COMMENT ON COLUMN "core_approval_histories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_approval_histories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_approval_histories"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_approval_histories"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_approval_histories"."id" IS '主键ID';
COMMENT ON COLUMN "core_approval_histories"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "core_approval_histories"."action" IS '操作类型（approve、reject、cancel、transfer）';
COMMENT ON COLUMN "core_approval_histories"."action_by" IS '操作人ID（用户ID）';
COMMENT ON COLUMN "core_approval_histories"."action_at" IS '操作时间';
COMMENT ON COLUMN "core_approval_histories"."comment" IS '审批意见';
COMMENT ON COLUMN "core_approval_histories"."from_node" IS '来源节点';
COMMENT ON COLUMN "core_approval_histories"."to_node" IS '目标节点';
COMMENT ON COLUMN "core_approval_histories"."from_approver_id" IS '原审批人ID';
COMMENT ON COLUMN "core_approval_histories"."to_approver_id" IS '新审批人ID';
COMMENT ON TABLE "core_approval_histories" IS '核心 Approval_hitorie表';;
        ALTER TABLE "apps_kuaicrm_sales_orders" ADD "approval_status" VARCHAR(20);
        ALTER TABLE "apps_kuaicrm_sales_orders" ADD "approval_instance_id" INT;
        CREATE INDEX "idx_apps_kuaicr_approva_5fc27f" ON "apps_kuaicrm_sales_orders" ("approval_status");
        CREATE INDEX "idx_apps_kuaicr_approva_c5f1a0" ON "apps_kuaicrm_sales_orders" ("approval_instance_id");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX "idx_apps_kuaicr_approva_c5f1a0";
        DROP INDEX "idx_apps_kuaicr_approva_5fc27f";
        ALTER TABLE "apps_kuaicrm_sales_orders" DROP COLUMN "approval_status";
        ALTER TABLE "apps_kuaicrm_sales_orders" DROP COLUMN "approval_instance_id";
        DROP TABLE IF EXISTS "core_approval_histories";"""
