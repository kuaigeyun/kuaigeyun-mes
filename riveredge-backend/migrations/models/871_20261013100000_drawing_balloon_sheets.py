"""
图纸气泡标注单表 + 编码规则 + 从 FAI 回填历史气泡数据。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True

_RULE = {
    "code": "DRAWING_BALLOON_SHEET_CODE",
    "name": "图纸气泡标注编码规则",
    "prefix": "BAL",
    "description": "图纸气泡标注编码规则，格式：BAL + 日期（YYYYMMDD）+ 4位序号，每日重置",
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
    rule_sql = _insert_rule_sql(_RULE)
    return f"""
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_drawing_balloon_sheets" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "sheet_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "drawing_no" VARCHAR(100),
            "drawing_revision" VARCHAR(50),
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "drawing_file_url" VARCHAR(500),
            "balloon_candidates" JSONB,
            "linked_fai_order_id" INT,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_balloon_sheet_code" UNIQUE ("tenant_id", "sheet_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_balloon_sheet_tenant" ON "apps_kuaizhizao_drawing_balloon_sheets" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_balloon_sheet_code" ON "apps_kuaizhizao_drawing_balloon_sheets" ("sheet_code");
        CREATE INDEX IF NOT EXISTS "idx_balloon_sheet_status" ON "apps_kuaizhizao_drawing_balloon_sheets" ("status");
        CREATE INDEX IF NOT EXISTS "idx_balloon_sheet_linked_fai" ON "apps_kuaizhizao_drawing_balloon_sheets" ("linked_fai_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_drawing_balloon_sheet_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "sheet_id" INT NOT NULL,
            "sequence" INT NOT NULL DEFAULT 1,
            "balloon_no" VARCHAR(30),
            "characteristic_name" VARCHAR(200) NOT NULL,
            "nominal_value" DECIMAL(18,6),
            "upper_tolerance" DECIMAL(18,6),
            "lower_tolerance" DECIMAL(18,6),
            "unit" VARCHAR(20),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_balloon_line_tenant" ON "apps_kuaizhizao_drawing_balloon_sheet_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_balloon_line_sheet" ON "apps_kuaizhizao_drawing_balloon_sheet_lines" ("sheet_id");

        {rule_sql}

        INSERT INTO "apps_kuaizhizao_drawing_balloon_sheets" (
            "uuid", "tenant_id", "created_at", "updated_at",
            "created_by", "created_by_name", "updated_by", "updated_by_name",
            "sheet_code", "title", "status",
            "material_id", "material_code", "material_name",
            "drawing_no", "drawing_revision",
            "work_order_id", "work_order_code",
            "drawing_file_url", "balloon_candidates", "linked_fai_order_id", "remarks"
        )
        SELECT
            gen_random_uuid()::text,
            f."tenant_id",
            f."created_at",
            f."updated_at",
            f."created_by",
            f."created_by_name",
            f."updated_by",
            f."updated_by_name",
            'FAI-MIG-' || f."id"::text,
            COALESCE(NULLIF(TRIM(f."title"), ''), '首件迁移气泡标注') || '（迁移）',
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM "apps_kuaizhizao_fai_characteristics" c
                    WHERE c."fai_order_id" = f."id"
                      AND c."tenant_id" = f."tenant_id"
                      AND c."deleted_at" IS NULL
                ) THEN 'confirmed'
                ELSE 'draft'
            END,
            f."material_id",
            f."material_code",
            f."material_name",
            f."drawing_no",
            f."drawing_revision",
            f."work_order_id",
            f."work_order_code",
            f."drawing_file_url",
            f."balloon_candidates",
            f."id",
            '自 FAI 单迁移'
        FROM "apps_kuaizhizao_fai_orders" f
        WHERE f."deleted_at" IS NULL
          AND (
            (f."drawing_file_url" IS NOT NULL AND TRIM(f."drawing_file_url") <> '')
            OR (f."balloon_candidates" IS NOT NULL AND f."balloon_candidates"::text NOT IN ('null', '[]', ''))
          )
          AND NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_drawing_balloon_sheets" s
            WHERE s."tenant_id" = f."tenant_id"
              AND s."linked_fai_order_id" = f."id"
              AND s."deleted_at" IS NULL
          );

        INSERT INTO "apps_kuaizhizao_drawing_balloon_sheet_lines" (
            "uuid", "tenant_id", "created_at", "updated_at",
            "sheet_id", "sequence", "balloon_no", "characteristic_name",
            "nominal_value", "upper_tolerance", "lower_tolerance", "unit", "remarks"
        )
        SELECT
            gen_random_uuid()::text,
            c."tenant_id",
            c."created_at",
            c."updated_at",
            s."id",
            c."sequence",
            c."balloon_no",
            c."characteristic_name",
            c."nominal_value",
            c."upper_tolerance",
            c."lower_tolerance",
            c."unit",
            c."remarks"
        FROM "apps_kuaizhizao_fai_characteristics" c
        INNER JOIN "apps_kuaizhizao_drawing_balloon_sheets" s
            ON s."linked_fai_order_id" = c."fai_order_id"
           AND s."tenant_id" = c."tenant_id"
           AND s."deleted_at" IS NULL
           AND s."sheet_code" LIKE 'FAI-MIG-%'
        WHERE c."deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_drawing_balloon_sheet_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_drawing_balloon_sheets";
    """
