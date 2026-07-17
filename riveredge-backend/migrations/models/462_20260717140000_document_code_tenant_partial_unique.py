"""
单据编码唯一约束：由全局唯一改为「租户内 + 未删除」部分唯一。

根因：apps_kuaizhizao_sales_orders.order_code 等字段使用全局 UNIQUE，
而编码规则按日重置流水（如 XS+YYYYMMDD+序号），多租户同日会生成相同编码并 422。

同时清理同租户下重复的启用中编码规则（保留带序号记录 / 最早创建的一条）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# (table, old_index_or_constraint_names, new_index_name, columns)
_DOC_CODE_UNIQUES: list[tuple[str, list[str], str, list[str]]] = [
    (
        "apps_kuaizhizao_sales_orders",
        ["apps_kuaizhizao_sales_orders_order_code_key"],
        "uidx_sales_orders_tenant_order_code_active",
        ["tenant_id", "order_code"],
    ),
    (
        "apps_kuaizhizao_sales_forecasts",
        ["apps_kuaizhizao_sales_forecasts_forecast_code_key"],
        "uidx_sales_forecasts_tenant_forecast_code_active",
        ["tenant_id", "forecast_code"],
    ),
    (
        "apps_kuaizhizao_sales_deliveries",
        ["apps_kuaizhizao_sales_deliveries_delivery_code_key"],
        "uidx_sales_deliveries_tenant_delivery_code_active",
        ["tenant_id", "delivery_code"],
    ),
    (
        "apps_kuaizhizao_sales_order_change_orders",
        ["apps_kuaizhizao_sales_order_change_orders_change_code_key"],
        "uidx_sales_order_changes_tenant_change_code_active",
        ["tenant_id", "change_code"],
    ),
    (
        "apps_kuaizhizao_sales_returns",
        ["apps_kuaizhizao_sales_returns_return_code_key"],
        "uidx_sales_returns_tenant_return_code_active",
        ["tenant_id", "return_code"],
    ),
    (
        "apps_kuaizhizao_shipment_notices",
        ["apps_kuaizhizao_shipment_notices_notice_code_key"],
        "uidx_shipment_notices_tenant_notice_code_active",
        ["tenant_id", "notice_code"],
    ),
    (
        "apps_kuaizhizao_receipt_notices",
        ["apps_kuaizhizao_receipt_notices_notice_code_key"],
        "uidx_receipt_notices_tenant_notice_code_active",
        ["tenant_id", "notice_code"],
    ),
    (
        "apps_kuaizhizao_purchase_orders",
        ["apps_kuaizhizao_purchase_orders_order_code_key"],
        "uidx_purchase_orders_tenant_order_code_active",
        ["tenant_id", "order_code"],
    ),
    (
        "apps_kuaizhizao_purchase_order_change_orders",
        ["apps_kuaizhizao_purchase_order_change_orders_change_code_key"],
        "uidx_purchase_order_changes_tenant_change_code_active",
        ["tenant_id", "change_code"],
    ),
    (
        "apps_kuaizhizao_purchase_requisitions",
        ["apps_kuaizhizao_purchase_requisitions_requisition_code_key"],
        "uidx_purchase_requisitions_tenant_req_code_active",
        ["tenant_id", "requisition_code"],
    ),
    (
        "apps_kuaizhizao_purchase_receipts",
        ["apps_kuaizhizao_purchase_receipts_receipt_code_key"],
        "uidx_purchase_receipts_tenant_receipt_code_active",
        ["tenant_id", "receipt_code"],
    ),
    (
        "apps_kuaizhizao_purchase_returns",
        ["apps_kuaizhizao_purchase_returns_return_code_key"],
        "uidx_purchase_returns_tenant_return_code_active",
        ["tenant_id", "return_code"],
    ),
    (
        "apps_kuaizhizao_production_pickings",
        ["apps_kuaizhizao_production_pickings_picking_code_key"],
        "uidx_production_pickings_tenant_picking_code_active",
        ["tenant_id", "picking_code"],
    ),
    (
        "apps_kuaizhizao_production_returns",
        ["apps_kuaizhizao_production_returns_return_code_key"],
        "uidx_production_returns_tenant_return_code_active",
        ["tenant_id", "return_code"],
    ),
    (
        "apps_kuaizhizao_production_plans",
        ["apps_kuaizhizao_production_plans_plan_code_key"],
        "uidx_production_plans_tenant_plan_code_active",
        ["tenant_id", "plan_code"],
    ),
    (
        "apps_kuaizhizao_process_inspections",
        ["apps_kuaizhizao_process_inspections_inspection_code_key"],
        "uidx_process_inspections_tenant_insp_code_active",
        ["tenant_id", "inspection_code"],
    ),
    (
        "apps_kuaizhizao_semi_finished_goods_receipts",
        ["apps_kuaizhizao_semi_finished_goods_receipts_receipt_code_key"],
        "uidx_semi_fg_receipts_tenant_receipt_code_active",
        ["tenant_id", "receipt_code"],
    ),
    (
        "apps_kuaizhizao_stocktakings",
        ["apps_kuaizhizao_stocktakings_code_key"],
        "uidx_stocktakings_tenant_code_active",
        ["tenant_id", "code"],
    ),
    (
        "apps_kuaizhizao_other_outbounds",
        ["apps_kuaizhizao_other_outbounds_outbound_code_key"],
        "uidx_other_outbounds_tenant_outbound_code_active",
        ["tenant_id", "outbound_code"],
    ),
    (
        "apps_kuaizhizao_other_inbounds",
        ["apps_kuaizhizao_other_inbounds_inbound_code_key"],
        "uidx_other_inbounds_tenant_inbound_code_active",
        ["tenant_id", "inbound_code"],
    ),
    (
        "apps_kuaizhizao_material_returns",
        ["apps_kuaizhizao_material_returns_return_code_key"],
        "uidx_material_returns_tenant_return_code_active",
        ["tenant_id", "return_code"],
    ),
    (
        "apps_kuaizhizao_material_borrows",
        ["apps_kuaizhizao_material_borrows_borrow_code_key"],
        "uidx_material_borrows_tenant_borrow_code_active",
        ["tenant_id", "borrow_code"],
    ),
    (
        "apps_kuaizhizao_finished_goods_receipts",
        ["apps_kuaizhizao_finished_goods_receipts_receipt_code_key"],
        "uidx_finished_goods_receipts_tenant_receipt_code_active",
        ["tenant_id", "receipt_code"],
    ),
    (
        "apps_kuaizhizao_incoming_inspections",
        ["apps_kuaizhizao_incoming_inspections_inspection_code_key"],
        "uidx_incoming_inspections_tenant_insp_code_active",
        ["tenant_id", "inspection_code"],
    ),
    (
        "apps_kuaizhizao_finished_goods_inspections",
        ["apps_kuaizhizao_finished_goods_inspections_inspection_code_key"],
        "uidx_finished_goods_inspections_tenant_insp_code_active",
        ["tenant_id", "inspection_code"],
    ),
    (
        "apps_kuaizhizao_disassembly_orders",
        ["apps_kuaizhizao_disassembly_orders_code_key"],
        "uidx_disassembly_orders_tenant_code_active",
        ["tenant_id", "code"],
    ),
    (
        "apps_kuaizhizao_delivery_notices",
        ["apps_kuaizhizao_delivery_notices_notice_code_key"],
        "uidx_delivery_notices_tenant_notice_code_active",
        ["tenant_id", "notice_code"],
    ),
    (
        "apps_kuaizhizao_batching_orders",
        ["apps_kuaizhizao_batching_orders_code_key"],
        "uidx_batching_orders_tenant_code_active",
        ["tenant_id", "code"],
    ),
    (
        "apps_kuaizhizao_assembly_orders",
        ["apps_kuaizhizao_assembly_orders_code_key"],
        "uidx_assembly_orders_tenant_code_active",
        ["tenant_id", "code"],
    ),
    (
        "apps_kuaizhizao_inventory_transfers",
        ["apps_kuaizhizao_inventory_transfers_code_key"],
        "uidx_inventory_transfers_tenant_code_active",
        ["tenant_id", "code"],
    ),
    (
        "apps_kuaizhizao_material_call_requests",
        ["apps_kuaizhizao_material_call_requests_code_key"],
        "uidx_material_call_requests_tenant_code_active",
        ["tenant_id", "code"],
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
    blocks: list[str] = [
        """
        -- 同租户重复启用的编码规则：保留「有序号记录」的最早一条，否则保留最早 id
        WITH ranked AS (
            SELECT
                cr.id,
                cr.tenant_id,
                cr.code,
                ROW_NUMBER() OVER (
                    PARTITION BY cr.tenant_id, cr.code
                    ORDER BY
                        CASE WHEN EXISTS (
                            SELECT 1 FROM core_code_sequences cs
                            WHERE cs.code_rule_id = cr.id AND cs.deleted_at IS NULL
                        ) THEN 0 ELSE 1 END,
                        cr.id ASC
                ) AS rn
            FROM core_code_rules cr
            WHERE cr.deleted_at IS NULL
              AND cr.is_active = TRUE
        )
        UPDATE core_code_rules cr
        SET is_active = FALSE,
            deleted_at = NOW(),
            updated_at = NOW()
        FROM ranked r
        WHERE cr.id = r.id
          AND r.rn > 1;
        """
    ]

    for table, old_names, new_name, cols in _DOC_CODE_UNIQUES:
        col_list = ", ".join(f'"{c}"' for c in cols)
        blocks.append(
            f"""
            DO $$
            BEGIN
                IF to_regclass('public.{table}') IS NULL THEN
                    RETURN;
                END IF;
                {_drop_old(table, old_names)}
            END $$;

            CREATE UNIQUE INDEX IF NOT EXISTS "{new_name}"
            ON "{table}" ({col_list})
            WHERE "deleted_at" IS NULL;
            """
        )

    return "\n".join(blocks)


async def downgrade(db: BaseDBAsyncClient) -> str:
    """降级不恢复全局唯一（会再次引入跨租户冲突）；仅删除新建部分索引。"""
    drops = "\n".join(
        f'DROP INDEX IF EXISTS "{new_name}";' for _, _, new_name, _ in _DOC_CODE_UNIQUES
    )
    return drops
