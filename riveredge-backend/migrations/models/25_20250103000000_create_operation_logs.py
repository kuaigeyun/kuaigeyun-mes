"""
创建操作日志表迁移

创建 root_operation_logs 表，用于记录系统操作日志。
"""

from aerich.ddl import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "root_operation_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "operation_type" VARCHAR(50) NOT NULL,
            "operation_module" VARCHAR(100),
            "operation_object_type" VARCHAR(100),
            "operation_object_id" INT,
            "operation_object_uuid" VARCHAR(36),
            "operation_content" TEXT,
            "ip_address" VARCHAR(50),
            "user_agent" TEXT,
            "request_method" VARCHAR(10),
            "request_path" VARCHAR(500),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "root_operation_logs" IS '操作日志表';
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_tenant_id" ON "root_operation_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_uuid" ON "root_operation_logs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_user_id" ON "root_operation_logs" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_operation_type" ON "root_operation_logs" ("operation_type");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_operation_module" ON "root_operation_logs" ("operation_module");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_operation_object_type" ON "root_operation_logs" ("operation_object_type");
        CREATE INDEX IF NOT EXISTS "idx_root_operation_logs_created_at" ON "root_operation_logs" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "root_operation_logs";
    """

