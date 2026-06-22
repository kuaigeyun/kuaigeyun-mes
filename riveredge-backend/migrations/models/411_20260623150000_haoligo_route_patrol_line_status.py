from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_route_patrol_line"
        ADD COLUMN IF NOT EXISTS "line_status" VARCHAR(32) NOT NULL DEFAULT 'normal';

        UPDATE "haoligo_equipment_route_patrol_line"
        SET "line_status" = CASE
            WHEN "is_normal" THEN 'normal'
            ELSE 'abnormal'
        END
        WHERE "line_status" = 'normal';

        ALTER TABLE "haoligo_equipment_route_patrol_line"
        DROP COLUMN IF EXISTS "is_normal";

        COMMENT ON COLUMN "haoligo_equipment_route_patrol_line"."line_status"
        IS '巡检结果：normal 正常 / abnormal 异常 / not_producing 未生产';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_route_patrol_line"
        ADD COLUMN IF NOT EXISTS "is_normal" BOOLEAN NOT NULL DEFAULT TRUE;

        UPDATE "haoligo_equipment_route_patrol_line"
        SET "is_normal" = ("line_status" = 'normal');

        ALTER TABLE "haoligo_equipment_route_patrol_line"
        DROP COLUMN IF EXISTS "line_status";
    """
