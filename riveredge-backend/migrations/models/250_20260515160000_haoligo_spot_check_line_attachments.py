"""好力 GO — 点检单行增加现场照片附件 id 列表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_spot_check_line"
            ADD COLUMN IF NOT EXISTS "attachment_file_ids" JSONB;
        COMMENT ON COLUMN "haoligo_equipment_spot_check_line"."attachment_file_ids" IS '点检项现场照片 core 文件 id 列表';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_spot_check_line" DROP COLUMN IF EXISTS "attachment_file_ids";
    """
