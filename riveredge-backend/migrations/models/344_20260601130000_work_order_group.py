"""工单组：表结构及工单/委外工单/需求计算扩展字段。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_work_order_groups" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "group_code" VARCHAR(50) NOT NULL,
            "group_name" VARCHAR(200),
            "root_demand_item_id" INT NOT NULL,
            "root_material_id" INT NOT NULL,
            "root_material_code" VARCHAR(50) NOT NULL,
            "root_material_name" VARCHAR(200) NOT NULL,
            "demand_id" INT,
            "demand_computation_id" INT NOT NULL,
            "sales_order_id" INT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "has_direct_supply" BOOL NOT NULL DEFAULT FALSE,
            "root_work_order_id" INT,
            "member_count" INT NOT NULL DEFAULT 0,
            "remarks" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_work_order_groups" IS '快格轻制造 - 工单组';
        CREATE INDEX IF NOT EXISTS "idx_wog_tenant_id"
            ON "apps_kuaizhizao_work_order_groups" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_wog_computation"
            ON "apps_kuaizhizao_work_order_groups" ("tenant_id", "demand_computation_id");
        CREATE INDEX IF NOT EXISTS "idx_wog_root_demand_item"
            ON "apps_kuaizhizao_work_order_groups" ("tenant_id", "root_demand_item_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_wog_tenant_group_code"
            ON "apps_kuaizhizao_work_order_groups" ("tenant_id", "group_code")
            WHERE "deleted_at" IS NULL;

        ALTER TABLE "apps_kuaizhizao_work_orders"
            ADD COLUMN IF NOT EXISTS "work_order_group_id" INT,
            ADD COLUMN IF NOT EXISTS "bom_parent_work_order_id" INT,
            ADD COLUMN IF NOT EXISTS "group_role" VARCHAR(30),
            ADD COLUMN IF NOT EXISTS "demand_item_id" INT,
            ADD COLUMN IF NOT EXISTS "supply_mode" VARCHAR(20) DEFAULT 'stocked';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."work_order_group_id" IS '所属工单组 ID';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."bom_parent_work_order_id" IS 'BOM 上级生产工单 ID（与拆分工单 parent 无关）';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."group_role" IS '组内角色：root/component/outsource_component';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."demand_item_id" IS '触发该工单的需求行 ID';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."supply_mode" IS '供应模式：stocked/direct';
        CREATE INDEX IF NOT EXISTS "idx_wo_work_order_group_id"
            ON "apps_kuaizhizao_work_orders" ("work_order_group_id");
        CREATE INDEX IF NOT EXISTS "idx_wo_bom_parent_work_order_id"
            ON "apps_kuaizhizao_work_orders" ("bom_parent_work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_wo_demand_item_id"
            ON "apps_kuaizhizao_work_orders" ("demand_item_id");

        ALTER TABLE "apps_kuaizhizao_outsource_work_orders"
            ADD COLUMN IF NOT EXISTS "work_order_group_id" INT,
            ADD COLUMN IF NOT EXISTS "bom_parent_work_order_id" INT,
            ADD COLUMN IF NOT EXISTS "group_role" VARCHAR(30),
            ADD COLUMN IF NOT EXISTS "demand_item_id" INT,
            ADD COLUMN IF NOT EXISTS "supply_mode" VARCHAR(20) DEFAULT 'stocked';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_work_orders"."work_order_group_id" IS '所属工单组 ID';
        CREATE INDEX IF NOT EXISTS "idx_owo_work_order_group_id"
            ON "apps_kuaizhizao_outsource_work_orders" ("work_order_group_id");

        ALTER TABLE "apps_kuaizhizao_demand_computations"
            ADD COLUMN IF NOT EXISTS "demand_item_bom_trees" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_demand_computations"."demand_item_bom_trees" IS '需求行 BOM 生产树（MRP 写入，下推工单组成组）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_demand_computations"
            DROP COLUMN IF EXISTS "demand_item_bom_trees";
        ALTER TABLE "apps_kuaizhizao_outsource_work_orders"
            DROP COLUMN IF EXISTS "supply_mode",
            DROP COLUMN IF EXISTS "demand_item_id",
            DROP COLUMN IF EXISTS "group_role",
            DROP COLUMN IF EXISTS "bom_parent_work_order_id",
            DROP COLUMN IF EXISTS "work_order_group_id";
        ALTER TABLE "apps_kuaizhizao_work_orders"
            DROP COLUMN IF EXISTS "supply_mode",
            DROP COLUMN IF EXISTS "demand_item_id",
            DROP COLUMN IF EXISTS "group_role",
            DROP COLUMN IF EXISTS "bom_parent_work_order_id",
            DROP COLUMN IF EXISTS "work_order_group_id";
        DROP TABLE IF EXISTS "apps_kuaizhizao_work_order_groups";
    """
