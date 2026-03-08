"""
添加组织自动审核字段到平台设置

为平台设置表添加 tenant_auto_approve 字段，开启后新注册的租户组织自动通过审核。

Author: Auto (AI Assistant)
Date: 2026-03-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加组织自动审核字段
    """
    return """
        -- ============================================
        -- 添加组织自动审核字段到平台设置表
        -- ============================================
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "tenant_auto_approve" BOOLEAN DEFAULT FALSE;
        
        -- 添加字段注释
        COMMENT ON COLUMN "infra_platform_settings"."tenant_auto_approve" IS '是否自动审核：开启后，新注册的租户组织自动通过审核';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除组织自动审核字段
    """
    return """
        -- 删除组织自动审核字段
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "tenant_auto_approve";
    """
