"""
创建自定义字段表迁移

创建自定义字段和自定义字段值表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建自定义字段表
        CREATE TABLE IF NOT EXISTS "sys_custom_fields" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "table_name" VARCHAR(50) NOT NULL,
            "field_type" VARCHAR(20) NOT NULL,
            "config" JSONB,
            "label" VARCHAR(100),
            "placeholder" VARCHAR(200),
            "is_required" BOOL NOT NULL DEFAULT False,
            "is_searchable" BOOL NOT NULL DEFAULT True,
            "is_sortable" BOOL NOT NULL DEFAULT True,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_custom_tenant__i9j4k5" UNIQUE ("tenant_id", "table_name", "code")
        );
COMMENT ON TABLE "sys_custom_fields" IS '自定义字段表';
        
        -- 创建自定义字段表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_tenant__i9j4k5" ON "sys_custom_fields" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_table__j9k4l5" ON "sys_custom_fields" ("table_name");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_created_k9l4m5" ON "sys_custom_fields" ("created_at");
        
        -- 创建自定义字段值表
        CREATE TABLE IF NOT EXISTS "sys_custom_field_values" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "custom_field_id" INT NOT NULL,
            "record_id" INT NOT NULL,
            "record_table" VARCHAR(50) NOT NULL,
            "value_text" TEXT,
            "value_number" NUMERIC(20,4),
            "value_date" DATE,
            "value_json" JSONB,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_custom_field_values" IS '自定义字段值表';
        
        -- 创建自定义字段值表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_custom__l9m4n5" ON "sys_custom_field_values" ("custom_field_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_tenant__m9n4o5" ON "sys_custom_field_values" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_record_n9o4p5" ON "sys_custom_field_values" ("record_table", "record_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_created_o9p4q5" ON "sys_custom_field_values" ("created_at");
        
        -- 添加外键约束
        ALTER TABLE "sys_custom_field_values" ADD CONSTRAINT "fk_sys_custom_v_custom__l9m4n5" FOREIGN KEY ("custom_field_id") REFERENCES "sys_custom_fields" ("id") ON DELETE CASCADE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除外键约束
        ALTER TABLE "sys_custom_field_values" DROP CONSTRAINT IF EXISTS "fk_sys_custom_v_custom__l9m4n5";
        
        -- 删除自定义字段值表索引
        DROP INDEX IF EXISTS "idx_sys_custom_v_created_o9p4q5";
        DROP INDEX IF EXISTS "idx_sys_custom_v_record_n9o4p5";
        DROP INDEX IF EXISTS "idx_sys_custom_v_tenant__m9n4o5";
        DROP INDEX IF EXISTS "idx_sys_custom_v_custom__l9m4n5";
        
        -- 删除自定义字段值表
        DROP TABLE IF EXISTS "sys_custom_field_values";
        
        -- 删除自定义字段表索引
        DROP INDEX IF EXISTS "idx_sys_custom_created_k9l4m5";
        DROP INDEX IF EXISTS "idx_sys_custom_table__j9k4l5";
        DROP INDEX IF EXISTS "idx_sys_custom_tenant__i9j4k5";
        
        -- 删除自定义字段表
        DROP TABLE IF EXISTS "sys_custom_fields";
    """

