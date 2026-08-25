"""
补建采购到货延期填报编码规则。

存量租户在延期填报接入自动编码前没有该规则，生成单号会报
「编码规则 PURCHASE_ARRIVAL_DELAY_CODE 不存在或未启用」。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True

_RULE = {
    "code": "PURCHASE_ARRIVAL_DELAY_CODE",
    "name": "采购到货延期填报编码规则",
    "prefix": "PAD",
    "description": "采购到货延期填报编码规则，格式：PAD + 日期（YYYYMMDD）+ 4位序号，每日重置",
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
    return _insert_rule_sql(_RULE)


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        DELETE FROM "core_code_rules"
        WHERE "code" = '{_RULE["code"]}'
          AND "is_system" = TRUE
          AND "deleted_at" IS NULL;
    """
