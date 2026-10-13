"""
委外检验单表 + 编码规则补种。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True

_RULE = {
    "code": "OUTSOURCE_INSPECTION_CODE",
    "name": "委外检验编码规则",
    "prefix": "OSQC",
    "description": "委外检验编码规则，格式：OSQC + 日期（YYYYMMDD）+ 4位序号，每日重置",
}


def _rule_components_json(prefix: str) -> str:
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
        '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
        '"reset_cycle":"daily","initial_value":1}]'
    )


def _insert_rule_sql(rule: dict) -> str:
    components = _rule_components_json(rule["prefix"]).replace("'", "''")
    desc = rule["description"].replace("'", "''")
    rule_name = rule["name"].replace("'", "''")
    rule_code = rule["code"]
    return f"""
        INSERT INTO "core_code_rules" (
            "uuid", "tenant_id", "name", "code", "rule_components", "description",
            "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
            "allow_manual_edit", "created_at", "updated_at"
        )
        SELECT
            gen_random_uuid()::text,
            t."tenant_id",
            '{rule_name}',
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
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_outsource_inspections" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "inspection_code" VARCHAR(50) NOT NULL,
            "source_type" VARCHAR(30) NOT NULL DEFAULT 'outsource_receipt',
            "outsource_receipt_id" INT,
            "outsource_receipt_code" VARCHAR(50),
            "outsource_work_order_id" INT,
            "outsource_work_order_code" VARCHAR(50),
            "supplier_id" INT,
            "supplier_name" VARCHAR(200),
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20),
            "batch_number" VARCHAR(100),
            "inspection_quantity" DECIMAL(14,4) NOT NULL,
            "qualified_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
            "unqualified_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
            "inspection_result" VARCHAR(20) NOT NULL DEFAULT '待检验',
            "quality_status" VARCHAR(20) NOT NULL DEFAULT '合格',
            "inspector_id" INT,
            "inspector_name" VARCHAR(100),
            "inspection_time" TIMESTAMPTZ,
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "inspection_standard" TEXT,
            "other_checks" JSONB,
            "nonconformance_reason" TEXT,
            "disposition" VARCHAR(50),
            "corrective_action" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT '待检验',
            "attachments" JSONB,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_tenant__outsour_code" UNIQUE ("tenant_id", "inspection_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_osqc_tenant" ON "apps_kuaizhizao_outsource_inspections" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_osqc_code" ON "apps_kuaizhizao_outsource_inspections" ("inspection_code");
        CREATE INDEX IF NOT EXISTS "idx_osqc_receipt" ON "apps_kuaizhizao_outsource_inspections" ("outsource_receipt_id");
        CREATE INDEX IF NOT EXISTS "idx_osqc_owo" ON "apps_kuaizhizao_outsource_inspections" ("outsource_work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_osqc_supplier" ON "apps_kuaizhizao_outsource_inspections" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_osqc_material" ON "apps_kuaizhizao_outsource_inspections" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_osqc_status" ON "apps_kuaizhizao_outsource_inspections" ("status");
        CREATE INDEX IF NOT EXISTS "idx_osqc_quality" ON "apps_kuaizhizao_outsource_inspections" ("quality_status");
        CREATE INDEX IF NOT EXISTS "idx_osqc_created" ON "apps_kuaizhizao_outsource_inspections" ("created_at");
        {_insert_rule_sql(_RULE)}
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        DROP TABLE IF EXISTS "apps_kuaizhizao_outsource_inspections";
        DELETE FROM "core_code_rules"
        WHERE "code" = '{_RULE["code"]}'
          AND "is_system" = TRUE
          AND "deleted_at" IS NULL;
    """
