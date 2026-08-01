"""体验演示：将 infra_admin 名下客户归属同步到 guest（同租户同名「体验用户」混淆修复）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_master_data_customers" AS c
           SET "salesman_id" = g.id,
               "salesman_name" = g.full_name,
               "pool_status" = 'owned'
          FROM "core_users" AS g
         INNER JOIN "core_users" AS a
            ON a.tenant_id = g.tenant_id
           AND a.username = 'infra_admin'
           AND a.deleted_at IS NULL
         WHERE c.tenant_id = g.tenant_id
           AND g.username = 'guest'
           AND g.deleted_at IS NULL
           AND c.salesman_id = a.id
           AND c.deleted_at IS NULL;

        UPDATE "core_users"
           SET "is_tenant_admin" = FALSE
         WHERE username = 'guest'
           AND deleted_at IS NULL
           AND is_tenant_admin = TRUE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
