"""
快数采 IoT 设备：指令下发 MQTT device_id（command_device_id）。

空则业务侧回落 external_device_id。生产曾缺迁移导致 dashboard/summary 全列 SELECT 500。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiiot_devices"
            ADD COLUMN IF NOT EXISTS "command_device_id" VARCHAR(100);
        COMMENT ON COLUMN "apps_kuaiiot_devices"."command_device_id"
            IS '指令下发 MQTT device_id；空则回落 external_device_id';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiiot_devices" DROP COLUMN IF EXISTS "command_device_id";
    """
