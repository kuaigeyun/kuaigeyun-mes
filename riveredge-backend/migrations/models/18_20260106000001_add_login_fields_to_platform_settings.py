"""
添加登录页配置字段到平台设置表

添加 login_description 和 icp_license 字段。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加登录页配置字段
    """
    return """
        -- ============================================
        -- 添加登录页配置字段
        -- ============================================
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "login_description" TEXT;
        
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "icp_license" VARCHAR(100);
        
        -- 添加字段注释
        COMMENT ON COLUMN "infra_platform_settings"."login_description" IS '登录页描述';
        COMMENT ON COLUMN "infra_platform_settings"."icp_license" IS 'ICP备案信息';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除登录页配置字段
    """
    return """
        -- 删除字段
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "login_description";
        
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "icp_license";
    """

