"""
质量体系 ISO 条款目录表 + 体系文件/内审 iso_clause_id 外键。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_qms_iso_clauses" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "standard_code" VARCHAR(30) NOT NULL,
    "clause_code" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "parent_id" INT,
    "sort_order" INT NOT NULL DEFAULT 0,
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_qms_iso_clause_tenant_std_code"
    ON "apps_kuaizhizao_qms_iso_clauses" ("tenant_id", "standard_code", "clause_code")
    WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_qms_iso_clause_tenant" ON "apps_kuaizhizao_qms_iso_clauses" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_qms_iso_clause_standard" ON "apps_kuaizhizao_qms_iso_clauses" ("standard_code");
CREATE INDEX IF NOT EXISTS "idx_qms_iso_clause_parent" ON "apps_kuaizhizao_qms_iso_clauses" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_qms_iso_clause_active" ON "apps_kuaizhizao_qms_iso_clauses" ("is_active");

ALTER TABLE "apps_kuaizhizao_qms_system_documents"
    ADD COLUMN IF NOT EXISTS "iso_clause_id" INT;
CREATE INDEX IF NOT EXISTS "idx_qms_sys_doc_clause_id"
    ON "apps_kuaizhizao_qms_system_documents" ("iso_clause_id");

ALTER TABLE "apps_kuaizhizao_qms_internal_audits"
    ADD COLUMN IF NOT EXISTS "iso_clause_id" INT;
CREATE INDEX IF NOT EXISTS "idx_qms_internal_audit_clause_id"
    ON "apps_kuaizhizao_qms_internal_audits" ("iso_clause_id");

UPDATE "apps_kuaizhizao_qms_system_documents" d
SET "iso_clause_id" = c."id"
FROM "apps_kuaizhizao_qms_iso_clauses" c
WHERE d."deleted_at" IS NULL
  AND c."deleted_at" IS NULL
  AND d."tenant_id" = c."tenant_id"
  AND d."iso_clause_id" IS NULL
  AND d."iso_clause" IS NOT NULL
  AND TRIM(d."iso_clause") = c."clause_code";

UPDATE "apps_kuaizhizao_qms_internal_audits" a
SET "iso_clause_id" = c."id"
FROM "apps_kuaizhizao_qms_iso_clauses" c
WHERE a."deleted_at" IS NULL
  AND c."deleted_at" IS NULL
  AND a."tenant_id" = c."tenant_id"
  AND a."iso_clause_id" IS NULL
  AND a."iso_clause" IS NOT NULL
  AND TRIM(a."iso_clause") = c."clause_code";
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_qms_internal_audit_clause_id";
ALTER TABLE "apps_kuaizhizao_qms_internal_audits" DROP COLUMN IF EXISTS "iso_clause_id";
DROP INDEX IF EXISTS "idx_qms_sys_doc_clause_id";
ALTER TABLE "apps_kuaizhizao_qms_system_documents" DROP COLUMN IF EXISTS "iso_clause_id";
DROP TABLE IF EXISTS "apps_kuaizhizao_qms_iso_clauses";
"""
