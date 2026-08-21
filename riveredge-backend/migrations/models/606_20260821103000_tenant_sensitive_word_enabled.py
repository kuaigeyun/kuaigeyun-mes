"""infra_tenants 增加敏感词控制开关（默认关闭）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_tenants"
            ADD COLUMN IF NOT EXISTS "sensitive_word_enabled" BOOL NOT NULL DEFAULT FALSE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_tenants"
            DROP COLUMN IF EXISTS "sensitive_word_enabled";
    """
