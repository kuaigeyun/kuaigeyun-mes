"""
添加平台设置模型

创建 infra_platform_settings 表，用于存储平台级配置信息。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建平台设置表
    """
    return """
        -- ============================================
        -- 创建平台设置表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "infra_platform_settings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "platform_name" VARCHAR(200) NOT NULL DEFAULT 'RiverEdge SaaS Framework',
            "platform_logo" VARCHAR(500),
            "platform_description" TEXT,
            "platform_contact_email" VARCHAR(255),
            "platform_contact_phone" VARCHAR(50),
            "platform_website" VARCHAR(500),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_infra_platform_settings_platform_name" ON "infra_platform_settings" ("platform_name");
        
        -- 添加表注释
        COMMENT ON TABLE "infra_platform_settings" IS '平台设置表，存储平台级配置信息（平台名称、Logo、联系方式等）';
        COMMENT ON COLUMN "infra_platform_settings"."id" IS '主键ID';
        COMMENT ON COLUMN "infra_platform_settings"."platform_name" IS '平台名称';
        COMMENT ON COLUMN "infra_platform_settings"."platform_logo" IS '平台Logo URL';
        COMMENT ON COLUMN "infra_platform_settings"."platform_description" IS '平台描述';
        COMMENT ON COLUMN "infra_platform_settings"."platform_contact_email" IS '平台联系邮箱';
        COMMENT ON COLUMN "infra_platform_settings"."platform_contact_phone" IS '平台联系电话';
        COMMENT ON COLUMN "infra_platform_settings"."platform_website" IS '平台网站';
        COMMENT ON COLUMN "infra_platform_settings"."created_at" IS '创建时间';
        COMMENT ON COLUMN "infra_platform_settings"."updated_at" IS '更新时间';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除平台设置表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_infra_platform_settings_platform_name";
        
        -- 删除表
        DROP TABLE IF EXISTS "infra_platform_settings";
    """

