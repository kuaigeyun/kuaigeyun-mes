"""
历史批号有效期至回填：物料启用保质期且批号有生产日期、有效期为空时，
按 production_date + shelf_life_days 写入；仍为空则继承同物料同批号已维护的有效期。

与 scripts/backfill_material_batch_expiry.py 逻辑一致；部署 aerich upgrade 时自动执行。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_master_data_material_batches" AS b
        SET "expiry_date" = b."production_date" + m."shelf_life_days"
        FROM "apps_master_data_materials" AS m
        WHERE b."material_id" = m."id"
          AND b."tenant_id" = m."tenant_id"
          AND b."deleted_at" IS NULL
          AND m."deleted_at" IS NULL
          AND b."expiry_date" IS NULL
          AND b."production_date" IS NOT NULL
          AND m."shelf_life_managed" = TRUE
          AND m."shelf_life_days" IS NOT NULL
          AND m."shelf_life_days" >= 1;

        UPDATE "apps_master_data_material_batches" AS b
        SET "expiry_date" = src."expiry_date"
        FROM (
            SELECT DISTINCT ON ("tenant_id", "material_id", "batch_no")
                "tenant_id",
                "material_id",
                "batch_no",
                "expiry_date"
            FROM "apps_master_data_material_batches"
            WHERE "deleted_at" IS NULL
              AND "expiry_date" IS NOT NULL
            ORDER BY "tenant_id", "material_id", "batch_no", "updated_at" DESC NULLS LAST, "id" DESC
        ) AS src
        WHERE b."tenant_id" = src."tenant_id"
          AND b."material_id" = src."material_id"
          AND b."batch_no" = src."batch_no"
          AND b."deleted_at" IS NULL
          AND b."expiry_date" IS NULL
          AND src."expiry_date" IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: material batch expiry backfill is irreversible"
