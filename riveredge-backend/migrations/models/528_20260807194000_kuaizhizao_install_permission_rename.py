"""
安装执行权限码重命名：production-execution-install-execution -> after-sales-install

同步角色授权与数据范围配置。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

OLD_PREFIX = "kuaizhizao:production-execution-install-execution"
NEW_PREFIX = "kuaizhizao:after-sales-install"
OLD_RESOURCE = "production-execution-install-execution"
NEW_RESOURCE = "after-sales-install"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        -- 1) 重命名权限码
        UPDATE core_permissions
        SET
            code = REPLACE(code, '{OLD_PREFIX}', '{NEW_PREFIX}'),
            resource = CASE
                WHEN resource = '{OLD_RESOURCE}' THEN '{NEW_RESOURCE}'
                ELSE resource
            END,
            description = REPLACE(COALESCE(description, ''), '{OLD_PREFIX}', '{NEW_PREFIX}'),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND code LIKE '{OLD_PREFIX}:%';

        -- 2) 数据权限策略 resource 字段迁移
        UPDATE core_data_permission_policies
        SET
            resource = REPLACE(resource, '{OLD_PREFIX}', '{NEW_PREFIX}'),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND resource LIKE '%{OLD_PREFIX}%';

        -- 3) 旧菜单 path 迁移（sync-manifest 会重建，此处兜底历史数据）
        UPDATE core_menus
        SET
            path = REPLACE(path, '/production-execution/install-execution', '/after-sales-service/install-execution'),
            permission_code = REPLACE(permission_code, '{OLD_PREFIX}', '{NEW_PREFIX}'),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND path LIKE '%/production-execution/install-execution%';

        UPDATE core_menus
        SET
            path = REPLACE(path, '/sales-management/after-sales-tickets', '/after-sales-service/tickets'),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND path LIKE '%/sales-management/after-sales-tickets%';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        UPDATE core_permissions
        SET
            code = REPLACE(code, '{NEW_PREFIX}', '{OLD_PREFIX}'),
            resource = CASE
                WHEN resource = '{NEW_RESOURCE}' THEN '{OLD_RESOURCE}'
                ELSE resource
            END,
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND code LIKE '{NEW_PREFIX}:%';

        UPDATE core_data_permission_policies
        SET
            resource = REPLACE(resource, '{NEW_PREFIX}', '{OLD_PREFIX}'),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND resource LIKE '%{NEW_PREFIX}%';

        UPDATE core_menus
        SET
            path = REPLACE(path, '/after-sales-service/install-execution', '/production-execution/install-execution'),
            permission_code = REPLACE(permission_code, '{NEW_PREFIX}', '{OLD_PREFIX}'),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND path LIKE '%/after-sales-service/install-execution%';
    """
