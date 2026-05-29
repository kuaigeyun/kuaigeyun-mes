"""
创建快研发 (kuaiplm) 相关表及编码规则

Author: RiverEdge Team
Date: 2026-05-28
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


def _rule_components(prefix: str) -> str:
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
        '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
        '"reset_cycle":"daily","initial_value":1}]'
    )


async def upgrade(db: BaseDBAsyncClient) -> str:
    yfxm = _rule_components("YFXM").replace("'", "''")
    return f"""
        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_projects" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_code" VARCHAR(50) NOT NULL,
            "project_name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "current_gate_key" VARCHAR(30),
            "owner_id" INT,
            "owner_name" VARCHAR(100),
            "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
            "planned_start_date" DATE,
            "planned_end_date" DATE,
            "actual_start_date" DATE,
            "actual_end_date" DATE,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_proj_tenant" ON "apps_kuaiplm_rd_projects" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_proj_code" ON "apps_kuaiplm_rd_projects" ("project_code");
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_proj_status" ON "apps_kuaiplm_rd_projects" ("status");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaiplm_proj_tenant_code_active"
            ON "apps_kuaiplm_rd_projects" ("tenant_id", "project_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_project_gates" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL REFERENCES "apps_kuaiplm_rd_projects"("id") ON DELETE CASCADE,
            "gate_key" VARCHAR(30) NOT NULL,
            "gate_name" VARCHAR(100) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
            "planned_date" DATE,
            "actual_date" DATE,
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_notes" TEXT,
            "criteria" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_gate_project" ON "apps_kuaiplm_rd_project_gates" ("project_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaiplm_gate_project_key"
            ON "apps_kuaiplm_rd_project_gates" ("tenant_id", "project_id", "gate_key");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_project_tasks" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL REFERENCES "apps_kuaiplm_rd_projects"("id") ON DELETE CASCADE,
            "gate_id" INT REFERENCES "apps_kuaiplm_rd_project_gates"("id") ON DELETE SET NULL,
            "task_name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "status" VARCHAR(30) NOT NULL DEFAULT 'TODO',
            "assignee_id" INT,
            "assignee_name" VARCHAR(100),
            "due_date" DATE,
            "completed_at" TIMESTAMPTZ,
            "sort_order" INT NOT NULL DEFAULT 0,
            "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_task_project" ON "apps_kuaiplm_rd_project_tasks" ("project_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_project_deliverables" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL REFERENCES "apps_kuaiplm_rd_projects"("id") ON DELETE CASCADE,
            "gate_id" INT REFERENCES "apps_kuaiplm_rd_project_gates"("id") ON DELETE SET NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "deliverable_type" VARCHAR(50),
            "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
            "file_url" VARCHAR(500),
            "file_name" VARCHAR(200),
            "submitted_at" TIMESTAMPTZ,
            "approved_at" TIMESTAMPTZ,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_deliv_project" ON "apps_kuaiplm_rd_project_deliverables" ("project_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_project_links" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_id" INT NOT NULL REFERENCES "apps_kuaiplm_rd_projects"("id") ON DELETE CASCADE,
            "link_type" VARCHAR(50) NOT NULL,
            "target_type" VARCHAR(50) NOT NULL,
            "target_id" INT,
            "target_uuid" VARCHAR(36),
            "target_code" VARCHAR(100),
            "target_name" VARCHAR(200),
            "notes" TEXT,
            "created_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_link_project" ON "apps_kuaiplm_rd_project_links" ("project_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_link_target" ON "apps_kuaiplm_rd_project_links" ("target_type", "target_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_kb_spaces" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "space_code" VARCHAR(50) NOT NULL,
            "space_name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "parent_space_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_kb_space_tenant" ON "apps_kuaiplm_kb_spaces" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaiplm_kb_space_code_active"
            ON "apps_kuaiplm_kb_spaces" ("tenant_id", "space_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_kb_articles" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "space_id" INT NOT NULL REFERENCES "apps_kuaiplm_kb_spaces"("id") ON DELETE CASCADE,
            "article_code" VARCHAR(50),
            "title" VARCHAR(300) NOT NULL,
            "content" TEXT,
            "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            "tags" JSONB,
            "author_id" INT,
            "author_name" VARCHAR(100),
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_kb_article_space" ON "apps_kuaiplm_kb_articles" ("space_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_kb_article_title" ON "apps_kuaiplm_kb_articles" ("title");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_kb_article_links" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "article_id" INT NOT NULL REFERENCES "apps_kuaiplm_kb_articles"("id") ON DELETE CASCADE,
            "link_type" VARCHAR(50) NOT NULL,
            "target_type" VARCHAR(50) NOT NULL,
            "target_id" INT,
            "target_uuid" VARCHAR(36),
            "target_code" VARCHAR(100),
            "target_name" VARCHAR(200),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_kb_link_article" ON "apps_kuaiplm_kb_article_links" ("article_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_requirements" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_id" INT REFERENCES "apps_kuaiplm_rd_projects"("id") ON DELETE SET NULL,
            "requirement_code" VARCHAR(50),
            "title" VARCHAR(300) NOT NULL,
            "description" TEXT,
            "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
            "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            "source_type" VARCHAR(50),
            "source_id" INT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_req_project" ON "apps_kuaiplm_rd_requirements" ("project_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_design_reviews" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_id" INT REFERENCES "apps_kuaiplm_rd_projects"("id") ON DELETE SET NULL,
            "review_code" VARCHAR(50),
            "title" VARCHAR(300) NOT NULL,
            "review_type" VARCHAR(50),
            "status" VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_date" DATE,
            "review_notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_dr_project" ON "apps_kuaiplm_rd_design_reviews" ("project_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiplm_rd_fmea_records" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "project_id" INT REFERENCES "apps_kuaiplm_rd_projects"("id") ON DELETE SET NULL,
            "fmea_code" VARCHAR(50),
            "title" VARCHAR(300) NOT NULL,
            "fmea_type" VARCHAR(20) NOT NULL DEFAULT 'DFMEA',
            "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "risk_items" JSONB,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_fmea_project" ON "apps_kuaiplm_rd_fmea_records" ("project_id");

        INSERT INTO "core_code_rules" (
            "uuid", "tenant_id", "name", "code", "rule_components", "description",
            "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
            "allow_manual_edit", "created_at", "updated_at"
        )
        SELECT gen_random_uuid()::text, t."tenant_id", '研发项目编码', 'RD_PROJECT_CODE',
            '{yfxm}'::jsonb, '研发项目 YFXM+日期+序号', 1, 1, 'daily', TRUE, TRUE, TRUE, NOW(), NOW()
        FROM (SELECT DISTINCT "tenant_id" FROM "core_code_rules" WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL) t
        WHERE NOT EXISTS (
            SELECT 1 FROM "core_code_rules" r WHERE r."tenant_id"=t."tenant_id" AND r."code"='RD_PROJECT_CODE' AND r."deleted_at" IS NULL
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_fmea_records";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_design_reviews";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_requirements";
        DROP TABLE IF EXISTS "apps_kuaiplm_kb_article_links";
        DROP TABLE IF EXISTS "apps_kuaiplm_kb_articles";
        DROP TABLE IF EXISTS "apps_kuaiplm_kb_spaces";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_project_links";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_project_deliverables";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_project_tasks";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_project_gates";
        DROP TABLE IF EXISTS "apps_kuaiplm_rd_projects";
    """
