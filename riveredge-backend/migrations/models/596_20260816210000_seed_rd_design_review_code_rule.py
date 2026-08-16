"""
补建设计评审编码规则（RD_DESIGN_REVIEW_CODE），并回填历史空编号。

存量租户仅种子了 RD_PROJECT_CODE，设计评审创建时规则缺失会导致预览失败，
历史数据 review_code 为空，列表显示「-」。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "RD_DESIGN_REVIEW_CODE"
_RULE_NAME = "设计评审编码规则"
_PREFIX = "SJPJ"
_DESCRIPTION = "设计评审编码规则，格式：SJPJ + 日期（YYYYMMDD）+ 4位序号，每日重置"


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
        -- 规范码已存在但未启用：默认启用
        UPDATE "core_code_rules"
        SET
            "is_active" = TRUE,
            "updated_at" = NOW()
        WHERE "code" = '{_RULE_CODE}'
          AND "deleted_at" IS NULL
          AND "is_active" IS DISTINCT FROM TRUE;

        -- 缺失的租户：按预设补建并启用
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

        -- 回填空评审编号（按租户 + 创建日序号，前缀与规则一致）
        WITH ranked AS (
            SELECT
                d."id",
                to_char((d."created_at" AT TIME ZONE 'UTC'), 'YYYYMMDD') AS day_key,
                ROW_NUMBER() OVER (
                    PARTITION BY d."tenant_id", (d."created_at" AT TIME ZONE 'UTC')::date
                    ORDER BY d."id"
                ) AS rn
            FROM "apps_kuaiplm_rd_design_reviews" d
            WHERE d."deleted_at" IS NULL
              AND (d."review_code" IS NULL OR BTRIM(d."review_code") = '')
        )
        UPDATE "apps_kuaiplm_rd_design_reviews" AS t
        SET
            "review_code" = '{_PREFIX}' || ranked.day_key || LPAD(ranked.rn::text, 4, '0'),
            "updated_at" = NOW()
        FROM ranked
        WHERE t."id" = ranked."id";

        -- 同步项目关联上的目标编码
        UPDATE "apps_kuaiplm_rd_project_links" AS l
        SET
            "target_code" = d."review_code",
            "updated_at" = NOW()
        FROM "apps_kuaiplm_rd_design_reviews" AS d
        WHERE l."target_type" = 'design_review'
          AND l."target_id" = d."id"
          AND d."deleted_at" IS NULL
          AND NULLIF(BTRIM(d."review_code"), '') IS NOT NULL
          AND (l."target_code" IS NULL OR BTRIM(l."target_code") = '');
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        DELETE FROM "core_code_rules"
        WHERE "code" = '{_RULE_CODE}'
          AND "is_system" IS TRUE;
        """
