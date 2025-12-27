from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


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
        ALTER TABLE "sys_dictionary_items" ADD CONSTRAINT "fk_sys_dictio_diction_c9d4e5" FOREIGN KEY ("dictionary_id") REFERENCES "sys_data_dictionaries" ("id") ON DELETE CASCADE;"""


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
        DROP TABLE IF EXISTS "sys_data_dictionaries";"""


MODELS_STATE = (
    "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"
)
