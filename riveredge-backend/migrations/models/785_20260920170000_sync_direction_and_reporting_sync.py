"""新增同步方向字段与报工同步绑定表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

SYNC_BINDING_TABLES = [
    "apps_master_data_customer_sync_binding",
    "apps_master_data_supplier_sync_binding",
    "apps_master_data_warehouse_sync_binding",
    "apps_master_data_material_sync_binding",
    "apps_master_data_material_unit_sync_binding",
    "apps_master_data_material_group_sync_binding",
    "apps_kuaizhizao_work_order_sync_binding",
    "apps_kuaizhizao_purchase_order_sync_binding",
    "apps_kuaizhizao_sales_order_sync_binding",
    "apps_kuaizhizao_inventory_sync_binding",
]


async def upgrade(db: BaseDBAsyncClient) -> str:
    add_direction = "\n".join(
        f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS "sync_direction" VARCHAR(20) NOT NULL DEFAULT 'pull';
        """
        for table in SYNC_BINDING_TABLES
    )
    return f"""
        {add_direction}

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_reporting_sync_binding" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "source_type" VARCHAR(20),
            "api_uuid" VARCHAR(36),
            "dataset_uuid" VARCHAR(36),
            "field_mapping" JSONB,
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'id',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full',
            "sync_direction" VARCHAR(20) NOT NULL DEFAULT 'push',
            "schedule_interval_minutes" INT NOT NULL DEFAULT 15,
            "last_success_at" TIMESTAMPTZ,
            "last_attempt_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_reporting_sync_binding_tenant"
            ON "apps_kuaizhizao_reporting_sync_binding" ("tenant_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    drop_direction = "\n".join(
        f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS "sync_direction";
        """
        for table in reversed(SYNC_BINDING_TABLES)
    )
    return f"""
        DROP TABLE IF EXISTS "apps_kuaizhizao_reporting_sync_binding" CASCADE;
        {drop_direction}
    """
