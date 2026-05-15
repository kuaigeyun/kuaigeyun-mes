"""好力 GO — 外协维保完修单增加审核状态。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "sheet_status" VARCHAR(16) NOT NULL DEFAULT '已通过';
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "audited_at" TIMESTAMPTZ;
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "audited_by_user_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_omcs_sheet_status"
            ON "haoligo_mold_outsource_maintenance_complete_sheet" ("tenant_id", "sheet_status");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_omcs_applicant_status"
            ON "haoligo_mold_outsource_maintenance_complete_sheet" ("tenant_id", "applicant_user_id", "sheet_status");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_omcs_applicant_status";
        DROP INDEX IF EXISTS "idx_haoligo_omcs_sheet_status";
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet" DROP COLUMN IF EXISTS "audited_by_user_id";
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet" DROP COLUMN IF EXISTS "audited_at";
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet" DROP COLUMN IF EXISTS "sheet_status";
    """
