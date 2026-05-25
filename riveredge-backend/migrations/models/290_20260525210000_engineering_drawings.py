"""
创建工程图纸表及 ENGINEERING_DRAWING_CODE 编码规则。

Author: AI Assistant
Date: 2026-05-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "ENGINEERING_DRAWING_CODE"
_RULE_NAME = "工程图纸编码规则"
_PREFIX = "TZ"
_DESCRIPTION = "工程图纸图号规则，格式：TZ + 日期（YYYYMMDD）+ 4位序号，每日重置"


def _rule_components_json(prefix: str) -> str:
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
        '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
        '"reset_cycle":"daily","initial_value":1}]'
    )


async def upgrade(db: BaseDBAsyncClient) -> str:
    components = _rule_components_json(_PREFIX).replace("'", "''")
    desc = _DESCRIPTION.replace("'", "''")
    rule_name = _RULE_NAME.replace("'", "''")
    return f"""
        CREATE TABLE IF NOT EXISTS "apps_master_data_engineering_drawings" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "revision" VARCHAR(20) NOT NULL DEFAULT 'A',
            "drawing_type" VARCHAR(20) NOT NULL DEFAULT 'part',
            "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
            "file_uuid" VARCHAR(36) NOT NULL,
            "supplementary_file_uuids" JSONB,
            "material_uuids" JSONB,
            "process_route_uuids" JSONB,
            "operation_uuids" JSONB,
            "description" TEXT,
            "released_at" TIMESTAMPTZ,
            "released_by" INT,
            "obsolete_at" TIMESTAMPTZ,
            "obsolete_reason" TEXT,
            "created_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_eng_drawing_tenant"
            ON "apps_master_data_engineering_drawings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_eng_drawing_code"
            ON "apps_master_data_engineering_drawings" ("code");
        CREATE INDEX IF NOT EXISTS "idx_eng_drawing_status"
            ON "apps_master_data_engineering_drawings" ("status");
        CREATE INDEX IF NOT EXISTS "idx_eng_drawing_type"
            ON "apps_master_data_engineering_drawings" ("drawing_type");

        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_eng_drawing_tenant_code_rev"
            ON "apps_master_data_engineering_drawings" ("tenant_id", "code", "revision")
            WHERE "deleted_at" IS NULL;

        INSERT INTO "core_code_rules" (
            "uuid", "tenant_id", "name", "code", "rule_components", "description",
            "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
            "allow_manual_edit", "created_at", "updated_at"
        )
        SELECT
            gen_random_uuid()::text,
            t."tenant_id",
            '{rule_name}',
            '{_RULE_CODE}',
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
              AND r."code" = '{_RULE_CODE}'
              AND r."deleted_at" IS NULL
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_engineering_drawings";
        DELETE FROM "core_code_rules" WHERE "code" = 'ENGINEERING_DRAWING_CODE';
    """
