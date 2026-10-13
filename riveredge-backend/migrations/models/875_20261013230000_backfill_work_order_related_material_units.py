"""
工单相关单位回填。

工单表本身不存单位字段，数量按基础单位落库；单位展示读物料 base_unit。
此前 scenarios.production 与单据 material_unit 快照可能仍停在旧生产单位。

本迁移：
1. 清掉无有效辅助单位的 scenarios（含空对象）与空 unit 行；
2. 物料 base_unit 若唯一命中单位名称且不是任一编码，回填为该单位 code；
3. 制造侧单据/线边库存 material_unit 快照对齐到当前物料 base_unit。

不改工单数量：无可靠换算证据，禁止逆推。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# 制造侧：数量按基础单位管理，快照单位应对齐 base_unit
_MFG_SNAPSHOT_TABLES = (
    "apps_kuaizhizao_line_side_inventory",
    "apps_kuaizhizao_finished_goods_receipt_items",
    "apps_kuaizhizao_semi_finished_goods_receipt_items",
    "apps_kuaizhizao_production_picking_items",
    "apps_kuaizhizao_production_return_items",
    "apps_kuaizhizao_backflush_records",
    "apps_kuaizhizao_material_call_request_items",
    "apps_kuaizhizao_material_call_requests",
)


def _sync_snapshot_sql(table: str) -> str:
    return f"""
        UPDATE "{table}" AS t
        SET "material_unit" = m."base_unit"
        FROM "apps_master_data_materials" AS m
        WHERE t."deleted_at" IS NULL
          AND m."deleted_at" IS NULL
          AND t."material_id" = m."id"
          AND t."tenant_id" = m."tenant_id"
          AND COALESCE(btrim(m."base_unit"), '') <> ''
          AND t."material_unit" IS DISTINCT FROM m."base_unit";
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts: list[str] = [
        # 1a. 无有效辅助单位时去掉 scenarios；或 scenarios 已是空对象
        """
        UPDATE "apps_master_data_materials"
        SET "units" = ("units"::jsonb - 'scenarios')
        WHERE "units" IS NOT NULL
          AND jsonb_typeof("units"::jsonb) = 'object'
          AND ("units"::jsonb) ? 'scenarios'
          AND (
            "units"::jsonb -> 'scenarios' = '{}'::jsonb
            OR NOT EXISTS (
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
            )
          );
        """,
        # 1b. 辅助单位数组去掉 unit 为空的对象行
        """
        UPDATE "apps_master_data_materials"
        SET "units" = jsonb_set(
          "units"::jsonb,
          '{units}',
          COALESCE((
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements("units"::jsonb -> 'units') AS elem
            WHERE NOT (
              jsonb_typeof(elem) = 'object'
              AND btrim(COALESCE(elem->>'unit', '')) = ''
            )
          ), '[]'::jsonb),
          true
        )
        WHERE "units" IS NOT NULL
          AND jsonb_typeof("units"::jsonb) = 'object'
          AND jsonb_typeof("units"::jsonb -> 'units') = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements("units"::jsonb -> 'units') AS elem
            WHERE jsonb_typeof(elem) = 'object'
              AND btrim(COALESCE(elem->>'unit', '')) = ''
          );
        """,
        # 2. base_unit 存成了单位名称、且该名称唯一对应一个 code、且名称本身不是任一 code
        """
        UPDATE "apps_master_data_materials" AS m
        SET "base_unit" = u."code"
        FROM "apps_master_data_units" AS u
        WHERE m."deleted_at" IS NULL
          AND u."deleted_at" IS NULL
          AND m."tenant_id" = u."tenant_id"
          AND m."base_unit" = u."name"
          AND u."code" IS DISTINCT FROM u."name"
          AND NOT EXISTS (
            SELECT 1
            FROM "apps_master_data_units" AS u2
            WHERE u2."tenant_id" = m."tenant_id"
              AND u2."deleted_at" IS NULL
              AND u2."code" = m."base_unit"
          )
          AND (
            SELECT COUNT(DISTINCT u3."code")
            FROM "apps_master_data_units" AS u3
            WHERE u3."tenant_id" = m."tenant_id"
              AND u3."deleted_at" IS NULL
              AND u3."name" = m."base_unit"
          ) = 1;
        """,
    ]
    for table in _MFG_SNAPSHOT_TABLES:
        parts.append(_sync_snapshot_sql(table))
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: work-order-related material unit backfill is irreversible"
