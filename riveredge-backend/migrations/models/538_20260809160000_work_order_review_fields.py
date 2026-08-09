"""
生产工单接入 UniAudit：增加审核字段。

Author: RiverEdge
Date: 2026-08-09
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_work_orders'
                  AND column_name = 'review_status'
            ) THEN
                ALTER TABLE apps_kuaizhizao_work_orders
                    ADD COLUMN review_status VARCHAR(20);
                COMMENT ON COLUMN apps_kuaizhizao_work_orders.review_status IS '审核状态';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_work_orders'
                  AND column_name = 'reviewer_id'
            ) THEN
                ALTER TABLE apps_kuaizhizao_work_orders
                    ADD COLUMN reviewer_id INT;
                COMMENT ON COLUMN apps_kuaizhizao_work_orders.reviewer_id IS '审核人ID';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_work_orders'
                  AND column_name = 'reviewer_name'
            ) THEN
                ALTER TABLE apps_kuaizhizao_work_orders
                    ADD COLUMN reviewer_name VARCHAR(100);
                COMMENT ON COLUMN apps_kuaizhizao_work_orders.reviewer_name IS '审核人姓名';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_work_orders'
                  AND column_name = 'review_time'
            ) THEN
                ALTER TABLE apps_kuaizhizao_work_orders
                    ADD COLUMN review_time TIMESTAMPTZ;
                COMMENT ON COLUMN apps_kuaizhizao_work_orders.review_time IS '审核时间';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_work_orders'
                  AND column_name = 'review_remarks'
            ) THEN
                ALTER TABLE apps_kuaizhizao_work_orders
                    ADD COLUMN review_remarks TEXT;
                COMMENT ON COLUMN apps_kuaizhizao_work_orders.review_remarks IS '审核备注';
            END IF;
        END $$;
        -- 历史工单按「审核默认关闭」视为已通过，避免开启开关后草稿因空 review_status 无法下达
        UPDATE apps_kuaizhizao_work_orders
           SET review_status = '已通过'
         WHERE review_status IS NULL
           AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_work_orders DROP COLUMN IF EXISTS review_remarks;
        ALTER TABLE apps_kuaizhizao_work_orders DROP COLUMN IF EXISTS review_time;
        ALTER TABLE apps_kuaizhizao_work_orders DROP COLUMN IF EXISTS reviewer_name;
        ALTER TABLE apps_kuaizhizao_work_orders DROP COLUMN IF EXISTS reviewer_id;
        ALTER TABLE apps_kuaizhizao_work_orders DROP COLUMN IF EXISTS review_status;
    """
