"""回填线边仓库存 warehouse_name（与主数据仓库名称对齐）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE apps_kuaizhizao_line_side_inventory AS lsi
        SET warehouse_name = w.name
        FROM apps_master_data_warehouses AS w
        WHERE lsi.warehouse_id = w.id
          AND w.deleted_at IS NULL
          AND (lsi.warehouse_name IS NULL OR TRIM(lsi.warehouse_name) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
