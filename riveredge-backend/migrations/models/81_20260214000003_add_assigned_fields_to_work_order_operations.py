"""
为工单工序表添加派工相关字段

模型有 assigned_worker_id 等字段但表缺失，导致 WorkOrderOperation.create 报错。

Author: Auto (AI Assistant)
Date: 2026-02-14
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps_kuaizhizao_work_order_operations' AND column_name = 'assigned_worker_id') THEN
                ALTER TABLE apps_kuaizhizao_work_order_operations ADD COLUMN assigned_worker_id INT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps_kuaizhizao_work_order_operations' AND column_name = 'assigned_worker_name') THEN
                ALTER TABLE apps_kuaizhizao_work_order_operations ADD COLUMN assigned_worker_name VARCHAR(100);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps_kuaizhizao_work_order_operations' AND column_name = 'assigned_equipment_id') THEN
                ALTER TABLE apps_kuaizhizao_work_order_operations ADD COLUMN assigned_equipment_id INT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps_kuaizhizao_work_order_operations' AND column_name = 'assigned_equipment_name') THEN
                ALTER TABLE apps_kuaizhizao_work_order_operations ADD COLUMN assigned_equipment_name VARCHAR(100);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps_kuaizhizao_work_order_operations' AND column_name = 'assigned_at') THEN
                ALTER TABLE apps_kuaizhizao_work_order_operations ADD COLUMN assigned_at TIMESTAMPTZ;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps_kuaizhizao_work_order_operations' AND column_name = 'assigned_by') THEN
                ALTER TABLE apps_kuaizhizao_work_order_operations ADD COLUMN assigned_by INT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps_kuaizhizao_work_order_operations' AND column_name = 'assigned_by_name') THEN
                ALTER TABLE apps_kuaizhizao_work_order_operations ADD COLUMN assigned_by_name VARCHAR(100);
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_work_order_operations DROP COLUMN IF EXISTS assigned_worker_id;
        ALTER TABLE apps_kuaizhizao_work_order_operations DROP COLUMN IF EXISTS assigned_worker_name;
        ALTER TABLE apps_kuaizhizao_work_order_operations DROP COLUMN IF EXISTS assigned_equipment_id;
        ALTER TABLE apps_kuaizhizao_work_order_operations DROP COLUMN IF EXISTS assigned_equipment_name;
        ALTER TABLE apps_kuaizhizao_work_order_operations DROP COLUMN IF EXISTS assigned_at;
        ALTER TABLE apps_kuaizhizao_work_order_operations DROP COLUMN IF EXISTS assigned_by;
        ALTER TABLE apps_kuaizhizao_work_order_operations DROP COLUMN IF EXISTS assigned_by_name;
    """
