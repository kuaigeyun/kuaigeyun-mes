"""
过程/成品/OQC 检验单补齐 material_unit，并从物料主数据回填历史行。

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
                WHERE table_name = 'apps_kuaizhizao_process_inspections'
                  AND column_name = 'material_unit'
            ) THEN
                ALTER TABLE apps_kuaizhizao_process_inspections
                    ADD COLUMN material_unit VARCHAR(20);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_finished_goods_inspections'
                  AND column_name = 'material_unit'
            ) THEN
                ALTER TABLE apps_kuaizhizao_finished_goods_inspections
                    ADD COLUMN material_unit VARCHAR(20);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'apps_kuaizhizao_oqc_inspections'
                  AND column_name = 'material_unit'
            ) THEN
                ALTER TABLE apps_kuaizhizao_oqc_inspections
                    ADD COLUMN material_unit VARCHAR(20);
            END IF;
        END $$;

        UPDATE apps_kuaizhizao_process_inspections pi
        SET material_unit = COALESCE(NULLIF(TRIM(m.base_unit), ''), '个')
        FROM apps_master_data_materials m
        WHERE pi.material_id = m.id
          AND pi.deleted_at IS NULL
          AND (pi.material_unit IS NULL OR TRIM(pi.material_unit) = '');

        UPDATE apps_kuaizhizao_finished_goods_inspections fi
        SET material_unit = COALESCE(NULLIF(TRIM(m.base_unit), ''), '个')
        FROM apps_master_data_materials m
        WHERE fi.material_id = m.id
          AND fi.deleted_at IS NULL
          AND (fi.material_unit IS NULL OR TRIM(fi.material_unit) = '');

        UPDATE apps_kuaizhizao_oqc_inspections oi
        SET material_unit = COALESCE(NULLIF(TRIM(m.base_unit), ''), '个')
        FROM apps_master_data_materials m
        WHERE oi.material_id = m.id
          AND oi.deleted_at IS NULL
          AND (oi.material_unit IS NULL OR TRIM(oi.material_unit) = '');

        UPDATE apps_kuaizhizao_incoming_inspections ii
        SET material_unit = COALESCE(NULLIF(TRIM(m.base_unit), ''), '个')
        FROM apps_master_data_materials m
        WHERE ii.material_id = m.id
          AND ii.deleted_at IS NULL
          AND (ii.material_unit IS NULL OR TRIM(ii.material_unit) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_process_inspections DROP COLUMN IF EXISTS material_unit;
        ALTER TABLE apps_kuaizhizao_finished_goods_inspections DROP COLUMN IF EXISTS material_unit;
        ALTER TABLE apps_kuaizhizao_oqc_inspections DROP COLUMN IF EXISTS material_unit;
    """
