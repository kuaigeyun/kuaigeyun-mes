"""
回填序列号/批号 production_date：取自已确认入库单的实际入库时间（receipt_time），非计算推断。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 序列号：成品入库
        UPDATE apps_master_data_material_serials AS s
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (s2.id)
                s2.id AS serial_id,
                COALESCE(fgi.receipt_time, fgr.receipt_time)::date AS inbound_date
            FROM apps_master_data_material_serials s2
            JOIN apps_kuaizhizao_finished_goods_receipt_items fgi
                ON fgi.tenant_id = s2.tenant_id
                AND fgi.material_id = s2.material_id
                AND fgi.status = '已入库'
                AND fgi.serial_numbers IS NOT NULL
                AND jsonb_typeof(fgi.serial_numbers) = 'array'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(fgi.serial_numbers) AS sn(elem)
                    WHERE sn.elem = s2.serial_no
                )
            JOIN apps_kuaizhizao_finished_goods_receipts fgr
                ON fgr.id = fgi.receipt_id
                AND fgr.tenant_id = fgi.tenant_id
            WHERE s2.production_date IS NULL
              AND s2.deleted_at IS NULL
            ORDER BY s2.id, COALESCE(fgi.receipt_time, fgr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE s.id = src.serial_id;

        -- 序列号：采购入库
        UPDATE apps_master_data_material_serials AS s
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (s2.id)
                s2.id AS serial_id,
                COALESCE(pri.receipt_time, pr.receipt_time)::date AS inbound_date
            FROM apps_master_data_material_serials s2
            JOIN apps_kuaizhizao_purchase_receipt_items pri
                ON pri.tenant_id = s2.tenant_id
                AND pri.material_id = s2.material_id
                AND pri.status = '已入库'
                AND pri.serial_numbers IS NOT NULL
                AND jsonb_typeof(pri.serial_numbers) = 'array'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(pri.serial_numbers) AS sn(elem)
                    WHERE sn.elem = s2.serial_no
                )
            JOIN apps_kuaizhizao_purchase_receipts pr
                ON pr.id = pri.receipt_id
                AND pr.tenant_id = pri.tenant_id
            WHERE s2.production_date IS NULL
              AND s2.deleted_at IS NULL
            ORDER BY s2.id, COALESCE(pri.receipt_time, pr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE s.id = src.serial_id;

        -- 序列号：代工来料
        UPDATE apps_master_data_material_serials AS s
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (s2.id)
                s2.id AS serial_id,
                cmr.processed_at::date AS inbound_date
            FROM apps_master_data_material_serials s2
            JOIN apps_kuaizhizao_customer_material_registration_items cmri
                ON cmri.tenant_id = s2.tenant_id
                AND cmri.material_id = s2.material_id
                AND cmri.serial_numbers IS NOT NULL
                AND jsonb_typeof(cmri.serial_numbers) = 'array'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(cmri.serial_numbers) AS sn(elem)
                    WHERE sn.elem = s2.serial_no
                )
            JOIN apps_kuaizhizao_customer_material_registrations cmr
                ON cmr.id = cmri.registration_id
                AND cmr.tenant_id = cmri.tenant_id
                AND cmr.status = 'processed'
                AND cmr.processed_at IS NOT NULL
            WHERE s2.production_date IS NULL
              AND s2.deleted_at IS NULL
            ORDER BY s2.id, cmr.processed_at ASC NULLS LAST
        ) AS src
        WHERE s.id = src.serial_id;

        -- 批号：成品入库
        UPDATE apps_master_data_material_batches AS b
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (b2.id)
                b2.id AS batch_id,
                COALESCE(fgi.receipt_time, fgr.receipt_time)::date AS inbound_date
            FROM apps_master_data_material_batches b2
            JOIN apps_kuaizhizao_finished_goods_receipt_items fgi
                ON fgi.tenant_id = b2.tenant_id
                AND fgi.material_id = b2.material_id
                AND fgi.status = '已入库'
                AND fgi.batch_number IS NOT NULL
                AND fgi.batch_number = b2.batch_no
            JOIN apps_kuaizhizao_finished_goods_receipts fgr
                ON fgr.id = fgi.receipt_id
                AND fgr.tenant_id = fgi.tenant_id
            WHERE b2.production_date IS NULL
              AND b2.deleted_at IS NULL
            ORDER BY b2.id, COALESCE(fgi.receipt_time, fgr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE b.id = src.batch_id;

        -- 批号：采购入库
        UPDATE apps_master_data_material_batches AS b
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (b2.id)
                b2.id AS batch_id,
                COALESCE(pri.receipt_time, pr.receipt_time)::date AS inbound_date
            FROM apps_master_data_material_batches b2
            JOIN apps_kuaizhizao_purchase_receipt_items pri
                ON pri.tenant_id = b2.tenant_id
                AND pri.material_id = b2.material_id
                AND pri.status = '已入库'
                AND pri.batch_number IS NOT NULL
                AND pri.batch_number = b2.batch_no
            JOIN apps_kuaizhizao_purchase_receipts pr
                ON pr.id = pri.receipt_id
                AND pr.tenant_id = pri.tenant_id
            WHERE b2.production_date IS NULL
              AND b2.deleted_at IS NULL
            ORDER BY b2.id, COALESCE(pri.receipt_time, pr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE b.id = src.batch_id;

        -- 批号：半成品入库
        UPDATE apps_master_data_material_batches AS b
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (b2.id)
                b2.id AS batch_id,
                COALESCE(sfi.receipt_time, sfr.receipt_time)::date AS inbound_date
            FROM apps_master_data_material_batches b2
            JOIN apps_kuaizhizao_semi_finished_goods_receipt_items sfi
                ON sfi.tenant_id = b2.tenant_id
                AND sfi.material_id = b2.material_id
                AND sfi.status = '已入库'
                AND sfi.batch_number IS NOT NULL
                AND sfi.batch_number = b2.batch_no
            JOIN apps_kuaizhizao_semi_finished_goods_receipts sfr
                ON sfr.id = sfi.receipt_id
                AND sfr.tenant_id = sfi.tenant_id
            WHERE b2.production_date IS NULL
              AND b2.deleted_at IS NULL
            ORDER BY b2.id, COALESCE(sfi.receipt_time, sfr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE b.id = src.batch_id;

        -- 批号：代工来料（source_doc 关联）
        UPDATE apps_master_data_material_batches AS b
        SET production_date = cmr.processed_at::date
        FROM apps_kuaizhizao_customer_material_registrations cmr
        WHERE b.production_date IS NULL
          AND b.deleted_at IS NULL
          AND b.source_doc_id IS NOT NULL
          AND cmr.id = b.source_doc_id
          AND cmr.tenant_id = b.tenant_id
          AND cmr.status = 'processed'
          AND cmr.processed_at IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
