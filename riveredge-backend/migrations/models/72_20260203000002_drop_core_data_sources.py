"""
删除 core_data_sources 表

前置：已执行 70、71 及数据迁移脚本，Dataset 已全部使用 integration_config_id。
数据源功能已由 IntegrationConfig（数据连接）统一承载。

Author: Plan B 数据连接与数据源后端统一
Date: 2026-02-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_data_sources";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 仅恢复表结构，不恢复数据；回滚需结合逆迁移脚本
    return """
        CREATE TABLE IF NOT EXISTS "core_data_sources" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "type" VARCHAR(20) NOT NULL,
            "config" JSONB NOT NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT true,
            "is_connected" BOOLEAN NOT NULL DEFAULT false,
            "last_connected_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "core_data_sources_tenant_id_code_key" ON "core_data_sources" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_type" ON "core_data_sources" ("type");
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_uuid" ON "core_data_sources" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_code" ON "core_data_sources" ("code");
        CREATE INDEX IF NOT EXISTS "idx_core_data_sources_created_at" ON "core_data_sources" ("created_at");
    """
