"""
补建销售发票编码规则，并将历史 UUID 系统编号回填为 SI 业务编码。

Author: AI Assistant
Date: 2026-05-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "SALES_INVOICE_CODE"
_RULE_NAME = "销售发票编码规则"
_PREFIX = "SI"
_DESCRIPTION = "销售发票编码规则，格式：SI + 日期（YYYYMMDD）+ 4位序号，每日重置"


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
        -- 补建销售发票编码规则
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

        -- 历史销项发票：UUID 系统编号回填为 SI 业务编码
        WITH numbered AS (
            SELECT
                i."id",
                i."tenant_id",
                TO_CHAR(COALESCE(i."invoice_date", i."created_at"::date), 'YYYYMMDD') AS d,
                ROW_NUMBER() OVER (
                    PARTITION BY i."tenant_id",
                        TO_CHAR(COALESCE(i."invoice_date", i."created_at"::date), 'YYYYMMDD')
                    ORDER BY i."id"
                ) AS rn
            FROM "apps_kuaicaiwu_invoices" i
            WHERE i."category" = 'OUT'
              AND i."invoice_code" ~* '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[1-8][0-9a-f]{{3}}-[89ab][0-9a-f]{{3}}-[0-9a-f]{{12}}$'
        )
        UPDATE "apps_kuaicaiwu_invoices" i
        SET "invoice_code" = '{_PREFIX}' || n.d || LPAD(n.rn::text, 4, '0'),
            "updated_at" = NOW()
        FROM numbered n
        WHERE i."id" = n."id";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        DELETE FROM "core_code_rules"
        WHERE "code" = '{_RULE_CODE}'
          AND "is_system" = TRUE
          AND "deleted_at" IS NULL;
    """
