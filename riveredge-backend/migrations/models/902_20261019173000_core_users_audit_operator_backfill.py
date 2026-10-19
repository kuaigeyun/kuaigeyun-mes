"""
账户（core_users）审计人回填：与组织主数据 901 同规则，补全列表「更新时间」上行姓名。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_users x
           SET created_by_name = COALESCE(NULLIF(TRIM(u.full_name), ''), u.username)
          FROM core_users u
         WHERE x.created_by IS NOT NULL
           AND x.created_by = u.id
           AND (x.created_by_name IS NULL OR BTRIM(x.created_by_name) = '');

        UPDATE core_users x
           SET updated_by_name = COALESCE(NULLIF(TRIM(u.full_name), ''), u.username)
          FROM core_users u
         WHERE x.updated_by IS NOT NULL
           AND x.updated_by = u.id
           AND (x.updated_by_name IS NULL OR BTRIM(x.updated_by_name) = '');

        UPDATE core_users u
           SET created_by = u.id,
               created_by_name = COALESCE(NULLIF(TRIM(u.full_name), ''), u.username),
               updated_by = COALESCE(u.updated_by, u.id),
               updated_by_name = COALESCE(
                   NULLIF(TRIM(u.updated_by_name), ''),
                   COALESCE(NULLIF(TRIM(u.full_name), ''), u.username)
               )
         WHERE u.deleted_at IS NULL
           AND u.created_by IS NULL
           AND u.is_tenant_admin = TRUE;

        UPDATE core_users x
           SET created_by = ta.user_id,
               created_by_name = ta.display_name,
               updated_by = COALESCE(x.updated_by, ta.user_id),
               updated_by_name = COALESCE(NULLIF(TRIM(x.updated_by_name), ''), ta.display_name)
          FROM (
            SELECT DISTINCT ON (tenant_id)
                   tenant_id,
                   id AS user_id,
                   COALESCE(NULLIF(TRIM(full_name), ''), username) AS display_name
              FROM core_users
             WHERE deleted_at IS NULL
               AND is_tenant_admin = TRUE
             ORDER BY tenant_id, id
          ) ta
         WHERE x.tenant_id = ta.tenant_id
           AND x.deleted_at IS NULL
           AND x.created_by IS NULL
           AND x.id <> ta.user_id;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
