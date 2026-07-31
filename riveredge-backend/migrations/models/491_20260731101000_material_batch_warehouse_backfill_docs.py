"""
补回填 MaterialBatch.warehouse_id：覆盖采购入库等多种来源单据。

迁移 490 仅从库存流水与 other_inbounds（且误用 code 字段）回填；
实际主仓入库大量来自 purchase_receipts（如 CGSD），导致铁粉等仍为 warehouse_id=0。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 通用：按 source_doc_id + tenant 从各类入库/退货/拆卸单据回填
UPDATE "apps_master_data_material_batches" AS b
SET
    "warehouse_id" = src.wh_id,
    "warehouse_name" = NULLIF(TRIM(src.wh_name), '')
FROM (
    SELECT pr."tenant_id" AS tenant_id, pr."id" AS doc_id, pr."warehouse_id" AS wh_id, pr."warehouse_name" AS wh_name
    FROM "apps_kuaizhizao_purchase_receipts" pr
    WHERE pr."warehouse_id" IS NOT NULL AND pr."warehouse_id" > 0 AND pr."deleted_at" IS NULL
    UNION ALL
    SELECT oi."tenant_id", oi."id", oi."warehouse_id", oi."warehouse_name"
    FROM "apps_kuaizhizao_other_inbounds" oi
    WHERE oi."warehouse_id" IS NOT NULL AND oi."warehouse_id" > 0 AND oi."deleted_at" IS NULL
    UNION ALL
    SELECT fg."tenant_id", fg."id", fg."warehouse_id", fg."warehouse_name"
    FROM "apps_kuaizhizao_finished_goods_receipts" fg
    WHERE fg."warehouse_id" IS NOT NULL AND fg."warehouse_id" > 0 AND fg."deleted_at" IS NULL
    UNION ALL
    SELECT sf."tenant_id", sf."id", sf."warehouse_id", sf."warehouse_name"
    FROM "apps_kuaizhizao_semi_finished_goods_receipts" sf
    WHERE sf."warehouse_id" IS NOT NULL AND sf."warehouse_id" > 0 AND sf."deleted_at" IS NULL
    UNION ALL
    SELECT cm."tenant_id", cm."id", cm."warehouse_id", cm."warehouse_name"
    FROM "apps_kuaizhizao_customer_material_registrations" cm
    WHERE cm."warehouse_id" IS NOT NULL AND cm."warehouse_id" > 0 AND cm."deleted_at" IS NULL
    UNION ALL
    SELECT sr."tenant_id", sr."id", sr."warehouse_id", sr."warehouse_name"
    FROM "apps_kuaizhizao_sales_returns" sr
    WHERE sr."warehouse_id" IS NOT NULL AND sr."warehouse_id" > 0 AND sr."deleted_at" IS NULL
    UNION ALL
    SELECT d."tenant_id", d."id", d."warehouse_id", d."warehouse_name"
    FROM "apps_kuaizhizao_disassembly_orders" d
    WHERE d."warehouse_id" IS NOT NULL AND d."warehouse_id" > 0 AND d."deleted_at" IS NULL
    UNION ALL
    SELECT ow."tenant_id", ow."id", ow."warehouse_id", ow."warehouse_name"
    FROM "apps_kuaizhizao_outsource_material_receipts" ow
    WHERE ow."warehouse_id" IS NOT NULL AND ow."warehouse_id" > 0 AND ow."deleted_at" IS NULL
) AS src
WHERE b."deleted_at" IS NULL
  AND b."warehouse_id" = 0
  AND b."source_doc_id" IS NOT NULL
  AND b."tenant_id" = src.tenant_id
  AND b."source_doc_id" = src.doc_id
  AND NOT EXISTS (
      SELECT 1 FROM "apps_master_data_material_batches" x
      WHERE x."deleted_at" IS NULL
        AND x."tenant_id" = b."tenant_id"
        AND x."material_id" = b."material_id"
        AND x."batch_no" = b."batch_no"
        AND COALESCE(x."ownership_type", 'company_owned') = COALESCE(b."ownership_type", 'company_owned')
        AND COALESCE(x."customer_id", 0) = COALESCE(b."customer_id", 0)
        AND x."warehouse_id" = src.wh_id
        AND x."id" <> b."id"
  );

-- 按 source_doc_code 二次回填（id 对不上但单号能对上时）
UPDATE "apps_master_data_material_batches" AS b
SET
    "warehouse_id" = src.wh_id,
    "warehouse_name" = NULLIF(TRIM(src.wh_name), '')
FROM (
    SELECT pr."tenant_id" AS tenant_id, pr."receipt_code" AS doc_code, pr."warehouse_id" AS wh_id, pr."warehouse_name" AS wh_name
    FROM "apps_kuaizhizao_purchase_receipts" pr
    WHERE pr."warehouse_id" IS NOT NULL AND pr."warehouse_id" > 0 AND pr."deleted_at" IS NULL
    UNION ALL
    SELECT oi."tenant_id", oi."inbound_code", oi."warehouse_id", oi."warehouse_name"
    FROM "apps_kuaizhizao_other_inbounds" oi
    WHERE oi."warehouse_id" IS NOT NULL AND oi."warehouse_id" > 0 AND oi."deleted_at" IS NULL
    UNION ALL
    SELECT fg."tenant_id", fg."receipt_code", fg."warehouse_id", fg."warehouse_name"
    FROM "apps_kuaizhizao_finished_goods_receipts" fg
    WHERE fg."warehouse_id" IS NOT NULL AND fg."warehouse_id" > 0 AND fg."deleted_at" IS NULL
    UNION ALL
    SELECT sf."tenant_id", sf."receipt_code", sf."warehouse_id", sf."warehouse_name"
    FROM "apps_kuaizhizao_semi_finished_goods_receipts" sf
    WHERE sf."warehouse_id" IS NOT NULL AND sf."warehouse_id" > 0 AND sf."deleted_at" IS NULL
    UNION ALL
    SELECT cm."tenant_id", cm."registration_code", cm."warehouse_id", cm."warehouse_name"
    FROM "apps_kuaizhizao_customer_material_registrations" cm
    WHERE cm."warehouse_id" IS NOT NULL AND cm."warehouse_id" > 0 AND cm."deleted_at" IS NULL
    UNION ALL
    SELECT sr."tenant_id", sr."return_code", sr."warehouse_id", sr."warehouse_name"
    FROM "apps_kuaizhizao_sales_returns" sr
    WHERE sr."warehouse_id" IS NOT NULL AND sr."warehouse_id" > 0 AND sr."deleted_at" IS NULL
    UNION ALL
    SELECT d."tenant_id", d."code", d."warehouse_id", d."warehouse_name"
    FROM "apps_kuaizhizao_disassembly_orders" d
    WHERE d."warehouse_id" IS NOT NULL AND d."warehouse_id" > 0 AND d."deleted_at" IS NULL
    UNION ALL
    SELECT ow."tenant_id", ow."code", ow."warehouse_id", ow."warehouse_name"
    FROM "apps_kuaizhizao_outsource_material_receipts" ow
    WHERE ow."warehouse_id" IS NOT NULL AND ow."warehouse_id" > 0 AND ow."deleted_at" IS NULL
) AS src
WHERE b."deleted_at" IS NULL
  AND b."warehouse_id" = 0
  AND b."source_doc_code" IS NOT NULL
  AND NULLIF(TRIM(b."source_doc_code"), '') IS NOT NULL
  AND b."tenant_id" = src.tenant_id
  AND b."source_doc_code" = src.doc_code
  AND NOT EXISTS (
      SELECT 1 FROM "apps_master_data_material_batches" x
      WHERE x."deleted_at" IS NULL
        AND x."tenant_id" = b."tenant_id"
        AND x."material_id" = b."material_id"
        AND x."batch_no" = b."batch_no"
        AND COALESCE(x."ownership_type", 'company_owned') = COALESCE(b."ownership_type", 'company_owned')
        AND COALESCE(x."customer_id", 0) = COALESCE(b."customer_id", 0)
        AND x."warehouse_id" = src.wh_id
        AND x."id" <> b."id"
  );

-- 补仓库名称
UPDATE "apps_master_data_material_batches" AS b
SET "warehouse_name" = w."name"
FROM "apps_master_data_warehouses" AS w
WHERE b."warehouse_id" > 0
  AND (b."warehouse_name" IS NULL OR TRIM(b."warehouse_name") = '')
  AND w."id" = b."warehouse_id"
  AND w."tenant_id" = b."tenant_id"
  AND w."deleted_at" IS NULL;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 回填不可逆；downgrade 为空操作
SELECT 1;
"""
