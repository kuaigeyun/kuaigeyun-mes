"""
工艺路线级「允许工序跳转」；工单来源工艺路线 process_route_id

Date: 2026-03-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_process_routes"
        ADD COLUMN IF NOT EXISTS "allow_operation_jump" BOOL NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_master_data_process_routes"."allow_operation_jump" IS '路线级是否允许工序跳转（为真时启用节点工序控制）';

        ALTER TABLE "apps_kuaizhizao_work_orders"
        ADD COLUMN IF NOT EXISTS "process_route_id" INT NULL
        REFERENCES "apps_master_data_process_routes" ("id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_work_orders_process_route_id"
        ON "apps_kuaizhizao_work_orders" ("process_route_id");
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."process_route_id" IS '开工单时选择的来源工艺路线';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_process_route_id";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "process_route_id";
        ALTER TABLE "apps_master_data_process_routes" DROP COLUMN IF EXISTS "allow_operation_jump";
    """
