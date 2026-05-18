"""好力 GO — 点检单：处置改为设备运行状态 + 独立上报（多选接收人）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_spot_check"
            ADD COLUMN IF NOT EXISTS "applied_operational_status" VARCHAR(32);
        ALTER TABLE "haoligo_equipment_spot_check"
            ADD COLUMN IF NOT EXISTS "report_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "haoligo_equipment_spot_check"
            ADD COLUMN IF NOT EXISTS "report_notify_user_ids" JSONB NOT NULL DEFAULT '[]';

        UPDATE "haoligo_equipment_spot_check"
        SET "report_enabled" = COALESCE("handling_report", FALSE)
        WHERE "report_enabled" = FALSE AND COALESCE("handling_report", FALSE) = TRUE;

        ALTER TABLE "haoligo_equipment_spot_check" DROP COLUMN IF EXISTS "handling_shutdown";
        ALTER TABLE "haoligo_equipment_spot_check" DROP COLUMN IF EXISTS "handling_report";
        ALTER TABLE "haoligo_equipment_spot_check" DROP COLUMN IF EXISTS "handling_supervised";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_spot_check"
            ADD COLUMN IF NOT EXISTS "handling_shutdown" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "haoligo_equipment_spot_check"
            ADD COLUMN IF NOT EXISTS "handling_report" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "haoligo_equipment_spot_check"
            ADD COLUMN IF NOT EXISTS "handling_supervised" BOOLEAN NOT NULL DEFAULT FALSE;

        UPDATE "haoligo_equipment_spot_check"
        SET "handling_report" = COALESCE("report_enabled", FALSE);

        ALTER TABLE "haoligo_equipment_spot_check" DROP COLUMN IF EXISTS "applied_operational_status";
        ALTER TABLE "haoligo_equipment_spot_check" DROP COLUMN IF EXISTS "report_enabled";
        ALTER TABLE "haoligo_equipment_spot_check" DROP COLUMN IF EXISTS "report_notify_user_ids";
    """
