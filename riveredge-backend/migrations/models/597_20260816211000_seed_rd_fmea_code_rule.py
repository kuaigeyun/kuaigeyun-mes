"""
补建 FMEA 编码规则（RD_FMEA_CODE），并回填历史空编号。

与设计评审同因：存量租户未种子该规则，历史 fmea_code 为空。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "RD_FMEA_CODE"
_RULE_NAME = "失效分析编码规则"
_PREFIX = "FMEA"
_DESCRIPTION = "失效分析编码规则，格式：FMEA + 日期（YYYYMMDD）+ 4位序号，每日重置"


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
        UPDATE "core_code_rules"
        SET
            "is_active" = TRUE,
            "updated_at" = NOW()
        WHERE "code" = '{_RULE_CODE}'
          AND "deleted_at" IS NULL
          AND "is_active" IS DISTINCT FROM TRUE;

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

        WITH ranked AS (
            SELECT
                d."id",
                to_char((d."created_at" AT TIME ZONE 'UTC'), 'YYYYMMDD') AS day_key,
                ROW_NUMBER() OVER (
                    PARTITION BY d."tenant_id", (d."created_at" AT TIME ZONE 'UTC')::date
                    ORDER BY d."id"
                ) AS rn
            FROM "apps_kuaiplm_rd_fmea_records" d
            WHERE d."deleted_at" IS NULL
              AND (d."fmea_code" IS NULL OR BTRIM(d."fmea_code") = '')
        )
        UPDATE "apps_kuaiplm_rd_fmea_records" AS t
        SET
            "fmea_code" = '{_PREFIX}' || ranked.day_key || LPAD(ranked.rn::text, 4, '0'),
            "updated_at" = NOW()
        FROM ranked
        WHERE t."id" = ranked."id";

        UPDATE "apps_kuaiplm_rd_project_links" AS l
        SET
            "target_code" = d."fmea_code",
            "updated_at" = NOW()
        FROM "apps_kuaiplm_rd_fmea_records" AS d
        WHERE l."target_type" = 'fmea'
          AND l."target_id" = d."id"
          AND d."deleted_at" IS NULL
          AND NULLIF(BTRIM(d."fmea_code"), '') IS NOT NULL
          AND (l."target_code" IS NULL OR BTRIM(l."target_code") = '');
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        DELETE FROM "core_code_rules"
        WHERE "code" = '{_RULE_CODE}'
          AND "is_system" IS TRUE;
        """
