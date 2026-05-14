"""
好力 GO — 试模单数据集关联表增加「列表数据集」与「采购订单号列」，
用于从 ERP 模具采购单列表选择并创建试模单。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_dataset_binding"
            ADD COLUMN IF NOT EXISTS "list_dataset_uuid" VARCHAR(36),
            ADD COLUMN IF NOT EXISTS "purchase_order_column" VARCHAR(128);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_dataset_binding"
            DROP COLUMN IF EXISTS "list_dataset_uuid",
            DROP COLUMN IF EXISTS "purchase_order_column";
    """
