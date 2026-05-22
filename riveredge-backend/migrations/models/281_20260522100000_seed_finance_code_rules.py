"""
为已有组织补建轻管理会计编码规则（应收/应付/进项发票/核销）。

Author: AI Assistant
Date: 2026-05-22
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_FINANCE_RULES = [
    (
        "RECEIVABLE_CODE",
        "应收账款编码规则",
        "YS",
        "应收账款编码规则，格式：YS + 日期（YYYYMMDD）+ 4位序号，每日重置",
    ),
    (
        "PAYABLE_CODE",
        "应付账款编码规则",
        "PY",
        "应付账款编码规则，格式：PY + 日期（YYYYMMDD）+ 4位序号，每日重置",
    ),
    (
        "PURCHASE_INVOICE_CODE",
        "进项发票编码规则",
        "PI",
        "进项发票编码规则，格式：PI + 日期（YYYYMMDD）+ 4位序号，每日重置",
    ),
    (
        "SETTLEMENT_CODE",
        "核销编码规则",
        "HX",
        "核销编码规则，格式：HX + 日期（YYYYMMDD）+ 4位序号，每日重置",
    ),
]


def _rule_components_json(prefix: str) -> str:
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
        '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
        '"reset_cycle":"daily","initial_value":1}]'
    )


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = [
        "-- ============================================",
        "-- 补建轻管理会计编码规则（应收/应付/进项发票/核销）",
        "-- ============================================",
    ]
    for code, name, prefix, description in _FINANCE_RULES:
        components = _rule_components_json(prefix).replace("'", "''")
        desc = description.replace("'", "''")
        rule_name = name.replace("'", "''")
        statements.append(
            f"""
        INSERT INTO "core_code_rules" (
            "uuid", "tenant_id", "name", "code", "rule_components", "description",
            "seq_start", "seq_step", "seq_reset_rule", "is_system", "is_active",
            "allow_manual_edit", "created_at", "updated_at"
        )
        SELECT
            gen_random_uuid()::text,
            t."tenant_id",
            '{rule_name}',
            '{code}',
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
              AND r."code" = '{code}'
              AND r."deleted_at" IS NULL
        );
        """
        )
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    codes = ", ".join(f"'{c}'" for c, _, _, _ in _FINANCE_RULES)
    return f"""
        DELETE FROM "core_code_rules"
        WHERE "code" IN ({codes})
          AND "is_system" = TRUE
          AND "deleted_at" IS NULL;
    """
