"""
创建编码规则表迁移

创建编码规则和编码序号表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建编码规则表
        CREATE TABLE IF NOT EXISTS "sys_code_rules" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "expression" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "seq_start" INT NOT NULL DEFAULT 1,
            "seq_step" INT NOT NULL DEFAULT 1,
            "seq_reset_rule" VARCHAR(20),
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_code_r_tenant__d9e4f5" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "sys_code_rules" IS '编码规则表';
        
        -- 创建编码规则表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_code_r_tenant__d9e4f5" ON "sys_code_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_code_r_code_e9f4g5" ON "sys_code_rules" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_code_r_created_f9g4h5" ON "sys_code_rules" ("created_at");
        
        
        -- 创建编码序号表
        CREATE TABLE IF NOT EXISTS "sys_code_sequences" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code_rule_id" INT NOT NULL,
            "current_seq" INT NOT NULL DEFAULT 0,
            "reset_date" DATE,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_code_s_code_ru_g9h4i5" UNIQUE ("code_rule_id", "tenant_id")
        );
COMMENT ON TABLE "sys_code_sequences" IS '编码序号表';
        
        -- 创建编码序号表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_code_s_code_ru_g9h4i5" ON "sys_code_sequences" ("code_rule_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_code_s_tenant__h9i4j5" ON "sys_code_sequences" ("tenant_id");
        
        
        -- 添加外键约束
        ALTER TABLE "sys_code_sequences" ADD CONSTRAINT "fk_sys_code_s_code_ru_g9h4i5" FOREIGN KEY ("code_rule_id") REFERENCES "sys_code_rules" ("id") ON DELETE CASCADE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除外键约束
        ALTER TABLE "sys_code_sequences" DROP CONSTRAINT IF EXISTS "fk_sys_code_s_code_ru_g9h4i5";
        
        -- 删除编码序号表索引
        DROP INDEX IF EXISTS "idx_sys_code_s_tenant__h9i4j5";
        DROP INDEX IF EXISTS "idx_sys_code_s_code_ru_g9h4i5";
        
        -- 删除编码序号表
        DROP TABLE IF EXISTS "sys_code_sequences";
        
        -- 删除编码规则表索引
        DROP INDEX IF EXISTS "idx_sys_code_r_created_f9g4h5";
        DROP INDEX IF EXISTS "idx_sys_code_r_code_e9f4g5";
        DROP INDEX IF EXISTS "idx_sys_code_r_tenant__d9e4f5";
        
        -- 删除编码规则表
        DROP TABLE IF EXISTS "sys_code_rules";
    """

