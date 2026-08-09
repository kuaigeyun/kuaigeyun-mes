"""
创建组织活动日志表 infra_tenant_activity_logs。

TenantActivityLog 模型与组织管理 API 已存在，此前无 aerich 建表迁移；
新建组织时写活动日志会因表缺失导致 PostgreSQL 事务失败。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "infra_tenant_activity_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "action" VARCHAR(50) NOT NULL,
            "description" TEXT NOT NULL,
            "operator_id" INT,
            "operator_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_infra_tenant_activity_logs_tenant_id"
            ON "infra_tenant_activity_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_infra_tenant_activity_logs_created_at"
            ON "infra_tenant_activity_logs" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_infra_tenant_activity_logs_action"
            ON "infra_tenant_activity_logs" ("action");
        COMMENT ON TABLE "infra_tenant_activity_logs" IS '组织活动日志（创建/激活/停用/套餐变更等）';
        COMMENT ON COLUMN "infra_tenant_activity_logs"."action" IS '操作类型';
        COMMENT ON COLUMN "infra_tenant_activity_logs"."description" IS '操作描述';
        COMMENT ON COLUMN "infra_tenant_activity_logs"."operator_id" IS '操作人ID';
        COMMENT ON COLUMN "infra_tenant_activity_logs"."operator_name" IS '操作人名称';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_infra_tenant_activity_logs_action";
        DROP INDEX IF EXISTS "idx_infra_tenant_activity_logs_created_at";
        DROP INDEX IF EXISTS "idx_infra_tenant_activity_logs_tenant_id";
        DROP TABLE IF EXISTS "infra_tenant_activity_logs";
    """
