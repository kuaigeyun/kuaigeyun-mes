"""为接口表添加来源类型编码转换映射字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_apis"
    ADD COLUMN IF NOT EXISTS "source_type_conversion_map" JSONB NULL;
COMMENT ON COLUMN "core_apis"."source_type_conversion_map" IS '来源类型编码转换映射（如金蝶 FErpClsID: {"1":"Buy","2":"Make"}），用于同步时自动转换编码';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_apis"
    DROP COLUMN IF EXISTS "source_type_conversion_map";
"""
