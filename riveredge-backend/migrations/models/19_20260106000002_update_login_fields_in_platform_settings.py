"""
更新登录页配置字段

将 login_description 拆分为 login_title 和 login_content。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：拆分登录页描述字段
    """
    return """
        -- ============================================
        -- 添加新的登录页配置字段
        -- ============================================
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "login_title" VARCHAR(200);
        
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "login_content" TEXT;
        
        -- 将旧的 login_description 数据迁移到 login_content（如果存在）
        UPDATE "infra_platform_settings" 
        SET "login_content" = "login_description" 
        WHERE "login_description" IS NOT NULL 
        AND "login_content" IS NULL;
        
        -- 删除旧的 login_description 字段
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "login_description";
        
        -- 添加字段注释
        COMMENT ON COLUMN "infra_platform_settings"."login_title" IS '登录页标题';
        COMMENT ON COLUMN "infra_platform_settings"."login_content" IS '登录页内容描述';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：恢复为单个描述字段
    """
    return """
        -- 添加回 login_description 字段
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "login_description" TEXT;
        
        -- 将 login_content 数据迁移回 login_description
        UPDATE "infra_platform_settings" 
        SET "login_description" = "login_content" 
        WHERE "login_content" IS NOT NULL;
        
        -- 删除新字段
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "login_title";
        
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "login_content";
    """

