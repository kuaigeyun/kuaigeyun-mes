"""回填序列号库存查询菜单 icon：hash → key（ManufacturingIcons 预置键）。

根因：磁盘 manifest 已改为 key，但 core_applications.menu_config 仍含 hash，
菜单同步会把旧 icon 写回 core_menus。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE "core_applications"
SET
  "menu_config" = replace(
    replace("menu_config"::text, '"icon": "hash"', '"icon": "key"'),
    '"icon":"hash"',
    '"icon":"key"'
  )::jsonb,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "deleted_at" IS NULL
  AND "menu_config" IS NOT NULL
  AND (
    "menu_config"::text LIKE '%"icon": "hash"%'
    OR "menu_config"::text LIKE '%"icon":"hash"%'
  );

UPDATE "core_menus"
SET
  "icon" = 'key',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "deleted_at" IS NULL
  AND "icon" = 'hash'
  AND "path" = '/apps/master-data/materials/serials';

DELETE FROM "core_cache_entries"
WHERE "key" LIKE '%:tree:%'
   OR "key" LIKE '%:list:%';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 不可逆回填：不恢复错误的 hash icon
SELECT 1;
"""
