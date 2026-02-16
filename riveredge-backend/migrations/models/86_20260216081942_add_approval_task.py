from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_approval_tasks" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "node_id" VARCHAR(100) NOT NULL,
    "approver_id" INT NOT NULL,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "action_at" TIMESTAMPTZ,
    "comment" TEXT,
    "read_at" TIMESTAMPTZ,
    "approval_instance_id" INT NOT NULL REFERENCES "core_approval_instances" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__ef7a99" ON "core_approval_tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__01ec5f" ON "core_approval_tasks" ("tenant_id", "approver_id", "status");
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__022c1c" ON "core_approval_tasks" ("tenant_id", "approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_uuid_a3c08e" ON "core_approval_tasks" ("uuid");
COMMENT ON COLUMN "core_approval_tasks"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_approval_tasks"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_approval_tasks"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_approval_tasks"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_approval_tasks"."id" IS '主键ID';
COMMENT ON COLUMN "core_approval_tasks"."node_id" IS '节点ID';
COMMENT ON COLUMN "core_approval_tasks"."approver_id" IS '审批人ID';
COMMENT ON COLUMN "core_approval_tasks"."status" IS '任务状态';
COMMENT ON COLUMN "core_approval_tasks"."action_at" IS '操作时间';
COMMENT ON COLUMN "core_approval_tasks"."comment" IS '审批意见';
COMMENT ON COLUMN "core_approval_tasks"."read_at" IS '阅读时间';
COMMENT ON COLUMN "core_approval_tasks"."approval_instance_id" IS '关联审批实例';
COMMENT ON TABLE "core_approval_tasks" IS '审批任务模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_approval_tasks";"""
