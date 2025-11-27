from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_tenants" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(100) NOT NULL,
    "domain" VARCHAR(100) NOT NULL UNIQUE,
    "status" VARCHAR(9) NOT NULL DEFAULT 'inactive',
    "plan" VARCHAR(12) NOT NULL DEFAULT 'basic',
    "settings" JSONB NOT NULL,
    "max_users" INT NOT NULL DEFAULT 10,
    "max_storage" INT NOT NULL DEFAULT 1024,
    "expires_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_core_tenant_tenant__e55d73" ON "core_tenants" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_tenant_domain_22c064" ON "core_tenants" ("domain");
CREATE INDEX IF NOT EXISTS "idx_core_tenant_status_195cc5" ON "core_tenants" ("status");
CREATE INDEX IF NOT EXISTS "idx_core_tenant_plan_fda057" ON "core_tenants" ("plan");
COMMENT ON COLUMN "core_tenants"."id" IS '主键 ID';
COMMENT ON COLUMN "core_tenants"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_tenants"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_tenants"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_tenants"."name" IS '组织名称';
COMMENT ON COLUMN "core_tenants"."domain" IS '组织域名（用于子域名访问）';
COMMENT ON COLUMN "core_tenants"."status" IS '组织状态';
COMMENT ON COLUMN "core_tenants"."plan" IS '组织套餐';
COMMENT ON COLUMN "core_tenants"."settings" IS '组织配置（JSONB 存储）';
COMMENT ON COLUMN "core_tenants"."max_users" IS '最大用户数限制';
COMMENT ON COLUMN "core_tenants"."max_storage" IS '最大存储空间限制（MB）';
COMMENT ON COLUMN "core_tenants"."expires_at" IS '过期时间（可选）';
COMMENT ON TABLE "core_tenants" IS '组织模型';
        CREATE TABLE IF NOT EXISTS "core_tenant_configs" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" JSONB NOT NULL,
    "description" TEXT,
    CONSTRAINT "uid_core_tenant_tenant__622b22" UNIQUE ("tenant_id", "config_key")
);
CREATE INDEX IF NOT EXISTS "idx_core_tenant_tenant__993185" ON "core_tenant_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_tenant_config__3f2216" ON "core_tenant_configs" ("config_key");
CREATE INDEX IF NOT EXISTS "idx_core_tenant_tenant__622b22" ON "core_tenant_configs" ("tenant_id", "config_key");
COMMENT ON COLUMN "core_tenant_configs"."id" IS '主键 ID';
COMMENT ON COLUMN "core_tenant_configs"."tenant_id" IS '组织 ID（外键，关联到 core_tenants 表）';
COMMENT ON COLUMN "core_tenant_configs"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_tenant_configs"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_tenant_configs"."config_key" IS '配置键（唯一标识配置项）';
COMMENT ON COLUMN "core_tenant_configs"."config_value" IS '配置值（JSONB 存储）';
COMMENT ON COLUMN "core_tenant_configs"."description" IS '配置描述（可选）';
COMMENT ON TABLE "core_tenant_configs" IS '组织配置模型';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_tenant_configs";
        DROP TABLE IF EXISTS "core_tenants";"""


MODELS_STATE = (
    "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"
)
