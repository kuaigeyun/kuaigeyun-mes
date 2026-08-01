"""将 guest_auto_* 名下客户迁回 canonical guest，并修正体验账号显示名。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_master_data_customers" AS c
           SET "salesman_id" = g.id,
               "salesman_name" = CASE
                 WHEN TRIM(COALESCE(g.full_name, '')) <> ''
                  AND TRIM(COALESCE(g.username, '')) <> ''
                   THEN TRIM(g.full_name) || ' (' || TRIM(g.username) || ')'
                 WHEN TRIM(COALESCE(g.full_name, '')) <> ''
                   THEN TRIM(g.full_name)
                 ELSE TRIM(g.username)
               END
          FROM "core_users" AS g,
               "core_users" AS old_u
         WHERE old_u.id = c.salesman_id
           AND g.tenant_id = c.tenant_id
           AND g.username = 'guest'
           AND g.deleted_at IS NULL
           AND old_u.username LIKE 'guest_auto_%'
           AND old_u.deleted_at IS NULL
           AND c.deleted_at IS NULL;

        UPDATE "core_users"
           SET "full_name" = '体验用户'
         WHERE "username" = 'guest'
           AND "tenant_id" IS NOT NULL
           AND "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
