from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_users" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100),
    "is_active" BOOL NOT NULL DEFAULT True,
    "is_superuser" BOOL NOT NULL DEFAULT False,
    "is_tenant_admin" BOOL NOT NULL DEFAULT False,
    "last_login" TIMESTAMPTZ,
    CONSTRAINT "uid_core_users_tenant__8d51a4" UNIQUE ("tenant_id", "username")
);
CREATE INDEX IF NOT EXISTS "idx_core_users_tenant__7bf229" ON "core_users" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_users_usernam_b84f0b" ON "core_users" ("username");
CREATE INDEX IF NOT EXISTS "idx_core_users_email_438fe9" ON "core_users" ("email");
CREATE INDEX IF NOT EXISTS "idx_core_users_tenant__8d51a4" ON "core_users" ("tenant_id", "username");
COMMENT ON COLUMN "core_users"."id" IS '主键 ID';
COMMENT ON COLUMN "core_users"."tenant_id" IS '组织 ID（外键，关联到 core_tenants 表）';
COMMENT ON COLUMN "core_users"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_users"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_users"."username" IS '用户名（组织内唯一）';
COMMENT ON COLUMN "core_users"."email" IS '用户邮箱（全局唯一）';
COMMENT ON COLUMN "core_users"."password_hash" IS '密码哈希值（使用 bcrypt 加密）';
COMMENT ON COLUMN "core_users"."full_name" IS '用户全名（可选）';
COMMENT ON COLUMN "core_users"."is_active" IS '是否激活';
COMMENT ON COLUMN "core_users"."is_superuser" IS '是否为超级用户（组织内）';
COMMENT ON COLUMN "core_users"."is_tenant_admin" IS '是否为组织管理员';
COMMENT ON COLUMN "core_users"."last_login" IS '最后登录时间（可选）';
COMMENT ON TABLE "core_users" IS '用户模型';
        CREATE TABLE IF NOT EXISTS "core_roles" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system" BOOL NOT NULL DEFAULT False,
    CONSTRAINT "uid_core_roles_tenant__c64518" UNIQUE ("tenant_id", "name"),
    CONSTRAINT "uid_core_roles_tenant__f765ef" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_roles_tenant__82fa42" ON "core_roles" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_roles_name_b2ea14" ON "core_roles" ("name");
CREATE INDEX IF NOT EXISTS "idx_core_roles_code_4053fd" ON "core_roles" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_roles_tenant__c64518" ON "core_roles" ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "idx_core_roles_tenant__f765ef" ON "core_roles" ("tenant_id", "code");
COMMENT ON COLUMN "core_roles"."id" IS '主键 ID';
COMMENT ON COLUMN "core_roles"."tenant_id" IS '组织 ID（外键，关联到 core_tenants 表）';
COMMENT ON COLUMN "core_roles"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_roles"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_roles"."name" IS '角色名称（组织内唯一）';
COMMENT ON COLUMN "core_roles"."code" IS '角色代码（组织内唯一，用于程序识别）';
COMMENT ON COLUMN "core_roles"."description" IS '角色描述（可选）';
COMMENT ON COLUMN "core_roles"."is_system" IS '是否为系统角色（系统角色不可删除）';
COMMENT ON TABLE "core_roles" IS '角色模型';
        CREATE TABLE IF NOT EXISTS "core_permissions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "is_system" BOOL NOT NULL DEFAULT False,
    CONSTRAINT "uid_core_permis_tenant__44d640" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "idx_core_permis_tenant__d00b13" ON "core_permissions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_core_permis_name_cd30b2" ON "core_permissions" ("name");
CREATE INDEX IF NOT EXISTS "idx_core_permis_code_d0d5b4" ON "core_permissions" ("code");
CREATE INDEX IF NOT EXISTS "idx_core_permis_resourc_2f2a9a" ON "core_permissions" ("resource");
CREATE INDEX IF NOT EXISTS "idx_core_permis_action_b49dc9" ON "core_permissions" ("action");
CREATE INDEX IF NOT EXISTS "idx_core_permis_tenant__44d640" ON "core_permissions" ("tenant_id", "code");
COMMENT ON COLUMN "core_permissions"."id" IS '主键 ID';
COMMENT ON COLUMN "core_permissions"."tenant_id" IS '组织 ID（外键，关联到 core_tenants 表）';
COMMENT ON COLUMN "core_permissions"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_permissions"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_permissions"."name" IS '权限名称（组织内唯一）';
COMMENT ON COLUMN "core_permissions"."code" IS '权限代码（组织内唯一，格式：resource:action）';
COMMENT ON COLUMN "core_permissions"."description" IS '权限描述（可选）';
COMMENT ON COLUMN "core_permissions"."resource" IS '资源名称（如：user, role, tenant）';
COMMENT ON COLUMN "core_permissions"."action" IS '操作类型（如：create, read, update, delete）';
COMMENT ON COLUMN "core_permissions"."is_system" IS '是否为系统权限（系统权限不可删除）';
COMMENT ON TABLE "core_permissions" IS '权限模型';
        CREATE TABLE "core_users_core_roles" (
    "core_users_id" INT NOT NULL REFERENCES "core_users" ("id") ON DELETE CASCADE,
    "role_id" INT NOT NULL REFERENCES "core_roles" ("id") ON DELETE CASCADE
);
        COMMENT ON TABLE "core_users_core_roles" IS '用户角色（多对多关系）';
        CREATE TABLE "core_roles_core_permissions" (
    "core_roles_id" INT NOT NULL REFERENCES "core_roles" ("id") ON DELETE CASCADE,
    "permission_id" INT NOT NULL REFERENCES "core_permissions" ("id") ON DELETE CASCADE
);
        COMMENT ON TABLE "core_roles_core_permissions" IS '角色权限（多对多关系）';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_users_core_roles";
        DROP TABLE IF EXISTS "core_users";
        DROP TABLE IF EXISTS "core_roles_core_permissions";
        DROP TABLE IF EXISTS "core_roles";
        DROP TABLE IF EXISTS "core_permissions";"""


MODELS_STATE = (
    "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"
    "vu/x5/8BG4L58Q=="
)
