"""
保养计划 equipment_items 回填：从保养方案绑定展开写入计划范围。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_maintenance_plans" AS p
        SET "equipment_items" = agg.items,
            "equipment_id" = (agg.items->0->>'id')::int,
            "equipment_uuid" = agg.items->0->>'uuid',
            "equipment_name" = CASE
                WHEN jsonb_array_length(agg.items) = 1 THEN agg.items->0->>'name'
                ELSE (agg.items->0->>'name') || ' 等' || jsonb_array_length(agg.items)::text || '台'
            END
        FROM (
            SELECT
                mp.id AS plan_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', e.id,
                            'uuid', e.uuid,
                            'code', e.code,
                            'name', e.name
                        )
                        ORDER BY b.id
                    ) FILTER (WHERE e.id IS NOT NULL),
                    '[]'::jsonb
                ) AS items
            FROM "apps_kuaizhizao_maintenance_plans" mp
            LEFT JOIN "apps_kuaizhizao_equipment_scheme_bindings" b
                ON b.tenant_id = mp.tenant_id
                AND b.scheme_id = mp.maintenance_scheme_id
                AND b.scheme_type = 'maintenance'
                AND b.deleted_at IS NULL
            LEFT JOIN "apps_kuaizhizao_equipment" e
                ON e.id = b.equipment_id
                AND e.tenant_id = b.tenant_id
                AND e.deleted_at IS NULL
            WHERE mp.deleted_at IS NULL
              AND mp.maintenance_scheme_id IS NOT NULL
              AND (
                  mp.equipment_items IS NULL
                  OR mp.equipment_items = '[]'::jsonb
                  OR jsonb_array_length(mp.equipment_items) = 0
              )
            GROUP BY mp.id
        ) AS agg
        WHERE p.id = agg.plan_id
          AND jsonb_array_length(agg.items) > 0;
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
        """
