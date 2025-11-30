from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_users_core_roles";
        DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tree_tenant_tenant__481a89') THEN
        DROP INDEX "idx_tree_tenant_tenant__481a89";
    END IF;
END $$;
            END IF;
        END $$;
        ALTER TABLE "core_tenants" RENAME TO "tree_tenants";
        ALTER TABLE "tree_tenants" ADD "uuid" VARCHAR(36) NOT NULL;
        ALTER TABLE "core_tenant_configs" RENAME TO "tree_tenant_configs";
        ALTER TABLE "tree_tenant_configs" ADD "uuid" VARCHAR(36) NOT NULL;
        ALTER TABLE "tree_tenant_configs" ALTER COLUMN "tenant_id" TYPE INT USING "tenant_id"::INT;
        ALTER TABLE "core_tenant_activity_logs" RENAME TO "tree_tenant_activity_logs";
        ALTER TABLE "tree_tenant_activity_logs" ADD "uuid" VARCHAR(36) NOT NULL;
        ALTER TABLE "core_users" RENAME TO "root_users";
        ALTER TABLE "root_users" ADD "uuid" VARCHAR(36) NOT NULL;
        ALTER TABLE "root_users" ALTER COLUMN "tenant_id" TYPE INT USING "tenant_id"::INT;
        CREATE TABLE IF NOT EXISTS "soil_platform_superadmin" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "username" VARCHAR(50) NOT NULL UNIQUE,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "last_login" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_soil_platfo_usernam_84921b" ON "soil_platform_superadmin" ("username");
COMMENT ON COLUMN "tree_tenants"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "tree_tenant_configs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "tree_tenant_activity_logs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "root_users"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "soil_platform_superadmin"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "soil_platform_superadmin"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "soil_platform_superadmin"."created_at" IS '创建时间';
COMMENT ON COLUMN "soil_platform_superadmin"."updated_at" IS '更新时间';
COMMENT ON COLUMN "soil_platform_superadmin"."id" IS '平台超级管理员 ID（主键）';
COMMENT ON COLUMN "soil_platform_superadmin"."username" IS '用户名（全局唯一，平台唯一）';
COMMENT ON COLUMN "soil_platform_superadmin"."email" IS '用户邮箱（可选）';
COMMENT ON COLUMN "soil_platform_superadmin"."password_hash" IS '密码哈希值（使用 bcrypt 加密）';
COMMENT ON COLUMN "soil_platform_superadmin"."full_name" IS '用户全名（可选）';
COMMENT ON COLUMN "soil_platform_superadmin"."is_active" IS '是否激活';
COMMENT ON COLUMN "soil_platform_superadmin"."last_login" IS '最后登录时间（可选）';
COMMENT ON TABLE "soil_platform_superadmin" IS '平台超级管理员模型';;
        CREATE TABLE IF NOT EXISTS "soil_packages" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "plan" VARCHAR(12) NOT NULL,
    "max_users" INT NOT NULL,
    "max_storage_mb" INT NOT NULL,
    "allow_pro_apps" BOOL NOT NULL  DEFAULT False,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "features" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_soil_packag_plan_493a83" ON "soil_packages" ("plan");
COMMENT ON COLUMN "soil_packages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "soil_packages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "soil_packages"."created_at" IS '创建时间';
COMMENT ON COLUMN "soil_packages"."updated_at" IS '更新时间';
COMMENT ON COLUMN "soil_packages"."id" IS '套餐 ID（主键）';
COMMENT ON COLUMN "soil_packages"."name" IS '套餐名称';
COMMENT ON COLUMN "soil_packages"."plan" IS '套餐类型';
COMMENT ON COLUMN "soil_packages"."max_users" IS '最大用户数限制';
COMMENT ON COLUMN "soil_packages"."max_storage_mb" IS '最大存储空间限制（MB）';
COMMENT ON COLUMN "soil_packages"."allow_pro_apps" IS '是否允许使用 PRO 应用';
COMMENT ON COLUMN "soil_packages"."description" IS '套餐描述';
COMMENT ON COLUMN "soil_packages"."price" IS '套餐价格（可选）';
COMMENT ON COLUMN "soil_packages"."features" IS '套餐功能列表（JSON 存储）';
COMMENT ON TABLE "soil_packages" IS '套餐模型';;
        DROP TABLE IF EXISTS "core_roles";
        DROP TABLE IF EXISTS "core_permissions";"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "root_users" RENAME TO "core_users";
        ALTER TABLE "root_users" DROP COLUMN "uuid";
        ALTER TABLE "root_users" ALTER COLUMN "tenant_id" TYPE INT USING "tenant_id"::INT;
        ALTER TABLE "tree_tenants" RENAME TO "core_tenants";
        ALTER TABLE "tree_tenants" DROP COLUMN "uuid";
        ALTER TABLE "tree_tenant_configs" RENAME TO "core_tenant_configs";
        ALTER TABLE "tree_tenant_configs" DROP COLUMN "uuid";
        ALTER TABLE "tree_tenant_configs" ALTER COLUMN "tenant_id" TYPE INT USING "tenant_id"::INT;
        ALTER TABLE "tree_tenant_activity_logs" RENAME TO "core_tenant_activity_logs";
        ALTER TABLE "tree_tenant_activity_logs" DROP COLUMN "uuid";
        DROP TABLE IF EXISTS "soil_platform_superadmin";
        DROP TABLE IF EXISTS "soil_packages";
        CREATE TABLE "core_users_core_roles" (
    "core_users_id" INT NOT NULL REFERENCES "root_users" ("id") ON DELETE CASCADE,
    "role_id" INT NOT NULL REFERENCES "core_roles" ("id") ON DELETE CASCADE
);
        CREATE INDEX "idx_tree_tenant_tenant__481a89" ON "tree_tenants" ("tenant_id");"""
