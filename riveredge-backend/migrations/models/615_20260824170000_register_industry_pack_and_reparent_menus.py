"""
行业包容器应用 + 辐条轮毂菜单挂载调整

1. 注册 industry-pack（sort_order 290，侧栏统一「行业包」根）
2. 清除 spoke-wheel 独立 menu_config（改由 industry_pack_menu 聚合）
3. 软删各行业模块旧版独立应用根菜单
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        INSERT INTO core_applications (
            uuid, tenant_id, code, name, description, version,
            entry_point, route_path, sort_order,
            is_system, is_active, is_installed,
            menu_config, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            t.id,
            'industry-pack',
            '行业包',
            '行业应用统一入口，各行业模块作为子菜单挂载',
            '1.0.0',
            '../apps/industry-pack/index.tsx',
            '/apps/industry-pack',
            290,
            FALSE, FALSE, FALSE,
            '{"title":"app.industry-pack.name","icon":"layers","path":"/apps/industry-pack","permission":"industry-pack:entry:read","children":[]}'::jsonb,
            NOW(), NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_applications
            WHERE code = 'industry-pack' AND tenant_id = t.id AND deleted_at IS NULL
        );

        UPDATE core_applications
        SET menu_config = NULL,
            sort_order = 300,
            updated_at = NOW()
        WHERE code = 'spoke-wheel' AND deleted_at IS NULL;

        UPDATE core_menus m
        SET deleted_at = NOW(), updated_at = NOW()
        FROM core_applications a
        WHERE m.tenant_id = a.tenant_id
          AND m.application_uuid = a.uuid
          AND m.deleted_at IS NULL
          AND a.code IN ('spoke-wheel')
          AND a.deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM core_applications
        WHERE code = 'industry-pack' AND is_installed = FALSE AND deleted_at IS NULL;
    """
