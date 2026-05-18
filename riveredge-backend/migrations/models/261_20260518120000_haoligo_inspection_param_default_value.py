"""好力 GO — 点检项增加默认值（创建设备点检单时预填实测值）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_inspection_param"
            ADD COLUMN IF NOT EXISTS "default_value" TEXT;
        COMMENT ON COLUMN "haoligo_inspection_param"."default_value" IS '默认值（按 value_type 存储为文本，创建设备点检单时预填实测值）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_inspection_param" DROP COLUMN IF EXISTS "default_value";
    """
