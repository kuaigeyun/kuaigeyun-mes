"""承运商官方服务热线"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_logistics_carriers"
            ADD COLUMN IF NOT EXISTS "service_hotline" VARCHAR(50);
        COMMENT ON COLUMN "apps_kuaizhizao_logistics_carriers"."service_hotline" IS '官方服务热线';
        UPDATE "apps_kuaizhizao_logistics_carriers"
        SET "service_hotline" = CASE UPPER("code")
            WHEN 'SF' THEN '95338'
            WHEN 'ZTO' THEN '95311'
            WHEN 'YTO' THEN '95554'
            WHEN 'YD' THEN '95546'
            WHEN 'STO' THEN '95543'
            WHEN 'JT' THEN '956025'
            WHEN 'JD' THEN '950616'
            WHEN 'EMS' THEN '11183'
            WHEN 'YZPY' THEN '11183'
            WHEN 'DBL' THEN '95353'
            WHEN 'HTKY' THEN '95320'
            WHEN 'KYSY' THEN '95324'
            WHEN 'ANE' THEN '400-104-0088'
            WHEN 'SNWL' THEN '95315'
            WHEN 'ZYEX' THEN '11183'
            ELSE "service_hotline"
        END
        WHERE deleted_at IS NULL
          AND (service_hotline IS NULL OR BTRIM(service_hotline) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_logistics_carriers"
            DROP COLUMN IF EXISTS "service_hotline";
    """
