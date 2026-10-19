"""
图纸气泡标注特性行补齐 BaseModel 审计列（created_by / updated_by 等）。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_drawing_balloon_sheet_lines"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_drawing_balloon_sheet_lines"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by";
    """
