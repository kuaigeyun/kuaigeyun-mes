"""外协维保单/完修单 outsourced_unit_code 从供应商主数据回填（历史仅填名称未填代号）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE haoligo_mold_outsource_maintenance_sheet s
        SET outsourced_unit_code = sup.code,
            updated_at = NOW()
        FROM apps_master_data_suppliers sup
        WHERE s.deleted_at IS NULL
          AND (s.outsourced_unit_code IS NULL OR TRIM(s.outsourced_unit_code) = '')
          AND TRIM(s.outsourced_unit_name) <> ''
          AND sup.deleted_at IS NULL
          AND sup.tenant_id = s.tenant_id
          AND sup.name = TRIM(s.outsourced_unit_name);

        UPDATE haoligo_mold_outsource_maintenance_complete_sheet s
        SET outsourced_unit_code = sup.code,
            updated_at = NOW()
        FROM apps_master_data_suppliers sup
        WHERE s.deleted_at IS NULL
          AND (s.outsourced_unit_code IS NULL OR TRIM(s.outsourced_unit_code) = '')
          AND TRIM(s.outsourced_unit_name) <> ''
          AND sup.deleted_at IS NULL
          AND sup.tenant_id = s.tenant_id
          AND sup.name = TRIM(s.outsourced_unit_name);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
