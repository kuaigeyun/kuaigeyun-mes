"""
报工记录增加工序开始时间 / 完成时间（work_start_time / work_end_time）。

用于列表叠列展示；与报工弹窗三向联动字段一致。
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
                  AND column_name = 'work_start_time'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records
                    ADD COLUMN work_start_time TIMESTAMPTZ;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_reporting_records'
                  AND column_name = 'work_end_time'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records
                    ADD COLUMN work_end_time TIMESTAMPTZ;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_reporting_records
            DROP COLUMN IF EXISTS work_start_time;
        ALTER TABLE apps_kuaizhizao_reporting_records
            DROP COLUMN IF EXISTS work_end_time;
    """
