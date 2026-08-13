"""
补建物流编码规则：货运单、运费单、承运商、驾驶员。

存量租户在物流模块接入自动编码前没有这些规则，生成单号会报
「编码规则 FREIGHT_ORDER_CODE 不存在或未启用」。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULES = (
    {
        "code": "FREIGHT_ORDER_CODE",
        "name": "货运单编码规则",
        "prefix": "HYD",
        "with_date": True,
        "description": "货运单编码规则，格式：HYD + 日期（YYYYMMDD）+ 4位序号，每日重置",
    },
    {
        "code": "FREIGHT_BILL_CODE",
        "name": "运费单编码规则",
        "prefix": "YFD",
        "with_date": True,
        "description": "运费单编码规则，格式：YFD + 日期（YYYYMMDD）+ 4位序号，每日重置",
    },
    {
        "code": "LOGISTICS_CARRIER_CODE",
        "name": "承运商编码规则",
        "prefix": "CYS",
        "with_date": False,
        "description": "承运商编码规则，格式：CYS + 4位序号",
    },
    {
        "code": "DRIVER_CODE",
        "name": "驾驶员编码规则",
        "prefix": "JSY",
        "with_date": False,
        "description": "驾驶员编码规则，格式：JSY + 4位序号",
    },
)


def _rule_components_json(prefix: str, *, with_date: bool) -> str:
    if with_date:
        return (
            '[{"type":"fixed_text","order":0,"text":"'
            + prefix
            + '"},{"type":"date","order":1,"format_type":"preset","preset_format":"YYYYMMDD"},'
            '{"type":"auto_counter","order":2,"digits":4,"fixed_width":true,'
            '"reset_cycle":"daily","initial_value":1}]'
        )
    return (
        '[{"type":"fixed_text","order":0,"text":"'
        + prefix
        + '"},{"type":"auto_counter","order":1,"digits":4,"fixed_width":true,'
        '"reset_cycle":"never","initial_value":1}]'
    )


def _insert_rule_sql(rule: dict) -> str:
    components = _rule_components_json(rule["prefix"], with_date=rule["with_date"]).replace("'", "''")
    desc = rule["description"].replace("'", "''")
    rule_name = rule["name"].replace("'", "''")
    rule_code = rule["code"]
    seq_reset = "daily" if rule["with_date"] else "never"
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
            1, 1, '{seq_reset}', TRUE, TRUE, TRUE, NOW(), NOW()
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
