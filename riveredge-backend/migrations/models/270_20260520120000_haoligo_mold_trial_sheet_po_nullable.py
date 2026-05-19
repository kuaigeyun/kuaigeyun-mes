"""好力 GO — 试模单采购订单号改为可空（支持从待启用模具直接试模）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ALTER COLUMN "purchase_order_no" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_mold_trial_sheet" SET "purchase_order_no" = '' WHERE "purchase_order_no" IS NULL;
        ALTER TABLE "haoligo_mold_trial_sheet"
        ALTER COLUMN "purchase_order_no" SET NOT NULL;
    """
