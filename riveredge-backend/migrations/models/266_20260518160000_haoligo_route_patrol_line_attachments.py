"""好力 GO — 路线巡检单行增加现场照片附件 id 列表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_route_patrol_line"
            ADD COLUMN IF NOT EXISTS "attachment_file_ids" JSONB;
        COMMENT ON COLUMN "haoligo_equipment_route_patrol_line"."attachment_file_ids" IS '巡检设备现场照片 core 文件 id 列表';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_route_patrol_line" DROP COLUMN IF EXISTS "attachment_file_ids";
    """
