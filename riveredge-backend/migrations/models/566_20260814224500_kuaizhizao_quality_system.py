"""
质量体系：体系文件 / 内审 / 管理评审表 + 编码规则。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


def _rule_components_json(prefix: str) -> str:
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
        '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
        '"reset_cycle":"daily","initial_value":1}]'
    )


def _seed_rule_sql(rule_code: str, rule_name: str, prefix: str, description: str) -> str:
    components = _rule_components_json(prefix).replace("'", "''")
    desc = description.replace("'", "''")
    name = rule_name.replace("'", "''")
    return f"""
INSERT INTO "core_code_rules" (
    "uuid", "tenant_id", "name", "code", "rule_components", "description",
    "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
    "allow_manual_edit", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    t."tenant_id",
    '{name}',
    '{rule_code}',
    '{components}'::jsonb,
    '{desc}',
    1, 1, 'daily', TRUE, TRUE, TRUE, NOW(), NOW()
FROM (
    SELECT DISTINCT "tenant_id"
    FROM "core_code_rules"
    WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL
) t
WHERE NOT EXISTS (
    SELECT 1 FROM "core_code_rules" r
    WHERE r."tenant_id" = t."tenant_id"
      AND r."code" = '{rule_code}'
      AND r."deleted_at" IS NULL
);
"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_qms_system_documents" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "document_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "doc_type" VARCHAR(30) NOT NULL DEFAULT 'procedure',
    "version" VARCHAR(30) NOT NULL DEFAULT 'A0',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "iso_clause" VARCHAR(50),
    "content" TEXT,
    "file_url" VARCHAR(500),
    "effective_at" TIMESTAMPTZ,
    "obsolete_at" TIMESTAMPTZ,
    "owner_name" VARCHAR(100),
    "evidence_links" JSONB,
    "training_refs" JSONB,
    "attachments" JSONB,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_qms_sys_doc_tenant_code"
    ON "apps_kuaizhizao_qms_system_documents" ("tenant_id", "document_code");
CREATE INDEX IF NOT EXISTS "idx_qms_sys_doc_tenant" ON "apps_kuaizhizao_qms_system_documents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_qms_sys_doc_status" ON "apps_kuaizhizao_qms_system_documents" ("status");
CREATE INDEX IF NOT EXISTS "idx_qms_sys_doc_type" ON "apps_kuaizhizao_qms_system_documents" ("doc_type");
CREATE INDEX IF NOT EXISTS "idx_qms_sys_doc_clause" ON "apps_kuaizhizao_qms_system_documents" ("iso_clause");

CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_qms_internal_audits" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "audit_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "audit_scope" VARCHAR(500),
    "iso_clause" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'planned',
    "planned_date" TIMESTAMPTZ,
    "completed_date" TIMESTAMPTZ,
    "lead_auditor" VARCHAR(100),
    "audit_team" TEXT,
    "checklist" TEXT,
    "findings" TEXT,
    "conclusion" TEXT,
    "finding_links" JSONB,
    "training_refs" JSONB,
    "calibration_refs" JSONB,
    "attachments" JSONB,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_qms_audit_tenant_code"
    ON "apps_kuaizhizao_qms_internal_audits" ("tenant_id", "audit_code");
CREATE INDEX IF NOT EXISTS "idx_qms_audit_tenant" ON "apps_kuaizhizao_qms_internal_audits" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_qms_audit_status" ON "apps_kuaizhizao_qms_internal_audits" ("status");
CREATE INDEX IF NOT EXISTS "idx_qms_audit_planned" ON "apps_kuaizhizao_qms_internal_audits" ("planned_date");

CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_qms_management_reviews" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "review_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "review_date" TIMESTAMPTZ,
    "chairperson" VARCHAR(100),
    "attendees" TEXT,
    "inputs_summary" TEXT,
    "outputs_summary" TEXT,
    "input_links" JSONB,
    "training_refs" JSONB,
    "calibration_refs" JSONB,
    "attachments" JSONB,
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_qms_review_tenant_code"
    ON "apps_kuaizhizao_qms_management_reviews" ("tenant_id", "review_code");
CREATE INDEX IF NOT EXISTS "idx_qms_review_tenant" ON "apps_kuaizhizao_qms_management_reviews" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_qms_review_status" ON "apps_kuaizhizao_qms_management_reviews" ("status");
CREATE INDEX IF NOT EXISTS "idx_qms_review_date" ON "apps_kuaizhizao_qms_management_reviews" ("review_date");

{_seed_rule_sql("QMS_SYSTEM_DOCUMENT_CODE", "体系文件编码规则", "TXWJ", "质量体系文件编码：TXWJ+日期+序号")}
{_seed_rule_sql("QMS_INTERNAL_AUDIT_CODE", "内部审核编码规则", "NS", "质量体系内审编码：NS+日期+序号")}
{_seed_rule_sql("QMS_MANAGEMENT_REVIEW_CODE", "管理评审编码规则", "GLPS", "质量体系管理评审编码：GLPS+日期+序号")}
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaizhizao_qms_management_reviews";
DROP TABLE IF EXISTS "apps_kuaizhizao_qms_internal_audits";
DROP TABLE IF EXISTS "apps_kuaizhizao_qms_system_documents";
DELETE FROM "core_code_rules"
WHERE "code" IN (
    'QMS_SYSTEM_DOCUMENT_CODE',
    'QMS_INTERNAL_AUDIT_CODE',
    'QMS_MANAGEMENT_REVIEW_CODE'
);
"""
