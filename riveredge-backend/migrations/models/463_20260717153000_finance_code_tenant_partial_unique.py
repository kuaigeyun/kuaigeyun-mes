"""
财务单据编码：全局唯一 → 租户内 + 未删除部分唯一。

与销售订单同因：日流水编码（如 YS+YYYYMMDD+序号）多租户同日会撞全局 UNIQUE。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# (table, old_constraint_or_index_names, new_index_name, columns)
_FINANCE_CODE_UNIQUES: list[tuple[str, list[str], str, list[str]]] = [
    (
        "apps_kuaicaiwu_receivables",
        ["apps_kuaizhizao_receivables_receivable_code_key"],
        "uidx_receivables_tenant_receivable_code_active",
        ["tenant_id", "receivable_code"],
    ),
    (
        "apps_kuaicaiwu_payables",
        ["apps_kuaizhizao_payables_payable_code_key"],
        "uidx_payables_tenant_payable_code_active",
        ["tenant_id", "payable_code"],
    ),
    (
        "apps_kuaicaiwu_receipts",
        ["apps_kuaicaiwu_receipts_receipt_code_key"],
        "uidx_receipts_tenant_receipt_code_active",
        ["tenant_id", "receipt_code"],
    ),
    (
        "apps_kuaicaiwu_payments",
        ["apps_kuaicaiwu_payments_payment_code_key"],
        "uidx_payments_tenant_payment_code_active",
        ["tenant_id", "payment_code"],
    ),
    (
        "apps_kuaicaiwu_settlements",
        ["apps_kuaicaiwu_settlements_settlement_code_key"],
        "uidx_settlements_tenant_settlement_code_active",
        ["tenant_id", "settlement_code"],
    ),
    (
        "apps_kuaicaiwu_partner_statements",
        ["apps_kuaicaiwu_partner_statements_statement_code_key"],
        "uidx_partner_statements_tenant_statement_code_active",
        ["tenant_id", "statement_code"],
    ),
    (
        "apps_kuaicaiwu_purchase_invoices",
        ["apps_kuaizhizao_purchase_invoices_invoice_code_key"],
        "uidx_purchase_invoices_tenant_invoice_code_active",
        ["tenant_id", "invoice_code"],
    ),
    (
        "apps_kuaicaiwu_invoices",
        ["apps_kuaizhizao_invoices_invoice_code_key"],
        "uidx_sales_invoices_tenant_invoice_code_active",
        ["tenant_id", "invoice_code"],
    ),
    (
        "apps_kuaicaiwu_vouchers",
        ["uq_apps_kuaicaiwu_vouchers_voucher_code"],
        "uidx_vouchers_tenant_voucher_code_active",
        ["tenant_id", "voucher_code"],
    ),
    (
        "apps_kuaicaiwu_accounting_events",
        ["uq_apps_kuaicaiwu_accounting_events_event_code"],
        "uidx_accounting_events_tenant_event_code_active",
        ["tenant_id", "event_code"],
    ),
]


def _drop_old(table: str, names: list[str]) -> str:
    parts = []
    for name in names:
        parts.append(
            f"""
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = '{name}' AND conrelid = '{table}'::regclass
            ) THEN
                ALTER TABLE "{table}" DROP CONSTRAINT "{name}";
            END IF;
            DROP INDEX IF EXISTS "{name}";
            """
        )
    return "\n".join(parts)


async def upgrade(db: BaseDBAsyncClient) -> str:
    blocks: list[str] = []
    for table, old_names, new_name, cols in _FINANCE_CODE_UNIQUES:
        col_list = ", ".join(f'"{c}"' for c in cols)
        blocks.append(
            f"""
            DO $$
            BEGIN
                IF to_regclass('public.{table}') IS NULL THEN
                    RETURN;
                END IF;
                {_drop_old(table, old_names)}
                CREATE UNIQUE INDEX IF NOT EXISTS "{new_name}"
                ON "{table}" ({col_list})
                WHERE "deleted_at" IS NULL;
            END $$;
            """
        )
    return "\n".join(blocks)


async def downgrade(db: BaseDBAsyncClient) -> str:
    drops = "\n".join(
        f'DROP INDEX IF EXISTS "{new_name}";' for _, _, new_name, _ in _FINANCE_CODE_UNIQUES
    )
    return drops
