"""请假申请补充车间/产线/档案人员字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaioa_leave_requests"
            ADD COLUMN IF NOT EXISTS "workshop_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "production_line_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "employee_id" INT,
            ADD COLUMN IF NOT EXISTS "employee_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaioa_leave_requests"
            DROP COLUMN IF EXISTS "employee_name",
            DROP COLUMN IF EXISTS "employee_id",
            DROP COLUMN IF EXISTS "production_line_name",
            DROP COLUMN IF EXISTS "workshop_name";
    """
