"""
好力 GO — 模具类单据增加 sheet_no（接入系统编码规则：简称+YYMMDD+3位流水）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet" ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        ALTER TABLE "haoligo_mold_borrow_sheet" ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        ALTER TABLE "haoligo_mold_maintenance_sheet" ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet" ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet" ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mts_sheet_no" ON "haoligo_mold_trial_sheet" ("tenant_id", "sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mbs_sheet_no" ON "haoligo_mold_borrow_sheet" ("tenant_id", "sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mrs_sheet_no" ON "haoligo_mold_return_sheet" ("tenant_id", "sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mms_sheet_no" ON "haoligo_mold_maintenance_sheet" ("tenant_id", "sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mmcs_sheet_no" ON "haoligo_mold_maintenance_complete_sheet" ("tenant_id", "sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_moms_sheet_no" ON "haoligo_mold_outsource_maintenance_sheet" ("tenant_id", "sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_momcs_sheet_no" ON "haoligo_mold_outsource_maintenance_complete_sheet" ("tenant_id", "sheet_no");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_momcs_sheet_no";
        DROP INDEX IF EXISTS "idx_haoligo_moms_sheet_no";
        DROP INDEX IF EXISTS "idx_haoligo_mmcs_sheet_no";
        DROP INDEX IF EXISTS "idx_haoligo_mms_sheet_no";
        DROP INDEX IF EXISTS "idx_haoligo_mrs_sheet_no";
        DROP INDEX IF EXISTS "idx_haoligo_mbs_sheet_no";
        DROP INDEX IF EXISTS "idx_haoligo_mts_sheet_no";
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet" DROP COLUMN IF EXISTS "sheet_no";
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet" DROP COLUMN IF EXISTS "sheet_no";
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "sheet_no";
        ALTER TABLE "haoligo_mold_maintenance_sheet" DROP COLUMN IF EXISTS "sheet_no";
        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "sheet_no";
        ALTER TABLE "haoligo_mold_borrow_sheet" DROP COLUMN IF EXISTS "sheet_no";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "sheet_no";
    """
