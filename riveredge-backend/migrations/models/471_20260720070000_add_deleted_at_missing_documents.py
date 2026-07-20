"""
补齐缺失的 deleted_at 软删除字段。

根因：迁移 462/463 已对采购订单、统一发票等表建立
「tenant + code WHERE deleted_at IS NULL」部分唯一索引，
但模型与表列此前未声明 deleted_at，导致 ORM 过滤报 Unknown filter param。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES: list[tuple[str, str]] = [
    ("apps_kuaizhizao_purchase_orders", "删除时间"),
    ("apps_kuaizhizao_purchase_order_items", "删除时间"),
    ("apps_kuaicaiwu_invoices", "删除时间"),
    ("apps_kuaicaiwu_invoice_items", "删除时间"),
    ("apps_kuaizhizao_sales_order_items", "删除时间"),
    ("apps_kuaizhizao_sales_delivery_items", "删除时间"),
    ("apps_kuaizhizao_purchase_receipt_items", "删除时间"),
    ("apps_kuaizhizao_finished_goods_receipt_items", "删除时间"),
    ("apps_kuaizhizao_production_picking_items", "删除时间"),
    ("apps_kuaizhizao_demand_computations", "删除时间"),
    ("core_approval_histories", "删除时间"),
]


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts: list[str] = []
    for table, comment in _TABLES:
        parts.append(
            f"""
            DO $$
            BEGIN
                IF to_regclass('public.{table}') IS NULL THEN
                    RETURN;
                END IF;
                ALTER TABLE "{table}"
                    ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL;
                COMMENT ON COLUMN "{table}"."deleted_at" IS '{comment}';
            END $$;
            """
        )
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts: list[str] = []
    for table, _ in _TABLES:
        parts.append(
            f"""
            DO $$
            BEGIN
                IF to_regclass('public.{table}') IS NULL THEN
                    RETURN;
                END IF;
                ALTER TABLE "{table}" DROP COLUMN IF EXISTS "deleted_at";
            END $$;
            """
        )
    return "\n".join(parts)
