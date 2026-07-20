"""
快研发 (kuaiplm) 归入通用应用：FREE、sort_order 位于快制造与快财务之间。

排序（与 manifest 一致）：
  20  快制造    kuaizhizao
  25  快研发    kuaiplm
  30  快财务    kuaicaiwu
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications
        SET sort_order = 25,
            name = COALESCE(NULLIF(name, ''), '快研发'),
            description = COALESCE(
                NULLIF(description, ''),
                '研发项目 / NPI 阶段门、变更工作台与知识库协同平台'
            ),
            entry_point = COALESCE(NULLIF(entry_point, ''), '../apps/kuaiplm/index.tsx'),
            route_path = COALESCE(NULLIF(route_path, ''), '/apps/kuaiplm'),
            updated_at = NOW()
        WHERE code = 'kuaiplm' AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications
        SET sort_order = 50, updated_at = NOW()
        WHERE code = 'kuaiplm' AND deleted_at IS NULL;
    """
