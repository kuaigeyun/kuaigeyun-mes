"""
快研发：阶段门模板表与项目 gate_template_id / milestone_role

Author: RiverEdge Team
Date: 2026-07-07
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_gate_templates" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "project_type" VARCHAR(20) NOT NULL DEFAULT 'RD',
            "template_code" VARCHAR(50) NOT NULL,
            "template_name" VARCHAR(200) NOT NULL,
            "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "notes" TEXT NULL,
            "created_by" INT NULL,
            "updated_by" INT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaiplm_rd_gate_templates_tenant_type_code"
                UNIQUE ("tenant_id", "project_type", "template_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_gate_tpl_tenant_type"
            ON "apps_kuaiplm_rd_gate_templates" ("tenant_id", "project_type");
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_gate_tpl_tenant_type_default"
            ON "apps_kuaiplm_rd_gate_templates" ("tenant_id", "project_type", "is_default");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_gate_template_stages" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "template_id" INT NOT NULL,
            "gate_key" VARCHAR(30) NOT NULL,
            "gate_name" VARCHAR(100) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "milestone_role" VARCHAR(30) NOT NULL DEFAULT 'none',
            CONSTRAINT "uid_apps_kuaiplm_rd_gate_template_stages_tpl_key"
                UNIQUE ("template_id", "gate_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_gate_tpl_stage_tenant_tpl"
            ON "apps_kuaiplm_rd_gate_template_stages" ("tenant_id", "template_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_gate_template_deliverables" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "stage_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "deliverable_type" VARCHAR(50) NULL,
            "sort_order" INT NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_gate_tpl_deliv_tenant_stage"
            ON "apps_kuaiplm_rd_gate_template_deliverables" ("tenant_id", "stage_id");

        ALTER TABLE "apps_kuaiplm_rd_projects"
            ADD COLUMN IF NOT EXISTS "gate_template_id" INT NULL;
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_rd_project_gate_template"
            ON "apps_kuaiplm_rd_projects" ("gate_template_id");

        ALTER TABLE "apps_kuaiplm_rd_project_gates"
            ADD COLUMN IF NOT EXISTS "milestone_role" VARCHAR(30) NULL DEFAULT 'none';

        UPDATE "apps_kuaiplm_rd_project_gates"
        SET "milestone_role" = 'spawn_delivery'
        WHERE "gate_key" = 'release'
          AND ("milestone_role" IS NULL OR "milestone_role" = 'none');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_project_gates"
            DROP COLUMN IF EXISTS "milestone_role";
        DROP INDEX IF EXISTS "idx_kuaiplm_rd_project_gate_template";
        ALTER TABLE "apps_kuaiplm_rd_projects"
            DROP COLUMN IF EXISTS "gate_template_id";

        DROP TABLE IF EXISTS "apps_kuaiplm_rd_gate_template_deliverables";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_gate_template_stages";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_gate_templates";
    """
