"""
变体属性定义增加 allow_multiple 字段

枚举类型变体属性可配置为多选，在物料编辑变体时支持选择多个枚举值。

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_material_variant_attribute_definitions" ADD COLUMN IF NOT EXISTS "allow_multiple" BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_master_data_material_variant_attribute_definitions"."allow_multiple" IS '枚举类型是否允许多选（仅 attribute_type=enum 时有效）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_material_variant_attribute_definitions" DROP COLUMN IF EXISTS "allow_multiple";
    """
