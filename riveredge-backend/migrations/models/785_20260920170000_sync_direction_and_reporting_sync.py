"""新增同步方向字段、即时库存同步绑定表与报工同步绑定表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# 仅对「已存在」的绑定表补 sync_direction；库存绑定在本迁移内先 CREATE。
EXISTING_SYNC_BINDING_TABLES = [
    "apps_master_data_customer_sync_binding",
    "apps_master_data_supplier_sync_binding",
    "apps_master_data_warehouse_sync_binding",
    "apps_master_data_material_sync_binding",
    "apps_master_data_material_unit_sync_binding",
    "apps_master_data_material_group_sync_binding",
    "apps_kuaizhizao_work_order_sync_binding",
    "apps_kuaizhizao_purchase_order_sync_binding",
    "apps_kuaizhizao_sales_order_sync_binding",
]


def _add_sync_direction_if_table_exists(table: str) -> str:
    return f"""
DO $$
BEGIN
    IF to_regclass('public.{table}') IS NOT NULL THEN
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS "sync_direction" VARCHAR(20) NOT NULL DEFAULT 'pull';
    END IF;
END $$;
"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    add_direction = "\n".join(
        _add_sync_direction_if_table_exists(table) for table in EXISTING_SYNC_BINDING_TABLES
    )
    return f"""
        -- 即时库存同步绑定：此前无建表迁移，须在加 sync_direction 之前创建
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_sync_binding" (
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
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'material_code',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full',
            "sync_direction" VARCHAR(20) NOT NULL DEFAULT 'pull',
            "schedule_interval_minutes" INT NOT NULL DEFAULT 15,
            "last_success_at" TIMESTAMPTZ,
            "last_attempt_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_inventory_sync_binding_tenant"
            ON "apps_kuaizhizao_inventory_sync_binding" ("tenant_id");

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
        DO $$
        BEGIN
            IF to_regclass('public.{table}') IS NOT NULL THEN
                ALTER TABLE "{table}" DROP COLUMN IF EXISTS "sync_direction";
            END IF;
        END $$;
        """
        for table in reversed(EXISTING_SYNC_BINDING_TABLES)
    )
    return f"""
        DROP TABLE IF EXISTS "apps_kuaizhizao_reporting_sync_binding" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_sync_binding" CASCADE;
        {drop_direction}
    """
