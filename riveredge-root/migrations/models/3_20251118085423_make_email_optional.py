"""
迁移脚本：将用户邮箱字段改为可选

根据中国用户使用习惯，将邮箱字段改为可选（null=True），并去掉唯一性约束。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级数据库：将 email 字段改为可选
    
    1. 删除 email 字段的唯一性约束
    2. 将 email 字段改为允许 NULL
    3. 删除 email 字段的索引（如果存在）
    """
    return """
        -- 删除 email 字段的唯一性约束（如果存在）
        ALTER TABLE "core_users" DROP CONSTRAINT IF EXISTS "core_users_email_key";
        
        -- 将 email 字段改为允许 NULL
        ALTER TABLE "core_users" ALTER COLUMN "email" DROP NOT NULL;
        
        -- 删除 email 字段的索引（如果存在）
        DROP INDEX IF EXISTS "idx_core_users_email";
        
        -- 添加注释说明
        COMMENT ON COLUMN "core_users"."email" IS '用户邮箱（可选，符合中国用户使用习惯）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚数据库：恢复 email 字段为必填和唯一
    
    注意：如果数据库中已有 NULL 值的 email，需要先处理这些数据。
    """
    return """
        -- 将 email 字段改为不允许 NULL（需要先处理 NULL 值）
        -- ALTER TABLE "core_users" ALTER COLUMN "email" SET NOT NULL;
        
        -- 添加 email 字段的唯一性约束
        -- ALTER TABLE "core_users" ADD CONSTRAINT "core_users_email_key" UNIQUE ("email");
        
        -- 恢复 email 字段的索引
        -- CREATE INDEX IF NOT EXISTS "idx_core_users_email" ON "core_users" ("email");
        
        -- 恢复注释
        COMMENT ON COLUMN "core_users"."email" IS '用户邮箱（全局唯一）';
        
        -- 注意：回滚前需要先处理 NULL 值的 email，否则会失败
    """

