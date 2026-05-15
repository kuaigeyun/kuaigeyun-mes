"""好力 GO — 维保类单据历史数据：service_type 统一为「维修」（与产品取消维修/保养区分一致）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_mold_outsource_maintenance_sheet"
        SET "service_type" = '维修', "updated_at" = CURRENT_TIMESTAMP
        WHERE "service_type" IS DISTINCT FROM '维修';

        UPDATE "haoligo_mold_outsource_maintenance_complete_sheet"
        SET "service_type" = '维修', "updated_at" = CURRENT_TIMESTAMP
        WHERE "service_type" IS DISTINCT FROM '维修';

        UPDATE "haoligo_mold_maintenance_sheet"
        SET "service_type" = '维修', "updated_at" = CURRENT_TIMESTAMP
        WHERE "service_type" IS DISTINCT FROM '维修';

        UPDATE "haoligo_mold_maintenance_complete_sheet"
        SET "service_type" = '维修', "updated_at" = CURRENT_TIMESTAMP
        WHERE "service_type" IS DISTINCT FROM '维修';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 数据归一化不可无损回滚：保持 no-op
    return """SELECT 1;"""
