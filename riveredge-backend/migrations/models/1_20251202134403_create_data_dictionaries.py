"""
创建数据字典表迁移

创建数据字典和字典项表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建数据字典表
        CREATE TABLE IF NOT EXISTS "sys_data_dictionaries" (
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
            CONSTRAINT "uid_sys_data_di_tenant__a8b3c4" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_data_dictionaries" IS '数据字典表';
        
        -- 创建数据字典表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_tenant__a8b3c4" ON "sys_data_dictionaries" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_uuid_b8c3d4" ON "sys_data_dictionaries" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_code_c8d3e4" ON "sys_data_dictionaries" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_data_di_created_d8e3f4" ON "sys_data_dictionaries" ("created_at");
        
        -- 创建字典项表
        CREATE TABLE IF NOT EXISTS "sys_dictionary_items" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "dictionary_id" INT NOT NULL,
            "label" VARCHAR(100) NOT NULL,
            "value" VARCHAR(100) NOT NULL,
            "description" TEXT,
            "color" VARCHAR(20),
            "icon" VARCHAR(50),
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_dictio_tenant__b9c4d5" UNIQUE ("tenant_id", "dictionary_id", "value")
        );
        
        -- 创建字典项表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_tenant__b9c4d5" ON "sys_dictionary_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_diction_c9d4e5" ON "sys_dictionary_items" ("dictionary_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_sort_or_d9e4f5" ON "sys_dictionary_items" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_sys_dictio_created_e9f4g5" ON "sys_dictionary_items" ("created_at");
        COMMENT ON TABLE "sys_dictionary_items" IS '数据字典项表';
        
        -- 添加外键约束
        ALTER TABLE "sys_dictionary_items" ADD CONSTRAINT "fk_sys_dictio_diction_c9d4e5" FOREIGN KEY ("dictionary_id") REFERENCES "sys_data_dictionaries" ("id") ON DELETE CASCADE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除外键约束
        ALTER TABLE "sys_dictionary_items" DROP CONSTRAINT IF EXISTS "fk_sys_dictio_diction_c9d4e5";
        
        -- 删除字典项表索引
        DROP INDEX IF EXISTS "idx_sys_dictio_created_e9f4g5";
        DROP INDEX IF EXISTS "idx_sys_dictio_sort_or_d9e4f5";
        DROP INDEX IF EXISTS "idx_sys_dictio_diction_c9d4e5";
        DROP INDEX IF EXISTS "idx_sys_dictio_tenant__b9c4d5";
        
        -- 删除字典项表
        DROP TABLE IF EXISTS "sys_dictionary_items";
        
        -- 删除数据字典表索引
        DROP INDEX IF EXISTS "idx_sys_data_di_created_d8e3f4";
        DROP INDEX IF EXISTS "idx_sys_data_di_code_c8d3e4";
        DROP INDEX IF EXISTS "idx_sys_data_di_uuid_b8c3d4";
        DROP INDEX IF EXISTS "idx_sys_data_di_tenant__a8b3c4";
        
        -- 删除数据字典表
        DROP TABLE IF EXISTS "sys_data_dictionaries";
    """

