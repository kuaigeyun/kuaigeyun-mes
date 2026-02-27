"""
创建行业模板表

行业模板为平台级配置，用于快速初始化组织（编码规则、系统参数、默认角色等）。

Author: AI Assistant
Date: 2026-02-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建 infra_industry_templates 表
    """
    return """
        -- ============================================
        -- 创建行业模板表（平台级，tenant_id 为 NULL）
        -- ============================================
        CREATE TABLE IF NOT EXISTS "infra_industry_templates" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "industry" VARCHAR(50) NOT NULL,
            "description" TEXT NULL,
            "config" JSONB NOT NULL DEFAULT '{}',
            "is_active" BOOLEAN NOT NULL DEFAULT true,
            "is_default" BOOLEAN NOT NULL DEFAULT false,
            "usage_count" INT NOT NULL DEFAULT 0,
            "last_used_at" TIMESTAMPTZ NULL,
            "sort_order" INT NOT NULL DEFAULT 0
        );
        
        -- 创建索引
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_infra_industry_templates_code" 
            ON "infra_industry_templates" ("code") WHERE "tenant_id" IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_infra_industry_templates_industry" 
            ON "infra_industry_templates" ("industry");
        CREATE INDEX IF NOT EXISTS "idx_infra_industry_templates_is_active" 
            ON "infra_industry_templates" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_infra_industry_templates_sort_order" 
            ON "infra_industry_templates" ("sort_order");
        
        -- 添加表注释
        COMMENT ON TABLE "infra_industry_templates" IS '行业模板表，平台级配置，用于快速初始化组织';
        COMMENT ON COLUMN "infra_industry_templates"."id" IS '主键ID';
        COMMENT ON COLUMN "infra_industry_templates"."uuid" IS '业务ID（UUID）';
        COMMENT ON COLUMN "infra_industry_templates"."tenant_id" IS '组织ID（行业模板为平台级，此处为NULL）';
        COMMENT ON COLUMN "infra_industry_templates"."name" IS '模板名称';
        COMMENT ON COLUMN "infra_industry_templates"."code" IS '模板代码（唯一）';
        COMMENT ON COLUMN "infra_industry_templates"."industry" IS '行业类型';
        COMMENT ON COLUMN "infra_industry_templates"."description" IS '模板描述';
        COMMENT ON COLUMN "infra_industry_templates"."config" IS '模板配置（JSON）';
        COMMENT ON COLUMN "infra_industry_templates"."is_active" IS '是否启用';
        COMMENT ON COLUMN "infra_industry_templates"."is_default" IS '是否默认模板';
        COMMENT ON COLUMN "infra_industry_templates"."usage_count" IS '使用次数';
        COMMENT ON COLUMN "infra_industry_templates"."last_used_at" IS '最后使用时间';
        COMMENT ON COLUMN "infra_industry_templates"."sort_order" IS '排序顺序';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 infra_industry_templates 表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_infra_industry_templates_sort_order";
        DROP INDEX IF EXISTS "idx_infra_industry_templates_is_active";
        DROP INDEX IF EXISTS "idx_infra_industry_templates_industry";
        DROP INDEX IF EXISTS "idx_infra_industry_templates_code";
        
        -- 删除表
        DROP TABLE IF EXISTS "infra_industry_templates";
    """
