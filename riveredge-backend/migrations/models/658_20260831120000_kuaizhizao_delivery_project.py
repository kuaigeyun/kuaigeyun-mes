"""快制造 — 交付项目（订单交机）独立表"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_process_templates" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "template_code" VARCHAR(50) NOT NULL,
            "template_name" VARCHAR(200) NOT NULL,
            "project_type" VARCHAR(50),
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "is_default" BOOL NOT NULL DEFAULT FALSE,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_dpt_tenant_code"
            ON "apps_kuaizhizao_delivery_process_templates" ("tenant_id", "template_code");
        CREATE INDEX IF NOT EXISTS "idx_dpt_tenant_active"
            ON "apps_kuaizhizao_delivery_process_templates" ("tenant_id", "is_active");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_process_template_nodes" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "template_id" INT NOT NULL,
            "node_key" VARCHAR(50) NOT NULL,
            "node_name" VARCHAR(100) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "default_owner_role" VARCHAR(50),
            "planned_duration_days" INT NOT NULL DEFAULT 0,
            "is_critical" BOOL NOT NULL DEFAULT FALSE,
            "is_milestone" BOOL NOT NULL DEFAULT FALSE,
            CONSTRAINT "ux_dptn_tenant_template_key" UNIQUE ("tenant_id", "template_id", "node_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_dptn_tenant_template"
            ON "apps_kuaizhizao_delivery_process_template_nodes" ("tenant_id", "template_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_projects" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "project_code" VARCHAR(50) NOT NULL,
            "project_name" VARCHAR(200) NOT NULL,
            "process_template_id" INT,
            "process_template_name" VARCHAR(200),
            "sales_order_id" INT,
            "sales_order_code" VARCHAR(50),
            "customer_id" INT,
            "customer_name" VARCHAR(200),
            "delivery_date" DATE,
            "owner_id" INT,
            "owner_name" VARCHAR(100),
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "material_spec" VARCHAR(500),
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "progress_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
            "current_node_key" VARCHAR(50),
            "current_node_name" VARCHAR(100),
            "planned_start_date" DATE,
            "planned_end_date" DATE,
            "actual_start_date" DATE,
            "actual_end_date" DATE,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_dp_tenant_code"
            ON "apps_kuaizhizao_delivery_projects" ("tenant_id", "project_code");
        CREATE INDEX IF NOT EXISTS "idx_dp_tenant_status"
            ON "apps_kuaizhizao_delivery_projects" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_dp_tenant_so"
            ON "apps_kuaizhizao_delivery_projects" ("tenant_id", "sales_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_project_nodes" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "project_id" INT NOT NULL,
            "template_node_id" INT,
            "node_key" VARCHAR(50) NOT NULL,
            "node_name" VARCHAR(100) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "status" VARCHAR(30) NOT NULL DEFAULT 'not_started',
            "progress_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
            "owner_id" INT,
            "owner_name" VARCHAR(100),
            "planned_start_date" DATE,
            "planned_end_date" DATE,
            "actual_start_date" DATE,
            "actual_end_date" DATE,
            "is_critical" BOOL NOT NULL DEFAULT FALSE,
            "is_milestone" BOOL NOT NULL DEFAULT FALSE,
            CONSTRAINT "ux_dpn_tenant_project_key" UNIQUE ("tenant_id", "project_id", "node_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_dpn_tenant_project"
            ON "apps_kuaizhizao_delivery_project_nodes" ("tenant_id", "project_id");
        CREATE INDEX IF NOT EXISTS "idx_dpn_tenant_status"
            ON "apps_kuaizhizao_delivery_project_nodes" ("tenant_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_node_reports" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "report_code" VARCHAR(50) NOT NULL,
            "project_id" INT NOT NULL,
            "project_code" VARCHAR(50) NOT NULL,
            "node_id" INT NOT NULL,
            "node_key" VARCHAR(50) NOT NULL,
            "node_name" VARCHAR(100) NOT NULL,
            "reporter_id" INT,
            "reporter_name" VARCHAR(100),
            "report_date" DATE NOT NULL,
            "progress_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
            "content" TEXT,
            "attachments" JSONB,
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "reviewed_at" TIMESTAMPTZ,
            "review_notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_dnr_tenant_code"
            ON "apps_kuaizhizao_delivery_node_reports" ("tenant_id", "report_code");
        CREATE INDEX IF NOT EXISTS "idx_dnr_tenant_project"
            ON "apps_kuaizhizao_delivery_node_reports" ("tenant_id", "project_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_issues" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "issue_code" VARCHAR(50) NOT NULL,
            "project_id" INT NOT NULL,
            "project_code" VARCHAR(50) NOT NULL,
            "node_id" INT,
            "node_name" VARCHAR(100),
            "issue_type" VARCHAR(30) NOT NULL DEFAULT 'other',
            "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
            "status" VARCHAR(30) NOT NULL DEFAULT 'open',
            "title" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "assignee_id" INT,
            "assignee_name" VARCHAR(100),
            "due_date" DATE,
            "resolved_at" TIMESTAMPTZ,
            "resolution" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_di_tenant_code"
            ON "apps_kuaizhizao_delivery_issues" ("tenant_id", "issue_code");
        CREATE INDEX IF NOT EXISTS "idx_di_tenant_project"
            ON "apps_kuaizhizao_delivery_issues" ("tenant_id", "project_id");

        INSERT INTO "apps_kuaizhizao_delivery_projects" (
            "uuid", "tenant_id", "created_at", "updated_at",
            "project_code", "project_name", "customer_name",
            "material_code", "material_name", "status", "progress_percent", "deleted_at"
        )
        SELECT
            gen_random_uuid()::text,
            rp."tenant_id",
            COALESCE(rp."created_at", NOW()),
            COALESCE(rp."updated_at", NOW()),
            rp."project_code",
            rp."project_name",
            NULL,
            rp."material_code",
            rp."material_name",
            CASE rp."status"
                WHEN 'IN_PROGRESS' THEN 'in_progress'
                WHEN 'COMPLETED' THEN 'completed'
                WHEN 'ON_HOLD' THEN 'paused'
                WHEN 'CANCELLED' THEN 'cancelled'
                ELSE 'draft'
            END,
            0,
            rp."deleted_at"
        FROM "apps_kuaiplm_rd_projects" rp
        WHERE rp."project_type" = 'DELIVERY'
          AND NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_delivery_projects" dp
            WHERE dp."tenant_id" = rp."tenant_id" AND dp."project_code" = rp."project_code"
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_issues" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_node_reports" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_project_nodes" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_projects" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_process_template_nodes" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_process_templates" CASCADE;
    """
