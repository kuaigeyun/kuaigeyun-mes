from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_packing_bindings"
            ALTER COLUMN "finished_goods_receipt_id" DROP NOT NULL;

        ALTER TABLE "apps_kuaizhizao_packing_bindings"
            ADD COLUMN IF NOT EXISTS "sales_delivery_id" INT;

        CREATE INDEX IF NOT EXISTS "idx_packing_bindings_sales_delivery_id"
            ON "apps_kuaizhizao_packing_bindings" ("sales_delivery_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_packing_bindings_sales_delivery_id";

        ALTER TABLE "apps_kuaizhizao_packing_bindings"
            DROP COLUMN IF EXISTS "sales_delivery_id";

        ALTER TABLE "apps_kuaizhizao_packing_bindings"
            ALTER COLUMN "finished_goods_receipt_id" SET NOT NULL;
    """
