"""安全修复：恢复被篡改为 infra_admin 的 guest；清理错误角色与租户管理员标记。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_users" AS g
           SET "username" = 'guest_auto_' || g.id::text
          FROM "core_users" AS h
         WHERE h.username = 'infra_admin'
           AND h.tenant_id IS NOT NULL
           AND h.deleted_at IS NULL
           AND h.is_infra_admin = FALSE
           AND g.tenant_id = h.tenant_id
           AND g.username = 'guest'
           AND g.id <> h.id
           AND g.deleted_at IS NULL;

        UPDATE "core_users"
           SET "username" = 'guest',
               "full_name" = '体验用户',
               "is_tenant_admin" = FALSE
         WHERE "username" = 'infra_admin'
           AND "tenant_id" IS NOT NULL
           AND "deleted_at" IS NULL
           AND "is_infra_admin" = FALSE;

        DELETE FROM "core_user_roles" AS ur
         USING "core_users" AS u, "core_roles" AS r
         WHERE ur.user_id = u.id
           AND ur.role_id = r.id
           AND u.username = 'guest'
           AND u.tenant_id IS NOT NULL
           AND u.deleted_at IS NULL
           AND r.code <> 'GUEST';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
