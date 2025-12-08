"""
移除关联表的 uuid 字段迁移

移除用户-角色关联表和角色-权限关联表中的 uuid 字段。
关联表（中间表）不需要业务ID（UUID），只需要主键和外键即可。

执行时间: 2025-12-08
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：删除关联表的 uuid 字段
    """
    return """
        -- 移除关联表的 uuid 字段
        -- 关联表（中间表）不需要业务ID（UUID），只需要主键和外键即可
        
        DO $$ 
        BEGIN
            -- 删除 core_user_roles 表的 uuid 字段
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_user_roles' AND column_name = 'uuid'
            ) THEN
                -- 先删除唯一约束（如果存在）
                ALTER TABLE core_user_roles DROP CONSTRAINT IF EXISTS core_user_roles_uuid_key;
                -- 删除 uuid 字段
                ALTER TABLE core_user_roles DROP COLUMN uuid;
            END IF;
            
            -- 删除 core_role_permissions 表的 uuid 字段
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_role_permissions' AND column_name = 'uuid'
            ) THEN
                -- 先删除唯一约束（如果存在）
                ALTER TABLE core_role_permissions DROP CONSTRAINT IF EXISTS core_role_permissions_uuid_key;
                -- 删除 uuid 字段
                ALTER TABLE core_role_permissions DROP COLUMN uuid;
            END IF;
            
            -- 兼容旧表名（如果存在）
            -- 删除 sys_user_roles 表的 uuid 字段（如果表还未重命名）
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_user_roles' AND column_name = 'uuid'
            ) THEN
                ALTER TABLE sys_user_roles DROP CONSTRAINT IF EXISTS sys_user_roles_uuid_key;
                ALTER TABLE sys_user_roles DROP COLUMN uuid;
            END IF;
            
            -- 删除 sys_role_permissions 表的 uuid 字段（如果表还未重命名）
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_role_permissions' AND column_name = 'uuid'
            ) THEN
                ALTER TABLE sys_role_permissions DROP CONSTRAINT IF EXISTS sys_role_permissions_uuid_key;
                ALTER TABLE sys_role_permissions DROP COLUMN uuid;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚：恢复关联表的 uuid 字段
    """
    return """
        -- 恢复关联表的 uuid 字段（如果需要回滚）
        -- 注意：回滚时需要重新生成 uuid 值
        
        DO $$ 
        BEGIN
            -- 恢复 core_user_roles 表的 uuid 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_user_roles' AND column_name = 'uuid'
            ) THEN
                ALTER TABLE core_user_roles ADD COLUMN uuid VARCHAR(36);
                -- 为现有记录生成 uuid
                UPDATE core_user_roles SET uuid = gen_random_uuid()::text WHERE uuid IS NULL;
                -- 添加唯一约束
                ALTER TABLE core_user_roles ADD CONSTRAINT core_user_roles_uuid_key UNIQUE (uuid);
            END IF;
            
            -- 恢复 core_role_permissions 表的 uuid 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_role_permissions' AND column_name = 'uuid'
            ) THEN
                ALTER TABLE core_role_permissions ADD COLUMN uuid VARCHAR(36);
                -- 为现有记录生成 uuid
                UPDATE core_role_permissions SET uuid = gen_random_uuid()::text WHERE uuid IS NULL;
                -- 添加唯一约束
                ALTER TABLE core_role_permissions ADD CONSTRAINT core_role_permissions_uuid_key UNIQUE (uuid);
            END IF;
        END $$;
    """

