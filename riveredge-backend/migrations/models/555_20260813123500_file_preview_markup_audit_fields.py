"""
core_file_preview_markups 补齐 BaseModel 审计字段

迁移 495 建表早于全库审计字段约定，ORM 查询会引用缺失的 created_by 等列，
导致 preview-markup 接口 500。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_file_preview_markups"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_file_preview_markups"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by";
    """
