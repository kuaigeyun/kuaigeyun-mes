"""
KU-AI 排序：调至专业版应用分组末位（快报表 / 快数采 / 快能源 / 快协同 之后）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_PRO_REORDER = {
    "kuaireport": 210,
    "kuaiiot": 220,
    "kuaiems": 230,
    "kuaisrm": 240,
    "kuaiai": 250,
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
        "kuaiai": 210,
        "kuaireport": 220,
        "kuaiiot": 230,
        "kuaiems": 240,
        "kuaisrm": 250,
    }
    statements = [
        f"UPDATE core_applications SET sort_order = {so}, is_custom_sort = FALSE, updated_at = NOW() "
        f"WHERE code = '{code}' AND deleted_at IS NULL;"
        for code, so in legacy.items()
    ]
    return "\n".join(statements)
