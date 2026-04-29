"""
确保 core_permissions 表拥有 (tenant_id, code) 唯一约束。

背景：
  - init_schema 建表时未声明唯一约束，仅有普通索引
  - aerich migrate 对已存在的列不会自动补充约束
  - 导致通过 generate_schemas()（开发环境）创建的 DB 有唯一约束，
    而通过逐步 upgrade 的生产 DB 可能没有该约束
  - 缺少唯一约束时 ON CONFLICT (tenant_id, code) 语法会报错，
    或数据层出现重复行

本迁移：
  1. 先用 DO 块清理同租户下 deleted_at IS NULL 的重复行（保留 id 最小的行）
  2. 若约束不存在则添加
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = False  # 包含 ALTER TABLE ... ADD CONSTRAINT，不能在事务内执行


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- Step 1: 归并 deleted_at IS NULL 的重复行（同 tenant_id + code 保留 id 最小的）
        DO $$
        DECLARE
            rec RECORD;
        BEGIN
            FOR rec IN
                SELECT code, tenant_id, MIN(id) AS keep_id
                FROM core_permissions
                WHERE deleted_at IS NULL
                GROUP BY code, tenant_id
                HAVING COUNT(*) > 1
            LOOP
                -- 将重复行关联的角色权限迁移至保留行（避免丢失角色-权限绑定）
                INSERT INTO core_role_permissions (role_id, permission_id, created_at)
                SELECT rp.role_id, rec.keep_id, rp.created_at
                FROM core_role_permissions rp
                WHERE rp.permission_id IN (
                    SELECT id FROM core_permissions
                    WHERE code = rec.code
                      AND tenant_id = rec.tenant_id
                      AND deleted_at IS NULL
                      AND id != rec.keep_id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM core_role_permissions
                    WHERE permission_id = rec.keep_id
                      AND role_id = rp.role_id
                )
                ON CONFLICT DO NOTHING;

                -- 软删除重复行
                UPDATE core_permissions
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE code = rec.code
                  AND tenant_id = rec.tenant_id
                  AND deleted_at IS NULL
                  AND id != rec.keep_id;
            END LOOP;
        END$$;

        -- Step 2: 若约束已存在则跳过，否则添加
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'core_permissions_tenant_code_unique'
                  AND conrelid = 'core_permissions'::regclass
            ) THEN
                ALTER TABLE core_permissions
                ADD CONSTRAINT core_permissions_tenant_code_unique
                UNIQUE (tenant_id, code);
            END IF;
        END$$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE core_permissions
        DROP CONSTRAINT IF EXISTS core_permissions_tenant_code_unique;
    """
