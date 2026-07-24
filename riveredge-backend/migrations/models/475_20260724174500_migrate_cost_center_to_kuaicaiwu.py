"""
成本中心从快制造迁到快财务：迁移权限授权与菜单数据。

- kuaizhizao:cost-management-dashboard:read
  -> kuaicaiwu:cost-management-dashboard:read
- 角色授权同步补齐新码
- 菜单 path / permission_code / application_uuid 迁到快财务成本管理下
- 软删除快制造侧旧成本中心菜单与旧权限码
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

OLD_CODE = "kuaizhizao:cost-management-dashboard:read"
NEW_CODE = "kuaicaiwu:cost-management-dashboard:read"
OLD_PATH = "/apps/kuaizhizao/cost-management/dashboard"
NEW_PATH = "/apps/kuaicaiwu/cost-management/dashboard"
OLD_MENU_NAME = "app.kuaizhizao.menu.cost-management.dashboard"
NEW_MENU_NAME = "app.kuaicaiwu.menu.cost-management.dashboard"
KZ_GROUP_NAME = "app.kuaizhizao.menu.cost-management"
KC_GROUP_NAME = "app.kuaicaiwu.menu.cost-management"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        -- 1) 为各租户确保新权限存在（有旧码的租户；或已安装快财务的租户）
        INSERT INTO core_permissions (
            uuid,
            tenant_id,
            name,
            code,
            resource,
            action,
            description,
            permission_type,
            is_managed,
            source_type,
            source_app,
            source_path,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid()::text,
            t.tenant_id,
            '查看',
            '{NEW_CODE}',
            'cost-management-dashboard',
            'read',
            '成本中心迁入快财务自动补齐: {NEW_CODE}',
            'function',
            TRUE,
            'manifest',
            'kuaicaiwu',
            'cost-center-migrate',
            NOW(),
            NOW()
        FROM (
            SELECT DISTINCT p.tenant_id
            FROM core_permissions p
            WHERE p.deleted_at IS NULL
              AND LOWER(BTRIM(p.code)) = '{OLD_CODE}'
            UNION
            SELECT DISTINCT a.tenant_id
            FROM core_applications a
            WHERE a.deleted_at IS NULL
              AND a.code = 'kuaicaiwu'
              AND COALESCE(a.is_installed, TRUE) = TRUE
        ) t
        WHERE NOT EXISTS (
            SELECT 1
            FROM core_permissions p2
            WHERE p2.tenant_id = t.tenant_id
              AND LOWER(BTRIM(p2.code)) = '{NEW_CODE}'
              AND p2.deleted_at IS NULL
        );

        -- 2) 角色授权：持有旧码的角色补齐新码
        INSERT INTO core_role_permissions (role_id, permission_id, created_at)
        SELECT DISTINCT
            rp.role_id,
            p_new.id,
            NOW()
        FROM core_permissions p_old
        JOIN core_role_permissions rp
          ON rp.permission_id = p_old.id
        JOIN core_permissions p_new
          ON p_new.tenant_id = p_old.tenant_id
         AND LOWER(BTRIM(p_new.code)) = '{NEW_CODE}'
         AND p_new.deleted_at IS NULL
        WHERE p_old.deleted_at IS NULL
          AND LOWER(BTRIM(p_old.code)) = '{OLD_CODE}'
          AND NOT EXISTS (
              SELECT 1
              FROM core_role_permissions rp2
              WHERE rp2.role_id = rp.role_id
                AND rp2.permission_id = p_new.id
          );

        -- 3) 已有旧成本中心菜单：改挂到快财务成本管理下
        UPDATE core_menus m
        SET
            name = '{NEW_MENU_NAME}',
            path = '{NEW_PATH}',
            permission_code = '{NEW_CODE}',
            application_uuid = COALESCE(
                (
                    SELECT app.uuid
                    FROM core_applications app
                    WHERE app.tenant_id = m.tenant_id
                      AND app.code = 'kuaicaiwu'
                      AND app.deleted_at IS NULL
                    ORDER BY app.id
                    LIMIT 1
                ),
                m.application_uuid
            ),
            parent_id = COALESCE(
                (
                    SELECT parent.id
                    FROM core_menus parent
                    JOIN core_applications app
                      ON app.uuid = parent.application_uuid
                     AND app.code = 'kuaicaiwu'
                     AND app.deleted_at IS NULL
                    WHERE parent.tenant_id = m.tenant_id
                      AND parent.deleted_at IS NULL
                      AND parent.name = '{KC_GROUP_NAME}'
                    ORDER BY parent.id
                    LIMIT 1
                ),
                m.parent_id
            ),
            sort_order = 0,
            is_active = TRUE,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE (
              m.path = '{OLD_PATH}'
              OR m.name = '{OLD_MENU_NAME}'
              OR LOWER(BTRIM(COALESCE(m.permission_code, ''))) = '{OLD_CODE}'
          );

        -- 4) 若仍无新路径菜单，则在快财务成本管理分组下插入
        INSERT INTO core_menus (
            uuid,
            tenant_id,
            name,
            path,
            icon,
            component,
            permission_code,
            application_uuid,
            parent_id,
            sort_order,
            is_active,
            is_external,
            external_url,
            meta,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid()::text,
            parent.tenant_id,
            '{NEW_MENU_NAME}',
            '{NEW_PATH}',
            NULL,
            NULL,
            '{NEW_CODE}',
            parent.application_uuid,
            parent.id,
            0,
            TRUE,
            FALSE,
            NULL,
            NULL,
            NOW(),
            NOW()
        FROM core_menus parent
        JOIN core_applications app
          ON app.uuid = parent.application_uuid
         AND app.code = 'kuaicaiwu'
         AND app.deleted_at IS NULL
        WHERE parent.deleted_at IS NULL
          AND parent.name = '{KC_GROUP_NAME}'
          AND NOT EXISTS (
              SELECT 1
              FROM core_menus child
              WHERE child.tenant_id = parent.tenant_id
                AND child.deleted_at IS NULL
                AND child.path = '{NEW_PATH}'
          );

        -- 5) 软删除快制造「成本管理」空分组（无未删子菜单）
        UPDATE core_menus g
        SET deleted_at = NOW(),
            is_active = FALSE,
            updated_at = NOW()
        WHERE g.deleted_at IS NULL
          AND g.name = '{KZ_GROUP_NAME}'
          AND NOT EXISTS (
              SELECT 1
              FROM core_menus c
              WHERE c.parent_id = g.id
                AND c.deleted_at IS NULL
          );

        -- 6) 角色首页若仍指向旧成本中心路径，改为新路径
        UPDATE core_roles
        SET home_path = '{NEW_PATH}',
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND home_path = '{OLD_PATH}';

        UPDATE core_tenant_backend_home tbh
        SET menu_uuid = m_new.uuid
        FROM core_menus m_old
        JOIN core_menus m_new
          ON m_new.tenant_id = m_old.tenant_id
         AND m_new.deleted_at IS NULL
         AND m_new.path = '{NEW_PATH}'
        WHERE tbh.menu_uuid = m_old.uuid
          AND (
              m_old.path = '{OLD_PATH}'
              OR m_old.name = '{OLD_MENU_NAME}'
          );

        -- 7) 移除旧权限上的角色关联并软删除旧权限码
        DELETE FROM core_role_permissions
        WHERE permission_id IN (
            SELECT id FROM core_permissions
            WHERE deleted_at IS NULL
              AND LOWER(BTRIM(code)) = '{OLD_CODE}'
        );

        UPDATE core_permissions
        SET deleted_at = NOW(),
            deprecated_at = COALESCE(deprecated_at, NOW()),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND LOWER(BTRIM(code)) = '{OLD_CODE}';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 成本中心迁入快财务后不自动回滚；如需恢复请从备份还原。
        SELECT 1;
    """
