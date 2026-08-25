"""倒冲流水操作人回填：BackflushRecord.status 为 completed（非 success）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
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
          AND d."work_order_id" = m."work_order_id"
          AND d."status" = 'completed'
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
