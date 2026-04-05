"""
叫料请求增加叫料原因（数据字典 MATERIAL_CALL_REASON，单物料叫料使用）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_material_call_requests"
        ADD COLUMN IF NOT EXISTS "call_reason" VARCHAR(64) NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_material_call_requests"."call_reason" IS '叫料原因（数据字典 MATERIAL_CALL_REASON，单物料）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_material_call_requests" DROP COLUMN IF EXISTS "call_reason";
    """
