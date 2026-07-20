"""
下线进销存 (kuaierp) / 快车间 (kuaimes) 独立版拆分应用。

仅保留快制造 (kuaizhizao) 一体应用；拆分菜单请改用自组菜单自行编辑。
软删除应用记录、关联菜单与入口权限，不删除业务表数据。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 软删除拆分应用
        UPDATE core_applications
        SET deleted_at = NOW(),
            is_active = FALSE,
            is_installed = FALSE,
            updated_at = NOW()
        WHERE code IN ('kuaierp', 'kuaimes')
          AND deleted_at IS NULL;

        -- 软删除拆分应用菜单（按 path / 应用 UUID / name key）
        UPDATE core_menus m
        SET deleted_at = NOW(),
            is_active = FALSE,
            updated_at = NOW()
        WHERE m.deleted_at IS NULL
          AND (
            m.path LIKE '/apps/kuaierp%'
            OR m.path LIKE '/apps/kuaimes%'
            OR m.name IN ('app.kuaierp.name', 'app.kuaimes.name')
            OR m.permission_code LIKE 'kuaierp:%'
            OR m.permission_code LIKE 'kuaimes:%'
            OR m.application_uuid IN (
                SELECT uuid FROM core_applications
                WHERE code IN ('kuaierp', 'kuaimes')
            )
          );

        -- 软删除拆分应用入口权限
        UPDATE core_permissions
        SET deleted_at = NOW(),
            deprecated_at = COALESCE(deprecated_at, NOW()),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND (
            code LIKE 'kuaierp:%'
            OR code LIKE 'kuaimes:%'
            OR source_app IN ('kuaierp', 'kuaimes')
          );

        -- 清理角色权限关联（硬删中间表，权限本身已软删）
        DELETE FROM core_role_permissions
        WHERE permission_id IN (
            SELECT id FROM core_permissions
            WHERE code LIKE 'kuaierp:%'
               OR code LIKE 'kuaimes:%'
               OR source_app IN ('kuaierp', 'kuaimes')
        );

        -- 清理指向拆分应用菜单的后台首页
        DELETE FROM core_tenant_backend_home
        WHERE menu_uuid IN (
            SELECT uuid FROM core_menus
            WHERE path LIKE '/apps/kuaierp%'
               OR path LIKE '/apps/kuaimes%'
               OR name IN ('app.kuaierp.name', 'app.kuaimes.name')
        );

        -- 清空角色首页若仍指向拆分应用路由
        UPDATE core_roles
        SET home_path = NULL,
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND (
            home_path LIKE '/apps/kuaierp%'
            OR home_path LIKE '/apps/kuaimes%'
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 拆分应用已下线，不自动恢复；如需回滚请从备份还原并重新放置 manifest。
        SELECT 1;
    """
