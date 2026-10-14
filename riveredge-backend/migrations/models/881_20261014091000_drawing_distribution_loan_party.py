from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_drawing_distributions"
            ADD COLUMN IF NOT EXISTS "issue_department_id" INT,
            ADD COLUMN IF NOT EXISTS "issue_department_name" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "recipient_user_id" INT,
            ADD COLUMN IF NOT EXISTS "recipient_user_name" VARCHAR(100);
        COMMENT ON COLUMN "apps_master_data_drawing_distributions"."issue_department_id" IS '发放部门ID';
        COMMENT ON COLUMN "apps_master_data_drawing_distributions"."issue_department_name" IS '发放部门名称快照';
        COMMENT ON COLUMN "apps_master_data_drawing_distributions"."recipient_user_id" IS '使用人用户ID';
        COMMENT ON COLUMN "apps_master_data_drawing_distributions"."recipient_user_name" IS '使用人姓名快照';

        ALTER TABLE "apps_master_data_drawing_loans"
            ADD COLUMN IF NOT EXISTS "borrower_department_id" INT,
            ADD COLUMN IF NOT EXISTS "borrower_department_name" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "borrower_user_id" INT,
            ADD COLUMN IF NOT EXISTS "borrower_user_name" VARCHAR(100);
        COMMENT ON COLUMN "apps_master_data_drawing_loans"."borrower_department_id" IS '借阅部门ID';
        COMMENT ON COLUMN "apps_master_data_drawing_loans"."borrower_department_name" IS '借阅部门名称快照';
        COMMENT ON COLUMN "apps_master_data_drawing_loans"."borrower_user_id" IS '借阅人用户ID';
        COMMENT ON COLUMN "apps_master_data_drawing_loans"."borrower_user_name" IS '借阅人姓名快照';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_drawing_distributions"
            DROP COLUMN IF EXISTS "issue_department_id",
            DROP COLUMN IF EXISTS "issue_department_name",
            DROP COLUMN IF EXISTS "recipient_user_id",
            DROP COLUMN IF EXISTS "recipient_user_name";

        ALTER TABLE "apps_master_data_drawing_loans"
            DROP COLUMN IF EXISTS "borrower_department_id",
            DROP COLUMN IF EXISTS "borrower_department_name",
            DROP COLUMN IF EXISTS "borrower_user_id",
            DROP COLUMN IF EXISTS "borrower_user_name";
    """
