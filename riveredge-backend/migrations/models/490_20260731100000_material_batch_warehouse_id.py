"""
主仓批次余额按仓库拆分：MaterialBatch 增加 warehouse_id / warehouse_name。

根因：入库过账把 warehouse_id 写入流水，但余额表不存仓；即时库存用物料默认仓冒充，
物料未配默认仓时显示「未配置仓库」。

回填顺序：库存流水 balance/to 仓 → 其他入库单表头仓 → 保持 0（未配置）。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_material_batches"
    ADD COLUMN IF NOT EXISTS "warehouse_id" INT NOT NULL DEFAULT 0;
ALTER TABLE "apps_master_data_material_batches"
    ADD COLUMN IF NOT EXISTS "warehouse_name" VARCHAR(200);

-- 1) 从库存流水回填（同物料+批号取最近一次有仓的流水）
UPDATE "apps_master_data_material_batches" AS b
SET
    "warehouse_id" = m.wh_id,
    "warehouse_name" = NULLIF(TRIM(m.wh_name), '')
FROM (
    SELECT DISTINCT ON (
        "tenant_id",
        "material_id",
        COALESCE(NULLIF(TRIM("batch_no"), ''), 'DEFAULT')
    )
        "tenant_id",
        "material_id",
        COALESCE(NULLIF(TRIM("batch_no"), ''), 'DEFAULT') AS batch_key,
        COALESCE("balance_warehouse_id", "to_warehouse_id") AS wh_id,
        COALESCE("to_warehouse_name", "from_warehouse_name") AS wh_name
    FROM "apps_kuaizhizao_material_stock_movements"
    WHERE COALESCE("balance_warehouse_id", "to_warehouse_id") IS NOT NULL
      AND COALESCE("balance_warehouse_id", "to_warehouse_id") > 0
    ORDER BY
        "tenant_id",
        "material_id",
        COALESCE(NULLIF(TRIM("batch_no"), ''), 'DEFAULT'),
        "created_at" DESC,
        "id" DESC
) AS m
WHERE b."deleted_at" IS NULL
  AND b."warehouse_id" = 0
  AND b."tenant_id" = m."tenant_id"
  AND b."material_id" = m."material_id"
  AND COALESCE(NULLIF(TRIM(b."batch_no"), ''), 'DEFAULT') = m.batch_key;

-- 2) 流水仍无仓时，从其他入库单表头回填
UPDATE "apps_master_data_material_batches" AS b
SET
    "warehouse_id" = oi."warehouse_id",
    "warehouse_name" = NULLIF(TRIM(oi."warehouse_name"), '')
FROM "apps_kuaizhizao_other_inbounds" AS oi
WHERE b."deleted_at" IS NULL
  AND b."warehouse_id" = 0
  AND b."source_doc_id" IS NOT NULL
  AND oi."id" = b."source_doc_id"
  AND oi."tenant_id" = b."tenant_id"
  AND oi."deleted_at" IS NULL
  AND oi."warehouse_id" IS NOT NULL
  AND oi."warehouse_id" > 0;

-- 3) 补仓库名称（仅有 id 时）
UPDATE "apps_master_data_material_batches" AS b
SET "warehouse_name" = w."name"
FROM "apps_master_data_warehouses" AS w
WHERE b."warehouse_id" > 0
  AND (b."warehouse_name" IS NULL OR TRIM(b."warehouse_name") = '')
  AND w."id" = b."warehouse_id"
  AND w."tenant_id" = b."tenant_id"
  AND w."deleted_at" IS NULL;

DROP INDEX IF EXISTS "uidx_material_batch_ownership";
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_material_batch_ownership_wh"
    ON "apps_master_data_material_batches"
    ("tenant_id", "material_id", "batch_no", "ownership_type", "customer_id", "warehouse_id")
    WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_material_batch_warehouse"
    ON "apps_master_data_material_batches" ("tenant_id", "warehouse_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_material_batch_warehouse";
DROP INDEX IF EXISTS "uidx_material_batch_ownership_wh";
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_material_batch_ownership"
    ON "apps_master_data_material_batches"
    ("tenant_id", "material_id", "batch_no", "ownership_type", "customer_id")
    WHERE "deleted_at" IS NULL;
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "warehouse_name";
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "warehouse_id";
"""
