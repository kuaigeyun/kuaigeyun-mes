"""
快数采 Wave 4：边缘 Agent 运行时字段
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiiot_edge_configs"
            ADD COLUMN IF NOT EXISTS "config_version" INT NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS "last_agent_heartbeat_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "agent_version" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "agent_status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
            ADD COLUMN IF NOT EXISTS "buffer_pending_count" INT NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_edge_configs_agent_status"
            ON "apps_kuaiiot_edge_configs" ("tenant_id", "agent_status");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaiiot_edge_configs_agent_status";
        ALTER TABLE "apps_kuaiiot_edge_configs"
            DROP COLUMN IF EXISTS "buffer_pending_count",
            DROP COLUMN IF EXISTS "agent_status",
            DROP COLUMN IF EXISTS "agent_version",
            DROP COLUMN IF EXISTS "last_agent_heartbeat_at",
            DROP COLUMN IF EXISTS "config_version";
    """
