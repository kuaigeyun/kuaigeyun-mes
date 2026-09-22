"""库存过账的事务去重，以及单据确认/撤回的串行边界。"""
import hashlib
import inspect
from contextlib import asynccontextmanager
from contextvars import ContextVar
from functools import wraps
from uuid import uuid4

from tortoise.transactions import in_transaction
from tortoise import connections
from tortoise.backends.base.client import BaseTransactionWrapper
from tortoise.queryset import Q

_posting_scope: ContextVar[str | None] = ContextVar("stock_posting_scope", default=None)


@asynccontextmanager
async def reuse_or_begin_transaction():
    """
    复用外层事务，否则开启新事务。

    Tortoise 0.21 嵌套 in_transaction 走 NestedTransactionPooledContext：
    - `_trxlock` 不可重入，嵌套调用会死锁；
    - 内层异常会直接 rollback 整段外层连接。
    因此凡可能被外层单据事务调用的写路径，统一走本上下文，避免独立提交/死锁。
    """
    conn = connections.get("default")
    if isinstance(conn, BaseTransactionWrapper):
        try:
            yield conn
        except BaseException:
            if not conn._finalized:
                await conn.rollback()
            raise
    else:
        async with in_transaction() as conn:
            yield conn


# 兼容旧名：库存原子装饰器内部仍用此别名
_stock_transaction = reuse_or_begin_transaction


def atomic_stock_change(func):
    @wraps(func)
    async def wrapped(*args, **kwargs):
        async with reuse_or_begin_transaction():
            return await func(*args, **kwargs)
    return wrapped


async def _lock(conn, key: str) -> None:
    lock_id = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big", signed=True)
    await conn.execute_query("SELECT pg_advisory_xact_lock($1)", [lock_id])


def idempotent_stock_change(func):
    """先锁定幂等操作，再查流水；余额和全部拆批流水与此检查同事务提交。"""
    signature = inspect.signature(func)

    @wraps(func)
    async def wrapped(*args, **kwargs):
        bound = signature.bind(*args, **kwargs)
        key = bound.arguments.get("idempotency_key")
        if not key:
            return await func(*args, **kwargs)
        tenant_id = bound.arguments["tenant_id"]
        scope = _posting_scope.get()
        if scope:
            # 确认→撤回→再次确认是新过账，不能沿用历史单据明细键。
            key = f"{key}@{scope}"
            bound.arguments["idempotency_key"] = key
        from apps.kuaizhizao.models.material_stock_movement import MaterialStockMovement

        async with reuse_or_begin_transaction() as conn:
            await _lock(conn, f"stock-posting:{tenant_id}:{key}")
            # 预检覆盖原键与全部分片（#p{n} / #neg{n}），避免部分成功重试漏检已写分片。
            if await MaterialStockMovement.filter(
                Q(tenant_id=tenant_id)
                & (Q(idempotency_key=key) | Q(idempotency_key__startswith=f"{key}#")),
            ).using_db(conn).exists():
                return True
            return await func(*bound.args, **bound.kwargs)

    return wrapped


def serialize_stock_document(document_type: str, id_parameter: str):
    """同一单据的确认和撤回互斥；锁内重新读取并校验状态。

    IDEM-03：新建路径若随后立刻确认，应在拿到单据 id 后尽早进入本装饰器
    （或与确认同事务），避免「新建未落定 + 并发确认」竞态。
    """
    def decorate(func):
        signature = inspect.signature(func)

        @wraps(func)
        async def wrapped(*args, **kwargs):
            values = signature.bind(*args, **kwargs).arguments
            async with reuse_or_begin_transaction() as conn:
                await _lock(conn, f"stock-document:{document_type}:{values['tenant_id']}:{values[id_parameter]}")
                token = _posting_scope.set(uuid4().hex)
                try:
                    return await func(*args, **kwargs)
                finally:
                    _posting_scope.reset(token)
        return wrapped
    return decorate


def serialize_stock_create(document_type: str):
    """新建→确认短窗口串行：按租户+单据类型加锁（无 id 前的创建路径）。"""
    def decorate(func):
        signature = inspect.signature(func)

        @wraps(func)
        async def wrapped(*args, **kwargs):
            values = signature.bind(*args, **kwargs).arguments
            tenant_id = values["tenant_id"]
            async with reuse_or_begin_transaction() as conn:
                await _lock(conn, f"stock-document-create:{document_type}:{tenant_id}")
                token = _posting_scope.set(uuid4().hex)
                try:
                    return await func(*args, **kwargs)
                finally:
                    _posting_scope.reset(token)
        return wrapped
    return decorate
