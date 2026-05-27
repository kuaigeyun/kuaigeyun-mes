"""好力 GO — 试模单待处理发出/收回：记录发出前仓库"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "dispatch_origin_warehouse_id" INT;
        COMMENT ON COLUMN "haoligo_mold_trial_sheet"."dispatch_origin_warehouse_id"
            IS '待处理发出前模具所在仓库 ID（收回时还原）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        DROP COLUMN IF EXISTS "dispatch_origin_warehouse_id";
    """
