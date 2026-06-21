"""
报工记录增加末道工序入库仓库（报工时指定，用于自动/通知入库）

Author: RiverEdge
Date: 2026-06-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records'
                  AND column_name = 'inbound_warehouse_id'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records
                    ADD COLUMN inbound_warehouse_id INT;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records'
                  AND column_name = 'inbound_warehouse_name'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records
                    ADD COLUMN inbound_warehouse_name VARCHAR(200);
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS inbound_warehouse_id;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS inbound_warehouse_name;
    """
