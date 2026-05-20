"""
根入口权限码规范化：
- /system -> system:entry:read
- /apps/{app_code} -> {app_code}:entry:read

同时迁移角色授权关系并记录权限别名，避免入口可见性回归。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS _root_perm_norm_map;

        CREATE TEMP TABLE _root_perm_norm_map AS
        SELECT DISTINCT
            m.tenant_id,
            LOWER(BTRIM(COALESCE(m.permission_code, ''))) AS old_code,
            CASE
                WHEN m.path = '/system' THEN 'system:entry:read'
                ELSE LOWER(REGEXP_REPLACE(m.path, '^/apps/([^/]+)$', '\\1:entry:read'))
            END AS new_code
        FROM core_menus m
        WHERE m.deleted_at IS NULL
          AND (m.path = '/system' OR m.path ~ '^/apps/[^/]+$');

        DELETE FROM _root_perm_norm_map
        WHERE new_code IS NULL OR new_code = '';

        DROP TABLE IF EXISTS _root_perm_code_pairs;

        CREATE TEMP TABLE _root_perm_code_pairs AS
        SELECT
            tenant_id,
            old_code,
            new_code
        FROM _root_perm_norm_map
        WHERE old_code <> ''
          AND old_code <> new_code
        GROUP BY tenant_id, old_code, new_code;

        WITH target_codes AS (
            SELECT
                tenant_id,
                new_code AS code
            FROM _root_perm_norm_map
            GROUP BY tenant_id, new_code
        )
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
            '查看' || REPLACE(REPLACE(REPLACE(t.code, ':read', ''), ':', '_'), '-', '_') || '（功能）',
            t.code,
            REPLACE(REPLACE(REPLACE(t.code, ':read', ''), ':', '_'), '-', '_'),
            'read',
            '根入口权限规范化自动补齐: ' || t.code,
            'function',
            TRUE,
            'derived',
            split_part(t.code, ':', 1),
            'menu-root-normalize',
            NOW(),
            NOW()
        FROM target_codes t
        WHERE NOT EXISTS (
            SELECT 1
            FROM core_permissions p
            WHERE p.tenant_id = t.tenant_id
              AND LOWER(BTRIM(p.code)) = t.code
              AND p.deleted_at IS NULL
        );

        UPDATE core_permission_aliases a
        SET canonical_code = cp.new_code,
            reason = 'root-entry-normalize',
            deleted_at = NULL,
            updated_at = NOW()
        FROM _root_perm_code_pairs cp
        WHERE a.tenant_id = cp.tenant_id
          AND LOWER(BTRIM(a.old_code)) = cp.old_code;

        INSERT INTO core_permission_aliases (
            uuid,
            tenant_id,
            old_code,
            canonical_code,
            reason,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid()::text,
            c.tenant_id,
            c.old_code,
            c.new_code,
            'root-entry-normalize',
            NOW(),
            NOW()
        FROM _root_perm_code_pairs c
        WHERE NOT EXISTS (
            SELECT 1
            FROM core_permission_aliases a
            WHERE a.tenant_id = c.tenant_id
              AND LOWER(BTRIM(a.old_code)) = c.old_code
        );

        INSERT INTO core_role_permissions (role_id, permission_id, created_at)
        SELECT DISTINCT
            rp.role_id,
            p_new.id,
            NOW()
        FROM _root_perm_code_pairs c
        JOIN core_permissions p_old
            ON p_old.tenant_id = c.tenant_id
           AND LOWER(BTRIM(p_old.code)) = c.old_code
           AND p_old.deleted_at IS NULL
        JOIN core_role_permissions rp
            ON rp.permission_id = p_old.id
        JOIN core_permissions p_new
            ON p_new.tenant_id = c.tenant_id
           AND LOWER(BTRIM(p_new.code)) = c.new_code
           AND p_new.deleted_at IS NULL
        WHERE NOT EXISTS (
            SELECT 1
            FROM core_role_permissions rp2
            WHERE rp2.role_id = rp.role_id
              AND rp2.permission_id = p_new.id
        );

        UPDATE core_menus m
        SET permission_code = CASE
                WHEN m.path = '/system' THEN 'system:entry:read'
                ELSE LOWER(REGEXP_REPLACE(m.path, '^/apps/([^/]+)$', '\\1:entry:read'))
            END,
            updated_at = NOW()
        WHERE m.deleted_at IS NULL
          AND (m.path = '/system' OR m.path ~ '^/apps/[^/]+$')
          AND LOWER(BTRIM(COALESCE(m.permission_code, ''))) <> CASE
                WHEN m.path = '/system' THEN 'system:entry:read'
                ELSE LOWER(REGEXP_REPLACE(m.path, '^/apps/([^/]+)$', '\\1:entry:read'))
            END;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """规范化不可逆，降级保持 no-op。"""
    return "-- normalize root entry permission codes: no-op downgrade"
