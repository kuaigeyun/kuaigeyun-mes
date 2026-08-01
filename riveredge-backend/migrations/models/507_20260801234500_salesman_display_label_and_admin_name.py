"""业务员展示名统一为「姓名 (账号)」；infra_admin 默认姓名与体验账号区分。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_master_data_customers" AS c
           SET "salesman_name" = CASE
                 WHEN TRIM(COALESCE(u.full_name, '')) <> ''
                  AND TRIM(COALESCE(u.username, '')) <> ''
                   THEN TRIM(u.full_name) || ' (' || TRIM(u.username) || ')'
                 WHEN TRIM(COALESCE(u.full_name, '')) <> ''
                   THEN TRIM(u.full_name)
                 WHEN TRIM(COALESCE(u.username, '')) <> ''
                   THEN TRIM(u.username)
                 ELSE c.salesman_name
               END
          FROM "core_users" AS u
         WHERE c.salesman_id = u.id
           AND c.tenant_id = u.tenant_id
           AND c.deleted_at IS NULL
           AND u.deleted_at IS NULL
           AND c.salesman_id IS NOT NULL;

        UPDATE "core_users"
           SET "full_name" = '系统管理员'
         WHERE username = 'infra_admin'
           AND deleted_at IS NULL
           AND TRIM(COALESCE(full_name, '')) = '体验用户';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
