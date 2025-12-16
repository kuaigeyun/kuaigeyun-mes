"""
初始迁移文件 - 清理后的数据库架构

此迁移创建了所有经过字段重排序的表，符合自增ID + UUID混合方案
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建所有表（按正确的字段顺序）

        -- 1. 平台超级管理员表
        CREATE TABLE IF NOT EXISTS "soil_platform_superadmin" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "username" VARCHAR(50) NOT NULL UNIQUE,
            "email" VARCHAR(255),
            "password_hash" VARCHAR(255) NOT NULL,
            "full_name" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "last_login" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        COMMENT ON TABLE "soil_platform_superadmin" IS '平台超级管理员表';
        CREATE INDEX IF NOT EXISTS "idx_soil_platfo_tenant__281c88" ON "soil_platform_superadmin" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_soil_platfo_usernam_84921b" ON "soil_platform_superadmin" ("username");

        -- 2. 套餐表
        CREATE TABLE IF NOT EXISTS "soil_packages" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "plan" VARCHAR(12) NOT NULL,
            "max_users" INT NOT NULL,
            "max_storage_mb" INT NOT NULL,
            "allow_pro_apps" BOOL NOT NULL DEFAULT False,
            "description" TEXT,
            "price" DOUBLE PRECISION,
            "features" JSONB NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "soil_packages" IS '套餐表';
        CREATE INDEX IF NOT EXISTS "idx_soil_packag_tenant__e2698a" ON "soil_packages" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_soil_packag_plan_493a83" ON "soil_packages" ("plan");

        -- 3. 租户表
        CREATE TABLE IF NOT EXISTS "tree_tenants" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "domain" VARCHAR(100) NOT NULL UNIQUE,
            "status" VARCHAR(9) NOT NULL DEFAULT 'inactive',
            "plan" VARCHAR(12) NOT NULL DEFAULT 'basic',
            "settings" JSONB NOT NULL,
            "max_users" INT NOT NULL DEFAULT 10,
            "max_storage" INT NOT NULL DEFAULT 1024,
            "expires_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "tree_tenants" IS '租户表';
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_tenant__481a89" ON "tree_tenants" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_domain_4aeb51" ON "tree_tenants" ("domain");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_status_51be99" ON "tree_tenants" ("status");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_plan_b8d0f3" ON "tree_tenants" ("plan");

        -- 4. 租户配置表
        CREATE TABLE IF NOT EXISTS "tree_tenant_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "config_key" VARCHAR(100) NOT NULL,
            "config_value" JSONB NOT NULL,
            "description" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_tree_tenant_tenant__547f3d" UNIQUE ("tenant_id", "config_key")
        );
COMMENT ON TABLE "tree_tenant_configs" IS '租户配置表';
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_tenant__77fa49" ON "tree_tenant_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_config__a223f6" ON "tree_tenant_configs" ("config_key");
        CREATE INDEX IF NOT EXISTS "idx_tree_tenant_tenant__547f3d" ON "tree_tenant_configs" ("tenant_id", "config_key");

        -- 5. 用户表
        CREATE TABLE IF NOT EXISTS "sys_users" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "username" VARCHAR(50) NOT NULL,
            "email" VARCHAR(255),
            "password_hash" VARCHAR(255) NOT NULL,
            "full_name" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_platform_admin" BOOL NOT NULL DEFAULT False,
            "is_tenant_admin" BOOL NOT NULL DEFAULT False,
            "source" VARCHAR(50),
            "last_login" TIMESTAMPTZ,
            "department_id" INT,
            "position_id" INT,
            "phone" VARCHAR(20),
            "avatar" VARCHAR(255),
            "remark" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_sys_users_tenant__26aebd" UNIQUE ("tenant_id", "username")
        );
COMMENT ON TABLE "sys_users" IS '用户表';
        CREATE INDEX IF NOT EXISTS "idx_sys_users_tenant__9fa158" ON "sys_users" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_usernam_04037b" ON "sys_users" ("username");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_tenant__26aebd" ON "sys_users" ("tenant_id", "username");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_is_plat_e57f1c" ON "sys_users" ("is_platform_admin");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_departm_7e45f0" ON "sys_users" ("department_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_positio_b5fd30" ON "sys_users" ("position_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_users_phone_cc3c13" ON "sys_users" ("phone");

        -- 6. 部门表
        CREATE TABLE IF NOT EXISTS "sys_departments" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50),
            "description" TEXT,
            "manager_id" INT,
            "parent_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_departments" IS '部门表';
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_tenant__b7794b" ON "sys_departments" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_parent__1ec8f4" ON "sys_departments" ("parent_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_manager_1b2230" ON "sys_departments" ("manager_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_sort_or_317fa8" ON "sys_departments" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_sys_departm_created_ea16c0" ON "sys_departments" ("created_at");

        -- 7. 职位表
        CREATE TABLE IF NOT EXISTS "sys_positions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50),
            "description" TEXT,
            "department_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_positions" IS '职位表';
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_tenant__057e59" ON "sys_positions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_departm_89df25" ON "sys_positions" ("department_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_code_a7df81" ON "sys_positions" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_sort_or_c51506" ON "sys_positions" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_sys_positio_created_fcdf4d" ON "sys_positions" ("created_at");

        -- 8. 角色表
        CREATE TABLE IF NOT EXISTS "sys_roles" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_roles_tenant__bbcd54" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_roles" IS '角色表';
        CREATE INDEX IF NOT EXISTS "idx_sys_roles_tenant__45a7bd" ON "sys_roles" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_roles_code_903f2f" ON "sys_roles" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_roles_created_e0843d" ON "sys_roles" ("created_at");

        -- 9. 权限表
        CREATE TABLE IF NOT EXISTS "sys_permissions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(100) NOT NULL,
            "resource" VARCHAR(50) NOT NULL,
            "action" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "permission_type" VARCHAR(20) NOT NULL DEFAULT 'function',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_permiss_tenant__a6de52" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_permissions" IS '权限表';
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_tenant__99f233" ON "sys_permissions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_code_b35ea3" ON "sys_permissions" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_resourc_941e0b" ON "sys_permissions" ("resource");
        CREATE INDEX IF NOT EXISTS "idx_sys_permiss_permiss_8e9b79" ON "sys_permissions" ("permission_type");

        -- 10. 角色-权限关联表
        -- 注意：关联表（中间表）不需要 uuid 字段，只需要主键和外键即可
        CREATE TABLE IF NOT EXISTS "sys_role_permissions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "role_id" INT NOT NULL,
            "permission_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_sys_role_pe_role_id_97b31f" UNIQUE ("role_id", "permission_id")
        );
COMMENT ON TABLE "sys_role_permissions" IS '角色权限关联表';
        CREATE INDEX IF NOT EXISTS "idx_sys_role_pe_role_id_fbd949" ON "sys_role_permissions" ("role_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_role_pe_permiss_fa70a0" ON "sys_role_permissions" ("permission_id");

        -- 11. 用户-角色关联表
        -- 注意：关联表（中间表）不需要 uuid 字段，只需要主键和外键即可
        CREATE TABLE IF NOT EXISTS "sys_user_roles" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "user_id" INT NOT NULL,
            "role_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_sys_user_ro_user_id_472051" UNIQUE ("user_id", "role_id")
        );
COMMENT ON TABLE "sys_user_roles" IS '用户角色关联表';
        CREATE INDEX IF NOT EXISTS "idx_sys_user_ro_user_id_50e65a" ON "sys_user_roles" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_user_ro_role_id_d8cc81" ON "sys_user_roles" ("role_id");

        -- 12. 保存搜索条件表
        CREATE TABLE IF NOT EXISTS "sys_saved_searches" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "user_id" INT NOT NULL,
            "page_path" VARCHAR(255) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "is_shared" BOOL NOT NULL DEFAULT False,
            "is_pinned" BOOL NOT NULL DEFAULT False,
            "search_params" JSONB NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
COMMENT ON TABLE "sys_saved_searches" IS '保存的搜索表';
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_tenant__4d209f" ON "sys_saved_searches" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_user_id_cf97e5" ON "sys_saved_searches" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_page_pa_5ab101" ON "sys_saved_searches" ("page_path");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_tenant__fe93a6" ON "sys_saved_searches" ("tenant_id", "user_id", "page_path");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_is_pinn_3cecd6" ON "sys_saved_searches" ("is_pinned");
        CREATE INDEX IF NOT EXISTS "idx_sys_saved_s_is_shar_cb957c" ON "sys_saved_searches" ("is_shared");

        -- 添加外键约束
        ALTER TABLE "sys_users" ADD CONSTRAINT "fk_sys_users_departm_7e45f0" FOREIGN KEY ("department_id") REFERENCES "sys_departments" ("id");
        ALTER TABLE "sys_users" ADD CONSTRAINT "fk_sys_users_positio_b5fd30" FOREIGN KEY ("position_id") REFERENCES "sys_positions" ("id");
        ALTER TABLE "sys_positions" ADD CONSTRAINT "fk_sys_positio_departm_89df25" FOREIGN KEY ("department_id") REFERENCES "sys_departments" ("id");
        ALTER TABLE "sys_departments" ADD CONSTRAINT "fk_sys_departm_manager_1b2230" FOREIGN KEY ("manager_id") REFERENCES "sys_users" ("id");
        ALTER TABLE "sys_departments" ADD CONSTRAINT "fk_sys_departm_parent__1ec8f4" FOREIGN KEY ("parent_id") REFERENCES "sys_departments" ("id");
        ALTER TABLE "sys_role_permissions" ADD CONSTRAINT "fk_sys_role_pe_role_id_fbd949" FOREIGN KEY ("role_id") REFERENCES "sys_roles" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_role_permissions" ADD CONSTRAINT "fk_sys_role_pe_permiss_fa70a0" FOREIGN KEY ("permission_id") REFERENCES "sys_permissions" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_user_roles" ADD CONSTRAINT "fk_sys_user_ro_user_id_50e65a" FOREIGN KEY ("user_id") REFERENCES "sys_users" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_user_roles" ADD CONSTRAINT "fk_sys_user_ro_role_id_d8cc81" FOREIGN KEY ("role_id") REFERENCES "sys_roles" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_saved_searches" ADD CONSTRAINT "fk_sys_saved_s_user_id_cf97e5" FOREIGN KEY ("user_id") REFERENCES "sys_users" ("id") ON DELETE CASCADE;
        ALTER TABLE "sys_saved_searches" ADD CONSTRAINT "fk_sys_saved_s_tenant__4d209f" FOREIGN KEY ("tenant_id") REFERENCES "tree_tenants" ("id");
        ALTER TABLE "tree_tenant_configs" ADD CONSTRAINT "fk_tree_tenant_tenant__77fa49" FOREIGN KEY ("tenant_id") REFERENCES "tree_tenants" ("id") ON DELETE CASCADE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 此迁移不支持回滚
        -- 如需重置，请删除所有表并重新运行初始化
    """
