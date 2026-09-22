"""人事模块缺口：请假小时/扣款、档案房租电费、结算行房租电费扣除。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaioa_leave_requests"
            ADD COLUMN IF NOT EXISTS "leave_hours" NUMERIC(8,2),
            ADD COLUMN IF NOT EXISTS "deduct_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS "deduct_amount" NUMERIC(12,2);

        ALTER TABLE "apps_kuaioa_employee_profiles"
            ADD COLUMN IF NOT EXISTS "rent_utility" NUMERIC(12,2);

        ALTER TABLE "apps_kuaioa_payroll_settlement_lines"
            ADD COLUMN IF NOT EXISTS "rent_utility_deduct" NUMERIC(12,2) NOT NULL DEFAULT 0;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaioa_payroll_settlement_lines"
            DROP COLUMN IF EXISTS "rent_utility_deduct";
        ALTER TABLE "apps_kuaioa_employee_profiles"
            DROP COLUMN IF EXISTS "rent_utility";
        ALTER TABLE "apps_kuaioa_leave_requests"
            DROP COLUMN IF EXISTS "deduct_amount",
            DROP COLUMN IF EXISTS "deduct_enabled",
            DROP COLUMN IF EXISTS "leave_hours";
    """
