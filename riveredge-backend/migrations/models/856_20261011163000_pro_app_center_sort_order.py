"""
专业 APP 应用中心排序与 pro-data-center 展示名对齐。

与 pro_app_catalog.PRO_APP_SORT_ORDER 一致：
快研发 → 快交付 → 轻办公 → 轻财务 → 快数采 → 快报表 → 快连接 → KU-AI
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_CANONICAL_SORT_ORDER = {
    "kuaiplm": 300,
    "kuaipd": 305,
    "kuaioa": 310,
    "kuaicaiwu": 315,
    "kuaiiot": 320,
    "kuaireport": 325,
    "pro-data-center": 330,
    "kuaiai": 350,
}


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = [
        f"UPDATE core_applications SET sort_order = {so}, is_custom_sort = FALSE, updated_at = NOW() "
        f"WHERE code = '{code}' AND deleted_at IS NULL AND COALESCE(sort_order, 0) <> {so};"
        for code, so in _CANONICAL_SORT_ORDER.items()
    ]
    statements.append(
        "UPDATE core_applications SET name = '快连接', updated_at = NOW() "
        "WHERE code = 'pro-data-center' AND deleted_at IS NULL AND name = '数据中心';"
    )
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
