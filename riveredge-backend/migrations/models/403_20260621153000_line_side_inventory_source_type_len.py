"""线边仓 source_type 扩长：支持 semi_finished_goods_receipt 等单据类型码。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_line_side_inventory"
            ALTER COLUMN "source_type" TYPE VARCHAR(50);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_line_side_inventory"
            ALTER COLUMN "source_type" TYPE VARCHAR(20);
    """
