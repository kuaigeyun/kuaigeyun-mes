"""交付/研发：项目成员 + 节点/门预置任务与实例任务"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_process_template_node_tasks" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "template_node_id" INT NOT NULL,
            "task_key" VARCHAR(50) NOT NULL,
            "task_name" VARCHAR(200) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "default_owner_role" VARCHAR(50),
            "planned_duration_days" INT NOT NULL DEFAULT 0,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            CONSTRAINT "uid_dpt_node_task_key" UNIQUE ("tenant_id", "template_node_id", "task_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_dpt_node_tasks_tenant_node"
            ON "apps_kuaizhizao_delivery_process_template_node_tasks" ("tenant_id", "template_node_id");
        CREATE INDEX IF NOT EXISTS "idx_dpt_node_tasks_uuid"
            ON "apps_kuaizhizao_delivery_process_template_node_tasks" ("uuid");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_project_members" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "user_name" VARCHAR(100) NOT NULL,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_dp_members_tenant_project"
            ON "apps_kuaizhizao_delivery_project_members" ("tenant_id", "project_id");
        CREATE INDEX IF NOT EXISTS "idx_dp_members_tenant_user"
            ON "apps_kuaizhizao_delivery_project_members" ("tenant_id", "user_id");
        CREATE INDEX IF NOT EXISTS "idx_dp_members_uuid"
            ON "apps_kuaizhizao_delivery_project_members" ("uuid");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_project_node_tasks" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL,
            "node_id" INT NOT NULL,
            "template_task_id" INT,
            "task_key" VARCHAR(50),
            "task_name" VARCHAR(200) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "status" VARCHAR(30) NOT NULL DEFAULT 'todo',
            "owner_id" INT,
            "owner_name" VARCHAR(100),
            "members_json" JSONB,
            "planned_start_date" DATE,
            "planned_end_date" DATE,
            "actual_start_date" DATE,
            "actual_end_date" DATE,
            "progress_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_dp_node_tasks_tenant_project"
            ON "apps_kuaizhizao_delivery_project_node_tasks" ("tenant_id", "project_id");
        CREATE INDEX IF NOT EXISTS "idx_dp_node_tasks_tenant_node"
            ON "apps_kuaizhizao_delivery_project_node_tasks" ("tenant_id", "node_id");
        CREATE INDEX IF NOT EXISTS "idx_dp_node_tasks_tenant_status"
            ON "apps_kuaizhizao_delivery_project_node_tasks" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_dp_node_tasks_uuid"
            ON "apps_kuaizhizao_delivery_project_node_tasks" ("uuid");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_gate_template_tasks" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "stage_id" INT NOT NULL,
            "parent_template_task_id" INT,
            "task_name" VARCHAR(200) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "default_owner_role" VARCHAR(50),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_rd_gate_tpl_tasks_tenant_stage"
            ON "apps_kuaiplm_rd_gate_template_tasks" ("tenant_id", "stage_id");
        CREATE INDEX IF NOT EXISTS "idx_rd_gate_tpl_tasks_uuid"
            ON "apps_kuaiplm_rd_gate_template_tasks" ("uuid");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_project_members" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "user_name" VARCHAR(100) NOT NULL,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_rd_members_tenant_project"
            ON "apps_kuaiplm_rd_project_members" ("tenant_id", "project_id");
        CREATE INDEX IF NOT EXISTS "idx_rd_members_tenant_user"
            ON "apps_kuaiplm_rd_project_members" ("tenant_id", "user_id");
        CREATE INDEX IF NOT EXISTS "idx_rd_members_uuid"
            ON "apps_kuaiplm_rd_project_members" ("uuid");

        ALTER TABLE "apps_kuaiplm_rd_project_tasks"
            ADD COLUMN IF NOT EXISTS "members_json" JSONB,
            ADD COLUMN IF NOT EXISTS "template_task_id" INT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_project_tasks"
            DROP COLUMN IF EXISTS "template_task_id",
            DROP COLUMN IF EXISTS "members_json";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_project_members";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_gate_template_tasks";
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_project_node_tasks";
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_project_members";
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_process_template_node_tasks";
    """
