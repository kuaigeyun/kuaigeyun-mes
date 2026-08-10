"""
补建并默认启用需求计算编码规则（DEMAND_COMPUTATION_CODE）。

硬编码切可配置后，存量租户可能仍无该规则，或仅有旧码 DEMAND_COMPUTATION。
迁移：旧码改名 → 启用未启用规则 → 缺失则按预设 MRP+YYYYMMDD+4 位流水补建。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "DEMAND_COMPUTATION_CODE"
_LEGACY_CODE = "DEMAND_COMPUTATION"
_RULE_NAME = "需求计算编码规则"
_PREFIX = "MRP"
_DESCRIPTION = "需求计算编码规则，格式：MRP + 日期（YYYYMMDD）+ 4位序号，每日重置"


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
        -- 旧码 DEMAND_COMPUTATION → 规范码 DEMAND_COMPUTATION_CODE（同租户尚无规范码时）
        UPDATE "core_code_rules" AS legacy
        SET
            "code" = '{_RULE_CODE}',
            "name" = COALESCE(NULLIF(TRIM(legacy."name"), ''), '{rule_name}'),
            "is_active" = TRUE,
            "updated_at" = NOW()
        WHERE legacy."code" = '{_LEGACY_CODE}'
          AND legacy."deleted_at" IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM "core_code_rules" r
              WHERE r."tenant_id" = legacy."tenant_id"
                AND r."code" = '{_RULE_CODE}'
                AND r."deleted_at" IS NULL
          );

        -- 规范码已存在但未启用：默认启用
        UPDATE "core_code_rules"
        SET
            "is_active" = TRUE,
            "updated_at" = NOW()
        WHERE "code" = '{_RULE_CODE}'
          AND "deleted_at" IS NULL
          AND "is_active" IS DISTINCT FROM TRUE;

        -- 仍缺失的租户：按预设补建并启用
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
    return f"""
        -- 仅删除本迁移补建的系统预设；改名/启用过的存量规则不回滚
        DELETE FROM "core_code_rules"
        WHERE "code" = '{_RULE_CODE}'
          AND "is_system" = TRUE
          AND "deleted_at" IS NULL
          AND "description" = '{_DESCRIPTION.replace("'", "''")}';
    """
