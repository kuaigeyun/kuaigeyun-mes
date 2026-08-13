"""
core_code_sequences.current_seq：INT4 → BIGINT。

单据流水位数可到 18 位（10^18-1 仍小于 int64）；原先 int4 在约 10 位就会溢出，
校准库内最大号时会中断开单。不截断、不丢号，按解析到的最大流水续编。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_code_sequences"
    ALTER COLUMN "current_seq" TYPE BIGINT
    USING "current_seq"::bigint;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_code_sequences"
    ALTER COLUMN "current_seq" TYPE INTEGER
    USING "current_seq"::integer;
"""
