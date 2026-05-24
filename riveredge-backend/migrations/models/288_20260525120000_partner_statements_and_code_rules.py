"""
创建往来对账单表、扩展字段、补建 PARTNER_STATEMENT_CODE 编码规则。

Author: AI Assistant
Date: 2026-05-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_RULE_CODE = "PARTNER_STATEMENT_CODE"
_RULE_NAME = "往来对账单编码规则"
_PREFIX = "DZ"
_DESCRIPTION = "往来对账单编码规则，格式：DZ + 日期（YYYYMMDD）+ 4位序号，每日重置"


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
        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_partner_statements" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
            "tenant_id" INT NOT NULL,
            "statement_code" VARCHAR(50) NOT NULL UNIQUE,
            "partner_id" INT NOT NULL,
            "partner_name" VARCHAR(200) NOT NULL,
            "partner_type" VARCHAR(20) NOT NULL,
            "statement_period" VARCHAR(20) NOT NULL,
            "start_date" DATE NOT NULL,
            "end_date" DATE NOT NULL,
            "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "debit_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "credit_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "closing_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
            "transaction_details" JSONB,
            "company_name" VARCHAR(200),
            "confirmed_at" TIMESTAMPTZ,
            "confirmed_by" INT,
            "sent_at" TIMESTAMPTZ,
            "sent_by" INT,
            "sent_channel" VARCHAR(30),
            "dispute_reason" TEXT,
            "disputed_at" TIMESTAMPTZ,
            "notes" TEXT,
            "created_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_partner_stmt_tenant_partner"
            ON "apps_kuaicaiwu_partner_statements" ("tenant_id", "partner_id");
        CREATE INDEX IF NOT EXISTS "idx_partner_stmt_period"
            ON "apps_kuaicaiwu_partner_statements" ("statement_period");
        CREATE INDEX IF NOT EXISTS "idx_partner_stmt_status"
            ON "apps_kuaicaiwu_partner_statements" ("status");

        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_partner_stmt_tenant_partner_period"
            ON "apps_kuaicaiwu_partner_statements" ("tenant_id", "partner_id", "partner_type", "statement_period")
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
    return f"""
        DELETE FROM "core_code_rules"
        WHERE "code" = '{_RULE_CODE}'
          AND "is_system" = TRUE
          AND "deleted_at" IS NULL;
        DROP TABLE IF EXISTS "apps_kuaicaiwu_partner_statements";
    """
