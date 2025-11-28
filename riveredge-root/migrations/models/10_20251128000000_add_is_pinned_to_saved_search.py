"""
添加 is_pinned 字段到 root_saved_searches 表

用于标记搜索条件是否钉住，钉住的条件会显示在高级搜索按钮后面
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 添加 is_pinned 字段到 root_saved_searches 表
        ALTER TABLE "root_saved_searches" 
        ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE;
        
        -- 添加注释
        COMMENT ON COLUMN "root_saved_searches"."is_pinned" IS '是否钉住（True：钉住，显示在高级搜索按钮后面）';
        
        -- 添加索引（用于快速查询钉住的条件）
        CREATE INDEX IF NOT EXISTS "idx_root_saved_searches_is_pinned" ON "root_saved_searches" ("is_pinned");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_root_saved_searches_is_pinned";
        
        -- 删除 is_pinned 字段
        ALTER TABLE "root_saved_searches" 
        DROP COLUMN IF EXISTS "is_pinned";
    """

