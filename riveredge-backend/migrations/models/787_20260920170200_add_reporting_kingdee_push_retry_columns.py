"""
报工记录增加金蝶生产汇报单推送重试状态字段（P0-3）

Author: RiverEdge
Date: 2026-09-11
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'kingdee_push_status'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN kingdee_push_status VARCHAR(20);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'kingdee_push_attempts'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN kingdee_push_attempts INT NOT NULL DEFAULT 0;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'kingdee_push_next_at'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN kingdee_push_next_at TIMESTAMPTZ;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'kingdee_push_last_error'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN kingdee_push_last_error TEXT;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records' AND column_name = 'kingdee_push_last_at'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records ADD COLUMN kingdee_push_last_at TIMESTAMPTZ;
            END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS "idx_reporting_records_push_retry"
            ON "apps_kuaizhizao_reporting_records" ("kingdee_push_status", "kingdee_push_next_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_reporting_records_push_retry";
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS kingdee_push_status;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS kingdee_push_attempts;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS kingdee_push_next_at;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS kingdee_push_last_error;
        ALTER TABLE apps_kuaizhizao_reporting_records DROP COLUMN IF EXISTS kingdee_push_last_at;
    """