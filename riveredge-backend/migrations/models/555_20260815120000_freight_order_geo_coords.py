"""货运单与轨迹节点地理坐标"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_freight_orders"
            ADD COLUMN IF NOT EXISTS "origin_lng" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "origin_lat" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "destination_lng" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "destination_lat" DOUBLE PRECISION;
        COMMENT ON COLUMN "apps_kuaizhizao_freight_orders"."origin_lng" IS '发货地址经度（高德地理编码）';
        COMMENT ON COLUMN "apps_kuaizhizao_freight_orders"."origin_lat" IS '发货地址纬度（高德地理编码）';
        COMMENT ON COLUMN "apps_kuaizhizao_freight_orders"."destination_lng" IS '收货地址经度（高德地理编码）';
        COMMENT ON COLUMN "apps_kuaizhizao_freight_orders"."destination_lat" IS '收货地址纬度（高德地理编码）';

        ALTER TABLE "apps_kuaizhizao_freight_tracking_events"
            ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
        COMMENT ON COLUMN "apps_kuaizhizao_freight_tracking_events"."lng" IS '节点地点经度（高德地理编码）';
        COMMENT ON COLUMN "apps_kuaizhizao_freight_tracking_events"."lat" IS '节点地点纬度（高德地理编码）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_freight_tracking_events"
            DROP COLUMN IF EXISTS "lng",
            DROP COLUMN IF EXISTS "lat";
        ALTER TABLE "apps_kuaizhizao_freight_orders"
            DROP COLUMN IF EXISTS "origin_lng",
            DROP COLUMN IF EXISTS "origin_lat",
            DROP COLUMN IF EXISTS "destination_lng",
            DROP COLUMN IF EXISTS "destination_lat";
    """
