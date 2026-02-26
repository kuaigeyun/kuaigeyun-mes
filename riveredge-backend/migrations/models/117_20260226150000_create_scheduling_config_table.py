"""
创建排程配置表迁移

创建 apps_kuaizhizao_scheduling_configs 表，用于存储排程约束配置（含 4M 人机料法开关）。

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建排程配置表
    """
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_scheduling_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "config_code" VARCHAR(50) NOT NULL,
            "config_name" VARCHAR(200) NOT NULL,
            "constraints" JSONB NOT NULL,
            "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "description" TEXT,
            "created_by" INT,
            "updated_by" INT,
            CONSTRAINT "uid_scheduling_config_tenant_code" UNIQUE ("tenant_id", "config_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_scheduling_config_tenant_id" ON "apps_kuaizhizao_scheduling_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_scheduling_config_is_default" ON "apps_kuaizhizao_scheduling_configs" ("tenant_id", "is_default");
        CREATE INDEX IF NOT EXISTS "idx_scheduling_config_is_active" ON "apps_kuaizhizao_scheduling_configs" ("tenant_id", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_scheduling_config_config_code" ON "apps_kuaizhizao_scheduling_configs" ("config_code");
        COMMENT ON TABLE "apps_kuaizhizao_scheduling_configs" IS '快格轻制造 - 排程配置';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除排程配置表
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_scheduling_configs";
    """
