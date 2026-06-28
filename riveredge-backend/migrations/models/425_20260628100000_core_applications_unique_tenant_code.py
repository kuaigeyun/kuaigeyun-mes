"""
确保 core_applications 在 deleted_at IS NULL 时 (tenant_id, code) 唯一。

背景：
  - init_schema 仅有普通索引，无唯一约束
  - 新建组织后台初始化与首次登录引导并发扫描应用时可能插入重复行
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 归并同租户下同 code 的重复行（保留 id 最小者）
        UPDATE core_applications AS dup
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE dup.deleted_at IS NULL
          AND dup.id NOT IN (
              SELECT MIN(id)
              FROM core_applications
              WHERE deleted_at IS NULL
              GROUP BY tenant_id, code
          );

        CREATE UNIQUE INDEX IF NOT EXISTS uidx_core_applications_tenant_code_active
        ON core_applications (tenant_id, code)
        WHERE deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS uidx_core_applications_tenant_code_active;
    """
