"""
补建库存预警规则编码规则（ALERT_RULE_CODE）。

Author: AI Assistant
Date: 2026-07-24
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True

_RULES = (
    {
        "code": "ALERT_RULE_CODE",
        "name": "库存预警规则编码规则",
        "prefix": "AR",
        "description": "库存预警规则编码规则，格式：AR + 日期（YYYYMMDD）+ 4位序号，每日重置",
    },
)


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
    return "".join(_insert_rule_sql(rule) for rule in _RULES)


async def downgrade(db: BaseDBAsyncClient) -> str:
    codes = ", ".join(f"'{rule['code']}'" for rule in _RULES)
    return f"""
        DELETE FROM "core_code_rules"
        WHERE "code" IN ({codes})
          AND "is_system" = TRUE
          AND "deleted_at" IS NULL;
    """
