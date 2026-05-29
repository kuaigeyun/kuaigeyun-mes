"""
为各租户注册快研发 (kuaiplm) 应用记录（若尚未存在）。

与 manifest 一致：FREE 通用应用，sort_order=25（快制造 22 之后、快财务 30 之前）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        INSERT INTO core_applications (
            uuid, tenant_id, code, name, description, version,
            entry_point, route_path, sort_order,
            is_system, is_active, is_installed,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            t.id,
            'kuaiplm',
            '快研发',
            '研发项目 / NPI 阶段门、变更工作台与知识库协同平台',
            '1.0.0',
            '../apps/kuaiplm/index.tsx',
            '/apps/kuaiplm',
            25,
            FALSE, TRUE, FALSE,
            NOW(), NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_applications
            WHERE code = 'kuaiplm' AND tenant_id = t.id AND deleted_at IS NULL
        );

        UPDATE core_applications
        SET sort_order = 25,
            name = '快研发',
            description = '研发项目 / NPI 阶段门、变更工作台与知识库协同平台',
            entry_point = '../apps/kuaiplm/index.tsx',
            route_path = '/apps/kuaiplm',
            updated_at = NOW()
        WHERE code = 'kuaiplm' AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM core_applications
        WHERE code = 'kuaiplm'
          AND is_installed = FALSE
          AND deleted_at IS NULL;
    """
