"""
数据备份：存储落点字段 + 平台备份策略 JSON；支持定时/对象存储/保留清理。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups"
            ADD COLUMN IF NOT EXISTS "trigger_source" VARCHAR(20) NOT NULL DEFAULT 'manual';
        ALTER TABLE "core_data_backups"
            ADD COLUMN IF NOT EXISTS "storage_backend" VARCHAR(32) NOT NULL DEFAULT 'local';
        ALTER TABLE "core_data_backups"
            ADD COLUMN IF NOT EXISTS "storage_connection_uuid" VARCHAR(64);
        ALTER TABLE "core_data_backups"
            ADD COLUMN IF NOT EXISTS "storage_key" VARCHAR(500);
        ALTER TABLE "core_data_backups"
            ADD COLUMN IF NOT EXISTS "storage_owner_tenant_id" INT;

        ALTER TABLE "infra_platform_settings"
            ADD COLUMN IF NOT EXISTS "data_backup_policy" JSONB;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "trigger_source";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "storage_backend";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "storage_connection_uuid";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "storage_key";
        ALTER TABLE "core_data_backups" DROP COLUMN IF EXISTS "storage_owner_tenant_id";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "data_backup_policy";
    """
