"""
修正 production_date：按站点时区（默认 Asia/Shanghai）从入库 receipt_time 取日历日。
此前 ::date / datetime.date() 在 UTC 与站点时区混用时可能偏移一天。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# 与 infra_settings.TIMEZONE 默认值一致；站点时区变更须单独评估历史日期
_SITE_TZ = "Asia/Shanghai"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        -- 序列号：成品入库
        UPDATE apps_master_data_material_serials AS s
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (s2.id)
                s2.id AS serial_id,
                (timezone('{_SITE_TZ}', COALESCE(fgi.receipt_time, fgr.receipt_time)))::date AS inbound_date
            FROM apps_master_data_material_serials s2
            JOIN apps_kuaizhizao_finished_goods_receipt_items fgi
                ON fgi.tenant_id = s2.tenant_id
                AND fgi.material_id = s2.material_id
                AND fgi.status = '已入库'
                AND fgi.serial_numbers IS NOT NULL
                AND (
                    (jsonb_typeof(fgi.serial_numbers) = 'array' AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements_text(fgi.serial_numbers) AS sn(elem)
                        WHERE sn.elem = s2.serial_no
                    ))
                    OR (jsonb_typeof(fgi.serial_numbers) = 'string' AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements_text((fgi.serial_numbers #>> '{{}}')::jsonb) AS sn(elem)
                        WHERE sn.elem = s2.serial_no
                    ))
                )
            JOIN apps_kuaizhizao_finished_goods_receipts fgr
                ON fgr.id = fgi.receipt_id AND fgr.tenant_id = fgi.tenant_id
            WHERE s2.deleted_at IS NULL
              AND COALESCE(fgi.receipt_time, fgr.receipt_time) IS NOT NULL
            ORDER BY s2.id, COALESCE(fgi.receipt_time, fgr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE s.id = src.serial_id
          AND s.production_date IS DISTINCT FROM src.inbound_date;

        -- 序列号：采购入库
        UPDATE apps_master_data_material_serials AS s
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (s2.id)
                s2.id AS serial_id,
                (timezone('{_SITE_TZ}', COALESCE(pri.receipt_time, pr.receipt_time)))::date AS inbound_date
            FROM apps_master_data_material_serials s2
            JOIN apps_kuaizhizao_purchase_receipt_items pri
                ON pri.tenant_id = s2.tenant_id
                AND pri.material_id = s2.material_id
                AND pri.status = '已入库'
                AND pri.serial_numbers IS NOT NULL
                AND jsonb_typeof(pri.serial_numbers) = 'array'
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(pri.serial_numbers) AS sn(elem)
                    WHERE sn.elem = s2.serial_no
                )
            JOIN apps_kuaizhizao_purchase_receipts pr
                ON pr.id = pri.receipt_id AND pr.tenant_id = pri.tenant_id
            WHERE s2.deleted_at IS NULL
              AND COALESCE(pri.receipt_time, pr.receipt_time) IS NOT NULL
            ORDER BY s2.id, COALESCE(pri.receipt_time, pr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE s.id = src.serial_id
          AND s.production_date IS DISTINCT FROM src.inbound_date;

        -- 批号：成品 / 采购 / 半成品入库（按 batch_number 关联）
        UPDATE apps_master_data_material_batches AS b
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (b2.id)
                b2.id AS batch_id,
                (timezone('{_SITE_TZ}', COALESCE(fgi.receipt_time, fgr.receipt_time)))::date AS inbound_date
            FROM apps_master_data_material_batches b2
            JOIN apps_kuaizhizao_finished_goods_receipt_items fgi
                ON fgi.tenant_id = b2.tenant_id
                AND fgi.material_id = b2.material_id
                AND fgi.status = '已入库'
                AND fgi.batch_number = b2.batch_no
            JOIN apps_kuaizhizao_finished_goods_receipts fgr
                ON fgr.id = fgi.receipt_id AND fgr.tenant_id = fgi.tenant_id
            WHERE b2.deleted_at IS NULL
              AND COALESCE(fgi.receipt_time, fgr.receipt_time) IS NOT NULL
            ORDER BY b2.id, COALESCE(fgi.receipt_time, fgr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE b.id = src.batch_id
          AND b.production_date IS DISTINCT FROM src.inbound_date;

        UPDATE apps_master_data_material_batches AS b
        SET production_date = src.inbound_date
        FROM (
            SELECT DISTINCT ON (b2.id)
                b2.id AS batch_id,
                (timezone('{_SITE_TZ}', COALESCE(pri.receipt_time, pr.receipt_time)))::date AS inbound_date
            FROM apps_master_data_material_batches b2
            JOIN apps_kuaizhizao_purchase_receipt_items pri
                ON pri.tenant_id = b2.tenant_id
                AND pri.material_id = b2.material_id
                AND pri.status = '已入库'
                AND pri.batch_number = b2.batch_no
            JOIN apps_kuaizhizao_purchase_receipts pr
                ON pr.id = pri.receipt_id AND pr.tenant_id = pri.tenant_id
            WHERE b2.deleted_at IS NULL
              AND COALESCE(pri.receipt_time, pr.receipt_time) IS NOT NULL
            ORDER BY b2.id, COALESCE(pri.receipt_time, pr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE b.id = src.batch_id
          AND b.production_date IS DISTINCT FROM src.inbound_date;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
