"""
没有辅助单位的物料，删掉 units.scenarios。

场景单位选择只在有辅助单位时出现。辅助单位为空时这份配置不在界面上，
却会被工单当成生产单位。这里把已落库的隐藏配置清掉。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_master_data_materials"
        SET "units" = ("units"::jsonb - 'scenarios')
        WHERE "units" IS NOT NULL
          AND jsonb_typeof("units"::jsonb) = 'object'
          AND ("units"::jsonb) ? 'scenarios'
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof("units"::jsonb -> 'units') = 'array'
                  THEN "units"::jsonb -> 'units'
                ELSE '[]'::jsonb
              END
            ) AS elem
            WHERE (
              jsonb_typeof(elem) = 'object'
              AND btrim(COALESCE(elem->>'unit', '')) <> ''
            ) OR (
              jsonb_typeof(elem) = 'string'
              AND btrim(elem #>> '{}') <> ''
            )
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
