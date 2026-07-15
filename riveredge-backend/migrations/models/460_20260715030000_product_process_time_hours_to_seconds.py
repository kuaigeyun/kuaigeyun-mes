"""
产品工艺 lines：历史小时 → 秒，并补 standardTimeQty。

幂等条件：行 JSON 已含 standardTimeQty 或 standard_time_qty 则跳过该行。
与 apps.master_data.scripts.migrate_product_process_time_to_seconds 语义一致。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE apps_master_data_material_product_process AS m
SET lines = sub.new_lines,
    updated_at = NOW()
FROM (
    SELECT
        p.id,
        COALESCE((
            SELECT jsonb_agg(migrated.elem ORDER BY migrated.ord)
            FROM (
                SELECT
                    e.ord,
                    CASE
                        WHEN (e.elem ? 'standardTimeQty') OR (e.elem ? 'standard_time_qty') THEN e.elem
                        ELSE
                            (
                                e.elem
                                - 'standardTime'
                                - 'standard_time'
                                - 'setupTime'
                                - 'setup_time'
                            )
                            || jsonb_strip_nulls(
                                jsonb_build_object(
                                    'standardTime',
                                    CASE
                                        WHEN e.elem ? 'standardTime'
                                             AND jsonb_typeof(e.elem->'standardTime') = 'number'
                                            THEN to_jsonb((e.elem->>'standardTime')::double precision * 3600)
                                        WHEN e.elem ? 'standard_time'
                                             AND jsonb_typeof(e.elem->'standard_time') = 'number'
                                            THEN to_jsonb((e.elem->>'standard_time')::double precision * 3600)
                                        ELSE NULL
                                    END,
                                    'setupTime',
                                    CASE
                                        WHEN e.elem ? 'setupTime'
                                             AND jsonb_typeof(e.elem->'setupTime') = 'number'
                                            THEN to_jsonb((e.elem->>'setupTime')::double precision * 3600)
                                        WHEN e.elem ? 'setup_time'
                                             AND jsonb_typeof(e.elem->'setup_time') = 'number'
                                            THEN to_jsonb((e.elem->>'setup_time')::double precision * 3600)
                                        ELSE NULL
                                    END,
                                    'standardTimeQty', 1,
                                    'standardTimeUnit',
                                    COALESCE(
                                        NULLIF(e.elem->>'standardTimeUnit', ''),
                                        NULLIF(e.elem->>'standard_time_unit', ''),
                                        'm'
                                    ),
                                    'setupTimeUnit',
                                    COALESCE(
                                        NULLIF(e.elem->>'setupTimeUnit', ''),
                                        NULLIF(e.elem->>'setup_time_unit', ''),
                                        'm'
                                    )
                                )
                            )
                    END AS elem
                FROM jsonb_array_elements(COALESCE(p.lines::jsonb, '[]'::jsonb))
                    WITH ORDINALITY AS e(elem, ord)
            ) AS migrated
        ), '[]'::jsonb) AS new_lines
    FROM apps_master_data_material_product_process AS p
    WHERE p.deleted_at IS NULL
      AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(p.lines::jsonb, '[]'::jsonb)) AS e(elem)
          WHERE NOT (e.elem ? 'standardTimeQty')
            AND NOT (e.elem ? 'standard_time_qty')
      )
) AS sub
WHERE m.id = sub.id;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
SELECT 1;
    """
