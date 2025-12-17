from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


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
        ALTER TABLE "sys_code_sequences" ADD CONSTRAINT "fk_sys_code_s_code_ru_g9h4i5" FOREIGN KEY ("code_rule_id") REFERENCES "sys_code_rules" ("id") ON DELETE CASCADE;"""


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
        DROP TABLE IF EXISTS "sys_code_rules";"""


MODELS_STATE = (
    "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"
)
