"""委外工单已收数量改为仅累计合格品（自收货单/退货单回填）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_work_orders"."received_quantity"
            IS '已收货数量（合格品累计，不含不合格/工废/料废）';

        UPDATE "apps_kuaizhizao_outsource_work_orders" AS owo
        SET "received_quantity" = GREATEST(
            0,
            COALESCE(
                (
                    SELECT SUM(COALESCE(omr."qualified_quantity", 0))
                    FROM "apps_kuaizhizao_outsource_material_receipts" AS omr
                    WHERE omr."outsource_work_order_id" = owo."id"
                      AND omr."deleted_at" IS NULL
                      AND omr."status" = 'completed'
                ),
                0
            )
            - COALESCE(
                (
                    SELECT SUM(COALESCE(opr."quantity", 0))
                    FROM "apps_kuaizhizao_outsource_product_returns" AS opr
                    WHERE opr."outsource_work_order_id" = owo."id"
                      AND opr."deleted_at" IS NULL
                      AND opr."status" = 'completed'
                ),
                0
            )
        )
        WHERE owo."deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_work_orders"."received_quantity"
            IS '已收货数量';
    """
