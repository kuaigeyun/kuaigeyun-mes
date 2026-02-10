"""
添加物料编码规则配置相关模型

包含：
1. core_material_code_rule_main - 主编码规则配置表
2. core_material_type_config - 物料类型配置表
3. core_material_code_rule_alias - 部门编码规则配置表
4. core_material_code_rule_history - 规则版本历史表
5. core_material_sequence_counter - 序号计数器表

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加物料编码规则配置相关模型
    """
    return """
        -- ============================================
        -- 1. 创建主编码规则配置表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_material_code_rule_main" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "rule_name" VARCHAR(100) NOT NULL,
            "template" VARCHAR(200) NOT NULL,
            "prefix" VARCHAR(50),
            "sequence_config" JSONB,
            "is_active" BOOL NOT NULL DEFAULT true,
            "version" INT NOT NULL DEFAULT 1,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_materia_tenant__a1b2c3" UNIQUE ("tenant_id", "version")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_materia_tenant__d4e5f6" ON "core_material_code_rule_main" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_is_act_g7h8i9" ON "core_material_code_rule_main" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_version_j0k1l2" ON "core_material_code_rule_main" ("version");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_created_m3n4o5" ON "core_material_code_rule_main" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_uuid_p6q7r8" ON "core_material_code_rule_main" ("uuid");
        
        -- 添加注释
        COMMENT ON TABLE "core_material_code_rule_main" IS '主编码规则配置表';
        COMMENT ON COLUMN "core_material_code_rule_main"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_material_code_rule_main"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_material_code_rule_main"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_material_code_rule_main"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_material_code_rule_main"."id" IS '规则ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "core_material_code_rule_main"."rule_name" IS '规则名称';
        COMMENT ON COLUMN "core_material_code_rule_main"."template" IS '格式模板（如：{PREFIX}-{TYPE}-{SEQUENCE}）';
        COMMENT ON COLUMN "core_material_code_rule_main"."prefix" IS '前缀（如：MAT）';
        COMMENT ON COLUMN "core_material_code_rule_main"."sequence_config" IS '序号配置（JSON格式）';
        COMMENT ON COLUMN "core_material_code_rule_main"."is_active" IS '是否启用';
        COMMENT ON COLUMN "core_material_code_rule_main"."version" IS '版本号';
        COMMENT ON COLUMN "core_material_code_rule_main"."created_by" IS '创建人ID';
        COMMENT ON COLUMN "core_material_code_rule_main"."updated_by" IS '更新人ID';
        COMMENT ON COLUMN "core_material_code_rule_main"."deleted_at" IS '删除时间（软删除）';
        
        -- ============================================
        -- 2. 创建物料类型配置表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_material_type_config" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "rule_id" INT NOT NULL,
            "type_code" VARCHAR(20) NOT NULL,
            "type_name" VARCHAR(100) NOT NULL,
            "description" VARCHAR(255),
            "independent_sequence" BOOL NOT NULL DEFAULT true,
            "current_sequence" INT NOT NULL DEFAULT 0,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_materia_rule_i_s9t0u1" UNIQUE ("rule_id", "type_code")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_materia_tenant__v2w3x4" ON "core_material_type_config" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_rule_i_y5z6a7" ON "core_material_type_config" ("rule_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_type_c_b8c9d0" ON "core_material_type_config" ("type_code");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_created_e1f2g3" ON "core_material_type_config" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_uuid_h4i5j6" ON "core_material_type_config" ("uuid");
        
        -- 添加注释
        COMMENT ON TABLE "core_material_type_config" IS '物料类型配置表';
        COMMENT ON COLUMN "core_material_type_config"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_material_type_config"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_material_type_config"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_material_type_config"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_material_type_config"."id" IS '配置ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "core_material_type_config"."rule_id" IS '关联的主编码规则ID';
        COMMENT ON COLUMN "core_material_type_config"."type_code" IS '类型代码（如：FIN, SEMI, RAW）';
        COMMENT ON COLUMN "core_material_type_config"."type_name" IS '类型名称（如：成品, 半成品, 原材料）';
        COMMENT ON COLUMN "core_material_type_config"."description" IS '类型描述';
        COMMENT ON COLUMN "core_material_type_config"."independent_sequence" IS '是否独立计数';
        COMMENT ON COLUMN "core_material_type_config"."current_sequence" IS '当前序号（如果独立计数）';
        COMMENT ON COLUMN "core_material_type_config"."deleted_at" IS '删除时间（软删除）';
        
        -- ============================================
        -- 3. 创建部门编码规则配置表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_material_code_rule_alias" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code_type" VARCHAR(50) NOT NULL,
            "code_type_name" VARCHAR(100) NOT NULL,
            "template" VARCHAR(200),
            "prefix" VARCHAR(50),
            "validation_pattern" VARCHAR(500),
            "departments" JSONB,
            "is_active" BOOL NOT NULL DEFAULT true,
            "version" INT NOT NULL DEFAULT 1,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_materia_tenant__k7l8m9" UNIQUE ("tenant_id", "code_type")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_materia_tenant__n0o1p2" ON "core_material_code_rule_alias" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_code_t_q3r4s5" ON "core_material_code_rule_alias" ("code_type");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_is_act_t6u7v8" ON "core_material_code_rule_alias" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_version_w9x0y1" ON "core_material_code_rule_alias" ("version");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_created_z2a3b4" ON "core_material_code_rule_alias" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_uuid_c5d6e7" ON "core_material_code_rule_alias" ("uuid");
        
        -- 添加注释
        COMMENT ON TABLE "core_material_code_rule_alias" IS '部门编码规则配置表';
        COMMENT ON COLUMN "core_material_code_rule_alias"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."id" IS '规则ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."code_type" IS '编码类型代码（如：SALE, DES, SUP）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."code_type_name" IS '编码类型名称（如：销售编码, 设计编码）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."template" IS '格式模板（如：{PREFIX}-{DEPT}-{SEQUENCE}）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."prefix" IS '前缀（如：SALE）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."validation_pattern" IS '验证规则（正则表达式）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."departments" IS '关联部门（JSON数组）';
        COMMENT ON COLUMN "core_material_code_rule_alias"."is_active" IS '是否启用';
        COMMENT ON COLUMN "core_material_code_rule_alias"."version" IS '版本号';
        COMMENT ON COLUMN "core_material_code_rule_alias"."created_by" IS '创建人ID';
        COMMENT ON COLUMN "core_material_code_rule_alias"."updated_by" IS '更新人ID';
        COMMENT ON COLUMN "core_material_code_rule_alias"."deleted_at" IS '删除时间（软删除）';
        
        -- ============================================
        -- 4. 创建规则版本历史表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_material_code_rule_history" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "rule_type" VARCHAR(20) NOT NULL,
            "rule_id" INT NOT NULL,
            "version" INT NOT NULL,
            "rule_config" JSONB NOT NULL,
            "change_description" TEXT,
            "changed_by" INT,
            "changed_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_materia_rule_t_f8g9h0" UNIQUE ("rule_type", "rule_id", "version")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_materia_tenant__i1j2k3" ON "core_material_code_rule_history" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_rule_t_l4m5n6" ON "core_material_code_rule_history" ("rule_type", "rule_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_version_o7p8q9" ON "core_material_code_rule_history" ("version");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_changed_r0s1t2" ON "core_material_code_rule_history" ("changed_at");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_uuid_u3v4w5" ON "core_material_code_rule_history" ("uuid");
        
        -- 添加注释
        COMMENT ON TABLE "core_material_code_rule_history" IS '编码规则版本历史表';
        COMMENT ON COLUMN "core_material_code_rule_history"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_material_code_rule_history"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_material_code_rule_history"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_material_code_rule_history"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_material_code_rule_history"."id" IS '历史ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "core_material_code_rule_history"."rule_type" IS '规则类型（main/alias）';
        COMMENT ON COLUMN "core_material_code_rule_history"."rule_id" IS '规则ID';
        COMMENT ON COLUMN "core_material_code_rule_history"."version" IS '版本号';
        COMMENT ON COLUMN "core_material_code_rule_history"."rule_config" IS '规则配置（完整JSON）';
        COMMENT ON COLUMN "core_material_code_rule_history"."change_description" IS '变更说明';
        COMMENT ON COLUMN "core_material_code_rule_history"."changed_by" IS '变更人ID';
        COMMENT ON COLUMN "core_material_code_rule_history"."changed_at" IS '变更时间';
        COMMENT ON COLUMN "core_material_code_rule_history"."deleted_at" IS '删除时间（软删除）';
        
        -- ============================================
        -- 5. 创建序号计数器表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_material_sequence_counter" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "rule_id" INT NOT NULL,
            "type_code" VARCHAR(20),
            "current_value" INT NOT NULL DEFAULT 0,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_materia_tenant__a9b0c1" ON "core_material_sequence_counter" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_rule_i_d2e3f4" ON "core_material_sequence_counter" ("rule_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_type_c_g5h6i7" ON "core_material_sequence_counter" ("type_code");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_updated_j8k9l0" ON "core_material_sequence_counter" ("updated_at");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_uuid_m1n2o3" ON "core_material_sequence_counter" ("uuid");
        
        -- 创建部分唯一索引，确保全局计数（type_code IS NULL）时只有一个记录
        -- 这样当 independent_by_type=false 时，每个规则只能有一个全局计数器
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_core_materia_tenant__global" 
        ON "core_material_sequence_counter" ("tenant_id", "rule_id") 
        WHERE "type_code" IS NULL;
        
        -- 创建部分唯一索引，确保类型计数（type_code IS NOT NULL）时每种类型只有一个记录
        -- 这样当 independent_by_type=true 时，每个规则每个类型只能有一个计数器
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_core_materia_tenant__typed" 
        ON "core_material_sequence_counter" ("tenant_id", "rule_id", "type_code") 
        WHERE "type_code" IS NOT NULL;
        
        -- 添加注释
        COMMENT ON TABLE "core_material_sequence_counter" IS '物料序号计数器表';
        COMMENT ON COLUMN "core_material_sequence_counter"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "core_material_sequence_counter"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "core_material_sequence_counter"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "core_material_sequence_counter"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "core_material_sequence_counter"."id" IS '计数器ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "core_material_sequence_counter"."rule_id" IS '关联的规则ID（主编码规则ID）';
        COMMENT ON COLUMN "core_material_sequence_counter"."type_code" IS '物料类型代码（如果独立计数）';
        COMMENT ON COLUMN "core_material_sequence_counter"."current_value" IS '当前序号值';
        COMMENT ON COLUMN "core_material_sequence_counter"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除物料编码规则配置相关模型
    """
    return """
        -- 删除序号计数器表
        DROP TABLE IF EXISTS "core_material_sequence_counter";
        
        -- 删除规则版本历史表
        DROP TABLE IF EXISTS "core_material_code_rule_history";
        
        -- 删除部门编码规则配置表
        DROP TABLE IF EXISTS "core_material_code_rule_alias";
        
        -- 删除物料类型配置表
        DROP TABLE IF EXISTS "core_material_type_config";
        
        -- 删除主编码规则配置表
        DROP TABLE IF EXISTS "core_material_code_rule_main";
    """
