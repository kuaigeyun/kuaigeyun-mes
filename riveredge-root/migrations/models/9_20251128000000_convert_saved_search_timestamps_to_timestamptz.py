"""
将 root_saved_searches 表的 TIMESTAMP 字段改为 TIMESTAMPTZ

原因：
- Tortoise ORM 的 DatetimeField 对于 PostgreSQL 使用 TIMESTAMPTZ（带时区）
- 当前表使用 TIMESTAMP（不带时区），导致时区混用问题
- 需要统一使用 TIMESTAMPTZ 以匹配 Tortoise ORM 的行为
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 将 root_saved_searches 表的 created_at 和 updated_at 字段从 TIMESTAMP 改为 TIMESTAMPTZ
        -- 注意：PostgreSQL 会自动转换现有数据，假设它们是 UTC 时间
        
        -- 转换 created_at 字段
        ALTER TABLE "root_saved_searches" 
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ 
        USING "created_at" AT TIME ZONE 'UTC';
        
        -- 转换 updated_at 字段
        ALTER TABLE "root_saved_searches" 
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ 
        USING "updated_at" AT TIME ZONE 'UTC';
        
        -- 添加注释
        COMMENT ON COLUMN "root_saved_searches"."created_at" IS '创建时间（带时区）';
        COMMENT ON COLUMN "root_saved_searches"."updated_at" IS '更新时间（带时区）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 将 root_saved_searches 表的 created_at 和 updated_at 字段从 TIMESTAMPTZ 改回 TIMESTAMP
        -- 注意：这会丢失时区信息，只保留本地时间
        
        -- 转换 created_at 字段
        ALTER TABLE "root_saved_searches" 
        ALTER COLUMN "created_at" TYPE TIMESTAMP 
        USING "created_at" AT TIME ZONE 'UTC';
        
        -- 转换 updated_at 字段
        ALTER TABLE "root_saved_searches" 
        ALTER COLUMN "updated_at" TYPE TIMESTAMP 
        USING "updated_at" AT TIME ZONE 'UTC';
    """

