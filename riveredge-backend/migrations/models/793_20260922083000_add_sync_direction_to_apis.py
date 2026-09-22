"""为接口表添加同步方向（入站/出站/双向）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_apis"
    ADD COLUMN IF NOT EXISTS "sync_direction" VARCHAR(20) NOT NULL DEFAULT 'pull';
COMMENT ON COLUMN "core_apis"."sync_direction" IS '同步方向：pull 入站、push 出站、bidirectional 双向';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_apis"
    DROP COLUMN IF EXISTS "sync_direction";
"""
