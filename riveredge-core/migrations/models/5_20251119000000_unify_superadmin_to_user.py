"""
迁移：统一超级管理员到用户表

将系统级超级管理员统一到 core_users 表中管理：
1. 修改 core_users 表，使 tenant_id 可为空（用于系统级超级管理员）
2. 添加 is_superuser 索引
3. 迁移 core_superadmins 表的数据到 core_users 表（如果存在）
4. 删除 core_superadmins 表
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级数据库
    
    1. 修改 core_users 表，使 tenant_id 可为空
    2. 添加 is_superuser 索引
    3. 迁移 core_superadmins 表的数据到 core_users 表（如果存在）
    4. 删除 core_superadmins 表
    """
    sql_statements = []
    
    # 1. 修改 core_users 表，使 tenant_id 可为空
    sql_statements.append("""
        ALTER TABLE "core_users" 
        ALTER COLUMN "tenant_id" DROP NOT NULL;
    """)
    
    # 2. 添加 is_superuser 索引（如果不存在）
    sql_statements.append("""
        CREATE INDEX IF NOT EXISTS "idx_core_users_is_superuser" 
        ON "core_users" ("is_superuser");
    """)
    
    # 3. 迁移 core_superadmins 表的数据到 core_users 表（如果存在）
    # 注意：只迁移不存在的用户名，避免冲突
    sql_statements.append("""
        INSERT INTO "core_users" (
            "username", 
            "email", 
            "password_hash", 
            "full_name", 
            "is_active", 
            "is_superuser", 
            "is_tenant_admin",
            "last_login",
            "created_at", 
            "updated_at"
        )
        SELECT 
            sa."username",
            sa."email",
            sa."password_hash",
            sa."full_name",
            sa."is_active",
            True as "is_superuser",  -- 系统级超级管理员
            False as "is_tenant_admin",  -- 系统级超级管理员不是租户管理员
            sa."last_login",
            sa."created_at",
            sa."updated_at"
        FROM "core_superadmins" sa
        WHERE NOT EXISTS (
            SELECT 1 
            FROM "core_users" u 
            WHERE u."username" = sa."username" 
            AND u."tenant_id" IS NULL
        )
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'core_superadmins');
    """)
    
    # 4. 删除 core_superadmins 表（如果存在）
    sql_statements.append("""
        DROP TABLE IF EXISTS "core_superadmins";
    """)
    
    return "\n".join(sql_statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚数据库
    
    1. 恢复 core_superadmins 表
    2. 将系统级超级管理员（tenant_id IS NULL 且 is_superuser = True）迁移回 core_superadmins 表
    3. 恢复 core_users 表，使 tenant_id 不可为空
    4. 删除 is_superuser 索引
    """
    sql_statements = []
    
    # 1. 恢复 core_superadmins 表
    sql_statements.append("""
        CREATE TABLE IF NOT EXISTS "core_superadmins" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "username" VARCHAR(50) NOT NULL UNIQUE,
            "email" VARCHAR(255),
            "password_hash" VARCHAR(255) NOT NULL,
            "full_name" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "last_login" TIMESTAMPTZ,
            "device_fingerprint" VARCHAR(255)
        );
        CREATE INDEX IF NOT EXISTS "idx_core_superadmins_username" ON "core_superadmins" ("username");
    """)
    
    # 2. 将系统级超级管理员（tenant_id IS NULL 且 is_superuser = True）迁移回 core_superadmins 表
    sql_statements.append("""
        INSERT INTO "core_superadmins" (
            "username", 
            "email", 
            "password_hash", 
            "full_name", 
            "is_active", 
            "last_login",
            "created_at", 
            "updated_at"
        )
        SELECT 
            u."username",
            u."email",
            u."password_hash",
            u."full_name",
            u."is_active",
            u."last_login",
            u."created_at",
            u."updated_at"
        FROM "core_users" u
        WHERE u."tenant_id" IS NULL 
        AND u."is_superuser" = True
        AND NOT EXISTS (
            SELECT 1 
            FROM "core_superadmins" sa 
            WHERE sa."username" = u."username"
        );
    """)
    
    # 3. 删除系统级超级管理员用户（tenant_id IS NULL 且 is_superuser = True）
    sql_statements.append("""
        DELETE FROM "core_users" 
        WHERE "tenant_id" IS NULL 
        AND "is_superuser" = True;
    """)
    
    # 4. 恢复 core_users 表，使 tenant_id 不可为空
    sql_statements.append("""
        -- 先确保所有记录的 tenant_id 都不为空
        UPDATE "core_users" 
        SET "tenant_id" = 1 
        WHERE "tenant_id" IS NULL;
        
        ALTER TABLE "core_users" 
        ALTER COLUMN "tenant_id" SET NOT NULL;
    """)
    
    # 5. 删除 is_superuser 索引
    sql_statements.append("""
        DROP INDEX IF EXISTS "idx_core_users_is_superuser";
    """)
    
    return "\n".join(sql_statements)

