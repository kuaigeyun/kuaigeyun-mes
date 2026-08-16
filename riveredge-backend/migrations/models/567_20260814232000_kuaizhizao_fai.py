"""
FAI 首件检验单/特性表 + 编码规则。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "FAI_ORDER_CODE"
_RULE_NAME = "FAI首件检验编码规则"
_PREFIX = "FAI"
_DESCRIPTION = "FAI编码：FAI+日期+序号"


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
CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_fai_orders" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "fai_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "trigger_reason" VARCHAR(30) NOT NULL DEFAULT 'new_part',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "conclusion" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "material_id" INT,
    "material_code" VARCHAR(50),
    "material_name" VARCHAR(200),
    "drawing_no" VARCHAR(100),
    "drawing_revision" VARCHAR(50),
    "work_order_id" INT,
    "work_order_code" VARCHAR(50),
    "inspection_plan_id" INT,
    "inspection_plan_code" VARCHAR(50),
    "part_number" VARCHAR(100),
    "part_name" VARCHAR(200),
    "serial_number" VARCHAR(100),
    "lot_number" VARCHAR(100),
    "material_spec" VARCHAR(200),
    "process_spec" TEXT,
    "organization_name" VARCHAR(200),
    "sample_size" INT NOT NULL DEFAULT 1,
    "cpk_summary" JSONB,
    "drawing_file_url" VARCHAR(500),
    "balloon_candidates" JSONB,
    "attachments" JSONB,
    "remarks" TEXT,
    "submitted_at" TIMESTAMPTZ,
    "approved_at" TIMESTAMPTZ,
    "approved_by" INT,
    "approved_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_fai_orders_tenant_code"
    ON "apps_kuaizhizao_fai_orders" ("tenant_id", "fai_code");
CREATE INDEX IF NOT EXISTS "idx_fai_orders_tenant" ON "apps_kuaizhizao_fai_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_fai_orders_status" ON "apps_kuaizhizao_fai_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_fai_orders_material" ON "apps_kuaizhizao_fai_orders" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_fai_orders_wo" ON "apps_kuaizhizao_fai_orders" ("work_order_id");

CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_fai_characteristics" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "fai_order_id" INT NOT NULL,
    "sequence" INT NOT NULL DEFAULT 1,
    "balloon_no" VARCHAR(30),
    "characteristic_name" VARCHAR(200) NOT NULL,
    "nominal_value" DECIMAL(18,6),
    "upper_tolerance" DECIMAL(18,6),
    "lower_tolerance" DECIMAL(18,6),
    "unit" VARCHAR(20),
    "measured_value" DECIMAL(18,6),
    "sample_values" JSONB,
    "judgment" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "gauge_id" INT,
    "gauge_code" VARCHAR(50),
    "gauge_name" VARCHAR(100),
    "source_step_key" VARCHAR(50),
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_fai_chars_order" ON "apps_kuaizhizao_fai_characteristics" ("tenant_id", "fai_order_id");
CREATE INDEX IF NOT EXISTS "idx_fai_chars_balloon" ON "apps_kuaizhizao_fai_characteristics" ("balloon_no");
CREATE INDEX IF NOT EXISTS "idx_fai_chars_seq" ON "apps_kuaizhizao_fai_characteristics" ("sequence");

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
DROP TABLE IF EXISTS "apps_kuaizhizao_fai_characteristics";
DROP TABLE IF EXISTS "apps_kuaizhizao_fai_orders";
DELETE FROM "core_code_rules" WHERE "code" = 'FAI_ORDER_CODE';
"""
