"""同步绑定 sources；外推 push_targets / trigger_actions 回填。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_SYNC_BINDING_TABLES = (
    "apps_master_data_customer_sync_binding",
    "apps_master_data_supplier_sync_binding",
    "apps_master_data_warehouse_sync_binding",
    "apps_master_data_material_sync_binding",
    "apps_master_data_material_unit_sync_binding",
    "apps_master_data_material_group_sync_binding",
    "apps_kuaizhizao_sales_order_sync_binding",
    "apps_kuaizhizao_purchase_order_sync_binding",
    "apps_kuaizhizao_work_order_sync_binding",
    "apps_kuaizhizao_reporting_sync_binding",
    "apps_kuaizhizao_inventory_sync_binding",
)

_PUSH_BINDING_TABLES = (
    "apps_kuaizhizao_work_order_sync_binding",
    "apps_kuaizhizao_sales_order_sync_binding",
    "apps_kuaizhizao_purchase_order_sync_binding",
    "apps_kuaizhizao_reporting_sync_binding",
    "apps_kuaizhizao_inventory_sync_binding",
)


def _add_sources_column(table: str) -> str:
    return f"""
        ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "sources" JSONB;
    """


def _backfill_sources(table: str) -> str:
    return f"""
        UPDATE "{table}"
        SET "sources" = jsonb_build_array(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'kind', "source_type",
                    'api_uuid', "api_uuid",
                    'dataset_uuid', "dataset_uuid",
                    'field_mapping', COALESCE("field_mapping", '{{}}'::jsonb)
                )
            )
        )
        WHERE "sources" IS NULL
          AND "source_type" IN ('api', 'dataset')
          AND "field_mapping" IS NOT NULL
          AND (
            ("source_type" = 'api' AND "api_uuid" IS NOT NULL AND "api_uuid" <> '')
            OR ("source_type" = 'dataset' AND "dataset_uuid" IS NOT NULL AND "dataset_uuid" <> '')
          );
    """


def _add_push_columns(table: str) -> str:
    return f"""
        ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "push_targets" JSONB;
        ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "trigger_actions" JSONB;
    """


def _backfill_work_order_push() -> str:
    return """
        UPDATE "apps_kuaizhizao_work_order_sync_binding"
        SET "push_targets" = jsonb_build_array(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'connection_code', "push_connection_code",
                    'save_api_uuid', "push_save_api_uuid",
                    'target_profile', 'kingdee_prd_mo'
                )
            )
        )
        WHERE "push_targets" IS NULL
          AND (
            ("push_connection_code" IS NOT NULL AND "push_connection_code" <> '')
            OR ("push_save_api_uuid" IS NOT NULL AND "push_save_api_uuid" <> '')
          );
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _SYNC_BINDING_TABLES:
        parts.append(_add_sources_column(table))
        parts.append(_backfill_sources(table))
    for table in _PUSH_BINDING_TABLES:
        parts.append(_add_push_columns(table))
    parts.append(_backfill_work_order_push())
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _SYNC_BINDING_TABLES:
        parts.append(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS "sources";')
    for table in _PUSH_BINDING_TABLES:
        parts.append(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS "trigger_actions";')
        parts.append(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS "push_targets";')
    return "\n".join(parts)
