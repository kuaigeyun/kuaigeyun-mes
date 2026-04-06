"""
报工记录增加「记录人员」字段（代报工：生产人员 worker ≠ 记录人员 recorded_by）

Author: RiverEdge
Date: 2026-04-06
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'recorded_by'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN recorded_by INT;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'recorded_by_name'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN recorded_by_name VARCHAR(100);
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS recorded_by;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS recorded_by_name;
    """
