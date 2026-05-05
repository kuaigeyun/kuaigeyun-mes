"""
将 SOP 编码列加长至 100，支持「路线-工序-物料/物料组」组合编号策略。

Author: RiverEdge
Date: 2026-05-05
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_UPGRADE = """
        ALTER TABLE "apps_master_data_sop" ALTER COLUMN "code" TYPE VARCHAR(100);
"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    return _UPGRADE


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 若已有超过 50 字符的编码，回退会失败；升级策略下不回退列长。
    return ""
