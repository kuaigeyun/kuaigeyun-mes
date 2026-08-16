"""
工程图纸：仓库文件夹 + folder_id。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_folders" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "parent_id" INT,
    "sort_order" INT NOT NULL DEFAULT 0,
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_drawing_folders_tenant"
    ON "apps_master_data_drawing_folders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_drawing_folders_uuid"
    ON "apps_master_data_drawing_folders" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_drawing_folders_parent"
    ON "apps_master_data_drawing_folders" ("parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_drawing_folder_parent_name"
    ON "apps_master_data_drawing_folders" ("tenant_id", COALESCE("parent_id", 0), "name")
    WHERE "deleted_at" IS NULL;
ALTER TABLE "apps_master_data_engineering_drawings"
    ADD COLUMN IF NOT EXISTS "folder_id" INT;
CREATE INDEX IF NOT EXISTS "idx_eng_drawing_folder_id"
    ON "apps_master_data_engineering_drawings" ("folder_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_eng_drawing_folder_id";
ALTER TABLE "apps_master_data_engineering_drawings" DROP COLUMN IF EXISTS "folder_id";
DROP INDEX IF EXISTS "uq_drawing_folder_parent_name";
DROP INDEX IF EXISTS "idx_drawing_folders_parent";
DROP INDEX IF EXISTS "idx_drawing_folders_uuid";
DROP INDEX IF EXISTS "idx_drawing_folders_tenant";
DROP TABLE IF EXISTS "apps_master_data_drawing_folders";
"""
