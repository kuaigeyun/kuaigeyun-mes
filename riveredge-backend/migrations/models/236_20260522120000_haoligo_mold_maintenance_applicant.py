"""好力 GO — 厂内维保单增加申请人（关联 core_users，冗余姓名便于列表展示）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_sheet"
            ADD COLUMN IF NOT EXISTS "applicant_user_id" INT NULL;
        ALTER TABLE "haoligo_mold_maintenance_sheet"
            ADD COLUMN IF NOT EXISTS "applicant_name" VARCHAR(100) NULL;
        COMMENT ON COLUMN "haoligo_mold_maintenance_sheet"."applicant_user_id" IS '申请人用户 ID（core_users.id）';
        COMMENT ON COLUMN "haoligo_mold_maintenance_sheet"."applicant_name" IS '申请人显示名（冗余）';
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mms_applicant" ON "haoligo_mold_maintenance_sheet" ("applicant_user_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_mms_applicant";
        ALTER TABLE "haoligo_mold_maintenance_sheet" DROP COLUMN IF EXISTS "applicant_name";
        ALTER TABLE "haoligo_mold_maintenance_sheet" DROP COLUMN IF EXISTS "applicant_user_id";
    """
