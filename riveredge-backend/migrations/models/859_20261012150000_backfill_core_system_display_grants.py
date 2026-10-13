"""
回显切流后补齐系统级 :display 授权。

取消宿主 create/update/read 隐式放行后，业务角色须显式具备
system:data-dictionary|user|department|position|file:display（或 :read）
才能拉字典下拉 / 人员部门引用。切流同步仅在「租户零回显授权」或「新建 display 码」
时全量授予；系统级码早已存在且部分租户仅管理员有勾选，导致多数角色字典为空。

本迁移一次性把上述非敏感系统回显补到缺权角色；之后取消勾选不再被同步强制恢复。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_CORE_SYSTEM_DISPLAY_CODES = (
    "system:data-dictionary:display",
    "system:user:display",
    "system:department:display",
    "system:position:display",
    "system:file:display",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    codes_sql = ", ".join(f"'{c}'" for c in _CORE_SYSTEM_DISPLAY_CODES)
    return f"""
        INSERT INTO core_role_permissions (role_id, permission_id, created_at)
        SELECT r.id, p.id, NOW()
        FROM core_roles r
        JOIN core_permissions p
          ON p.tenant_id = r.tenant_id
         AND p.deleted_at IS NULL
         AND p.code IN ({codes_sql})
        WHERE r.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM core_role_permissions rp
            WHERE rp.role_id = r.id
              AND rp.permission_id = p.id
          );

        UPDATE core_permission_versions
        SET version = version + 1
        WHERE user_id IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
