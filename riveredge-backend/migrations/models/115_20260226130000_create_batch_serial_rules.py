"""
创建批号规则和序列号规则表迁移

创建 core_batch_rules、core_serial_rules、core_batch_rule_sequences、core_serial_rule_sequences 表。
为 Material 表增加 default_batch_rule_id、default_serial_rule_id、serial_managed 字段。

Author: RiverEdge Team
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建批号规则、序列号规则及序号表，扩展物料表
    """
    return """
        -- ============================================
        -- 创建批号规则表（core_batch_rules）
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "core_batch_rules" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "rule_components" JSONB,
            "description" TEXT,
            "seq_start" INT NOT NULL DEFAULT 1,
            "seq_step" INT NOT NULL DEFAULT 1,
            "seq_reset_rule" VARCHAR(20),
            "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_batch_rules_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        CREATE INDEX IF NOT EXISTS "idx_core_batch_rules_tenant_id" ON "core_batch_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_batch_rules_code" ON "core_batch_rules" ("code");
        CREATE INDEX IF NOT EXISTS "idx_core_batch_rules_uuid" ON "core_batch_rules" ("uuid");
        
        COMMENT ON TABLE "core_batch_rules" IS '批号规则表';
        
        -- ============================================
        -- 创建序列号规则表（core_serial_rules）
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "core_serial_rules" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "rule_components" JSONB,
            "description" TEXT,
            "seq_start" INT NOT NULL DEFAULT 1,
            "seq_step" INT NOT NULL DEFAULT 1,
            "seq_reset_rule" VARCHAR(20),
            "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_serial_rules_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        CREATE INDEX IF NOT EXISTS "idx_core_serial_rules_tenant_id" ON "core_serial_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_serial_rules_code" ON "core_serial_rules" ("code");
        CREATE INDEX IF NOT EXISTS "idx_core_serial_rules_uuid" ON "core_serial_rules" ("uuid");
        
        COMMENT ON TABLE "core_serial_rules" IS '序列号规则表';
        
        -- ============================================
        -- 创建批号规则序号表（core_batch_rule_sequences）
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "core_batch_rule_sequences" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "batch_rule_id" INT NOT NULL,
            "current_seq" INT NOT NULL DEFAULT 0,
            "reset_date" DATE,
            "scope_key" VARCHAR(200) NOT NULL DEFAULT '',
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_batch_seq_rule_tenant_scope" UNIQUE ("batch_rule_id", "tenant_id", "scope_key")
        );
        
        CREATE INDEX IF NOT EXISTS "idx_core_batch_seq_batch_rule_id" ON "core_batch_rule_sequences" ("batch_rule_id");
        CREATE INDEX IF NOT EXISTS "idx_core_batch_seq_tenant_id" ON "core_batch_rule_sequences" ("tenant_id");
        
        COMMENT ON TABLE "core_batch_rule_sequences" IS '批号规则序号表';
        
        -- ============================================
        -- 创建序列号规则序号表（core_serial_rule_sequences）
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "core_serial_rule_sequences" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "serial_rule_id" INT NOT NULL,
            "current_seq" INT NOT NULL DEFAULT 0,
            "reset_date" DATE,
            "scope_key" VARCHAR(200) NOT NULL DEFAULT '',
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_serial_seq_rule_tenant_scope" UNIQUE ("serial_rule_id", "tenant_id", "scope_key")
        );
        
        CREATE INDEX IF NOT EXISTS "idx_core_serial_seq_serial_rule_id" ON "core_serial_rule_sequences" ("serial_rule_id");
        CREATE INDEX IF NOT EXISTS "idx_core_serial_seq_tenant_id" ON "core_serial_rule_sequences" ("tenant_id");
        
        COMMENT ON TABLE "core_serial_rule_sequences" IS '序列号规则序号表';
        
        -- ============================================
        -- 扩展物料表：添加 default_batch_rule_id、default_serial_rule_id、serial_managed
        -- ============================================
        
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_materials' 
                AND column_name = 'default_batch_rule_id'
            ) THEN
                ALTER TABLE "apps_master_data_materials" 
                ADD COLUMN "default_batch_rule_id" INT NULL;
                COMMENT ON COLUMN "apps_master_data_materials"."default_batch_rule_id" IS '默认批号规则ID（可选）';
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_materials' 
                AND column_name = 'default_serial_rule_id'
            ) THEN
                ALTER TABLE "apps_master_data_materials" 
                ADD COLUMN "default_serial_rule_id" INT NULL;
                COMMENT ON COLUMN "apps_master_data_materials"."default_serial_rule_id" IS '默认序列号规则ID（可选）';
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_materials' 
                AND column_name = 'serial_managed'
            ) THEN
                ALTER TABLE "apps_master_data_materials" 
                ADD COLUMN "serial_managed" BOOLEAN NOT NULL DEFAULT FALSE;
                COMMENT ON COLUMN "apps_master_data_materials"."serial_managed" IS '是否启用序列号管理';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除批号/序列号规则表，移除物料表扩展字段
    """
    return """
        -- 移除物料表扩展字段
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "default_batch_rule_id";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "default_serial_rule_id";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "serial_managed";
        
        -- 删除序号表
        DROP TABLE IF EXISTS "core_serial_rule_sequences";
        DROP TABLE IF EXISTS "core_batch_rule_sequences";
        
        -- 删除规则表
        DROP TABLE IF EXISTS "core_serial_rules";
        DROP TABLE IF EXISTS "core_batch_rules";
    """
