"""
图纸工程变更 + 图档发放单 / 发放控制。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_changes" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "drawing_id" INT NOT NULL,
    "drawing_uuid" VARCHAR(36) NOT NULL,
    "drawing_code" VARCHAR(50) NOT NULL,
    "drawing_name" VARCHAR(200) NOT NULL,
    "drawing_revision" VARCHAR(20) NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "change_content" JSONB,
    "change_reason" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "applicant_id" INT NOT NULL,
    "approver_id" INT,
    "approval_comment" TEXT,
    "applied_at" TIMESTAMPTZ,
    "result_drawing_uuid" VARCHAR(36),
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_drawing_changes_tenant" ON "apps_master_data_drawing_changes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_drawing_changes_drawing" ON "apps_master_data_drawing_changes" ("drawing_id");
CREATE INDEX IF NOT EXISTS "idx_drawing_changes_status" ON "apps_master_data_drawing_changes" ("status");

CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_distribution_policies" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "is_enabled" BOOL NOT NULL DEFAULT FALSE,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_drawing_dist_policy_tenant"
    ON "apps_master_data_drawing_distribution_policies" ("tenant_id");

CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_distributions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "remark" TEXT,
    "issued_at" TIMESTAMPTZ,
    "issued_by" INT,
    "issued_by_name" VARCHAR(100),
    "recalled_at" TIMESTAMPTZ,
    "recalled_by" INT,
    "recalled_by_name" VARCHAR(100),
    "recall_reason" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_drawing_dist_tenant" ON "apps_master_data_drawing_distributions" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_drawing_dist_code"
    ON "apps_master_data_drawing_distributions" ("tenant_id", "code")
    WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_distribution_lines" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "distribution_id" INT NOT NULL,
    "drawing_id" INT NOT NULL,
    "drawing_uuid" VARCHAR(36) NOT NULL,
    "drawing_code" VARCHAR(50) NOT NULL,
    "drawing_name" VARCHAR(200) NOT NULL,
    "drawing_revision" VARCHAR(20) NOT NULL,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_drawing_dist_line_dist" ON "apps_master_data_drawing_distribution_lines" ("distribution_id");
CREATE INDEX IF NOT EXISTS "idx_drawing_dist_line_drawing" ON "apps_master_data_drawing_distribution_lines" ("drawing_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_master_data_drawing_distribution_lines";
DROP TABLE IF EXISTS "apps_master_data_drawing_distributions";
DROP TABLE IF EXISTS "apps_master_data_drawing_distribution_policies";
DROP TABLE IF EXISTS "apps_master_data_drawing_changes";
"""
