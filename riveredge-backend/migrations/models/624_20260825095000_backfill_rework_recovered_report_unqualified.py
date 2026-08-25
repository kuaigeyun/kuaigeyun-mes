"""返工已关闭但报工不合格未挽回：回填原工序合格/不合格。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        WITH rework_targets AS (
            SELECT
                r."tenant_id" AS tenant_id,
                COALESCE(
                    r."start_work_order_operation_id",
                    (
                        SELECT woo2."id"
                        FROM "apps_kuaizhizao_work_order_operations" AS woo2
                        WHERE woo2."tenant_id" = r."tenant_id"
                          AND woo2."work_order_id" = r."original_work_order_id"
                          AND woo2."deleted_at" IS NULL
                        ORDER BY woo2."sequence", woo2."id"
                        LIMIT 1
                    )
                ) AS woo_id,
                COALESCE(
                    NULLIF(r."completed_quantity", 0),
                    r."quantity"
                ) AS rework_qty
            FROM "apps_kuaizhizao_rework_orders" AS r
            WHERE r."deleted_at" IS NULL
              AND r."source_inspection_id" IS NULL
              AND r."original_work_order_id" IS NOT NULL
              AND r."status" IN ('closed', 'quality_released')
        ),
        agg AS (
            SELECT
                woo."id" AS woo_id,
                LEAST(
                    woo."unqualified_quantity",
                    SUM(rt.rework_qty)
                ) AS take
            FROM rework_targets AS rt
            JOIN "apps_kuaizhizao_work_order_operations" AS woo
              ON woo."id" = rt.woo_id
             AND woo."tenant_id" = rt.tenant_id
             AND woo."deleted_at" IS NULL
            WHERE rt.woo_id IS NOT NULL
              AND woo."unqualified_quantity" > 0
              AND rt.rework_qty > 0
            GROUP BY woo."id", woo."unqualified_quantity"
        )
        UPDATE "apps_kuaizhizao_work_order_operations" AS woo
        SET
            "qualified_quantity" = woo."qualified_quantity" + agg.take,
            "unqualified_quantity" = woo."unqualified_quantity" - agg.take,
            "updated_at" = CURRENT_TIMESTAMP
        FROM agg
        WHERE woo."id" = agg.woo_id
          AND agg.take > 0;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
