"""
为 SOP 表添加流程配置和表单配置字段

添加 flow_config 和 form_config 字段，用于存储 ProFlow 流程配置和 Formily 表单配置。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 为 SOP 表添加 flow_config 字段（ProFlow 流程配置）
        ALTER TABLE "apps_master_data_sop" ADD COLUMN IF NOT EXISTS "flow_config" JSONB;
        
        -- 为 SOP 表添加 form_config 字段（Formily 表单配置）
        ALTER TABLE "apps_master_data_sop" ADD COLUMN IF NOT EXISTS "form_config" JSONB;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除 form_config 字段
        ALTER TABLE "apps_master_data_sop" DROP COLUMN IF EXISTS "form_config";
        
        -- 删除 flow_config 字段
        ALTER TABLE "apps_master_data_sop" DROP COLUMN IF EXISTS "flow_config";
    """

