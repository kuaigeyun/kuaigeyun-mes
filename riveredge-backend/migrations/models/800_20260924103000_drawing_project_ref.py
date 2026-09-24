"""工程图纸：关联研发项目（下拉或手填代号，可空）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_engineering_drawings"
            ADD COLUMN IF NOT EXISTS "project_id" INT,
            ADD COLUMN IF NOT EXISTS "project_code" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "project_name" VARCHAR(200);
        COMMENT ON COLUMN "apps_master_data_engineering_drawings"."project_id"
            IS '关联研发项目ID（可空；存量项目可仅填代号）';
        COMMENT ON COLUMN "apps_master_data_engineering_drawings"."project_code"
            IS '关联项目代号快照';
        COMMENT ON COLUMN "apps_master_data_engineering_drawings"."project_name"
            IS '关联项目名称快照';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_engineering_drawings"
            DROP COLUMN IF EXISTS "project_name",
            DROP COLUMN IF EXISTS "project_code",
            DROP COLUMN IF EXISTS "project_id";
    """
