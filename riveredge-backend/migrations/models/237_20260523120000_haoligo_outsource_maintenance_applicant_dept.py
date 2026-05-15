"""好力 GO — 外协维保单增加申请人、申请部门（与厂内维保单一致）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
            ADD COLUMN IF NOT EXISTS "applicant_user_id" INT NULL;
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
            ADD COLUMN IF NOT EXISTS "applicant_name" VARCHAR(100) NULL;
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
            ADD COLUMN IF NOT EXISTS "department_uuid" VARCHAR(36) NULL;
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
            ADD COLUMN IF NOT EXISTS "department_name" VARCHAR(200) NULL;
        COMMENT ON COLUMN "haoligo_mold_outsource_maintenance_sheet"."applicant_user_id" IS '申请人用户 ID（core_users.id）';
        COMMENT ON COLUMN "haoligo_mold_outsource_maintenance_sheet"."applicant_name" IS '申请人显示名（冗余）';
        COMMENT ON COLUMN "haoligo_mold_outsource_maintenance_sheet"."department_uuid" IS '申请部门 UUID（末级）';
        COMMENT ON COLUMN "haoligo_mold_outsource_maintenance_sheet"."department_name" IS '申请部门名称';
        CREATE INDEX IF NOT EXISTS "idx_haoligo_omms_applicant" ON "haoligo_mold_outsource_maintenance_sheet" ("applicant_user_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_omms_dept" ON "haoligo_mold_outsource_maintenance_sheet" ("department_uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_omms_dept";
        DROP INDEX IF EXISTS "idx_haoligo_omms_applicant";
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet" DROP COLUMN IF EXISTS "department_name";
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet" DROP COLUMN IF EXISTS "department_uuid";
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet" DROP COLUMN IF EXISTS "applicant_name";
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet" DROP COLUMN IF EXISTS "applicant_user_id";
    """
