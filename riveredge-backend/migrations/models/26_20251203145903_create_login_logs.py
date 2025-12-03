"""
创建登录日志表迁移

创建 root_login_logs 表，用于记录系统登录日志。
"""

from aerich.ddl import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "root_login_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "user_id" INT,
            "username" VARCHAR(100),
            "login_ip" VARCHAR(50) NOT NULL,
            "login_location" VARCHAR(200),
            "login_device" VARCHAR(50),
            "login_browser" VARCHAR(200),
            "login_status" VARCHAR(20) NOT NULL,
            "failure_reason" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_tenant_id" ON "root_login_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_user_id" ON "root_login_logs" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_uuid" ON "root_login_logs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_username" ON "root_login_logs" ("username");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_login_ip" ON "root_login_logs" ("login_ip");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_login_status" ON "root_login_logs" ("login_status");
        CREATE INDEX IF NOT EXISTS "idx_root_login_logs_created_at" ON "root_login_logs" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "root_login_logs";
    """

