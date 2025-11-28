"""
为所有表添加 uuid 字段

使用混合策略：主键使用自增ID（性能优先），业务ID使用UUID（安全且唯一）
所有继承 BaseModel 的表都需要添加 uuid 字段
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 为 root_users 表添加 uuid 字段
        -- 注意：PostgreSQL 13+ 支持 gen_random_uuid()，如果版本较低，可以使用 uuid_generate_v4()
        ALTER TABLE "root_users" 
        ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36);
        
        -- 为现有记录生成 UUID
        UPDATE "root_users" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
        
        -- 设置 NOT NULL 约束
        ALTER TABLE "root_users" 
        ALTER COLUMN "uuid" SET NOT NULL;
        
        -- 设置默认值（用于新记录）
        ALTER TABLE "root_users" 
        ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
        
        -- 为 root_users 表添加唯一索引和普通索引
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_users_uuid" ON "root_users" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_users_uuid" ON "root_users" ("uuid");
        
        -- 添加注释
        COMMENT ON COLUMN "root_users"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        
        -- 为 tree_tenants 表添加 uuid 字段
        ALTER TABLE "tree_tenants" 
        ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36);
        
        UPDATE "tree_tenants" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
        ALTER TABLE "tree_tenants" 
        ALTER COLUMN "uuid" SET NOT NULL;
        ALTER TABLE "tree_tenants" 
        ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
        
        -- 为 tree_tenants 表添加唯一索引和普通索引
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_tree_tenants_uuid" ON "tree_tenants" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenants_uuid" ON "tree_tenants" ("uuid");
        
        -- 添加注释
        COMMENT ON COLUMN "tree_tenants"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        
        -- 为 root_saved_searches 表添加 uuid 字段
        ALTER TABLE "root_saved_searches" 
        ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36);
        
        UPDATE "root_saved_searches" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
        ALTER TABLE "root_saved_searches" 
        ALTER COLUMN "uuid" SET NOT NULL;
        ALTER TABLE "root_saved_searches" 
        ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
        
        -- 为 root_saved_searches 表添加唯一索引和普通索引
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_saved_searches_uuid" ON "root_saved_searches" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_saved_searches_uuid" ON "root_saved_searches" ("uuid");
        
        -- 添加注释
        COMMENT ON COLUMN "root_saved_searches"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        
        -- 为 root_roles 表添加 uuid 字段
        ALTER TABLE "root_roles" 
        ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36);
        
        UPDATE "root_roles" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
        ALTER TABLE "root_roles" 
        ALTER COLUMN "uuid" SET NOT NULL;
        ALTER TABLE "root_roles" 
        ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
        
        -- 为 root_roles 表添加唯一索引和普通索引
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_roles_uuid" ON "root_roles" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_roles_uuid" ON "root_roles" ("uuid");
        
        -- 添加注释
        COMMENT ON COLUMN "root_roles"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        
        -- 为 root_permissions 表添加 uuid 字段
        ALTER TABLE "root_permissions" 
        ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36);
        
        UPDATE "root_permissions" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
        ALTER TABLE "root_permissions" 
        ALTER COLUMN "uuid" SET NOT NULL;
        ALTER TABLE "root_permissions" 
        ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
        
        -- 为 root_permissions 表添加唯一索引和普通索引
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_permissions_uuid" ON "root_permissions" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_permissions_uuid" ON "root_permissions" ("uuid");
        
        -- 添加注释
        COMMENT ON COLUMN "root_permissions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        
        -- 为 root_tenant_configs 表添加 uuid 字段（如果存在）
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'root_tenant_configs') THEN
                ALTER TABLE "root_tenant_configs" 
                ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36);
                
                UPDATE "root_tenant_configs" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
                ALTER TABLE "root_tenant_configs" 
                ALTER COLUMN "uuid" SET NOT NULL;
                ALTER TABLE "root_tenant_configs" 
                ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
                
                CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_tenant_configs_uuid" ON "root_tenant_configs" ("uuid");
                CREATE INDEX IF NOT EXISTS "idx_root_tenant_configs_uuid" ON "root_tenant_configs" ("uuid");
                
                COMMENT ON COLUMN "root_tenant_configs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
            END IF;
        END $$;
        
        -- 为 root_tenant_activity_logs 表添加 uuid 字段（如果存在）
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'root_tenant_activity_logs') THEN
                ALTER TABLE "root_tenant_activity_logs" 
                ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36);
                
                UPDATE "root_tenant_activity_logs" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
                ALTER TABLE "root_tenant_activity_logs" 
                ALTER COLUMN "uuid" SET NOT NULL;
                ALTER TABLE "root_tenant_activity_logs" 
                ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
                
                CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_tenant_activity_logs_uuid" ON "root_tenant_activity_logs" ("uuid");
                CREATE INDEX IF NOT EXISTS "idx_root_tenant_activity_logs_uuid" ON "root_tenant_activity_logs" ("uuid");
                
                COMMENT ON COLUMN "root_tenant_activity_logs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除 root_users 表的 uuid 字段
        DROP INDEX IF EXISTS "idx_root_users_uuid";
        DROP INDEX IF EXISTS "uk_root_users_uuid";
        ALTER TABLE "root_users" DROP COLUMN IF EXISTS "uuid";
        
        -- 删除 tree_tenants 表的 uuid 字段
        DROP INDEX IF EXISTS "idx_tree_tenants_uuid";
        DROP INDEX IF EXISTS "uk_tree_tenants_uuid";
        ALTER TABLE "tree_tenants" DROP COLUMN IF EXISTS "uuid";
        
        -- 删除 root_saved_searches 表的 uuid 字段
        DROP INDEX IF EXISTS "idx_root_saved_searches_uuid";
        DROP INDEX IF EXISTS "uk_root_saved_searches_uuid";
        ALTER TABLE "root_saved_searches" DROP COLUMN IF EXISTS "uuid";
        
        -- 删除 root_roles 表的 uuid 字段
        DROP INDEX IF EXISTS "idx_root_roles_uuid";
        DROP INDEX IF EXISTS "uk_root_roles_uuid";
        ALTER TABLE "root_roles" DROP COLUMN IF EXISTS "uuid";
        
        -- 删除 root_permissions 表的 uuid 字段
        DROP INDEX IF EXISTS "idx_root_permissions_uuid";
        DROP INDEX IF EXISTS "uk_root_permissions_uuid";
        ALTER TABLE "root_permissions" DROP COLUMN IF EXISTS "uuid";
        
        -- 删除 root_tenant_configs 表的 uuid 字段（如果存在）
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'root_tenant_configs' AND column_name = 'uuid') THEN
                DROP INDEX IF EXISTS "idx_root_tenant_configs_uuid";
                DROP INDEX IF EXISTS "uk_root_tenant_configs_uuid";
                ALTER TABLE "root_tenant_configs" DROP COLUMN "uuid";
            END IF;
        END $$;
        
        -- 删除 root_tenant_activity_logs 表的 uuid 字段（如果存在）
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'root_tenant_activity_logs' AND column_name = 'uuid') THEN
                DROP INDEX IF EXISTS "idx_root_tenant_activity_logs_uuid";
                DROP INDEX IF EXISTS "uk_root_tenant_activity_logs_uuid";
                ALTER TABLE "root_tenant_activity_logs" DROP COLUMN "uuid";
            END IF;
        END $$;
    """

