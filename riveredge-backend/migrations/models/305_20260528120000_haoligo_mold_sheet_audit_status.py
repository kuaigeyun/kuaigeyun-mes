"""
试模/厂内维保/外协维保单：审核状态字段；历史已发单单据回填为已通过。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE haoligo_mold_maintenance_sheet
            ADD COLUMN IF NOT EXISTS sheet_status VARCHAR(32) NOT NULL DEFAULT '待审核';
        ALTER TABLE haoligo_mold_maintenance_sheet
            ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ NULL;
        ALTER TABLE haoligo_mold_maintenance_sheet
            ADD COLUMN IF NOT EXISTS audited_by_user_id INT NULL;

        ALTER TABLE haoligo_mold_outsource_maintenance_sheet
            ADD COLUMN IF NOT EXISTS sheet_status VARCHAR(32) NOT NULL DEFAULT '待审核';
        ALTER TABLE haoligo_mold_outsource_maintenance_sheet
            ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ NULL;
        ALTER TABLE haoligo_mold_outsource_maintenance_sheet
            ADD COLUMN IF NOT EXISTS audited_by_user_id INT NULL;

        UPDATE haoligo_mold_maintenance_sheet
        SET sheet_status = '已通过'
        WHERE sheet_no IS NOT NULL AND trim(sheet_no) <> '';

        UPDATE haoligo_mold_outsource_maintenance_sheet
        SET sheet_status = '已通过'
        WHERE sheet_no IS NOT NULL AND trim(sheet_no) <> '';

        ALTER TABLE haoligo_mold_trial_sheet
            ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ NULL;
        ALTER TABLE haoligo_mold_trial_sheet
            ADD COLUMN IF NOT EXISTS audited_by_user_id INT NULL;

        UPDATE haoligo_mold_trial_sheet
        SET sheet_status = '已通过'
        WHERE sheet_no IS NOT NULL
          AND trim(sheet_no) <> ''
          AND sheet_status IN ('草稿', '已提交');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE haoligo_mold_maintenance_sheet DROP COLUMN IF EXISTS audited_by_user_id;
        ALTER TABLE haoligo_mold_maintenance_sheet DROP COLUMN IF EXISTS audited_at;
        ALTER TABLE haoligo_mold_maintenance_sheet DROP COLUMN IF EXISTS sheet_status;

        ALTER TABLE haoligo_mold_outsource_maintenance_sheet DROP COLUMN IF EXISTS audited_by_user_id;
        ALTER TABLE haoligo_mold_outsource_maintenance_sheet DROP COLUMN IF EXISTS audited_at;
        ALTER TABLE haoligo_mold_outsource_maintenance_sheet DROP COLUMN IF EXISTS sheet_status;
    """
