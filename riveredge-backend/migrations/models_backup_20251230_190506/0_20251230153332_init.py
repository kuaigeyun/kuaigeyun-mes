from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "infra_tenants" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "domain" VARCHAR(100) NOT NULL UNIQUE,
    "status" VARCHAR(9) NOT NULL  DEFAULT 'inactive',
    "plan" VARCHAR(12) NOT NULL  DEFAULT 'basic',
    "settings" JSONB NOT NULL,
    "max_users" INT NOT NULL  DEFAULT 10,
    "max_storage" INT NOT NULL  DEFAULT 1024,
    "expires_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_tenant__32f9a3" ON "infra_tenants" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_domain_fb52a9" ON "infra_tenants" ("domain");
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_status_1d49f0" ON "infra_tenants" ("status");
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_plan_78ae7f" ON "infra_tenants" ("plan");
COMMENT ON COLUMN "infra_tenants"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "infra_tenants"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "infra_tenants"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "infra_tenants"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "infra_tenants"."id" IS '组织 ID（主键）';
COMMENT ON COLUMN "infra_tenants"."name" IS '组织名称';
COMMENT ON COLUMN "infra_tenants"."domain" IS '组织域名（用于子域名访问）';
COMMENT ON COLUMN "infra_tenants"."status" IS '组织状态';
COMMENT ON COLUMN "infra_tenants"."plan" IS '组织套餐';
COMMENT ON COLUMN "infra_tenants"."settings" IS '组织配置（JSONB 存储）';
COMMENT ON COLUMN "infra_tenants"."max_users" IS '最大用户数限制';
COMMENT ON COLUMN "infra_tenants"."max_storage" IS '最大存储空间限制（MB）';
COMMENT ON COLUMN "infra_tenants"."expires_at" IS '过期时间（可选）';
COMMENT ON TABLE "infra_tenants" IS '组织模型';
CREATE TABLE IF NOT EXISTS "infra_tenant_configs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" JSONB NOT NULL,
    "description" TEXT,
    CONSTRAINT "uid_infra_tenan_tenant__0d46b8" UNIQUE ("tenant_id", "config_key")
);
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_tenant__faafe5" ON "infra_tenant_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_config__f5fc80" ON "infra_tenant_configs" ("config_key");
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_tenant__0d46b8" ON "infra_tenant_configs" ("tenant_id", "config_key");
COMMENT ON COLUMN "infra_tenant_configs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "infra_tenant_configs"."tenant_id" IS '组织 ID（外键，关联到 infra_tenants 表）';
COMMENT ON COLUMN "infra_tenant_configs"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "infra_tenant_configs"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "infra_tenant_configs"."id" IS '配置 ID（主键）';
COMMENT ON COLUMN "infra_tenant_configs"."config_key" IS '配置键（唯一标识配置项）';
COMMENT ON COLUMN "infra_tenant_configs"."config_value" IS '配置值（JSONB 存储）';
COMMENT ON COLUMN "infra_tenant_configs"."description" IS '配置描述（可选）';
COMMENT ON TABLE "infra_tenant_configs" IS '组织配置模型';
CREATE TABLE IF NOT EXISTS "infra_tenant_activity_logs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "operator_id" INT,
    "operator_name" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_tenant__5ff17f" ON "infra_tenant_activity_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_created_d8682e" ON "infra_tenant_activity_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_infra_tenan_action_d33a3e" ON "infra_tenant_activity_logs" ("action");
COMMENT ON COLUMN "infra_tenant_activity_logs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."id" IS '日志 ID（主键）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."action" IS '操作类型（如：create, activate, deactivate, update_plan 等）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."description" IS '操作描述（详细说明）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."operator_id" IS '操作人 ID（可选）';
COMMENT ON COLUMN "infra_tenant_activity_logs"."operator_name" IS '操作人名称（可选）';
COMMENT ON TABLE "infra_tenant_activity_logs" IS '组织活动日志模型';
CREATE TABLE IF NOT EXISTS "infra_superadmin" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "username" VARCHAR(50) NOT NULL UNIQUE,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100),
    "phone" VARCHAR(20),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "last_login" TIMESTAMPTZ,
    "avatar" VARCHAR(36),
    "bio" TEXT,
    "contact_info" JSONB,
    "gender" VARCHAR(10)
);
CREATE INDEX IF NOT EXISTS "idx_infra_super_tenant__67e29b" ON "infra_superadmin" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_infra_super_usernam_33e3f6" ON "infra_superadmin" ("username");
COMMENT ON COLUMN "infra_superadmin"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "infra_superadmin"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "infra_superadmin"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "infra_superadmin"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "infra_superadmin"."id" IS '平台超级管理员 ID（主键）';
COMMENT ON COLUMN "infra_superadmin"."username" IS '用户名（全局唯一，平台唯一）';
COMMENT ON COLUMN "infra_superadmin"."email" IS '用户邮箱（可选）';
COMMENT ON COLUMN "infra_superadmin"."password_hash" IS '密码哈希值（使用 pbkdf2_sha256 加密）';
COMMENT ON COLUMN "infra_superadmin"."full_name" IS '用户全名（可选）';
COMMENT ON COLUMN "infra_superadmin"."phone" IS '手机号（可选）';
COMMENT ON COLUMN "infra_superadmin"."is_active" IS '是否激活';
COMMENT ON COLUMN "infra_superadmin"."last_login" IS '最后登录时间（可选）';
COMMENT ON COLUMN "infra_superadmin"."avatar" IS '头像文件UUID（关联文件管理，可选）';
COMMENT ON COLUMN "infra_superadmin"."bio" IS '个人简介（可选）';
COMMENT ON COLUMN "infra_superadmin"."contact_info" IS '联系方式（JSON格式，可选）';
COMMENT ON COLUMN "infra_superadmin"."gender" IS '性别（可选，如：male, female, other）';
COMMENT ON TABLE "infra_superadmin" IS '平台超级管理员模型';
CREATE TABLE IF NOT EXISTS "infra_packages" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
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
CREATE INDEX IF NOT EXISTS "idx_infra_packa_tenant__7cb7a0" ON "infra_packages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_infra_packa_plan_114f73" ON "infra_packages" ("plan");
COMMENT ON COLUMN "infra_packages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "infra_packages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "infra_packages"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "infra_packages"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "infra_packages"."id" IS '套餐 ID（主键）';
COMMENT ON COLUMN "infra_packages"."name" IS '套餐名称';
COMMENT ON COLUMN "infra_packages"."plan" IS '套餐类型';
COMMENT ON COLUMN "infra_packages"."max_users" IS '最大用户数限制';
COMMENT ON COLUMN "infra_packages"."max_storage_mb" IS '最大存储空间限制（MB）';
COMMENT ON COLUMN "infra_packages"."allow_pro_apps" IS '是否允许使用 PRO 应用';
COMMENT ON COLUMN "infra_packages"."description" IS '套餐描述';
COMMENT ON COLUMN "infra_packages"."price" IS '套餐价格（可选）';
COMMENT ON COLUMN "infra_packages"."features" IS '套餐功能列表（JSON 存储）';
COMMENT ON TABLE "infra_packages" IS '套餐模型';
CREATE TABLE IF NOT EXISTS "core_saved_searches" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "user_id" INT NOT NULL,
    "page_path" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_shared" BOOL NOT NULL  DEFAULT False,
    "is_pinned" BOOL NOT NULL  DEFAULT False,
    "search_params" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_core_saved__tenant__189bc8" ON "core_saved_searches" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_saved__user_id_f49137" ON "core_saved_searches" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_core_saved__page_pa_910055" ON "core_saved_searches" ("page_path");
CREATE INDEX IF NOT EXISTS "idx_core_saved__tenant__9489dd" ON "core_saved_searches" ("tenant_id", "user_id", "page_path");
CREATE INDEX IF NOT EXISTS "idx_core_saved__is_pinn_70d2b0" ON "core_saved_searches" ("is_pinned");
CREATE INDEX IF NOT EXISTS "idx_core_saved__is_shar_1583dc" ON "core_saved_searches" ("is_shared");
COMMENT ON COLUMN "core_saved_searches"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_saved_searches"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_saved_searches"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_saved_searches"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_saved_searches"."id" IS '搜索条件 ID（主键）';
COMMENT ON COLUMN "core_saved_searches"."user_id" IS '用户 ID（搜索条件的创建者）';
COMMENT ON COLUMN "core_saved_searches"."page_path" IS '页面路径';
COMMENT ON COLUMN "core_saved_searches"."name" IS '搜索条件名称';
COMMENT ON COLUMN "core_saved_searches"."is_shared" IS '是否共享给其他用户';
COMMENT ON COLUMN "core_saved_searches"."is_pinned" IS '是否置顶';
COMMENT ON COLUMN "core_saved_searches"."search_params" IS '搜索参数（JSON 存储）';
COMMENT ON TABLE "core_saved_searches" IS '保存搜索条件模型';
CREATE TABLE IF NOT EXISTS "core_roles" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system" BOOL NOT NULL  DEFAULT False,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_roles_tenant__f765ef" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_roles_tenant__82fa42" ON "core_roles" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_roles_code_4053fd" ON "core_roles" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_roles_created_45a3f2" ON "core_roles" ("created_at");
COMMENT ON COLUMN "core_roles"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_roles"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_roles"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_roles"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_roles"."id" IS '角色ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_roles"."name" IS '角色名称';
COMMENT ON COLUMN "core_roles"."code" IS '角色代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_roles"."description" IS '角色描述';
COMMENT ON COLUMN "core_roles"."is_system" IS '是否系统角色（系统角色不可删除）';
COMMENT ON COLUMN "core_roles"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_roles"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_roles" IS '角色模型';
CREATE TABLE IF NOT EXISTS "core_permissions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "permission_type" VARCHAR(20) NOT NULL  DEFAULT 'function',
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_permis_tenant__44d640" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_permis_tenant__d00b13" ON "core_permissions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_permis_code_d0d5b4" ON "core_permissions" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_permis_resourc_2f2a9a" ON "core_permissions" ("resource");
CREATE INDEX IF NOT EXISTS "idx_core_permis_permiss_39dbfc" ON "core_permissions" ("permission_type");
COMMENT ON COLUMN "core_permissions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_permissions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_permissions"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_permissions"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_permissions"."id" IS '权限ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_permissions"."name" IS '权限名称';
COMMENT ON COLUMN "core_permissions"."code" IS '权限代码（唯一，格式：资源:操作）';
COMMENT ON COLUMN "core_permissions"."resource" IS '资源（模块，如 user、role）';
COMMENT ON COLUMN "core_permissions"."action" IS '操作（如 create、read、update、delete）';
COMMENT ON COLUMN "core_permissions"."description" IS '权限描述';
COMMENT ON COLUMN "core_permissions"."permission_type" IS '权限类型：function（功能权限）、data（数据权限）、field（字段权限）';
COMMENT ON COLUMN "core_permissions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_permissions" IS '权限模型';
CREATE TABLE IF NOT EXISTS "core_role_permissions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "role_id" INT NOT NULL,
    "permission_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uid_core_role_p_role_id_386d08" UNIQUE ("role_id", "permission_id")
);
CREATE INDEX IF NOT EXISTS "idx_core_role_p_role_id_19c48d" ON "core_role_permissions" ("role_id");
CREATE INDEX IF NOT EXISTS "idx_core_role_p_permiss_3920ed" ON "core_role_permissions" ("permission_id");
COMMENT ON COLUMN "core_role_permissions"."id" IS '关联ID（主键）';
COMMENT ON COLUMN "core_role_permissions"."role_id" IS '角色ID（外键，关联 core_roles）';
COMMENT ON COLUMN "core_role_permissions"."permission_id" IS '权限ID（外键，关联 core_permissions）';
COMMENT ON COLUMN "core_role_permissions"."created_at" IS '创建时间';
COMMENT ON TABLE "core_role_permissions" IS '角色-权限关联模型';
CREATE TABLE IF NOT EXISTS "core_user_roles" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "user_id" INT NOT NULL,
    "role_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uid_core_user_r_user_id_d8e31a" UNIQUE ("user_id", "role_id")
);
CREATE INDEX IF NOT EXISTS "idx_core_user_r_user_id_dd2914" ON "core_user_roles" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_core_user_r_role_id_83612a" ON "core_user_roles" ("role_id");
COMMENT ON COLUMN "core_user_roles"."id" IS '关联ID（主键）';
COMMENT ON COLUMN "core_user_roles"."user_id" IS '用户ID（外键，关联 core_users）';
COMMENT ON COLUMN "core_user_roles"."role_id" IS '角色ID（外键，关联 core_roles）';
COMMENT ON COLUMN "core_user_roles"."created_at" IS '创建时间';
COMMENT ON TABLE "core_user_roles" IS '用户-角色关联模型';
CREATE TABLE IF NOT EXISTS "core_departments" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50),
    "description" TEXT,
    "manager_id" INT,
    "sort_order" INT NOT NULL  DEFAULT 0,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "parent_id" INT REFERENCES "core_departments" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_core_depart_tenant__881030" ON "core_departments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_depart_parent__76604c" ON "core_departments" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_core_depart_manager_584486" ON "core_departments" ("manager_id");
CREATE INDEX IF NOT EXISTS "idx_core_depart_sort_or_298a2b" ON "core_departments" ("sort_order");
CREATE INDEX IF NOT EXISTS "idx_core_depart_created_713814" ON "core_departments" ("created_at");
COMMENT ON COLUMN "core_departments"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_departments"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_departments"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_departments"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_departments"."id" IS '部门ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_departments"."name" IS '部门名称';
COMMENT ON COLUMN "core_departments"."code" IS '部门代码（可选，用于程序识别）';
COMMENT ON COLUMN "core_departments"."description" IS '部门描述';
COMMENT ON COLUMN "core_departments"."manager_id" IS '部门负责人ID（外键，关联 core_users，内部使用自增ID）';
COMMENT ON COLUMN "core_departments"."sort_order" IS '排序顺序（同级部门排序）';
COMMENT ON COLUMN "core_departments"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_departments"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "core_departments"."parent_id" IS '父部门（外键关系，用于树形结构）';
COMMENT ON TABLE "core_departments" IS '部门模型';
CREATE TABLE IF NOT EXISTS "core_positions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50),
    "description" TEXT,
    "department_id" INT,
    "sort_order" INT NOT NULL  DEFAULT 0,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_core_positi_tenant__8f135a" ON "core_positions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_positi_departm_e20145" ON "core_positions" ("department_id");
CREATE INDEX IF NOT EXISTS "idx_core_positi_code_75e9a2" ON "core_positions" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_positi_sort_or_34f432" ON "core_positions" ("sort_order");
CREATE INDEX IF NOT EXISTS "idx_core_positi_created_4df7b7" ON "core_positions" ("created_at");
COMMENT ON COLUMN "core_positions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_positions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_positions"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_positions"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_positions"."id" IS '职位ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_positions"."name" IS '职位名称';
COMMENT ON COLUMN "core_positions"."code" IS '职位代码（可选，用于程序识别）';
COMMENT ON COLUMN "core_positions"."description" IS '职位描述';
COMMENT ON COLUMN "core_positions"."department_id" IS '所属部门ID（外键，关联 core_departments，内部使用自增ID）';
COMMENT ON COLUMN "core_positions"."sort_order" IS '排序顺序';
COMMENT ON COLUMN "core_positions"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_positions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_positions" IS '职位模型';
CREATE TABLE IF NOT EXISTS "core_users" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_infra_admin" BOOL NOT NULL  DEFAULT False,
    "is_tenant_admin" BOOL NOT NULL  DEFAULT False,
    "source" VARCHAR(50),
    "last_login" TIMESTAMPTZ,
    "phone" VARCHAR(20),
    "avatar" VARCHAR(36),
    "remark" TEXT,
    "bio" TEXT,
    "contact_info" JSONB,
    "gender" VARCHAR(10),
    "deleted_at" TIMESTAMPTZ,
    "department_id" INT REFERENCES "core_departments" ("id") ON DELETE SET NULL,
    "position_id" INT REFERENCES "core_positions" ("id") ON DELETE SET NULL,
    CONSTRAINT "uid_core_users_tenant__8d51a4" UNIQUE ("tenant_id", "username")
);
CREATE INDEX IF NOT EXISTS "idx_core_users_tenant__7bf229" ON "core_users" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_users_usernam_b84f0b" ON "core_users" ("username");
CREATE INDEX IF NOT EXISTS "idx_core_users_tenant__8d51a4" ON "core_users" ("tenant_id", "username");
CREATE INDEX IF NOT EXISTS "idx_core_users_is_infr_98d511" ON "core_users" ("is_infra_admin");
CREATE INDEX IF NOT EXISTS "idx_core_users_departm_79b5d4" ON "core_users" ("department_id");
CREATE INDEX IF NOT EXISTS "idx_core_users_positio_5b10c3" ON "core_users" ("position_id");
CREATE INDEX IF NOT EXISTS "idx_core_users_phone_7819b4" ON "core_users" ("phone");
COMMENT ON COLUMN "core_users"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_users"."tenant_id" IS '组织 ID（外键，关联到 infra_tenants 表，可为空用于平台管理）';
COMMENT ON COLUMN "core_users"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_users"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_users"."id" IS '用户 ID（主键）';
COMMENT ON COLUMN "core_users"."username" IS '用户名（组织内唯一，平台管理全局唯一）';
COMMENT ON COLUMN "core_users"."email" IS '用户邮箱（可选，符合中国用户使用习惯）';
COMMENT ON COLUMN "core_users"."password_hash" IS '密码哈希值（使用 pbkdf2_sha256 加密）';
COMMENT ON COLUMN "core_users"."full_name" IS '用户全名（可选）';
COMMENT ON COLUMN "core_users"."is_active" IS '是否激活';
COMMENT ON COLUMN "core_users"."is_infra_admin" IS '是否为平台管理（系统级超级管理员，需 tenant_id=None）';
COMMENT ON COLUMN "core_users"."is_tenant_admin" IS '是否为组织管理员（需 tenant_id 不为空）';
COMMENT ON COLUMN "core_users"."source" IS '用户来源（invite_code, personal, organization等）';
COMMENT ON COLUMN "core_users"."last_login" IS '最后登录时间（可选）';
COMMENT ON COLUMN "core_users"."phone" IS '手机号（可选）';
COMMENT ON COLUMN "core_users"."avatar" IS '头像文件UUID（关联文件管理，可选）';
COMMENT ON COLUMN "core_users"."remark" IS '备注（可选）';
COMMENT ON COLUMN "core_users"."bio" IS '个人简介（可选）';
COMMENT ON COLUMN "core_users"."contact_info" IS '联系方式（JSON格式，可选）';
COMMENT ON COLUMN "core_users"."gender" IS '性别（可选，如：male, female, other）';
COMMENT ON COLUMN "core_users"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "core_users"."department_id" IS '所属部门（外键关系，自动创建 department_id 字段）';
COMMENT ON COLUMN "core_users"."position_id" IS '所属职位（外键关系，自动创建 position_id 字段）';
COMMENT ON TABLE "core_users" IS '用户模型';
CREATE TABLE IF NOT EXISTS "core_data_dictionaries" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system" BOOL NOT NULL  DEFAULT False,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_data_d_tenant__e6a0cd" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_data_d_tenant__8d519f" ON "core_data_dictionaries" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_data_d_code_e44059" ON "core_data_dictionaries" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_data_d_created_09bd3b" ON "core_data_dictionaries" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_core_data_d_tenant__e6a0cd" ON "core_data_dictionaries" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_data_d_tenant__ac4101" ON "core_data_dictionaries" ("tenant_id", "is_active");
COMMENT ON COLUMN "core_data_dictionaries"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_data_dictionaries"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_data_dictionaries"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_data_dictionaries"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_data_dictionaries"."id" IS '字典ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_data_dictionaries"."name" IS '字典名称';
COMMENT ON COLUMN "core_data_dictionaries"."code" IS '字典代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_data_dictionaries"."description" IS '字典描述';
COMMENT ON COLUMN "core_data_dictionaries"."is_system" IS '是否系统字典（系统字典不可删除）';
COMMENT ON COLUMN "core_data_dictionaries"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_data_dictionaries"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_data_dictionaries" IS '数据字典模型';
CREATE TABLE IF NOT EXISTS "core_dictionary_items" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "label" VARCHAR(100) NOT NULL,
    "value" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "sort_order" INT NOT NULL  DEFAULT 0,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "dictionary_id" INT NOT NULL REFERENCES "core_data_dictionaries" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_core_dictio_tenant__969b82" UNIQUE ("tenant_id", "dictionary_id", "value")
);
CREATE INDEX IF NOT EXISTS "idx_core_dictio_tenant__18cb1c" ON "core_dictionary_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_dictio_diction_cecd19" ON "core_dictionary_items" ("dictionary_id");
CREATE INDEX IF NOT EXISTS "idx_core_dictio_sort_or_031505" ON "core_dictionary_items" ("sort_order");
CREATE INDEX IF NOT EXISTS "idx_core_dictio_created_78d2f5" ON "core_dictionary_items" ("created_at");
COMMENT ON COLUMN "core_dictionary_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_dictionary_items"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_dictionary_items"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_dictionary_items"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_dictionary_items"."id" IS '字典项ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_dictionary_items"."label" IS '字典项标签（显示名称）';
COMMENT ON COLUMN "core_dictionary_items"."value" IS '字典项值（用于程序识别）';
COMMENT ON COLUMN "core_dictionary_items"."description" IS '字典项描述';
COMMENT ON COLUMN "core_dictionary_items"."color" IS '标签颜色（可选）';
COMMENT ON COLUMN "core_dictionary_items"."icon" IS '图标（可选）';
COMMENT ON COLUMN "core_dictionary_items"."sort_order" IS '排序顺序';
COMMENT ON COLUMN "core_dictionary_items"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_dictionary_items"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "core_dictionary_items"."dictionary_id" IS '关联字典（内部使用自增ID）';
COMMENT ON TABLE "core_dictionary_items" IS '字典项模型';
CREATE TABLE IF NOT EXISTS "core_system_parameters" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "is_system" BOOL NOT NULL  DEFAULT False,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_system_tenant__b1692d" UNIQUE ("tenant_id", "key")
);
CREATE INDEX IF NOT EXISTS "idx_core_system_tenant__68b58f" ON "core_system_parameters" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_system_key_ca5696" ON "core_system_parameters" ("key");
CREATE INDEX IF NOT EXISTS "idx_core_system_created_b16d60" ON "core_system_parameters" ("created_at");
COMMENT ON COLUMN "core_system_parameters"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_system_parameters"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_system_parameters"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_system_parameters"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_system_parameters"."id" IS '参数ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_system_parameters"."key" IS '参数键（唯一，用于程序识别）';
COMMENT ON COLUMN "core_system_parameters"."value" IS '参数值（JSON 字符串）';
COMMENT ON COLUMN "core_system_parameters"."type" IS '参数类型：string、number、boolean、json';
COMMENT ON COLUMN "core_system_parameters"."description" IS '参数描述';
COMMENT ON COLUMN "core_system_parameters"."is_system" IS '是否系统参数（系统参数不可删除）';
COMMENT ON COLUMN "core_system_parameters"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_system_parameters"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_system_parameters" IS '系统参数模型';
CREATE TABLE IF NOT EXISTS "core_code_rules" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "expression" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "seq_start" INT NOT NULL  DEFAULT 1,
    "seq_step" INT NOT NULL  DEFAULT 1,
    "seq_reset_rule" VARCHAR(20),
    "is_system" BOOL NOT NULL  DEFAULT False,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_code_r_tenant__19ffd8" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_code_r_tenant__57ddc4" ON "core_code_rules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_code_r_code_863619" ON "core_code_rules" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_code_r_created_288c85" ON "core_code_rules" ("created_at");
COMMENT ON COLUMN "core_code_rules"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_code_rules"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_code_rules"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_code_rules"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_code_rules"."id" IS '规则ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_code_rules"."name" IS '规则名称';
COMMENT ON COLUMN "core_code_rules"."code" IS '规则代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_code_rules"."expression" IS '规则表达式';
COMMENT ON COLUMN "core_code_rules"."description" IS '规则描述';
COMMENT ON COLUMN "core_code_rules"."seq_start" IS '序号起始值';
COMMENT ON COLUMN "core_code_rules"."seq_step" IS '序号步长';
COMMENT ON COLUMN "core_code_rules"."seq_reset_rule" IS '序号重置规则：never、daily、monthly、yearly';
COMMENT ON COLUMN "core_code_rules"."is_system" IS '是否系统规则（系统规则不可删除）';
COMMENT ON COLUMN "core_code_rules"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_code_rules"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_code_rules" IS '编码规则模型';
CREATE TABLE IF NOT EXISTS "core_code_sequences" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code_rule_id" INT NOT NULL,
    "current_seq" INT NOT NULL  DEFAULT 0,
    "reset_date" DATE,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_code_s_code_ru_6d9169" UNIQUE ("code_rule_id", "tenant_id")
);
CREATE INDEX IF NOT EXISTS "idx_core_code_s_tenant__a67f55" ON "core_code_sequences" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_code_s_code_ru_fe0e8c" ON "core_code_sequences" ("code_rule_id");
COMMENT ON COLUMN "core_code_sequences"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_code_sequences"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_code_sequences"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_code_sequences"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_code_sequences"."id" IS '序号ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_code_sequences"."code_rule_id" IS '关联编码规则ID（内部使用自增ID）';
COMMENT ON COLUMN "core_code_sequences"."current_seq" IS '当前序号';
COMMENT ON COLUMN "core_code_sequences"."reset_date" IS '重置日期（用于按日/月/年重置）';
COMMENT ON COLUMN "core_code_sequences"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_code_sequences" IS '编码序号模型';
CREATE TABLE IF NOT EXISTS "core_custom_fields" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "table_name" VARCHAR(50) NOT NULL,
    "field_type" VARCHAR(20) NOT NULL,
    "config" JSONB,
    "label" VARCHAR(100),
    "placeholder" VARCHAR(200),
    "is_required" BOOL NOT NULL  DEFAULT False,
    "is_searchable" BOOL NOT NULL  DEFAULT True,
    "is_sortable" BOOL NOT NULL  DEFAULT True,
    "sort_order" INT NOT NULL  DEFAULT 0,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_custom_tenant__d37af2" UNIQUE ("tenant_id", "table_name", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_custom_tenant__5a0270" ON "core_custom_fields" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_custom_table_n_2908ae" ON "core_custom_fields" ("table_name");
CREATE INDEX IF NOT EXISTS "idx_core_custom_created_ce34ce" ON "core_custom_fields" ("created_at");
COMMENT ON COLUMN "core_custom_fields"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_custom_fields"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_custom_fields"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_custom_fields"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_custom_fields"."id" IS '字段ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_custom_fields"."name" IS '字段名称';
COMMENT ON COLUMN "core_custom_fields"."code" IS '字段代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_custom_fields"."table_name" IS '关联表名';
COMMENT ON COLUMN "core_custom_fields"."field_type" IS '字段类型：text、number、date、select、textarea等';
COMMENT ON COLUMN "core_custom_fields"."config" IS '字段配置（JSON，存储默认值、验证规则、选项等）';
COMMENT ON COLUMN "core_custom_fields"."label" IS '字段标签（显示名称）';
COMMENT ON COLUMN "core_custom_fields"."placeholder" IS '占位符';
COMMENT ON COLUMN "core_custom_fields"."is_required" IS '是否必填';
COMMENT ON COLUMN "core_custom_fields"."is_searchable" IS '是否可搜索';
COMMENT ON COLUMN "core_custom_fields"."is_sortable" IS '是否可排序';
COMMENT ON COLUMN "core_custom_fields"."sort_order" IS '排序顺序';
COMMENT ON COLUMN "core_custom_fields"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_custom_fields"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_custom_fields" IS '自定义字段模型';
CREATE TABLE IF NOT EXISTS "core_custom_field_values" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "custom_field_id" INT NOT NULL,
    "record_id" INT NOT NULL,
    "record_table" VARCHAR(50) NOT NULL,
    "value_text" TEXT,
    "value_number" DECIMAL(20,4),
    "value_date" DATE,
    "value_json" JSONB,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_core_custom_tenant__3a19dd" ON "core_custom_field_values" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_custom_custom__b2d6e9" ON "core_custom_field_values" ("custom_field_id");
CREATE INDEX IF NOT EXISTS "idx_core_custom_record__8a2bcb" ON "core_custom_field_values" ("record_table", "record_id");
CREATE INDEX IF NOT EXISTS "idx_core_custom_created_bde756" ON "core_custom_field_values" ("created_at");
COMMENT ON COLUMN "core_custom_field_values"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_custom_field_values"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_custom_field_values"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_custom_field_values"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_custom_field_values"."id" IS '值ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_custom_field_values"."custom_field_id" IS '关联自定义字段ID（内部使用自增ID）';
COMMENT ON COLUMN "core_custom_field_values"."record_id" IS '关联记录ID（内部使用自增ID）';
COMMENT ON COLUMN "core_custom_field_values"."record_table" IS '关联表名';
COMMENT ON COLUMN "core_custom_field_values"."value_text" IS '文本值';
COMMENT ON COLUMN "core_custom_field_values"."value_number" IS '数值';
COMMENT ON COLUMN "core_custom_field_values"."value_date" IS '日期值';
COMMENT ON COLUMN "core_custom_field_values"."value_json" IS 'JSON值（用于复杂类型）';
COMMENT ON COLUMN "core_custom_field_values"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_custom_field_values" IS '自定义字段值模型';
CREATE TABLE IF NOT EXISTS "core_site_settings" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "settings" JSONB NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_site_s_tenant__a67cce" UNIQUE ("tenant_id")
);
CREATE INDEX IF NOT EXISTS "idx_core_site_s_tenant__a67cce" ON "core_site_settings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_site_s_created_0157f3" ON "core_site_settings" ("created_at");
COMMENT ON COLUMN "core_site_settings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_site_settings"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_site_settings"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_site_settings"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_site_settings"."id" IS '设置ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_site_settings"."settings" IS '设置项（JSON，存储所有配置）';
COMMENT ON COLUMN "core_site_settings"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_site_settings" IS '站点设置模型';
CREATE TABLE IF NOT EXISTS "core_invitation_codes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "email" VARCHAR(100),
    "role_id" INT,
    "max_uses" INT NOT NULL  DEFAULT 1,
    "used_count" INT NOT NULL  DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_core_invita_tenant__0e96a9" ON "core_invitation_codes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_invita_code_8fdd1d" ON "core_invitation_codes" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_invita_created_183828" ON "core_invitation_codes" ("created_at");
COMMENT ON COLUMN "core_invitation_codes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_invitation_codes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_invitation_codes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_invitation_codes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_invitation_codes"."id" IS '邀请码ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_invitation_codes"."code" IS '邀请码（唯一，全局唯一）';
COMMENT ON COLUMN "core_invitation_codes"."email" IS '邀请邮箱（可选）';
COMMENT ON COLUMN "core_invitation_codes"."role_id" IS '默认角色ID（内部使用自增ID，可选）';
COMMENT ON COLUMN "core_invitation_codes"."max_uses" IS '最大使用次数';
COMMENT ON COLUMN "core_invitation_codes"."used_count" IS '已使用次数';
COMMENT ON COLUMN "core_invitation_codes"."expires_at" IS '过期时间（可选）';
COMMENT ON COLUMN "core_invitation_codes"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_invitation_codes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_invitation_codes" IS '邀请码模型';
CREATE TABLE IF NOT EXISTS "core_languages" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "native_name" VARCHAR(50),
    "translations" JSONB NOT NULL,
    "is_default" BOOL NOT NULL  DEFAULT False,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "sort_order" INT NOT NULL  DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_langua_tenant__d854c3" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_langua_tenant__c09c2e" ON "core_languages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_langua_code_b99bc7" ON "core_languages" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_langua_created_4dc374" ON "core_languages" ("created_at");
COMMENT ON COLUMN "core_languages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_languages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_languages"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_languages"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_languages"."id" IS '语言ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_languages"."code" IS '语言代码（ISO 639-1，如：zh、en、ja）';
COMMENT ON COLUMN "core_languages"."name" IS '语言名称（如：中文、English、日本語）';
COMMENT ON COLUMN "core_languages"."native_name" IS '本地名称（如：中文、English、日本語）';
COMMENT ON COLUMN "core_languages"."translations" IS '翻译内容（JSON，存储所有翻译键值对）';
COMMENT ON COLUMN "core_languages"."is_default" IS '是否默认语言';
COMMENT ON COLUMN "core_languages"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_languages"."sort_order" IS '排序顺序';
COMMENT ON COLUMN "core_languages"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_languages" IS '语言模型';
CREATE TABLE IF NOT EXISTS "core_applications" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(200),
    "version" VARCHAR(20),
    "route_path" VARCHAR(200),
    "entry_point" VARCHAR(500),
    "menu_config" JSONB,
    "permission_code" VARCHAR(100),
    "is_system" BOOL NOT NULL  DEFAULT False,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_installed" BOOL NOT NULL  DEFAULT False,
    "sort_order" INT NOT NULL  DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_applic_tenant__ebd7bf" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_applic_tenant__b68c01" ON "core_applications" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_applic_code_d1c58e" ON "core_applications" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_applic_uuid_49d962" ON "core_applications" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_applic_created_0c7b52" ON "core_applications" ("created_at");
COMMENT ON COLUMN "core_applications"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_applications"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_applications"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_applications"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_applications"."id" IS '应用ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_applications"."name" IS '应用名称';
COMMENT ON COLUMN "core_applications"."code" IS '应用代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_applications"."description" IS '应用描述';
COMMENT ON COLUMN "core_applications"."icon" IS '应用图标';
COMMENT ON COLUMN "core_applications"."version" IS '应用版本';
COMMENT ON COLUMN "core_applications"."route_path" IS '应用路由路径';
COMMENT ON COLUMN "core_applications"."entry_point" IS '应用入口点';
COMMENT ON COLUMN "core_applications"."menu_config" IS '菜单配置（JSON）';
COMMENT ON COLUMN "core_applications"."permission_code" IS '权限代码';
COMMENT ON COLUMN "core_applications"."is_system" IS '是否系统应用';
COMMENT ON COLUMN "core_applications"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_applications"."is_installed" IS '是否已安装';
COMMENT ON COLUMN "core_applications"."sort_order" IS '排序顺序';
COMMENT ON COLUMN "core_applications"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_applications" IS '应用模型';
CREATE TABLE IF NOT EXISTS "core_menus" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "path" VARCHAR(200),
    "icon" VARCHAR(100),
    "component" VARCHAR(500),
    "permission_code" VARCHAR(100),
    "application_uuid" VARCHAR(36),
    "sort_order" INT NOT NULL  DEFAULT 0,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_external" BOOL NOT NULL  DEFAULT False,
    "external_url" VARCHAR(500),
    "meta" JSONB,
    "deleted_at" TIMESTAMPTZ,
    "parent_id" INT REFERENCES "core_menus" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_core_menus_tenant__797535" ON "core_menus" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_menus_parent__cca592" ON "core_menus" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_core_menus_applica_55131c" ON "core_menus" ("application_uuid");
CREATE INDEX IF NOT EXISTS "idx_core_menus_permiss_46a11b" ON "core_menus" ("permission_code");
CREATE INDEX IF NOT EXISTS "idx_core_menus_sort_or_3ceeb4" ON "core_menus" ("sort_order");
CREATE INDEX IF NOT EXISTS "idx_core_menus_is_acti_33e2e6" ON "core_menus" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_core_menus_created_800109" ON "core_menus" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_core_menus_tenant__563213" ON "core_menus" ("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_core_menus_tenant__d3b4a7" ON "core_menus" ("tenant_id", "application_uuid", "is_active");
CREATE INDEX IF NOT EXISTS "idx_core_menus_tenant__9bf2fb" ON "core_menus" ("tenant_id", "parent_id", "is_active");
COMMENT ON COLUMN "core_menus"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_menus"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_menus"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_menus"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_menus"."id" IS '菜单ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_menus"."name" IS '菜单名称';
COMMENT ON COLUMN "core_menus"."path" IS '菜单路径（路由路径）';
COMMENT ON COLUMN "core_menus"."icon" IS '菜单图标（Ant Design 图标名称或 URL）';
COMMENT ON COLUMN "core_menus"."component" IS '前端组件路径（可选）';
COMMENT ON COLUMN "core_menus"."permission_code" IS '权限代码（关联权限，可选）';
COMMENT ON COLUMN "core_menus"."application_uuid" IS '关联应用UUID（关联应用中心，可选）';
COMMENT ON COLUMN "core_menus"."sort_order" IS '排序顺序（同级菜单排序）';
COMMENT ON COLUMN "core_menus"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_menus"."is_external" IS '是否外部链接';
COMMENT ON COLUMN "core_menus"."external_url" IS '外部链接URL（如果 is_external 为 true）';
COMMENT ON COLUMN "core_menus"."meta" IS '菜单元数据（JSON格式）';
COMMENT ON COLUMN "core_menus"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "core_menus"."parent_id" IS '父菜单（外键关系，用于树形结构）';
COMMENT ON TABLE "core_menus" IS '菜单模型';
CREATE TABLE IF NOT EXISTS "core_integration_configs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_connected" BOOL NOT NULL  DEFAULT False,
    "last_connected_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_integr_tenant__da3b07" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_integr_tenant__00bd6f" ON "core_integration_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_integr_code_59c5ed" ON "core_integration_configs" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_integr_uuid_c97e8c" ON "core_integration_configs" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_integr_type_ca0631" ON "core_integration_configs" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_integr_created_b4566e" ON "core_integration_configs" ("created_at");
COMMENT ON COLUMN "core_integration_configs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_integration_configs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_integration_configs"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_integration_configs"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_integration_configs"."id" IS '集成配置ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_integration_configs"."name" IS '集成名称';
COMMENT ON COLUMN "core_integration_configs"."code" IS '集成代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_integration_configs"."type" IS '集成类型：OAuth、API、Webhook、Database等';
COMMENT ON COLUMN "core_integration_configs"."description" IS '集成描述';
COMMENT ON COLUMN "core_integration_configs"."config" IS '配置信息（JSON）';
COMMENT ON COLUMN "core_integration_configs"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_integration_configs"."is_connected" IS '是否已连接';
COMMENT ON COLUMN "core_integration_configs"."last_connected_at" IS '最后连接时间';
COMMENT ON COLUMN "core_integration_configs"."last_error" IS '最后错误信息';
COMMENT ON COLUMN "core_integration_configs"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_integration_configs" IS '集成配置模型';
CREATE TABLE IF NOT EXISTS "core_files" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_type" VARCHAR(100),
    "file_extension" VARCHAR(20),
    "preview_url" VARCHAR(500),
    "category" VARCHAR(50),
    "tags" JSONB,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "upload_status" VARCHAR(20) NOT NULL  DEFAULT 'completed',
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_core_files_tenant__6bf4bf" ON "core_files" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_files_categor_977e62" ON "core_files" ("category");
CREATE INDEX IF NOT EXISTS "idx_core_files_file_ty_5453c1" ON "core_files" ("file_type");
CREATE INDEX IF NOT EXISTS "idx_core_files_upload__259946" ON "core_files" ("upload_status");
CREATE INDEX IF NOT EXISTS "idx_core_files_uuid_998412" ON "core_files" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_files_created_4a8c37" ON "core_files" ("created_at");
COMMENT ON COLUMN "core_files"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_files"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_files"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_files"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_files"."id" IS '文件ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_files"."name" IS '文件名称（存储时使用的文件名，通常是UUID）';
COMMENT ON COLUMN "core_files"."original_name" IS '原始文件名（用户上传时的文件名）';
COMMENT ON COLUMN "core_files"."file_path" IS '文件存储路径';
COMMENT ON COLUMN "core_files"."file_size" IS '文件大小（字节）';
COMMENT ON COLUMN "core_files"."file_type" IS '文件类型（MIME类型）';
COMMENT ON COLUMN "core_files"."file_extension" IS '文件扩展名';
COMMENT ON COLUMN "core_files"."preview_url" IS '预览URL（kkFileView 或简单预览）';
COMMENT ON COLUMN "core_files"."category" IS '文件分类（可选）';
COMMENT ON COLUMN "core_files"."tags" IS '文件标签（JSON数组，可选）';
COMMENT ON COLUMN "core_files"."description" IS '文件描述（可选）';
COMMENT ON COLUMN "core_files"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_files"."upload_status" IS '上传状态（uploading、completed、failed）';
COMMENT ON COLUMN "core_files"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_files" IS '文件模型';
CREATE TABLE IF NOT EXISTS "core_apis" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "path" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "request_headers" JSONB,
    "request_params" JSONB,
    "request_body" JSONB,
    "response_format" JSONB,
    "response_example" JSONB,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_system" BOOL NOT NULL  DEFAULT False,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_apis_tenant__612f27" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_apis_tenant__067e72" ON "core_apis" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_apis_tenant__612f27" ON "core_apis" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_apis_method_be1014" ON "core_apis" ("method");
CREATE INDEX IF NOT EXISTS "idx_core_apis_uuid_26f0de" ON "core_apis" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_apis_code_ccf95a" ON "core_apis" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_apis_created_c9591b" ON "core_apis" ("created_at");
COMMENT ON COLUMN "core_apis"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_apis"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_apis"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_apis"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_apis"."id" IS '接口ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_apis"."name" IS '接口名称';
COMMENT ON COLUMN "core_apis"."code" IS '接口代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_apis"."description" IS '接口描述';
COMMENT ON COLUMN "core_apis"."path" IS '接口路径';
COMMENT ON COLUMN "core_apis"."method" IS '请求方法（GET、POST、PUT、DELETE等）';
COMMENT ON COLUMN "core_apis"."request_headers" IS '请求头（JSON格式）';
COMMENT ON COLUMN "core_apis"."request_params" IS '请求参数（JSON格式）';
COMMENT ON COLUMN "core_apis"."request_body" IS '请求体（JSON格式）';
COMMENT ON COLUMN "core_apis"."response_format" IS '响应格式（JSON格式）';
COMMENT ON COLUMN "core_apis"."response_example" IS '响应示例（JSON格式）';
COMMENT ON COLUMN "core_apis"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_apis"."is_system" IS '是否系统接口（系统接口不可删除）';
COMMENT ON COLUMN "core_apis"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_apis" IS '接口模型';
CREATE TABLE IF NOT EXISTS "core_data_sources" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_connected" BOOL NOT NULL  DEFAULT False,
    "last_connected_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_data_s_tenant__d3e30f" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_data_s_tenant__71e6b1" ON "core_data_sources" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_data_s_tenant__d3e30f" ON "core_data_sources" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_data_s_type_25a53e" ON "core_data_sources" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_data_s_uuid_37290b" ON "core_data_sources" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_data_s_code_943752" ON "core_data_sources" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_data_s_created_6f817f" ON "core_data_sources" ("created_at");
COMMENT ON COLUMN "core_data_sources"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_data_sources"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_data_sources"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_data_sources"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_data_sources"."id" IS '数据源ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_data_sources"."name" IS '数据源名称';
COMMENT ON COLUMN "core_data_sources"."code" IS '数据源代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_data_sources"."description" IS '数据源描述';
COMMENT ON COLUMN "core_data_sources"."type" IS '数据源类型（postgresql、mysql、mongodb、api等）';
COMMENT ON COLUMN "core_data_sources"."config" IS '连接配置（JSON格式）';
COMMENT ON COLUMN "core_data_sources"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_data_sources"."is_connected" IS '是否已连接';
COMMENT ON COLUMN "core_data_sources"."last_connected_at" IS '最后连接时间';
COMMENT ON COLUMN "core_data_sources"."last_error" IS '最后连接错误信息';
COMMENT ON COLUMN "core_data_sources"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_data_sources" IS '数据源模型';
CREATE TABLE IF NOT EXISTS "core_datasets" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "query_type" VARCHAR(20) NOT NULL,
    "query_config" JSONB NOT NULL,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "last_executed_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "data_source_id" INT NOT NULL REFERENCES "core_data_sources" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_core_datase_tenant__5937a3" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_datase_tenant__96acd6" ON "core_datasets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_datase_tenant__5937a3" ON "core_datasets" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_datase_data_so_30a957" ON "core_datasets" ("data_source_id");
CREATE INDEX IF NOT EXISTS "idx_core_datase_uuid_ad7b36" ON "core_datasets" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_datase_code_6f1c1f" ON "core_datasets" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_datase_created_f79c15" ON "core_datasets" ("created_at");
COMMENT ON COLUMN "core_datasets"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_datasets"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_datasets"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_datasets"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_datasets"."id" IS '数据集ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_datasets"."name" IS '数据集名称';
COMMENT ON COLUMN "core_datasets"."code" IS '数据集代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_datasets"."description" IS '数据集描述';
COMMENT ON COLUMN "core_datasets"."query_type" IS '查询类型（sql、api）';
COMMENT ON COLUMN "core_datasets"."query_config" IS '查询配置（JSON格式）';
COMMENT ON COLUMN "core_datasets"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_datasets"."last_executed_at" IS '最后执行时间';
COMMENT ON COLUMN "core_datasets"."last_error" IS '最后执行错误信息';
COMMENT ON COLUMN "core_datasets"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "core_datasets"."data_source_id" IS '关联数据源（内部使用自增ID）';
COMMENT ON TABLE "core_datasets" IS '数据集模型';
CREATE TABLE IF NOT EXISTS "core_message_configs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_default" BOOL NOT NULL  DEFAULT False,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_messag_tenant__4a3564" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__4b3869" ON "core_message_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__4a3564" ON "core_message_configs" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_messag_type_59dd7d" ON "core_message_configs" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_messag_uuid_59b5d3" ON "core_message_configs" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_messag_code_cc0e14" ON "core_message_configs" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_messag_created_89b2ca" ON "core_message_configs" ("created_at");
COMMENT ON COLUMN "core_message_configs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_message_configs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_message_configs"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_message_configs"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_message_configs"."id" IS '消息配置ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_message_configs"."name" IS '配置名称';
COMMENT ON COLUMN "core_message_configs"."code" IS '配置代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_message_configs"."type" IS '消息类型（email、sms、internal、push）';
COMMENT ON COLUMN "core_message_configs"."description" IS '配置描述';
COMMENT ON COLUMN "core_message_configs"."config" IS '配置信息（JSON格式）';
COMMENT ON COLUMN "core_message_configs"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_message_configs"."is_default" IS '是否默认配置';
COMMENT ON COLUMN "core_message_configs"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_message_configs" IS '消息配置模型';
CREATE TABLE IF NOT EXISTS "core_message_templates" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "subject" VARCHAR(200),
    "content" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_messag_tenant__2261c1" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__636b3e" ON "core_message_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__2261c1" ON "core_message_templates" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_messag_type_e7fc7a" ON "core_message_templates" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_messag_uuid_078765" ON "core_message_templates" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_messag_code_63f163" ON "core_message_templates" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_messag_created_629033" ON "core_message_templates" ("created_at");
COMMENT ON COLUMN "core_message_templates"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_message_templates"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_message_templates"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_message_templates"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_message_templates"."id" IS '消息模板ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_message_templates"."name" IS '模板名称';
COMMENT ON COLUMN "core_message_templates"."code" IS '模板代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_message_templates"."type" IS '消息类型（email、sms、internal、push）';
COMMENT ON COLUMN "core_message_templates"."description" IS '模板描述';
COMMENT ON COLUMN "core_message_templates"."subject" IS '主题（邮件、推送通知）';
COMMENT ON COLUMN "core_message_templates"."content" IS '模板内容（支持变量）';
COMMENT ON COLUMN "core_message_templates"."variables" IS '模板变量定义（JSON格式）';
COMMENT ON COLUMN "core_message_templates"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_message_templates"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_message_templates" IS '消息模板模型';
CREATE TABLE IF NOT EXISTS "core_message_logs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "template_uuid" VARCHAR(36),
    "config_uuid" VARCHAR(36),
    "type" VARCHAR(20) NOT NULL,
    "recipient" VARCHAR(200) NOT NULL,
    "subject" VARCHAR(200),
    "content" TEXT NOT NULL,
    "variables" JSONB,
    "status" VARCHAR(20) NOT NULL,
    "inngest_run_id" VARCHAR(100),
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__4b810c" ON "core_message_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_messag_uuid_a9e177" ON "core_message_logs" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_messag_templat_18c930" ON "core_message_logs" ("template_uuid");
CREATE INDEX IF NOT EXISTS "idx_core_messag_config__856184" ON "core_message_logs" ("config_uuid");
CREATE INDEX IF NOT EXISTS "idx_core_messag_type_9aad73" ON "core_message_logs" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_messag_status_18cd8a" ON "core_message_logs" ("status");
CREATE INDEX IF NOT EXISTS "idx_core_messag_inngest_167e18" ON "core_message_logs" ("inngest_run_id");
CREATE INDEX IF NOT EXISTS "idx_core_messag_created_646472" ON "core_message_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__65a7af" ON "core_message_logs" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__f752b5" ON "core_message_logs" ("tenant_id", "type", "status");
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__3cefcf" ON "core_message_logs" ("tenant_id", "recipient", "status");
CREATE INDEX IF NOT EXISTS "idx_core_messag_tenant__b5111d" ON "core_message_logs" ("tenant_id", "created_at");
COMMENT ON COLUMN "core_message_logs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_message_logs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_message_logs"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_message_logs"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_message_logs"."id" IS '消息记录ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_message_logs"."template_uuid" IS '关联模板UUID';
COMMENT ON COLUMN "core_message_logs"."config_uuid" IS '关联配置UUID';
COMMENT ON COLUMN "core_message_logs"."type" IS '消息类型';
COMMENT ON COLUMN "core_message_logs"."recipient" IS '接收者（邮箱、手机号、用户ID等）';
COMMENT ON COLUMN "core_message_logs"."subject" IS '主题';
COMMENT ON COLUMN "core_message_logs"."content" IS '消息内容';
COMMENT ON COLUMN "core_message_logs"."variables" IS '模板变量值（JSON格式）';
COMMENT ON COLUMN "core_message_logs"."status" IS '发送状态（pending、sending、success、failed）';
COMMENT ON COLUMN "core_message_logs"."inngest_run_id" IS 'Inngest 运行ID（关联 Inngest 工作流实例）';
COMMENT ON COLUMN "core_message_logs"."error_message" IS '错误信息';
COMMENT ON COLUMN "core_message_logs"."sent_at" IS '发送时间';
COMMENT ON COLUMN "core_message_logs"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_message_logs" IS '消息发送记录模型';
CREATE TABLE IF NOT EXISTS "core_scheduled_tasks" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "trigger_type" VARCHAR(20) NOT NULL,
    "trigger_config" JSONB NOT NULL,
    "task_config" JSONB NOT NULL,
    "inngest_function_id" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_running" BOOL NOT NULL  DEFAULT False,
    "last_run_at" TIMESTAMPTZ,
    "last_run_status" VARCHAR(20),
    "last_error" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_schedu_tenant__12d2a9" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_schedu_tenant__37561e" ON "core_scheduled_tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_schedu_tenant__12d2a9" ON "core_scheduled_tasks" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_schedu_type_2b698b" ON "core_scheduled_tasks" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_schedu_trigger_ed3a9e" ON "core_scheduled_tasks" ("trigger_type");
CREATE INDEX IF NOT EXISTS "idx_core_schedu_uuid_fb86bb" ON "core_scheduled_tasks" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_schedu_code_ad80f9" ON "core_scheduled_tasks" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_schedu_is_acti_d484a2" ON "core_scheduled_tasks" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_core_schedu_created_9c884a" ON "core_scheduled_tasks" ("created_at");
COMMENT ON COLUMN "core_scheduled_tasks"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_scheduled_tasks"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_scheduled_tasks"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_scheduled_tasks"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_scheduled_tasks"."id" IS '定时任务ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_scheduled_tasks"."name" IS '任务名称';
COMMENT ON COLUMN "core_scheduled_tasks"."code" IS '任务代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_scheduled_tasks"."description" IS '任务描述';
COMMENT ON COLUMN "core_scheduled_tasks"."type" IS '任务类型（python_script、api_call等）';
COMMENT ON COLUMN "core_scheduled_tasks"."trigger_type" IS '触发器类型（cron、interval、date）';
COMMENT ON COLUMN "core_scheduled_tasks"."trigger_config" IS '触发器配置（JSON格式）';
COMMENT ON COLUMN "core_scheduled_tasks"."task_config" IS '任务配置（JSON格式）';
COMMENT ON COLUMN "core_scheduled_tasks"."inngest_function_id" IS 'Inngest 函数ID（关联 Inngest 函数）';
COMMENT ON COLUMN "core_scheduled_tasks"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_scheduled_tasks"."is_running" IS '是否正在运行';
COMMENT ON COLUMN "core_scheduled_tasks"."last_run_at" IS '最后运行时间';
COMMENT ON COLUMN "core_scheduled_tasks"."last_run_status" IS '最后运行状态（success、failed）';
COMMENT ON COLUMN "core_scheduled_tasks"."last_error" IS '最后错误信息';
COMMENT ON COLUMN "core_scheduled_tasks"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_scheduled_tasks" IS '定时任务模型';
CREATE TABLE IF NOT EXISTS "core_approval_processes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "nodes" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "inngest_workflow_id" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_approv_tenant__3c5a58" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__b43c99" ON "core_approval_processes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__3c5a58" ON "core_approval_processes" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_approv_uuid_33f9bb" ON "core_approval_processes" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_approv_code_deea26" ON "core_approval_processes" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_approv_is_acti_6e8fa4" ON "core_approval_processes" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_core_approv_created_9596fd" ON "core_approval_processes" ("created_at");
COMMENT ON COLUMN "core_approval_processes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_approval_processes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_approval_processes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_approval_processes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_approval_processes"."id" IS '审批流程ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_approval_processes"."name" IS '流程名称';
COMMENT ON COLUMN "core_approval_processes"."code" IS '流程代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_approval_processes"."description" IS '流程描述';
COMMENT ON COLUMN "core_approval_processes"."nodes" IS '流程节点配置（JSON格式，ProFlow 设计）';
COMMENT ON COLUMN "core_approval_processes"."config" IS '流程配置（JSON格式）';
COMMENT ON COLUMN "core_approval_processes"."inngest_workflow_id" IS 'Inngest 工作流ID（关联 Inngest 工作流）';
COMMENT ON COLUMN "core_approval_processes"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_approval_processes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_approval_processes" IS '审批流程模型';
CREATE TABLE IF NOT EXISTS "core_approval_instances" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT,
    "data" JSONB,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "current_node" VARCHAR(100),
    "current_approver_id" INT,
    "inngest_run_id" VARCHAR(100),
    "submitter_id" INT NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "process_id" INT NOT NULL REFERENCES "core_approval_processes" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__972170" ON "core_approval_instances" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_uuid_a527c6" ON "core_approval_instances" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_approv_process_981a56" ON "core_approval_instances" ("process_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_status_e987f2" ON "core_approval_instances" ("status");
CREATE INDEX IF NOT EXISTS "idx_core_approv_current_a7a501" ON "core_approval_instances" ("current_approver_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_submitt_3dda20" ON "core_approval_instances" ("submitter_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_inngest_836974" ON "core_approval_instances" ("inngest_run_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_created_e0d115" ON "core_approval_instances" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__81f6df" ON "core_approval_instances" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__3dfdd8" ON "core_approval_instances" ("tenant_id", "current_approver_id", "status");
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__403913" ON "core_approval_instances" ("tenant_id", "submitter_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__36c6ee" ON "core_approval_instances" ("tenant_id", "created_at");
COMMENT ON COLUMN "core_approval_instances"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_approval_instances"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_approval_instances"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_approval_instances"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_approval_instances"."id" IS '审批实例ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_approval_instances"."title" IS '审批标题';
COMMENT ON COLUMN "core_approval_instances"."content" IS '审批内容';
COMMENT ON COLUMN "core_approval_instances"."data" IS '审批数据（JSON格式）';
COMMENT ON COLUMN "core_approval_instances"."status" IS '审批状态（pending、approved、rejected、cancelled）';
COMMENT ON COLUMN "core_approval_instances"."current_node" IS '当前节点';
COMMENT ON COLUMN "core_approval_instances"."current_approver_id" IS '当前审批人ID';
COMMENT ON COLUMN "core_approval_instances"."inngest_run_id" IS 'Inngest 运行ID（关联 Inngest 工作流实例）';
COMMENT ON COLUMN "core_approval_instances"."submitter_id" IS '提交人ID';
COMMENT ON COLUMN "core_approval_instances"."submitted_at" IS '提交时间';
COMMENT ON COLUMN "core_approval_instances"."completed_at" IS '完成时间';
COMMENT ON COLUMN "core_approval_instances"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "core_approval_instances"."process_id" IS '关联流程（外键）';
COMMENT ON TABLE "core_approval_instances" IS '审批实例模型';
CREATE TABLE IF NOT EXISTS "core_approval_histories" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "approval_instance_id" INT NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "action_by" INT NOT NULL,
    "action_at" TIMESTAMPTZ NOT NULL,
    "comment" TEXT,
    "from_node" VARCHAR(100),
    "to_node" VARCHAR(100),
    "from_approver_id" INT,
    "to_approver_id" INT
);
CREATE INDEX IF NOT EXISTS "idx_core_approv_tenant__89d1d6" ON "core_approval_histories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_approva_a2dd10" ON "core_approval_histories" ("approval_instance_id");
CREATE INDEX IF NOT EXISTS "idx_core_approv_uuid_9a1b94" ON "core_approval_histories" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action_bd31f0" ON "core_approval_histories" ("action");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action__0f4144" ON "core_approval_histories" ("action_by");
CREATE INDEX IF NOT EXISTS "idx_core_approv_action__b16310" ON "core_approval_histories" ("action_at");
COMMENT ON COLUMN "core_approval_histories"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_approval_histories"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_approval_histories"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_approval_histories"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_approval_histories"."id" IS '主键ID';
COMMENT ON COLUMN "core_approval_histories"."approval_instance_id" IS '审批实例ID（关联ApprovalInstance）';
COMMENT ON COLUMN "core_approval_histories"."action" IS '操作类型（approve、reject、cancel、transfer）';
COMMENT ON COLUMN "core_approval_histories"."action_by" IS '操作人ID（用户ID）';
COMMENT ON COLUMN "core_approval_histories"."action_at" IS '操作时间';
COMMENT ON COLUMN "core_approval_histories"."comment" IS '审批意见';
COMMENT ON COLUMN "core_approval_histories"."from_node" IS '来源节点';
COMMENT ON COLUMN "core_approval_histories"."to_node" IS '目标节点';
COMMENT ON COLUMN "core_approval_histories"."from_approver_id" IS '原审批人ID';
COMMENT ON COLUMN "core_approval_histories"."to_approver_id" IS '新审批人ID';
COMMENT ON TABLE "core_approval_histories" IS '审批历史记录模型';
CREATE TABLE IF NOT EXISTS "core_scripts" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "config" JSONB,
    "inngest_function_id" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_running" BOOL NOT NULL  DEFAULT False,
    "last_run_at" TIMESTAMPTZ,
    "last_run_status" VARCHAR(20),
    "last_error" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_script_tenant__040aeb" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_script_tenant__200baa" ON "core_scripts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_script_tenant__040aeb" ON "core_scripts" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_script_uuid_7b5df0" ON "core_scripts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_script_code_f60fd3" ON "core_scripts" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_script_type_e13e06" ON "core_scripts" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_script_is_acti_1b4783" ON "core_scripts" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_core_script_created_e0894e" ON "core_scripts" ("created_at");
COMMENT ON COLUMN "core_scripts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_scripts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_scripts"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_scripts"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_scripts"."id" IS '脚本ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_scripts"."name" IS '脚本名称';
COMMENT ON COLUMN "core_scripts"."code" IS '脚本代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_scripts"."type" IS '脚本类型（python、shell、sql等）';
COMMENT ON COLUMN "core_scripts"."description" IS '脚本描述';
COMMENT ON COLUMN "core_scripts"."content" IS '脚本内容';
COMMENT ON COLUMN "core_scripts"."config" IS '脚本配置（JSON格式，如参数、环境变量等）';
COMMENT ON COLUMN "core_scripts"."inngest_function_id" IS 'Inngest 函数ID（如果通过 Inngest 执行）';
COMMENT ON COLUMN "core_scripts"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_scripts"."is_running" IS '是否正在运行';
COMMENT ON COLUMN "core_scripts"."last_run_at" IS '最后执行时间';
COMMENT ON COLUMN "core_scripts"."last_run_status" IS '最后执行状态（success、failed、running）';
COMMENT ON COLUMN "core_scripts"."last_error" IS '最后执行错误信息';
COMMENT ON COLUMN "core_scripts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_scripts" IS '脚本模型';
CREATE TABLE IF NOT EXISTS "core_print_templates" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "config" JSONB,
    "inngest_function_id" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_default" BOOL NOT NULL  DEFAULT False,
    "usage_count" INT NOT NULL  DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_print__tenant__a9bc16" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_print__tenant__60f916" ON "core_print_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_print__tenant__a9bc16" ON "core_print_templates" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_print__uuid_94507c" ON "core_print_templates" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_print__code_5551af" ON "core_print_templates" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_print__type_c3ae52" ON "core_print_templates" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_print__is_acti_1a1633" ON "core_print_templates" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_core_print__is_defa_2525c5" ON "core_print_templates" ("is_default");
CREATE INDEX IF NOT EXISTS "idx_core_print__created_a67069" ON "core_print_templates" ("created_at");
COMMENT ON COLUMN "core_print_templates"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_print_templates"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_print_templates"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_print_templates"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_print_templates"."id" IS '打印模板ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_print_templates"."name" IS '模板名称';
COMMENT ON COLUMN "core_print_templates"."code" IS '模板代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_print_templates"."type" IS '模板类型（pdf、html、word等）';
COMMENT ON COLUMN "core_print_templates"."description" IS '模板描述';
COMMENT ON COLUMN "core_print_templates"."content" IS '模板内容（HTML、XML等格式）';
COMMENT ON COLUMN "core_print_templates"."config" IS '模板配置（JSON格式，如页面设置、样式等）';
COMMENT ON COLUMN "core_print_templates"."inngest_function_id" IS 'Inngest 函数ID（如果通过 Inngest 执行打印）';
COMMENT ON COLUMN "core_print_templates"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_print_templates"."is_default" IS '是否默认模板';
COMMENT ON COLUMN "core_print_templates"."usage_count" IS '使用次数';
COMMENT ON COLUMN "core_print_templates"."last_used_at" IS '最后使用时间';
COMMENT ON COLUMN "core_print_templates"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_print_templates" IS '打印模板模型';
CREATE TABLE IF NOT EXISTS "core_print_devices" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "inngest_function_id" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "is_default" BOOL NOT NULL  DEFAULT False,
    "is_online" BOOL NOT NULL  DEFAULT False,
    "last_connected_at" TIMESTAMPTZ,
    "usage_count" INT NOT NULL  DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_core_print__tenant__a433b8" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_print__tenant__933587" ON "core_print_devices" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_print__tenant__a433b8" ON "core_print_devices" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_core_print__uuid_192d01" ON "core_print_devices" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_print__code_c4a4f2" ON "core_print_devices" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_print__type_7f67c6" ON "core_print_devices" ("type");
CREATE INDEX IF NOT EXISTS "idx_core_print__is_acti_b80b95" ON "core_print_devices" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_core_print__is_defa_f0ac0b" ON "core_print_devices" ("is_default");
CREATE INDEX IF NOT EXISTS "idx_core_print__is_onli_5dc710" ON "core_print_devices" ("is_online");
CREATE INDEX IF NOT EXISTS "idx_core_print__created_cb57ea" ON "core_print_devices" ("created_at");
COMMENT ON COLUMN "core_print_devices"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_print_devices"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_print_devices"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_print_devices"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_print_devices"."id" IS '打印设备ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_print_devices"."name" IS '设备名称';
COMMENT ON COLUMN "core_print_devices"."code" IS '设备代码（唯一，用于程序识别）';
COMMENT ON COLUMN "core_print_devices"."type" IS '设备类型（local、network、cloud等）';
COMMENT ON COLUMN "core_print_devices"."description" IS '设备描述';
COMMENT ON COLUMN "core_print_devices"."config" IS '设备配置（JSON格式，如连接信息、打印参数等）';
COMMENT ON COLUMN "core_print_devices"."inngest_function_id" IS 'Inngest 函数ID（如果通过 Inngest 执行打印）';
COMMENT ON COLUMN "core_print_devices"."is_active" IS '是否启用';
COMMENT ON COLUMN "core_print_devices"."is_default" IS '是否默认设备';
COMMENT ON COLUMN "core_print_devices"."is_online" IS '是否在线';
COMMENT ON COLUMN "core_print_devices"."last_connected_at" IS '最后连接时间';
COMMENT ON COLUMN "core_print_devices"."usage_count" IS '使用次数';
COMMENT ON COLUMN "core_print_devices"."last_used_at" IS '最后使用时间';
COMMENT ON COLUMN "core_print_devices"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "core_print_devices" IS '打印设备模型';
CREATE TABLE IF NOT EXISTS "core_user_preferences" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "user_id" INT NOT NULL UNIQUE,
    "preferences" JSONB NOT NULL,
    CONSTRAINT "uid_core_user_p_user_id_316e36" UNIQUE ("user_id")
);
CREATE INDEX IF NOT EXISTS "idx_core_user_p_tenant__803871" ON "core_user_preferences" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_user_p_uuid_64e99a" ON "core_user_preferences" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_user_p_user_id_316e36" ON "core_user_preferences" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_core_user_p_created_3d00b5" ON "core_user_preferences" ("created_at");
COMMENT ON COLUMN "core_user_preferences"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_user_preferences"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_user_preferences"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_user_preferences"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_user_preferences"."id" IS '用户偏好ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_user_preferences"."user_id" IS '关联用户ID（外键，一对一）';
COMMENT ON COLUMN "core_user_preferences"."preferences" IS '偏好设置（JSON格式）';
COMMENT ON TABLE "core_user_preferences" IS '用户偏好模型';
CREATE TABLE IF NOT EXISTS "core_operation_logs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "user_id" INT NOT NULL,
    "operation_type" VARCHAR(50) NOT NULL,
    "operation_module" VARCHAR(100),
    "operation_object_type" VARCHAR(100),
    "operation_object_id" INT,
    "operation_object_uuid" VARCHAR(36),
    "operation_content" TEXT,
    "ip_address" VARCHAR(50),
    "user_agent" TEXT,
    "request_method" VARCHAR(10),
    "request_path" VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS "idx_core_operat_tenant__5d400c" ON "core_operation_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_operat_uuid_d466d5" ON "core_operation_logs" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_operat_user_id_f42e8b" ON "core_operation_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_core_operat_operati_3283ca" ON "core_operation_logs" ("operation_type");
CREATE INDEX IF NOT EXISTS "idx_core_operat_operati_fec981" ON "core_operation_logs" ("operation_module");
CREATE INDEX IF NOT EXISTS "idx_core_operat_operati_30213a" ON "core_operation_logs" ("operation_object_type");
CREATE INDEX IF NOT EXISTS "idx_core_operat_created_65f72c" ON "core_operation_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_core_operat_tenant__aabadd" ON "core_operation_logs" ("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_core_operat_tenant__04dcac" ON "core_operation_logs" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_core_operat_tenant__15f661" ON "core_operation_logs" ("tenant_id", "operation_module");
CREATE INDEX IF NOT EXISTS "idx_core_operat_tenant__541877" ON "core_operation_logs" ("tenant_id", "user_id", "created_at");
COMMENT ON COLUMN "core_operation_logs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_operation_logs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_operation_logs"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_operation_logs"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_operation_logs"."id" IS '操作日志ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_operation_logs"."user_id" IS '操作用户ID（外键）';
COMMENT ON COLUMN "core_operation_logs"."operation_type" IS '操作类型（create、update、delete、view等）';
COMMENT ON COLUMN "core_operation_logs"."operation_module" IS '操作模块（用户管理、角色管理等）';
COMMENT ON COLUMN "core_operation_logs"."operation_object_type" IS '操作对象类型（User、Role等）';
COMMENT ON COLUMN "core_operation_logs"."operation_object_id" IS '操作对象ID';
COMMENT ON COLUMN "core_operation_logs"."operation_object_uuid" IS '操作对象UUID';
COMMENT ON COLUMN "core_operation_logs"."operation_content" IS '操作内容（操作描述）';
COMMENT ON COLUMN "core_operation_logs"."ip_address" IS '操作IP';
COMMENT ON COLUMN "core_operation_logs"."user_agent" IS '用户代理（浏览器信息）';
COMMENT ON COLUMN "core_operation_logs"."request_method" IS '请求方法（GET、POST等）';
COMMENT ON COLUMN "core_operation_logs"."request_path" IS '请求路径';
COMMENT ON TABLE "core_operation_logs" IS '操作日志模型';
CREATE TABLE IF NOT EXISTS "core_login_logs" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "user_id" INT,
    "username" VARCHAR(100),
    "login_ip" VARCHAR(50) NOT NULL,
    "login_location" VARCHAR(200),
    "login_device" VARCHAR(50),
    "login_browser" VARCHAR(200),
    "login_status" VARCHAR(20) NOT NULL,
    "failure_reason" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_core_login__tenant__0aeb36" ON "core_login_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_login__user_id_8c2145" ON "core_login_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_core_login__uuid_833dc8" ON "core_login_logs" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_core_login__usernam_f6aabb" ON "core_login_logs" ("username");
CREATE INDEX IF NOT EXISTS "idx_core_login__login_i_8d0362" ON "core_login_logs" ("login_ip");
CREATE INDEX IF NOT EXISTS "idx_core_login__login_s_bc1cbf" ON "core_login_logs" ("login_status");
CREATE INDEX IF NOT EXISTS "idx_core_login__created_28985e" ON "core_login_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_core_login__tenant__bffd22" ON "core_login_logs" ("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_core_login__tenant__b6878a" ON "core_login_logs" ("tenant_id", "login_status");
CREATE INDEX IF NOT EXISTS "idx_core_login__tenant__86d003" ON "core_login_logs" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_core_login__tenant__e17430" ON "core_login_logs" ("tenant_id", "user_id", "created_at");
COMMENT ON COLUMN "core_login_logs"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "core_login_logs"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "core_login_logs"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "core_login_logs"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "core_login_logs"."id" IS '登录日志ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "core_login_logs"."user_id" IS '登录用户ID（登录失败时可能为空）';
COMMENT ON COLUMN "core_login_logs"."username" IS '登录账号（冗余字段，用于查询）';
COMMENT ON COLUMN "core_login_logs"."login_ip" IS '登录IP地址';
COMMENT ON COLUMN "core_login_logs"."login_location" IS '登录地点（根据IP解析，可选）';
COMMENT ON COLUMN "core_login_logs"."login_device" IS '登录设备（PC、Mobile等，可选）';
COMMENT ON COLUMN "core_login_logs"."login_browser" IS '登录浏览器（可选）';
COMMENT ON COLUMN "core_login_logs"."login_status" IS '登录状态（success、failed）';
COMMENT ON COLUMN "core_login_logs"."failure_reason" IS '失败原因（登录失败时记录）';
COMMENT ON TABLE "core_login_logs" IS '登录日志模型';
CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS "apps_master_data_workshops" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__f6dbcf" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__cbc4a6" ON "apps_master_data_workshops" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_037f82" ON "apps_master_data_workshops" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_80e998" ON "apps_master_data_workshops" ("uuid");
COMMENT ON COLUMN "apps_master_data_workshops"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_workshops"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_workshops"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_workshops"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_workshops"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_workshops"."code" IS '车间编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_workshops"."name" IS '车间名称';
COMMENT ON COLUMN "apps_master_data_workshops"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_workshops"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_workshops"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_workshops" IS '车间模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_production_lines" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "workshop_id" INT NOT NULL REFERENCES "apps_master_data_workshops" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__967d2c" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__9512e7" ON "apps_master_data_production_lines" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_af9b1d" ON "apps_master_data_production_lines" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_7eebec" ON "apps_master_data_production_lines" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_worksho_f5f4f2" ON "apps_master_data_production_lines" ("workshop_id");
COMMENT ON COLUMN "apps_master_data_production_lines"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_production_lines"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_production_lines"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_production_lines"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_production_lines"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_production_lines"."code" IS '产线编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_production_lines"."name" IS '产线名称';
COMMENT ON COLUMN "apps_master_data_production_lines"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_production_lines"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_production_lines"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_production_lines"."workshop_id" IS '所属车间';
COMMENT ON TABLE "apps_master_data_production_lines" IS '产线模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_workstations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "production_line_id" INT NOT NULL REFERENCES "apps_master_data_production_lines" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__9800ad" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__ad76dc" ON "apps_master_data_workstations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_fa7bb0" ON "apps_master_data_workstations" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_be3b9c" ON "apps_master_data_workstations" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_product_03076b" ON "apps_master_data_workstations" ("production_line_id");
COMMENT ON COLUMN "apps_master_data_workstations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_workstations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_workstations"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_workstations"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_workstations"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_workstations"."code" IS '工位编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_workstations"."name" IS '工位名称';
COMMENT ON COLUMN "apps_master_data_workstations"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_workstations"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_workstations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_workstations"."production_line_id" IS '所属产线';
COMMENT ON TABLE "apps_master_data_workstations" IS '工位模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_warehouses" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__3b681d" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__bea439" ON "apps_master_data_warehouses" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_0af912" ON "apps_master_data_warehouses" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_d953a6" ON "apps_master_data_warehouses" ("uuid");
COMMENT ON COLUMN "apps_master_data_warehouses"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_warehouses"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_warehouses"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_warehouses"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_warehouses"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_warehouses"."code" IS '仓库编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_warehouses"."name" IS '仓库名称';
COMMENT ON COLUMN "apps_master_data_warehouses"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_warehouses"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_warehouses"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_warehouses" IS '仓库模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_storage_areas" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "warehouse_id" INT NOT NULL REFERENCES "apps_master_data_warehouses" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__570bd8" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__31981e" ON "apps_master_data_storage_areas" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_38f73e" ON "apps_master_data_storage_areas" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_880c00" ON "apps_master_data_storage_areas" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_warehou_8a9ecb" ON "apps_master_data_storage_areas" ("warehouse_id");
COMMENT ON COLUMN "apps_master_data_storage_areas"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_storage_areas"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_storage_areas"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_storage_areas"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_storage_areas"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_storage_areas"."code" IS '库区编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_storage_areas"."name" IS '库区名称';
COMMENT ON COLUMN "apps_master_data_storage_areas"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_storage_areas"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_storage_areas"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_storage_areas"."warehouse_id" IS '所属仓库';
COMMENT ON TABLE "apps_master_data_storage_areas" IS '库区模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_storage_locations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "storage_area_id" INT NOT NULL REFERENCES "apps_master_data_storage_areas" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__bef358" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__e49e92" ON "apps_master_data_storage_locations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_e2014d" ON "apps_master_data_storage_locations" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_023a90" ON "apps_master_data_storage_locations" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_storage_7d6f12" ON "apps_master_data_storage_locations" ("storage_area_id");
COMMENT ON COLUMN "apps_master_data_storage_locations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_storage_locations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_storage_locations"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_storage_locations"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_storage_locations"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_storage_locations"."code" IS '库位编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_storage_locations"."name" IS '库位名称';
COMMENT ON COLUMN "apps_master_data_storage_locations"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_storage_locations"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_storage_locations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_storage_locations"."storage_area_id" IS '所属库区';
COMMENT ON TABLE "apps_master_data_storage_locations" IS '库位模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_material_groups" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "parent_id" INT REFERENCES "apps_master_data_material_groups" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__2cbfae" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__f97090" ON "apps_master_data_material_groups" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_57dd9d" ON "apps_master_data_material_groups" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_2c316d" ON "apps_master_data_material_groups" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_parent__b6e74b" ON "apps_master_data_material_groups" ("parent_id");
COMMENT ON COLUMN "apps_master_data_material_groups"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_material_groups"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_material_groups"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_groups"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_material_groups"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_material_groups"."code" IS '分组编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_material_groups"."name" IS '分组名称';
COMMENT ON COLUMN "apps_master_data_material_groups"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_material_groups"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_material_groups"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_material_groups"."parent_id" IS '父分组（用于层级结构）';
COMMENT ON TABLE "apps_master_data_material_groups" IS '物料分组模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_materials" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "specification" VARCHAR(500),
    "base_unit" VARCHAR(20) NOT NULL,
    "units" JSONB,
    "batch_managed" BOOL NOT NULL  DEFAULT False,
    "variant_managed" BOOL NOT NULL  DEFAULT False,
    "variant_attributes" JSONB,
    "description" TEXT,
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "group_id" INT REFERENCES "apps_master_data_material_groups" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__c20101" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__0861e3" ON "apps_master_data_materials" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_d9408f" ON "apps_master_data_materials" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_372b04" ON "apps_master_data_materials" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_group_i_fbd798" ON "apps_master_data_materials" ("group_id");
COMMENT ON COLUMN "apps_master_data_materials"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_materials"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_materials"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_materials"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_materials"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_materials"."code" IS '物料编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_materials"."name" IS '物料名称';
COMMENT ON COLUMN "apps_master_data_materials"."specification" IS '规格';
COMMENT ON COLUMN "apps_master_data_materials"."base_unit" IS '基础单位';
COMMENT ON COLUMN "apps_master_data_materials"."units" IS '多单位管理（JSON格式，存储单位列表及换算关系）';
COMMENT ON COLUMN "apps_master_data_materials"."batch_managed" IS '是否启用批号管理';
COMMENT ON COLUMN "apps_master_data_materials"."variant_managed" IS '是否启用变体管理';
COMMENT ON COLUMN "apps_master_data_materials"."variant_attributes" IS '变体属性（JSON格式，如颜色、尺寸等）';
COMMENT ON COLUMN "apps_master_data_materials"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_materials"."brand" IS '品牌';
COMMENT ON COLUMN "apps_master_data_materials"."model" IS '型号';
COMMENT ON COLUMN "apps_master_data_materials"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_materials"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_materials"."group_id" IS '物料分组';
COMMENT ON TABLE "apps_master_data_materials" IS '物料模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_bom" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "version" VARCHAR(50) NOT NULL  DEFAULT '1.0',
    "bom_code" VARCHAR(100),
    "effective_date" TIMESTAMPTZ,
    "expiry_date" TIMESTAMPTZ,
    "approval_status" VARCHAR(20) NOT NULL  DEFAULT 'draft',
    "approved_by" INT,
    "approved_at" TIMESTAMPTZ,
    "approval_comment" TEXT,
    "is_alternative" BOOL NOT NULL  DEFAULT False,
    "alternative_group_id" INT,
    "priority" INT NOT NULL  DEFAULT 0,
    "description" TEXT,
    "remark" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "component_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE,
    "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__86afbc" ON "apps_master_data_bom" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_materia_741be7" ON "apps_master_data_bom" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_compone_4a2b81" ON "apps_master_data_bom" ("component_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_f1029b" ON "apps_master_data_bom" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_alterna_0d935b" ON "apps_master_data_bom" ("alternative_group_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_bom_cod_c9fd66" ON "apps_master_data_bom" ("bom_code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_version_5ab897" ON "apps_master_data_bom" ("version");
CREATE INDEX IF NOT EXISTS "idx_apps_master_approva_9c39a8" ON "apps_master_data_bom" ("approval_status");
COMMENT ON COLUMN "apps_master_data_bom"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_bom"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_bom"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_bom"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_bom"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_bom"."quantity" IS '用量';
COMMENT ON COLUMN "apps_master_data_bom"."unit" IS '单位';
COMMENT ON COLUMN "apps_master_data_bom"."version" IS 'BOM版本号';
COMMENT ON COLUMN "apps_master_data_bom"."bom_code" IS 'BOM编码（同一主物料的不同版本使用相同编码）';
COMMENT ON COLUMN "apps_master_data_bom"."effective_date" IS '生效日期';
COMMENT ON COLUMN "apps_master_data_bom"."expiry_date" IS '失效日期';
COMMENT ON COLUMN "apps_master_data_bom"."approval_status" IS '审核状态：draft(草稿), pending(待审核), approved(已审核), rejected(已拒绝)';
COMMENT ON COLUMN "apps_master_data_bom"."approved_by" IS '审核人ID';
COMMENT ON COLUMN "apps_master_data_bom"."approved_at" IS '审核时间';
COMMENT ON COLUMN "apps_master_data_bom"."approval_comment" IS '审核意见';
COMMENT ON COLUMN "apps_master_data_bom"."is_alternative" IS '是否为替代料';
COMMENT ON COLUMN "apps_master_data_bom"."alternative_group_id" IS '替代料组ID（同一组的替代料互斥）';
COMMENT ON COLUMN "apps_master_data_bom"."priority" IS '优先级（数字越小优先级越高）';
COMMENT ON COLUMN "apps_master_data_bom"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_bom"."remark" IS '备注';
COMMENT ON COLUMN "apps_master_data_bom"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_bom"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_bom"."component_id" IS '子物料';
COMMENT ON COLUMN "apps_master_data_bom"."material_id" IS '主物料';
COMMENT ON TABLE "apps_master_data_bom" IS '物料清单（BOM）模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_defect_types" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50),
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__f54cec" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__20489d" ON "apps_master_data_defect_types" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_6746da" ON "apps_master_data_defect_types" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_f204b3" ON "apps_master_data_defect_types" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_categor_971e13" ON "apps_master_data_defect_types" ("category");
COMMENT ON COLUMN "apps_master_data_defect_types"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_defect_types"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_defect_types"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_defect_types"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_defect_types"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_defect_types"."code" IS '不良品编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_defect_types"."name" IS '不良品名称';
COMMENT ON COLUMN "apps_master_data_defect_types"."category" IS '分类';
COMMENT ON COLUMN "apps_master_data_defect_types"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_defect_types"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_defect_types"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_defect_types" IS '不良品模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_operations" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__6fe57a" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__793bc1" ON "apps_master_data_operations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_271e65" ON "apps_master_data_operations" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_4f3c7f" ON "apps_master_data_operations" ("uuid");
COMMENT ON COLUMN "apps_master_data_operations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_operations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_operations"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_operations"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_operations"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_operations"."code" IS '工序编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_operations"."name" IS '工序名称';
COMMENT ON COLUMN "apps_master_data_operations"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_operations"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_operations"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_operations" IS '工序模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_process_routes" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "operation_sequence" JSONB,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__f82cd5" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__144670" ON "apps_master_data_process_routes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_b3281d" ON "apps_master_data_process_routes" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_f9e0b9" ON "apps_master_data_process_routes" ("uuid");
COMMENT ON COLUMN "apps_master_data_process_routes"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_process_routes"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_process_routes"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_process_routes"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_process_routes"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_process_routes"."code" IS '工艺路线编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_process_routes"."name" IS '工艺路线名称';
COMMENT ON COLUMN "apps_master_data_process_routes"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_process_routes"."operation_sequence" IS '工序序列（JSON格式，存储工序ID及顺序）';
COMMENT ON COLUMN "apps_master_data_process_routes"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_process_routes"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_process_routes" IS '工艺路线模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_sop" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "version" VARCHAR(20),
    "content" TEXT,
    "attachments" JSONB,
    "flow_config" JSONB,
    "form_config" JSONB,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    "operation_id" INT REFERENCES "apps_master_data_operations" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_apps_master_tenant__641636" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__fc5c88" ON "apps_master_data_sop" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_debac1" ON "apps_master_data_sop" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_bb78b2" ON "apps_master_data_sop" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_operati_e8805a" ON "apps_master_data_sop" ("operation_id");
COMMENT ON COLUMN "apps_master_data_sop"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_sop"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_sop"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_sop"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_sop"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_sop"."code" IS 'SOP编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_sop"."name" IS 'SOP名称';
COMMENT ON COLUMN "apps_master_data_sop"."version" IS '版本号';
COMMENT ON COLUMN "apps_master_data_sop"."content" IS 'SOP内容（支持富文本）';
COMMENT ON COLUMN "apps_master_data_sop"."attachments" IS '附件列表（JSON格式，存储附件信息）';
COMMENT ON COLUMN "apps_master_data_sop"."flow_config" IS '流程配置（ProFlow JSON格式，包含 nodes 和 edges）';
COMMENT ON COLUMN "apps_master_data_sop"."form_config" IS '表单配置（Formily Schema格式，每个步骤的表单定义）';
COMMENT ON COLUMN "apps_master_data_sop"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_sop"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_sop"."operation_id" IS '关联工序';
COMMENT ON TABLE "apps_master_data_sop" IS '标准作业程序（SOP）模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_sop_executions" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL  DEFAULT 'pending',
    "current_node_id" VARCHAR(100),
    "node_data" JSONB,
    "inngest_run_id" VARCHAR(100),
    "executor_id" INT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "sop_id" INT NOT NULL REFERENCES "apps_master_data_sop" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__6b4dcc" ON "apps_master_data_sop_executions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_40fc19" ON "apps_master_data_sop_executions" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_sop_id_29ac2b" ON "apps_master_data_sop_executions" ("sop_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_status_8b9316" ON "apps_master_data_sop_executions" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_master_executo_6ff108" ON "apps_master_data_sop_executions" ("executor_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_current_06e816" ON "apps_master_data_sop_executions" ("current_node_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_inngest_060835" ON "apps_master_data_sop_executions" ("inngest_run_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_created_05cec7" ON "apps_master_data_sop_executions" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__e84074" ON "apps_master_data_sop_executions" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__473082" ON "apps_master_data_sop_executions" ("tenant_id", "executor_id", "status");
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__5042e6" ON "apps_master_data_sop_executions" ("tenant_id", "created_at");
COMMENT ON COLUMN "apps_master_data_sop_executions"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."id" IS '执行实例ID（主键，自增ID，内部使用）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."title" IS '执行标题';
COMMENT ON COLUMN "apps_master_data_sop_executions"."description" IS '执行描述';
COMMENT ON COLUMN "apps_master_data_sop_executions"."status" IS '执行状态（pending、running、completed、paused、cancelled）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."current_node_id" IS '当前节点ID';
COMMENT ON COLUMN "apps_master_data_sop_executions"."node_data" IS '节点执行数据（JSON格式，格式：{nodeId: {formData: {...}, completedAt: ''...''}}）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."inngest_run_id" IS 'Inngest 运行ID（关联 Inngest 工作流实例）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."executor_id" IS '执行人ID';
COMMENT ON COLUMN "apps_master_data_sop_executions"."started_at" IS '开始时间';
COMMENT ON COLUMN "apps_master_data_sop_executions"."completed_at" IS '完成时间';
COMMENT ON COLUMN "apps_master_data_sop_executions"."deleted_at" IS '删除时间（软删除）';
COMMENT ON COLUMN "apps_master_data_sop_executions"."sop_id" IS '关联SOP（外键）';
COMMENT ON TABLE "apps_master_data_sop_executions" IS 'SOP 执行实例模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_customers" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(100),
    "contact_person" VARCHAR(100),
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "address" TEXT,
    "category" VARCHAR(50),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__22dc7f" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__bde96c" ON "apps_master_data_customers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_b49d70" ON "apps_master_data_customers" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_d08c6f" ON "apps_master_data_customers" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_categor_ed7753" ON "apps_master_data_customers" ("category");
COMMENT ON COLUMN "apps_master_data_customers"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_customers"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_customers"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_customers"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_customers"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_customers"."code" IS '客户编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_customers"."name" IS '客户名称';
COMMENT ON COLUMN "apps_master_data_customers"."short_name" IS '简称';
COMMENT ON COLUMN "apps_master_data_customers"."contact_person" IS '联系人';
COMMENT ON COLUMN "apps_master_data_customers"."phone" IS '电话';
COMMENT ON COLUMN "apps_master_data_customers"."email" IS '邮箱';
COMMENT ON COLUMN "apps_master_data_customers"."address" IS '地址';
COMMENT ON COLUMN "apps_master_data_customers"."category" IS '客户分类';
COMMENT ON COLUMN "apps_master_data_customers"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_customers"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_customers" IS '客户模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_suppliers" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(100),
    "contact_person" VARCHAR(100),
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "address" TEXT,
    "category" VARCHAR(50),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__390ca7" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__9affe4" ON "apps_master_data_suppliers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_995339" ON "apps_master_data_suppliers" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_b7e990" ON "apps_master_data_suppliers" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_categor_614526" ON "apps_master_data_suppliers" ("category");
COMMENT ON COLUMN "apps_master_data_suppliers"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_suppliers"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_suppliers"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_suppliers"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_suppliers"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_suppliers"."code" IS '供应商编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_suppliers"."name" IS '供应商名称';
COMMENT ON COLUMN "apps_master_data_suppliers"."short_name" IS '简称';
COMMENT ON COLUMN "apps_master_data_suppliers"."contact_person" IS '联系人';
COMMENT ON COLUMN "apps_master_data_suppliers"."phone" IS '电话';
COMMENT ON COLUMN "apps_master_data_suppliers"."email" IS '邮箱';
COMMENT ON COLUMN "apps_master_data_suppliers"."address" IS '地址';
COMMENT ON COLUMN "apps_master_data_suppliers"."category" IS '供应商分类';
COMMENT ON COLUMN "apps_master_data_suppliers"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_suppliers"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_suppliers" IS '供应商模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_holidays" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(200) NOT NULL,
    "holiday_date" DATE NOT NULL,
    "holiday_type" VARCHAR(50),
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__a36907" ON "apps_master_data_holidays" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_8679ea" ON "apps_master_data_holidays" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_holiday_5dc729" ON "apps_master_data_holidays" ("holiday_date");
CREATE INDEX IF NOT EXISTS "idx_apps_master_holiday_5b77bb" ON "apps_master_data_holidays" ("holiday_type");
COMMENT ON COLUMN "apps_master_data_holidays"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_holidays"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_holidays"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_holidays"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_holidays"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_holidays"."name" IS '假期名称';
COMMENT ON COLUMN "apps_master_data_holidays"."holiday_date" IS '假期日期';
COMMENT ON COLUMN "apps_master_data_holidays"."holiday_type" IS '假期类型（法定节假日、公司假期等）';
COMMENT ON COLUMN "apps_master_data_holidays"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_holidays"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_holidays"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_holidays" IS '假期模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_skills" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "id" SERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50),
    "description" TEXT,
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__702b20" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__474b63" ON "apps_master_data_skills" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_ba9c58" ON "apps_master_data_skills" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_779d23" ON "apps_master_data_skills" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_categor_e436c4" ON "apps_master_data_skills" ("category");
COMMENT ON COLUMN "apps_master_data_skills"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_skills"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_skills"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_skills"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_skills"."id" IS '主键ID';
COMMENT ON COLUMN "apps_master_data_skills"."code" IS '技能编码（组织内唯一）';
COMMENT ON COLUMN "apps_master_data_skills"."name" IS '技能名称';
COMMENT ON COLUMN "apps_master_data_skills"."category" IS '技能分类';
COMMENT ON COLUMN "apps_master_data_skills"."description" IS '描述';
COMMENT ON COLUMN "apps_master_data_skills"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_skills"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_skills" IS '技能模型';
CREATE TABLE IF NOT EXISTS "apps_master_data_products" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "specification" VARCHAR(500),
    "unit" VARCHAR(20) NOT NULL,
    "bom_data" JSONB,
    "version" VARCHAR(20),
    "is_active" BOOL NOT NULL  DEFAULT True,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_master_tenant__256ad1" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_apps_master_tenant__e33acc" ON "apps_master_data_products" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_master_code_93557f" ON "apps_master_data_products" ("code");
CREATE INDEX IF NOT EXISTS "idx_apps_master_uuid_0e44af" ON "apps_master_data_products" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_master_version_2d2476" ON "apps_master_data_products" ("version");
CREATE INDEX IF NOT EXISTS "idx_apps_master_created_a23b36" ON "apps_master_data_products" ("created_at");
COMMENT ON COLUMN "apps_master_data_products"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_master_data_products"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_master_data_products"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "apps_master_data_products"."updated_at" IS '更新时间（UTC）';
COMMENT ON COLUMN "apps_master_data_products"."code" IS '产品编码（唯一）';
COMMENT ON COLUMN "apps_master_data_products"."name" IS '产品名称';
COMMENT ON COLUMN "apps_master_data_products"."specification" IS '规格';
COMMENT ON COLUMN "apps_master_data_products"."unit" IS '单位';
COMMENT ON COLUMN "apps_master_data_products"."bom_data" IS 'BOM 数据（JSON格式）';
COMMENT ON COLUMN "apps_master_data_products"."version" IS '版本号';
COMMENT ON COLUMN "apps_master_data_products"."is_active" IS '是否启用';
COMMENT ON COLUMN "apps_master_data_products"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_master_data_products" IS '产品模型';
CREATE TABLE IF NOT EXISTS "core.models.UserRole" (
    "core_users_id" INT NOT NULL REFERENCES "core_users" ("id") ON DELETE CASCADE,
    "role_id" INT NOT NULL REFERENCES "core_roles" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "core.models.UserRole" IS '用户角色（多对多关系）';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
)
