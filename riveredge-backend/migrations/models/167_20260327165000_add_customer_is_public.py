"""
客户表增加可见性字段：is_public（默认私有）。

- false: 私有（仅归属业务员可见）
- true: 公共（租户内可见）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "is_public" BOOL NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_master_data_customers"."is_public" IS '是否公共（false=私有，true=公共）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "is_public";
    """

