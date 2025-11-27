from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
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
COMMENT ON COLUMN "core_superadmins"."id" IS '主键 ID';
COMMENT ON COLUMN "core_superadmins"."created_at" IS '创建时间';
COMMENT ON COLUMN "core_superadmins"."updated_at" IS '更新时间';
COMMENT ON COLUMN "core_superadmins"."username" IS '用户名（全局唯一）';
COMMENT ON COLUMN "core_superadmins"."email" IS '用户邮箱（可选，符合中国用户使用习惯）';
COMMENT ON COLUMN "core_superadmins"."password_hash" IS '密码哈希值（使用 bcrypt 加密）';
COMMENT ON COLUMN "core_superadmins"."full_name" IS '用户全名（可选）';
COMMENT ON COLUMN "core_superadmins"."is_active" IS '是否激活';
COMMENT ON COLUMN "core_superadmins"."last_login" IS '最后登录时间（可选）';
COMMENT ON COLUMN "core_superadmins"."device_fingerprint" IS '设备指纹（可选，用于设备绑定）';
COMMENT ON TABLE "core_superadmins" IS '超级管理员模型（独立于组织系统，不包含 tenant_id）';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_superadmins";"""

