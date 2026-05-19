"""好力 GO — 现场巡查（隐患单）增加业务单号 sheet_no。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "sheet_no" VARCHAR(64);
        COMMENT ON COLUMN "haoligo_hazard_report"."sheet_no" IS '登记单号（编码规则生成）';
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_sheet_no"
            ON "haoligo_hazard_report" ("tenant_id", "sheet_no");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_hr_sheet_no";
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "sheet_no";
    """
