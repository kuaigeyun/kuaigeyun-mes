"""
报工记录：报工来源渠道码 + 报工方式（自报/代报/小组）

Author: RiverEdge
Date: 2026-09-02
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'client_channel'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN client_channel VARCHAR(32);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'report_mode'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN report_mode VARCHAR(16);
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS client_channel;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS report_mode;
    """
