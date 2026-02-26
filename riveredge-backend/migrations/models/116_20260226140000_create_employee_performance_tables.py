"""
创建员工绩效管理表迁移

创建 employee_performance_configs、piece_rates、hourly_rates、kpi_definitions、
employee_kpi_scores、performance_summaries 表。

Author: RiverEdge Team
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建员工绩效相关表
    """
    return """
        -- ============================================
        -- 1. 员工绩效配置表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_employee_performance_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "employee_id" INT NOT NULL,
            "employee_name" VARCHAR(100),
            "calc_mode" VARCHAR(20) NOT NULL DEFAULT 'time',
            "piece_rate_mode" VARCHAR(20),
            "hourly_rate" DECIMAL(10,2),
            "default_piece_rate" DECIMAL(10,4),
            "base_salary" DECIMAL(10,2),
            "effective_from" DATE,
            "effective_to" DATE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_emp_perf_config_tenant_employee" UNIQUE ("tenant_id", "employee_id")
        );
        CREATE INDEX IF NOT EXISTS "idx_emp_perf_config_tenant_id" ON "apps_master_data_employee_performance_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_emp_perf_config_employee_id" ON "apps_master_data_employee_performance_configs" ("employee_id");
        CREATE INDEX IF NOT EXISTS "idx_emp_perf_config_effective_from" ON "apps_master_data_employee_performance_configs" ("effective_from");
        COMMENT ON TABLE "apps_master_data_employee_performance_configs" IS '基础数据管理 - 员工绩效配置';

        -- ============================================
        -- 2. 计件单价表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_piece_rates" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "operation_id" INT NOT NULL,
            "operation_code" VARCHAR(50),
            "operation_name" VARCHAR(200),
            "material_id" INT,
            "material_code" VARCHAR(50),
            "rate" DECIMAL(10,4) NOT NULL,
            "effective_from" DATE,
            "effective_to" DATE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_piece_rates_tenant_id" ON "apps_master_data_piece_rates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_piece_rates_operation_id" ON "apps_master_data_piece_rates" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_piece_rates_material_id" ON "apps_master_data_piece_rates" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_piece_rates_effective_from" ON "apps_master_data_piece_rates" ("effective_from");
        COMMENT ON TABLE "apps_master_data_piece_rates" IS '基础数据管理 - 计件单价';

        -- ============================================
        -- 3. 工时单价表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_hourly_rates" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "department_id" INT,
            "department_name" VARCHAR(100),
            "position_id" INT,
            "position_name" VARCHAR(100),
            "rate" DECIMAL(10,2) NOT NULL,
            "effective_from" DATE,
            "effective_to" DATE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_hourly_rates_tenant_id" ON "apps_master_data_hourly_rates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_hourly_rates_department_id" ON "apps_master_data_hourly_rates" ("department_id");
        CREATE INDEX IF NOT EXISTS "idx_hourly_rates_position_id" ON "apps_master_data_hourly_rates" ("position_id");
        CREATE INDEX IF NOT EXISTS "idx_hourly_rates_effective_from" ON "apps_master_data_hourly_rates" ("effective_from");
        COMMENT ON TABLE "apps_master_data_hourly_rates" IS '基础数据管理 - 工时单价';

        -- ============================================
        -- 4. KPI 指标定义表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_kpi_definitions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "weight" DECIMAL(5,2) NOT NULL DEFAULT 1,
            "calc_type" VARCHAR(50) NOT NULL,
            "formula_json" JSONB,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_kpi_def_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_kpi_def_tenant_id" ON "apps_master_data_kpi_definitions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kpi_def_code" ON "apps_master_data_kpi_definitions" ("code");
        COMMENT ON TABLE "apps_master_data_kpi_definitions" IS '基础数据管理 - KPI指标定义';

        -- ============================================
        -- 5. 员工 KPI 得分表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_employee_kpi_scores" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "employee_id" INT NOT NULL,
            "employee_name" VARCHAR(100),
            "period" VARCHAR(7) NOT NULL,
            "kpi_code" VARCHAR(50) NOT NULL,
            "score" DECIMAL(10,2) NOT NULL,
            "source_data_json" JSONB,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_emp_kpi_tenant_emp_period_code" UNIQUE ("tenant_id", "employee_id", "period", "kpi_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_emp_kpi_tenant_id" ON "apps_master_data_employee_kpi_scores" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_emp_kpi_employee_id" ON "apps_master_data_employee_kpi_scores" ("employee_id");
        CREATE INDEX IF NOT EXISTS "idx_emp_kpi_period" ON "apps_master_data_employee_kpi_scores" ("period");
        CREATE INDEX IF NOT EXISTS "idx_emp_kpi_kpi_code" ON "apps_master_data_employee_kpi_scores" ("kpi_code");
        COMMENT ON TABLE "apps_master_data_employee_kpi_scores" IS '基础数据管理 - 员工KPI得分';

        -- ============================================
        -- 6. 绩效汇总表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_master_data_performance_summaries" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "employee_id" INT NOT NULL,
            "employee_name" VARCHAR(100),
            "period" VARCHAR(7) NOT NULL,
            "total_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_pieces" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "total_unqualified" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "time_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "piece_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "kpi_score" DECIMAL(6,2),
            "kpi_coefficient" DECIMAL(4,2),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_perf_summary_tenant_emp_period" UNIQUE ("tenant_id", "employee_id", "period")
        );
        CREATE INDEX IF NOT EXISTS "idx_perf_summary_tenant_id" ON "apps_master_data_performance_summaries" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_perf_summary_employee_id" ON "apps_master_data_performance_summaries" ("employee_id");
        CREATE INDEX IF NOT EXISTS "idx_perf_summary_period" ON "apps_master_data_performance_summaries" ("period");
        COMMENT ON TABLE "apps_master_data_performance_summaries" IS '基础数据管理 - 绩效汇总';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除员工绩效相关表
    """
    return """
        DROP TABLE IF EXISTS "apps_master_data_performance_summaries" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_employee_kpi_scores" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_kpi_definitions" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_hourly_rates" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_piece_rates" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_employee_performance_configs" CASCADE;
    """
