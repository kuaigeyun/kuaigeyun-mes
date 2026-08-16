"""
报价单关联订单评审：sales_review_id / sales_review_code。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "sales_review_id" INT;
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "sales_review_code" VARCHAR(120);
        CREATE INDEX IF NOT EXISTS "idx_quotations_sales_review"
            ON "apps_kuaizhizao_quotations" ("sales_review_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_quotations_sales_review";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "sales_review_code";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "sales_review_id";
    """
