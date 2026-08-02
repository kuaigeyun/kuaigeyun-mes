"""
维护计划支持多设备关联：equipment_items JSONB

保留 equipment_id/uuid/name 作为首台设备（列表筛选、执行默认），
equipment_items 存储完整关联设备列表。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ADD COLUMN IF NOT EXISTS "equipment_items" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."equipment_items" IS '关联设备列表 [{id,uuid,code,name}]';

        UPDATE "apps_kuaizhizao_maintenance_plans"
        SET "equipment_items" = jsonb_build_array(
            jsonb_build_object(
                'id', "equipment_id",
                'uuid', "equipment_uuid",
                'name', "equipment_name"
            )
        )
        WHERE "equipment_items" IS NULL
          AND "equipment_uuid" IS NOT NULL
          AND "equipment_uuid" <> '';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            DROP COLUMN IF EXISTS "equipment_items";
        """
