"""
工序绑定不良品项、默认生产人员

- 新增 apps_master_data_operation_defect_types 关联表（工序-不良品项 M2M）
- 工序表新增 default_operator_id（默认生产人员，用户ID）

Author: Auto
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 工序表新增 default_operator_ids（默认生产人员，JSON数组）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_operations'
                AND column_name = 'default_operator_ids'
            ) THEN
                ALTER TABLE apps_master_data_operations
                ADD COLUMN default_operator_ids JSONB NULL;
                COMMENT ON COLUMN apps_master_data_operations.default_operator_ids IS '默认生产人员（用户ID列表，JSON数组，同组织）';
            END IF;
        END $$;

        -- 工序-不良品项关联表（M2M）
        CREATE TABLE IF NOT EXISTS apps_master_data_operation_defect_types (
            id SERIAL PRIMARY KEY,
            operation_id INT NOT NULL REFERENCES apps_master_data_operations(id) ON DELETE CASCADE,
            defect_type_id INT NOT NULL REFERENCES apps_master_data_defect_types(id) ON DELETE CASCADE,
            UNIQUE(operation_id, defect_type_id)
        );
        CREATE INDEX IF NOT EXISTS idx_operation_defect_types_operation_id
            ON apps_master_data_operation_defect_types(operation_id);
        CREATE INDEX IF NOT EXISTS idx_operation_defect_types_defect_type_id
            ON apps_master_data_operation_defect_types(defect_type_id);
        COMMENT ON TABLE apps_master_data_operation_defect_types IS '工序绑定不良品项（M2M）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS apps_master_data_operation_defect_types;
        ALTER TABLE apps_master_data_operations DROP COLUMN IF EXISTS default_operator_ids;
    """
