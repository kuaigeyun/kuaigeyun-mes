"""
回填 FAI 首件检验单审计人名。

568 补列后历史行可能仅有 updated_at（auto_now）而无 created_by_name / updated_by_name，
列表「更新时间」叠列首行会显示为「-」。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE apps_kuaizhizao_fai_orders x
SET created_by_name = COALESCE(NULLIF(BTRIM(u.full_name), ''), u.username)
FROM core_users u
WHERE x.created_by IS NOT NULL
  AND CAST(x.created_by AS TEXT) = CAST(u.id AS TEXT)
  AND (x.created_by_name IS NULL OR BTRIM(x.created_by_name) = '');

UPDATE apps_kuaizhizao_fai_orders x
SET updated_by_name = COALESCE(NULLIF(BTRIM(u.full_name), ''), u.username)
FROM core_users u
WHERE x.updated_by IS NOT NULL
  AND CAST(x.updated_by AS TEXT) = CAST(u.id AS TEXT)
  AND (x.updated_by_name IS NULL OR BTRIM(x.updated_by_name) = '');

UPDATE apps_kuaizhizao_fai_orders
SET updated_by_name = created_by_name
WHERE (updated_by_name IS NULL OR BTRIM(updated_by_name) = '')
  AND created_by_name IS NOT NULL
  AND BTRIM(created_by_name) <> '';

UPDATE apps_kuaizhizao_fai_orders
SET created_by_name = updated_by_name
WHERE (created_by_name IS NULL OR BTRIM(created_by_name) = '')
  AND updated_by_name IS NOT NULL
  AND BTRIM(updated_by_name) <> '';

UPDATE apps_kuaizhizao_fai_orders
SET updated_by_name = approved_by_name,
    updated_by = COALESCE(updated_by, approved_by)
WHERE (updated_by_name IS NULL OR BTRIM(updated_by_name) = '')
  AND approved_by_name IS NOT NULL
  AND BTRIM(approved_by_name) <> '';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 数据回填迁移不做回退。
SELECT 1;
"""
