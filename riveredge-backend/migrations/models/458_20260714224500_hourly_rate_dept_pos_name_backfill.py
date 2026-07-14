"""工时单价：按 department_id / position_id 回填反范式名称。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE apps_master_data_hourly_rates x
   SET department_name = d.name
  FROM core_departments d
 WHERE x.department_id IS NOT NULL
   AND CAST(x.department_id AS TEXT) = CAST(d.id AS TEXT)
   AND CAST(x.tenant_id AS TEXT) = CAST(d.tenant_id AS TEXT)
   AND (x.department_name IS NULL OR BTRIM(x.department_name) = '');

UPDATE apps_master_data_hourly_rates x
   SET position_name = p.name
  FROM core_positions p
 WHERE x.position_id IS NOT NULL
   AND CAST(x.position_id AS TEXT) = CAST(p.id AS TEXT)
   AND CAST(x.tenant_id AS TEXT) = CAST(p.tenant_id AS TEXT)
   AND (x.position_name IS NULL OR BTRIM(x.position_name) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
SELECT 1;
    """
