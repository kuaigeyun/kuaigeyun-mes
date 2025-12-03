from aerich.ddl import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "root_data_backups" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "backup_type" VARCHAR(20) NOT NULL,
            "backup_scope" VARCHAR(20) NOT NULL,
            "backup_tables" JSONB,
            "file_path" VARCHAR(500),
            "file_uuid" VARCHAR(36),
            "file_size" BIGINT,
            "status" VARCHAR(20) NOT NULL,
            "inngest_run_id" VARCHAR(100),
            "started_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "error_message" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_tenant_id" ON "root_data_backups" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_uuid" ON "root_data_backups" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_backup_type" ON "root_data_backups" ("backup_type");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_backup_scope" ON "root_data_backups" ("backup_scope");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_status" ON "root_data_backups" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_data_backups_created_at" ON "root_data_backups" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "root_data_backups";
    """

