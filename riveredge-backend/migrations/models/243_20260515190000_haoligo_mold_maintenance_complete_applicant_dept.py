"""好力 GO — 维保完修单增加申请人、申请部门。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "applicant_user_id" INT;
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "applicant_name" VARCHAR(100);
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "department_uuid" VARCHAR(36);
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "department_name" VARCHAR(200);
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mmcs_dept_uuid"
            ON "haoligo_mold_maintenance_complete_sheet" ("tenant_id", "department_uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_mmcs_dept_uuid";
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "department_name";
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "department_uuid";
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "applicant_name";
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "applicant_user_id";
    """
