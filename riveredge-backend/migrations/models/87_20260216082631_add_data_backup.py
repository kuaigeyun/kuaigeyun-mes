from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_data_backups" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(200) NOT NULL,
    "backup_type" VARCHAR(20) NOT NULL  DEFAULT 'full',
    "backup_scope" VARCHAR(20) NOT NULL  DEFAULT 'all',
    "backup_tables" JSONB,
    "file_path" VARCHAR(500),
    "file_uuid" VARCHAR(100),
    "file_size" BIGINT,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "inngest_run_id" VARCHAR(100),
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "error_message" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_core_data_b_tenant__1194b7" ON "core_data_backups" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_data_b_tenant__2f7d04" ON "core_data_backups" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_core_data_b_uuid_716729" ON "core_data_backups" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_data_b_status_5896a2" ON "core_data_backups" ("status");
COMMENT ON COLUMN "core_data_backups"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_data_backups"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_data_backups"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_data_backups"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_data_backups"."id" IS '主键ID';
COMMENT ON COLUMN "core_data_backups"."name" IS '备份名称';
COMMENT ON COLUMN "core_data_backups"."backup_type" IS '备份类型';
COMMENT ON COLUMN "core_data_backups"."backup_scope" IS '备份范围';
COMMENT ON COLUMN "core_data_backups"."backup_tables" IS '备份的表列表';
COMMENT ON COLUMN "core_data_backups"."file_path" IS '备份文件本地路径';
COMMENT ON COLUMN "core_data_backups"."file_uuid" IS '文件UUID';
COMMENT ON COLUMN "core_data_backups"."file_size" IS '文件大小';
COMMENT ON COLUMN "core_data_backups"."status" IS '备份状态';
COMMENT ON COLUMN "core_data_backups"."inngest_run_id" IS 'Inngest 运行ID';
COMMENT ON COLUMN "core_data_backups"."started_at" IS '开始时间';
COMMENT ON COLUMN "core_data_backups"."completed_at" IS '完成时间';
COMMENT ON COLUMN "core_data_backups"."error_message" IS '错误信息';
COMMENT ON TABLE "core_data_backups" IS '数据备份模型';;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_data_backups";"""
