"""
调拨/盘点明细补齐 material_unit，并从物料主数据回填历史行。

Author: RiverEdge
Date: 2026-08-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_inventory_transfer_items'
                  AND column_name = 'material_unit'
            ) THEN
                ALTER TABLE apps_kuaizhizao_inventory_transfer_items
                    ADD COLUMN material_unit VARCHAR(20);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_stocktaking_items'
                  AND column_name = 'material_unit'
            ) THEN
                ALTER TABLE apps_kuaizhizao_stocktaking_items
                    ADD COLUMN material_unit VARCHAR(20);
            END IF;
        END $$;

        UPDATE apps_kuaizhizao_inventory_transfer_items ti
        SET material_unit = COALESCE(NULLIF(TRIM(m.base_unit), ''), '个')
        FROM apps_master_data_materials m
        WHERE ti.material_id = m.id
          AND ti.deleted_at IS NULL
          AND (ti.material_unit IS NULL OR TRIM(ti.material_unit) = '');

        UPDATE apps_kuaizhizao_stocktaking_items si
        SET material_unit = COALESCE(NULLIF(TRIM(m.base_unit), ''), '个')
        FROM apps_master_data_materials m
        WHERE si.material_id = m.id
          AND si.deleted_at IS NULL
          AND (si.material_unit IS NULL OR TRIM(si.material_unit) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_inventory_transfer_items DROP COLUMN IF EXISTS material_unit;
        ALTER TABLE apps_kuaizhizao_stocktaking_items DROP COLUMN IF EXISTS material_unit;
    """
