"""
工位表增加工作中心关联

为 apps_master_data_workstations 表添加 work_center_id、work_center_name 字段，
用于生产终端按工作中心筛选工单。

Author: RiverEdge
Date: 2026-02-14
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_workstations"
        ADD COLUMN IF NOT EXISTS "work_center_id" INT NULL,
        ADD COLUMN IF NOT EXISTS "work_center_name" VARCHAR(200) NULL;

        COMMENT ON COLUMN "apps_master_data_workstations"."work_center_id" IS '关联工作中心ID（用于生产终端筛选工单）';
        COMMENT ON COLUMN "apps_master_data_workstations"."work_center_name" IS '关联工作中心名称';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_workstations"
        DROP COLUMN IF EXISTS "work_center_id",
        DROP COLUMN IF EXISTS "work_center_name";
    """
