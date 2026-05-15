"""
编码规则表 core_code_rules.code 由 VARCHAR(50) 放宽至 VARCHAR(80)。

好力 GO 模具单据 rule_code 如 HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_NO 长度为 52，
超过原限制会导致「恢复预设」等写入失败。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_code_rules"
        ALTER COLUMN "code" TYPE VARCHAR(80);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_code_rules"
        ALTER COLUMN "code" TYPE VARCHAR(50);
    """
