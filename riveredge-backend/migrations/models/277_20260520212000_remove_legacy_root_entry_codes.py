"""
彻底移除历史根入口旧权限码（不再保留兼容映射）：
- haoligo:haoligo:read -> haoligo:entry:read
- kuaiai:workspace:read -> kuaiai:entry:read
- kuaicaiwu:app-root:read -> kuaicaiwu:entry:read
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS _legacy_root_code_map;
        CREATE TEMP TABLE _legacy_root_code_map (
            old_code TEXT NOT NULL,
            new_code TEXT NOT NULL
        );

        INSERT INTO _legacy_root_code_map (old_code, new_code) VALUES
            ('haoligo:haoligo:read', 'haoligo:entry:read'),
            ('kuaiai:workspace:read', 'kuaiai:entry:read'),
            ('kuaicaiwu:app-root:read', 'kuaicaiwu:entry:read');

        WITH tenant_target AS (
            SELECT DISTINCT
                p.tenant_id,
                m.new_code AS code
            FROM core_permissions p
            JOIN _legacy_root_code_map m
              ON LOWER(BTRIM(p.code)) = m.old_code
            WHERE p.deleted_at IS NULL
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
            '移除旧根入口权限码自动补齐: ' || t.code,
            'function',
            TRUE,
            'derived',
            split_part(t.code, ':', 1),
            'legacy-root-entry-cleanup',
            NOW(),
            NOW()
        FROM tenant_target t
        WHERE NOT EXISTS (
            SELECT 1
            FROM core_permissions p2
            WHERE p2.tenant_id = t.tenant_id
              AND LOWER(BTRIM(p2.code)) = t.code
              AND p2.deleted_at IS NULL
        );

        INSERT INTO core_role_permissions (role_id, permission_id, created_at)
        SELECT DISTINCT
            rp.role_id,
            p_new.id,
            NOW()
        FROM core_permissions p_old
        JOIN _legacy_root_code_map m
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

        UPDATE core_permissions p
        SET deprecated_at = NOW(),
            deleted_at = NOW(),
            updated_at = NOW()
        FROM _legacy_root_code_map m
        WHERE p.deleted_at IS NULL
          AND LOWER(BTRIM(p.code)) = m.old_code;

        UPDATE core_permission_aliases a
        SET deleted_at = NOW(),
            updated_at = NOW()
        WHERE a.deleted_at IS NULL
          AND a.reason = 'root-entry-normalize';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """历史旧权限码移除后不恢复。"""
    return "-- remove legacy root entry codes: no-op downgrade"
