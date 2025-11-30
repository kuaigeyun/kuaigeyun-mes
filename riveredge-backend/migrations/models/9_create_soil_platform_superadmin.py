"""
创建 soil_platform_superadmin 表的迁移文件

只创建表，不进行其他操作
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
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
COMMENT ON TABLE "soil_platform_superadmin" IS '平台超级管理员模型';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "soil_platform_superadmin";
"""

