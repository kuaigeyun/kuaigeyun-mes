"""好力 GO — 设备维保单/维保完成单：维修+保养（service_type 与维修完修字段）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_upkeep_sheet"
            ADD COLUMN IF NOT EXISTS "service_type" VARCHAR(16) NOT NULL DEFAULT '保养';
        COMMENT ON COLUMN "haoligo_equipment_upkeep_sheet"."service_type" IS '维修/保养';
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eus_service_type"
            ON "haoligo_equipment_upkeep_sheet" ("tenant_id", "service_type");

        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
            ADD COLUMN IF NOT EXISTS "service_type" VARCHAR(16) NOT NULL DEFAULT '保养',
            ADD COLUMN IF NOT EXISTS "repair_content" TEXT,
            ADD COLUMN IF NOT EXISTS "repair_result" VARCHAR(32);
        COMMENT ON COLUMN "haoligo_equipment_upkeep_complete_sheet"."service_type" IS '维修/保养（与来源维保单一致）';
        COMMENT ON COLUMN "haoligo_equipment_upkeep_complete_sheet"."repair_content" IS '维修完修内容';
        COMMENT ON COLUMN "haoligo_equipment_upkeep_complete_sheet"."repair_result" IS '维修完修结果';
        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
            ALTER COLUMN "completion_content" DROP NOT NULL;
        COMMENT ON TABLE "haoligo_equipment_upkeep_sheet" IS '好力GO - 设备维保单';
        COMMENT ON TABLE "haoligo_equipment_upkeep_complete_sheet" IS '好力GO - 设备维保完成单';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
            DROP COLUMN IF EXISTS "repair_result",
            DROP COLUMN IF EXISTS "repair_content",
            DROP COLUMN IF EXISTS "service_type";
        ALTER TABLE "haoligo_equipment_upkeep_sheet"
            DROP COLUMN IF EXISTS "service_type";
        DROP INDEX IF EXISTS "idx_haoligo_eus_service_type";
    """
