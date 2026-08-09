"""
报工记录支持工作小组（team_id / team_name），生产人员 worker_id 可空。

Author: RiverEdge
Date: 2026-08-08
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
                  AND column_name = 'team_id'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records
                    ADD COLUMN team_id INT;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records'
                  AND column_name = 'team_name'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records
                    ADD COLUMN team_name VARCHAR(100);
            END IF;
        END $$;
        ALTER TABLE apps_kuaizhizao_reporting_records
            ALTER COLUMN worker_id DROP NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_kuaizhizao_reporting_team_id
            ON apps_kuaizhizao_reporting_records (team_id);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS idx_kuaizhizao_reporting_team_id;
        UPDATE apps_kuaizhizao_reporting_records SET worker_id = 0 WHERE worker_id IS NULL;
        ALTER TABLE apps_kuaizhizao_reporting_records
            ALTER COLUMN worker_id SET NOT NULL;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS team_name;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS team_id;
    """
