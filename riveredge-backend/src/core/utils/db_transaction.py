"""
跨层事务复用：避免 Tortoise NestedTransactionPooledContext 死锁。

Tortoise 0.21 在已有事务上再 ``in_transaction()`` 会走 NestedTransactionPooledContext：
``_trxlock`` 为不可重入的 ``asyncio.Lock``，二层 Nested 会永久死锁，网关表现为 504
「服务器暂时不可用」。复用外层连接则只 yield，不二次抢锁。
"""

from contextlib import asynccontextmanager

from tortoise import connections
from tortoise.backends.base.client import BaseTransactionWrapper
from tortoise.transactions import in_transaction


@asynccontextmanager
async def reuse_or_begin_transaction():
    """复用外层事务，否则开启新事务。"""
    conn = connections.get("default")
    if isinstance(conn, BaseTransactionWrapper):
        yield conn
    else:
        async with in_transaction() as conn:
            yield conn
