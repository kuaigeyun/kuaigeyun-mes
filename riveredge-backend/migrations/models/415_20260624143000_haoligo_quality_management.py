"""好力 GO — 品质管理一期三类单据表。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_quality_issue_tracking" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "tenant_id" INT NOT NULL,
            "sheet_no" VARCHAR(64),
            "title" VARCHAR(200),
            "production_line" VARCHAR(200),
            "problem_description" TEXT,
            "immediate_action" TEXT,
            "long_term_action" TEXT,
            "due_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "status" VARCHAR(32) NOT NULL DEFAULT 'registered',
            "attachment_file_uuids" JSONB NOT NULL DEFAULT '[]',
            "registrant_user_id" INT,
            "registrant_name" VARCHAR(100),
            "responsible_user_id" INT,
            "responsible_name" VARCHAR(100),
            "notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            "reported_at" TIMESTAMPTZ,
            "issue_type_codes" JSONB NOT NULL DEFAULT '[]',
            "defect_qty" DECIMAL(18,6),
            "workshop_id" INT REFERENCES "haoligo_workshop" ("id") ON DELETE SET NULL,
            "equipment_id" INT REFERENCES "haoligo_equipment" ("id") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_hqit_tenant" ON "haoligo_quality_issue_tracking" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_hqit_status" ON "haoligo_quality_issue_tracking" ("status");
        CREATE INDEX IF NOT EXISTS "idx_hqit_reported_at" ON "haoligo_quality_issue_tracking" ("reported_at");
        CREATE INDEX IF NOT EXISTS "idx_hqit_sheet_no" ON "haoligo_quality_issue_tracking" ("sheet_no");

        CREATE TABLE IF NOT EXISTS "haoligo_customer_complaint" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "tenant_id" INT NOT NULL,
            "sheet_no" VARCHAR(64),
            "title" VARCHAR(200),
            "production_line" VARCHAR(200),
            "problem_description" TEXT,
            "immediate_action" TEXT,
            "long_term_action" TEXT,
            "due_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "status" VARCHAR(32) NOT NULL DEFAULT 'registered',
            "attachment_file_uuids" JSONB NOT NULL DEFAULT '[]',
            "registrant_user_id" INT,
            "registrant_name" VARCHAR(100),
            "responsible_user_id" INT,
            "responsible_name" VARCHAR(100),
            "notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            "reported_at" TIMESTAMPTZ,
            "customer_name" VARCHAR(200),
            "material_code" VARCHAR(100),
            "model" VARCHAR(100),
            "quantity" DECIMAL(18,6),
            "claim_amount" DECIMAL(18,2),
            "workshop_id" INT REFERENCES "haoligo_workshop" ("id") ON DELETE SET NULL,
            "equipment_id" INT REFERENCES "haoligo_equipment" ("id") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_hcc_tenant" ON "haoligo_customer_complaint" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_hcc_status" ON "haoligo_customer_complaint" ("status");
        CREATE INDEX IF NOT EXISTS "idx_hcc_reported_at" ON "haoligo_customer_complaint" ("reported_at");
        CREATE INDEX IF NOT EXISTS "idx_hcc_sheet_no" ON "haoligo_customer_complaint" ("sheet_no");

        CREATE TABLE IF NOT EXISTS "haoligo_line_stop_feedback" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "tenant_id" INT NOT NULL,
            "sheet_no" VARCHAR(64),
            "title" VARCHAR(200),
            "production_line" VARCHAR(200),
            "problem_description" TEXT,
            "immediate_action" TEXT,
            "long_term_action" TEXT,
            "due_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "status" VARCHAR(32) NOT NULL DEFAULT 'registered',
            "attachment_file_uuids" JSONB NOT NULL DEFAULT '[]',
            "registrant_user_id" INT,
            "registrant_name" VARCHAR(100),
            "responsible_user_id" INT,
            "responsible_name" VARCHAR(100),
            "notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            "reported_at" TIMESTAMPTZ,
            "stop_kind" VARCHAR(32) NOT NULL DEFAULT 'equipment',
            "stop_reason" TEXT,
            "stop_started_at" TIMESTAMPTZ,
            "recovered_at" TIMESTAMPTZ,
            "workshop_id" INT REFERENCES "haoligo_workshop" ("id") ON DELETE SET NULL,
            "equipment_id" INT REFERENCES "haoligo_equipment" ("id") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_hls_tenant" ON "haoligo_line_stop_feedback" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_hls_status" ON "haoligo_line_stop_feedback" ("status");
        CREATE INDEX IF NOT EXISTS "idx_hls_reported_at" ON "haoligo_line_stop_feedback" ("reported_at");
        CREATE INDEX IF NOT EXISTS "idx_hls_sheet_no" ON "haoligo_line_stop_feedback" ("sheet_no");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_line_stop_feedback";
        DROP TABLE IF EXISTS "haoligo_customer_complaint";
        DROP TABLE IF EXISTS "haoligo_quality_issue_tracking";
    """
