"""
工作台叶子菜单改用 haoligo:workspace-dashboard:*（可绑定角色矩阵）。
将已授予 haoligo:workspace:* 的角色同步补齐 workspace-dashboard 对应权限。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_ACTIONS = ("read", "create", "update", "delete", "import", "export")


async def upgrade(db: BaseDBAsyncClient) -> str:
    inserts = ",\n            ".join(
        f"('haoligo:workspace:{a}', 'haoligo:workspace-dashboard:{a}')"
        for a in _ACTIONS
    )
    return f"""
        DROP TABLE IF EXISTS _haoligo_workspace_code_map;
        CREATE TEMP TABLE _haoligo_workspace_code_map (
            old_code TEXT NOT NULL,
            new_code TEXT NOT NULL
        );

        INSERT INTO _haoligo_workspace_code_map (old_code, new_code) VALUES
            {inserts};

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
            p_old.tenant_id,
            p_old.name,
            m.new_code,
            'workspace-dashboard',
            p_old.action,
            COALESCE(p_old.description, '') || ' [工作台权限拆分]',
            p_old.permission_type,
            TRUE,
            'derived',
            'haoligo',
            'haoligo-workspace-dashboard-split',
            NOW(),
            NOW()
        FROM core_permissions p_old
        JOIN _haoligo_workspace_code_map m
          ON LOWER(BTRIM(p_old.code)) = m.old_code
        WHERE p_old.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM core_permissions p2
            WHERE p2.tenant_id = p_old.tenant_id
              AND LOWER(BTRIM(p2.code)) = m.new_code
              AND p2.deleted_at IS NULL
          );

        INSERT INTO core_role_permissions (role_id, permission_id, created_at)
        SELECT DISTINCT
            rp.role_id,
            p_new.id,
            NOW()
        FROM core_permissions p_old
        JOIN _haoligo_workspace_code_map m
          ON LOWER(BTRIM(p_old.code)) = m.old_code
        JOIN core_role_permissions rp
          ON rp.permission_id = p_old.id
        JOIN core_permissions p_new
          ON p_new.tenant_id = p_old.tenant_id
         AND LOWER(BTRIM(p_new.code)) = m.new_code
         AND p_new.deleted_at IS NULL
        WHERE p_old.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM core_role_permissions rp2
              WHERE rp2.role_id = rp.role_id
                AND rp2.permission_id = p_new.id
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM core_role_permissions rp
        USING core_permissions p
        WHERE rp.permission_id = p.id
          AND LOWER(BTRIM(p.code)) LIKE 'haoligo:workspace-dashboard:%';

        UPDATE core_permissions
        SET deleted_at = NOW(),
            deprecated_at = NOW(),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND LOWER(BTRIM(code)) LIKE 'haoligo:workspace-dashboard:%';
    """
