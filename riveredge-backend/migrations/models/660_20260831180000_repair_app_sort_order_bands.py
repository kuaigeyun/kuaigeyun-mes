"""
修复行业包（2xx）与专业 APP（3xx）侧栏排序段回归。

部分租户 core_applications 仍保留迁移 534 的 210/220/250，导致专业 APP
排在行业包 290 之前。本迁移与 pro_app_catalog.resolve_application_sort_order 对齐。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_CANONICAL_SORT_ORDER = {
    "industry-pack": 290,
    "spoke-wheel": 300,
    "kuaireport": 310,
    "kuaiiot": 320,
    "kuaiai": 350,
}


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = [
        f"UPDATE core_applications SET sort_order = {so}, is_custom_sort = FALSE, updated_at = NOW() "
        f"WHERE code = '{code}' AND deleted_at IS NULL AND COALESCE(sort_order, 0) <> {so};"
        for code, so in _CANONICAL_SORT_ORDER.items()
    ]
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
