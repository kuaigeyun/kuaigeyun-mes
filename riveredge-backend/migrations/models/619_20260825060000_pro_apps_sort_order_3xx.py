"""
专业版应用排序迁至 3xx 段（位于行业包 290 / 辐条轮毂 300 之后）。

- kuaireport: 210 → 310
- kuaiiot: 220 → 320
- kuaiai: 250 → 350
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_PRO_REORDER = {
    "kuaireport": 310,
    "kuaiiot": 320,
    "kuaiai": 350,
}


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = [
        f"UPDATE core_applications SET sort_order = {so}, is_custom_sort = FALSE, updated_at = NOW() "
        f"WHERE code = '{code}' AND deleted_at IS NULL;"
        for code, so in _PRO_REORDER.items()
    ]
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    legacy = {
        "kuaireport": 210,
        "kuaiiot": 220,
        "kuaiai": 250,
    }
    statements = [
        f"UPDATE core_applications SET sort_order = {so}, is_custom_sort = FALSE, updated_at = NOW() "
        f"WHERE code = '{code}' AND deleted_at IS NULL;"
        for code, so in legacy.items()
    ]
    return "\n".join(statements)
