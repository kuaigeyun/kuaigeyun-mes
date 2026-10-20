"""
组织主数据（部门/职位/角色）审计人回填：
1) 有 created_by/updated_by 但姓名为空时从 core_users 补姓名；
2) 历史预设/导入等未写 created_by 的行，按租户组织管理员补操作人快照（仅 created_by 为空）。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True

_ORG_TABLES = ("core_departments", "core_positions", "core_roles")


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _ORG_TABLES:
        parts.append(
            f"""
            UPDATE "{table}" x
               SET created_by_name = COALESCE(NULLIF(TRIM(u.full_name), ''), u.username)
              FROM core_users u
             WHERE x.created_by IS NOT NULL
               AND x.created_by = u.id
               AND (x.created_by_name IS NULL OR BTRIM(x.created_by_name) = '');
            """
        )
        parts.append(
            f"""
            UPDATE "{table}" x
               SET updated_by_name = COALESCE(NULLIF(TRIM(u.full_name), ''), u.username)
              FROM core_users u
             WHERE x.updated_by IS NOT NULL
               AND x.updated_by = u.id
               AND (x.updated_by_name IS NULL OR BTRIM(x.updated_by_name) = '');
            """
        )
        parts.append(
            f"""
            UPDATE "{table}" x
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
               AND x.created_by IS NULL;
            """
        )
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
