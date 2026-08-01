from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_install_execution_jobs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "job_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "sales_order_id" INT,
            "sales_order_code" VARCHAR(50),
            "sales_delivery_id" INT,
            "sales_delivery_code" VARCHAR(50),
            "packing_binding_id" INT,
            "supply_source" VARCHAR(20) NOT NULL DEFAULT '自制',
            "site_address" VARCHAR(500),
            "owner_id" INT,
            "owner_name" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT '待派工',
            "current_stage_key" VARCHAR(50),
            "notes" TEXT,
            "total_cost_amount" DECIMAL(14,2),
            "started_at" TIMESTAMPTZ,
            "closed_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_install_execution_jobs" IS '快格轻制造 - 安装执行单';
        CREATE INDEX IF NOT EXISTS "idx_install_job_code"
            ON "apps_kuaizhizao_install_execution_jobs" ("tenant_id", "job_code");
        CREATE INDEX IF NOT EXISTS "idx_install_job_customer"
            ON "apps_kuaizhizao_install_execution_jobs" ("tenant_id", "customer_id");
        CREATE INDEX IF NOT EXISTS "idx_install_job_status"
            ON "apps_kuaizhizao_install_execution_jobs" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_install_job_sales_order"
            ON "apps_kuaizhizao_install_execution_jobs" ("tenant_id", "sales_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_install_execution_stages" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "job_id" INT NOT NULL,
            "stage_key" VARCHAR(50) NOT NULL,
            "stage_name" VARCHAR(100) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 1,
            "status" VARCHAR(20) NOT NULL DEFAULT '待开始',
            "planned_at" TIMESTAMPTZ,
            "actual_at" TIMESTAMPTZ,
            "notes" TEXT
        );
        COMMENT ON TABLE "apps_kuaizhizao_install_execution_stages" IS '快格轻制造 - 安装执行阶段';
        CREATE INDEX IF NOT EXISTS "idx_install_stage_job"
            ON "apps_kuaizhizao_install_execution_stages" ("tenant_id", "job_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_install_execution_costs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "job_id" INT NOT NULL,
            "line_no" INT NOT NULL DEFAULT 1,
            "cost_type" VARCHAR(20) NOT NULL,
            "amount" DECIMAL(14,2) NOT NULL,
            "occurred_at" TIMESTAMPTZ NOT NULL,
            "description" VARCHAR(500)
        );
        COMMENT ON TABLE "apps_kuaizhizao_install_execution_costs" IS '快格轻制造 - 安装执行费用';
        CREATE INDEX IF NOT EXISTS "idx_install_cost_job"
            ON "apps_kuaizhizao_install_execution_costs" ("tenant_id", "job_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_install_execution_costs";
        DROP TABLE IF EXISTS "apps_kuaizhizao_install_execution_stages";
        DROP TABLE IF EXISTS "apps_kuaizhizao_install_execution_jobs";
    """
