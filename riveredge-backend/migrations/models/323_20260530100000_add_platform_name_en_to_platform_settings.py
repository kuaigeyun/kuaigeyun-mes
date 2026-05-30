"""
为 infra_platform_settings 补全 platform_name_en 列。

模型与 API 已使用该字段，初始建表迁移 17 及后续增量均未添加，导致 fresh deploy 后查询/更新平台设置失败。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
            ADD COLUMN IF NOT EXISTS "platform_name_en" VARCHAR(200);

        COMMENT ON COLUMN "infra_platform_settings"."platform_name_en" IS '平台名称（英文）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
            DROP COLUMN IF EXISTS "platform_name_en";
    """
