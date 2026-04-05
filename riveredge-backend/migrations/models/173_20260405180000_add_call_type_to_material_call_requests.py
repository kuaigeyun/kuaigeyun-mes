"""
叫料请求增加叫料类型（数据字典 MATERIAL_CALL_TYPE：单物料 / 整单）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_material_call_requests"
        ADD COLUMN IF NOT EXISTS "call_type" VARCHAR(64) NOT NULL DEFAULT 'SINGLE_MATERIAL';
        COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."call_type" IS '叫料类型（数据字典 MATERIAL_CALL_TYPE）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_material_call_requests" DROP COLUMN IF EXISTS "call_type";
    """
