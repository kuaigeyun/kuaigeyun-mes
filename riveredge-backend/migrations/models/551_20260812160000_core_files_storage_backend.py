"""
core_files 增加存储后端字段，支持本地 / 对象存储（如腾讯 COS）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_files"
    ADD COLUMN IF NOT EXISTS "storage_backend" VARCHAR(32) NOT NULL DEFAULT 'local';
ALTER TABLE "core_files"
    ADD COLUMN IF NOT EXISTS "storage_connection_uuid" VARCHAR(36);

COMMENT ON COLUMN "core_files"."storage_backend"
    IS '存储后端：local / tencent_cos 等';
COMMENT ON COLUMN "core_files"."storage_connection_uuid"
    IS '对象存储应用连接 UUID（local 时可空）';

CREATE INDEX IF NOT EXISTS "idx_core_files_storage_backend"
    ON "core_files" ("tenant_id", "storage_backend");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_core_files_storage_backend";
ALTER TABLE "core_files" DROP COLUMN IF EXISTS "storage_connection_uuid";
ALTER TABLE "core_files" DROP COLUMN IF EXISTS "storage_backend";
"""
