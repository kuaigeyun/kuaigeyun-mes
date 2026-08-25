"""补回填遗漏来源：还料、采购退货撤回、倒冲。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."returner_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."returner_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."returner_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."returner_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_material_returns" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" = 'material_return'
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."returner_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."returner_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."returner_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."returner_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_purchase_returns" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('purchase_return', 'purchase_return_withdraw')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        -- 倒冲历史误把 report_id 写入 source_doc_id；按工单+物料对齐 BackflushRecord
        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."processed_by", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."processed_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."processed_by", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."processed_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_backflush_records" AS d
        WHERE m."source_doc_type" = 'backflush_record'
          AND d."tenant_id" = m."tenant_id"
          AND d."material_id" = m."material_id"
          AND (
                (m."work_order_id" IS NOT NULL AND d."work_order_id" = m."work_order_id")
             OR (NULLIF(BTRIM(COALESCE(m."source_doc_code", '')), '') IS NOT NULL
                 AND d."work_order_code" = m."source_doc_code")
          )
          AND d."status" = 'completed'
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
