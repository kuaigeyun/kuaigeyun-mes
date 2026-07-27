"""点检行 / 巡检行增加行级附件 attachments（问题/对比照片）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_lines"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_spot_check_lines"."attachments"
            IS '行级附件（问题/对比照片）';

        ALTER TABLE "apps_kuaizhizao_equipment_route_patrol_lines"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_route_patrol_lines"."attachments"
            IS '行级附件（问题/对比照片）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_lines" DROP COLUMN IF EXISTS "attachments";
        ALTER TABLE "apps_kuaizhizao_equipment_route_patrol_lines" DROP COLUMN IF EXISTS "attachments";
    """
