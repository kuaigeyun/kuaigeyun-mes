"""
已安装辐条轮毂的租户补齐 industry-pack 容器状态。

615 迁移删除了 spoke-wheel 独立菜单，但若租户此前已安装辐条轮毂，
industry-pack 可能仍为未安装/未启用，侧栏不会出现「行业包」。
本迁移仅对齐 core_applications；菜单由扫描/同步时 IndustryPackMenuService.reconcile 重建。
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

        UPDATE core_applications ip
        SET is_installed = TRUE, updated_at = NOW()
        FROM core_applications sw
        WHERE ip.tenant_id = sw.tenant_id
          AND ip.code = 'industry-pack'
          AND sw.code = 'spoke-wheel'
          AND sw.is_installed = TRUE
          AND ip.deleted_at IS NULL
          AND sw.deleted_at IS NULL
          AND ip.is_installed = FALSE;

        UPDATE core_applications ip
        SET is_active = TRUE, updated_at = NOW()
        FROM core_applications sw
        WHERE ip.tenant_id = sw.tenant_id
          AND ip.code = 'industry-pack'
          AND sw.code = 'spoke-wheel'
          AND sw.is_installed = TRUE
          AND sw.is_active = TRUE
          AND ip.deleted_at IS NULL
          AND sw.deleted_at IS NULL
          AND ip.is_active = FALSE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
