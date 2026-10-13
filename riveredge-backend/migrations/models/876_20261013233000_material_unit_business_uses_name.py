"""
业务字段单位改存单位名称（唯一真源）。

此前 Select value=code，展示侧再 code→name 翻译，违反四禁「映射」。
本迁移把物料 base_unit / units JSON、换算 from/to、制造侧 material_unit
在「存的是编码且编码≠名称」时回填为对应单位名称。之后写路径与展示直出名称。
"""

from __future__ import annotations

import json
from typing import Any, Optional

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

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


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _rewrite_units_json(units: Any, old: str, new: str) -> Optional[dict]:
    if not isinstance(units, dict):
        return None
    old_n = _norm(old)
    new_n = _norm(new)
    if not old_n or old_n == new_n:
        return None
    changed = False
    out = dict(units)
    arr = units.get("units")
    if isinstance(arr, list):
        new_arr = []
        for elem in arr:
            if isinstance(elem, dict):
                item = dict(elem)
                if _norm(item.get("unit")) == old_n:
                    item["unit"] = new_n
                    changed = True
                new_arr.append(item)
            elif isinstance(elem, str) and _norm(elem) == old_n:
                new_arr.append(new_n)
                changed = True
            else:
                new_arr.append(elem)
        out["units"] = new_arr
    scenarios = units.get("scenarios")
    if isinstance(scenarios, dict):
        new_sc = {}
        for key, value in scenarios.items():
            if _norm(value) == old_n:
                new_sc[key] = new_n
                changed = True
            else:
                new_sc[key] = value
        out["scenarios"] = new_sc
    for key in (
        "unit",
        "baseUnit",
        "base_unit",
        "purchaseUnit",
        "purchase_unit",
        "stockUnit",
        "stock_unit",
    ):
        if _norm(units.get(key)) == old_n:
            out[key] = new_n
            changed = True
    return out if changed else None


async def upgrade(db: BaseDBAsyncClient) -> str:
    # 1) 物料 base_unit：code → name
    await db.execute_script(
        """
        UPDATE "apps_master_data_materials" AS m
        SET "base_unit" = u."name"
        FROM "apps_master_data_units" AS u
        WHERE m."deleted_at" IS NULL
          AND u."deleted_at" IS NULL
          AND m."tenant_id" = u."tenant_id"
          AND m."base_unit" = u."code"
          AND u."code" IS DISTINCT FROM u."name"
          AND COALESCE(btrim(u."name"), '') <> '';
        """
    )

    # 2) 换算 from/to：code → name（若目标名称侧已有同向换算则跳过该行，避免唯一键冲突）
    await db.execute_script(
        """
        UPDATE "apps_master_data_unit_conversions" AS c
        SET "from_unit_code" = u."name"
        FROM "apps_master_data_units" AS u
        WHERE c."deleted_at" IS NULL
          AND u."deleted_at" IS NULL
          AND c."tenant_id" = u."tenant_id"
          AND c."from_unit_code" = u."code"
          AND u."code" IS DISTINCT FROM u."name"
          AND COALESCE(btrim(u."name"), '') <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM "apps_master_data_unit_conversions" AS c2
            WHERE c2."tenant_id" = c."tenant_id"
              AND c2."deleted_at" IS NULL
              AND c2."id" <> c."id"
              AND c2."from_unit_code" = u."name"
              AND c2."to_unit_code" = c."to_unit_code"
          );
        """
    )
    await db.execute_script(
        """
        UPDATE "apps_master_data_unit_conversions" AS c
        SET "to_unit_code" = u."name"
        FROM "apps_master_data_units" AS u
        WHERE c."deleted_at" IS NULL
          AND u."deleted_at" IS NULL
          AND c."tenant_id" = u."tenant_id"
          AND c."to_unit_code" = u."code"
          AND u."code" IS DISTINCT FROM u."name"
          AND COALESCE(btrim(u."name"), '') <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM "apps_master_data_unit_conversions" AS c2
            WHERE c2."tenant_id" = c."tenant_id"
              AND c2."deleted_at" IS NULL
              AND c2."id" <> c."id"
              AND c2."from_unit_code" = c."from_unit_code"
              AND c2."to_unit_code" = u."name"
          );
        """
    )

    # 3) 制造侧快照 material_unit：code → name
    for table in _MFG_SNAPSHOT_TABLES:
        await db.execute_script(
            f"""
            UPDATE "{table}" AS t
            SET "material_unit" = u."name"
            FROM "apps_master_data_units" AS u
            WHERE t."deleted_at" IS NULL
              AND u."deleted_at" IS NULL
              AND t."tenant_id" = u."tenant_id"
              AND t."material_unit" = u."code"
              AND u."code" IS DISTINCT FROM u."name"
              AND COALESCE(btrim(u."name"), '') <> '';
            """
        )

    # 4) 物料 units JSON 内旧编码 → 名称
    pairs = await db.execute_query_dict(
        """
        SELECT u."tenant_id" AS tenant_id, u."code" AS code, u."name" AS name
        FROM "apps_master_data_units" AS u
        WHERE u."deleted_at" IS NULL
          AND u."code" IS DISTINCT FROM u."name"
          AND COALESCE(btrim(u."name"), '') <> ''
          AND COALESCE(btrim(u."code"), '') <> '';
        """
    )
    for pair in pairs:
        tenant_id = pair["tenant_id"]
        old = pair["code"]
        new = pair["name"]
        rows = await db.execute_query_dict(
            """
            SELECT "id", "units"
            FROM "apps_master_data_materials"
            WHERE "tenant_id" = $1
              AND "deleted_at" IS NULL
              AND "units" IS NOT NULL;
            """,
            [tenant_id],
        )
        for row in rows:
            units = row["units"]
            if isinstance(units, str):
                try:
                    units = json.loads(units)
                except json.JSONDecodeError:
                    continue
            rewritten = _rewrite_units_json(units, old, new)
            if rewritten is None:
                continue
            await db.execute_query(
                """
                UPDATE "apps_master_data_materials"
                SET "units" = $1::jsonb
                WHERE "id" = $2;
                """,
                [json.dumps(rewritten, ensure_ascii=False), row["id"]],
            )

    return "SELECT 1;"


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "SELECT 1;"
