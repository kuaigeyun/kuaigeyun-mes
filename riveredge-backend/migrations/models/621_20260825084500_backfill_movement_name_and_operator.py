"""回填库存流水：含软删物料的名称/编码，以及来源单据操作人。

620 仅 JOIN deleted_at IS NULL，软删物料行名称仍空；
历史过账从未写入 operator_*，需从来源单据真源回填。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 1) 物料名称/编码：主数据快照（含软删，流水是历史事实）
        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "material_name" = mat."name",
            "material_code" = COALESCE(NULLIF(BTRIM(m."material_code"), ''), mat."main_code")
        FROM "apps_master_data_materials" AS mat
        WHERE mat."id" = m."material_id"
          AND mat."tenant_id" = m."tenant_id"
          AND (
              m."material_name" IS NULL
              OR BTRIM(m."material_name") = ''
              OR m."material_code" IS NULL
              OR BTRIM(m."material_code") = ''
          );

        -- 2) 组装单类型纠正（历史误标 adjust）
        UPDATE "apps_kuaizhizao_material_stock_movements"
        SET "movement_type" = CASE
            WHEN "quantity" < 0 THEN 'assembly_consume'
            ELSE 'assembly_receipt'
        END
        WHERE "source_doc_type" = 'assembly_order'
          AND "movement_type" = 'adjust';

        -- 3) 操作人：从来源单据字段回填（仅空值）
        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."picker_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."picker_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."picker_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."picker_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_production_pickings" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('production_picking', 'production_picking_withdraw')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."receiver_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."receiver_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_finished_goods_receipts" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('finished_goods_receipt', 'finished_goods_receipt_revoke')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."receiver_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."receiver_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_semi_finished_goods_receipts" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('semi_finished_goods_receipt', 'semi_finished_goods_receipt_revoke')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."executed_by", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."executed_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."executed_by", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."executed_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_batching_orders" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" = 'batching_order'
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."receiver_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."receiver_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_other_inbounds" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('other_inbound', 'other_inbound_revoke')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."deliverer_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."deliverer_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."deliverer_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."deliverer_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_other_outbounds" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('other_outbound', 'other_outbound_revoke')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."receiver_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."receiver_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."receiver_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_purchase_receipts" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('purchase_receipt', 'purchase_receipt_revoke')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."deliverer_id", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."deliverer_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."deliverer_id", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."deliverer_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_sales_deliveries" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('sales_delivery', 'sales_delivery_withdraw')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."executed_by", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."executed_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."executed_by", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."executed_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_assembly_orders" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" = 'assembly_order'
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
        FROM "apps_kuaizhizao_production_returns" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" IN ('production_return', 'production_return_revoke')
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_id" = COALESCE(m."operator_id", d."received_by", d."updated_by", d."created_by"),
            "operator_name" = COALESCE(
                NULLIF(BTRIM(m."operator_name"), ''),
                NULLIF(BTRIM(d."received_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            ),
            "created_by" = COALESCE(m."created_by", d."received_by", d."updated_by", d."created_by"),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(d."received_by_name"), ''),
                NULLIF(BTRIM(d."updated_by_name"), ''),
                NULLIF(BTRIM(d."created_by_name"), '')
            )
        FROM "apps_kuaizhizao_outsource_material_receipts" AS d
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" = 'outsource_material_receipt'
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

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
        WHERE d."id" = m."source_doc_id"
          AND d."tenant_id" = m."tenant_id"
          AND m."source_doc_type" = 'backflush_record'
          AND (m."operator_id" IS NULL OR m."operator_name" IS NULL OR BTRIM(COALESCE(m."operator_name", '')) = '');

        -- 4) 仍缺姓名但有 operator_id：从用户表补姓名
        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "operator_name" = COALESCE(
                NULLIF(BTRIM(u."full_name"), ''),
                NULLIF(BTRIM(u."username"), '')
            ),
            "created_by_name" = COALESCE(
                NULLIF(BTRIM(m."created_by_name"), ''),
                NULLIF(BTRIM(u."full_name"), ''),
                NULLIF(BTRIM(u."username"), '')
            )
        FROM "core_users" AS u
        WHERE u."id" = m."operator_id"
          AND (m."operator_name" IS NULL OR BTRIM(m."operator_name") = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 回填不可逆；downgrade 为空操作
        SELECT 1;
    """
