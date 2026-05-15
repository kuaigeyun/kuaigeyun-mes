"""好力 GO — 隐患单增加登记人、责任人。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "registrant_user_id" INT NULL;
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "registrant_name" VARCHAR(100) NULL;
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "responsible_user_id" INT NULL;
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "responsible_name" VARCHAR(100) NULL;
        COMMENT ON COLUMN "haoligo_hazard_report"."registrant_user_id" IS '登记人用户 ID';
        COMMENT ON COLUMN "haoligo_hazard_report"."registrant_name" IS '登记人显示名（冗余）';
        COMMENT ON COLUMN "haoligo_hazard_report"."responsible_user_id" IS '责任人用户 ID（可选）';
        COMMENT ON COLUMN "haoligo_hazard_report"."responsible_name" IS '责任人显示名（冗余）';
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_registrant"
            ON "haoligo_hazard_report" ("registrant_user_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_responsible"
            ON "haoligo_hazard_report" ("responsible_user_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_hr_responsible";
        DROP INDEX IF EXISTS "idx_haoligo_hr_registrant";
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "responsible_name";
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "responsible_user_id";
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "registrant_name";
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "registrant_user_id";
    """
