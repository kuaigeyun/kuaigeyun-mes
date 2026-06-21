"""
修正入库 receipt_time：QuerySet.update(datetime.now()) 将站点墙钟误存为 UTC（+8h）。
仅修正与关联序列号 created_at 相差约 8 小时的记录；随后按站点时区重算 production_date。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_SITE_TZ = "Asia/Shanghai"
_EIGHT_HOURS_SEC = 28800
_TOLERANCE_SEC = 600


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        -- 成品入库明细 receipt_time
        UPDATE apps_kuaizhizao_finished_goods_receipt_items fgi
        SET receipt_time = ((fgi.receipt_time AT TIME ZONE 'UTC') AT TIME ZONE '{_SITE_TZ}')
        WHERE fgi.status = '已入库'
          AND fgi.receipt_time IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM apps_master_data_material_serials s
            WHERE s.tenant_id = fgi.tenant_id
              AND s.material_id = fgi.material_id
              AND s.deleted_at IS NULL
              AND s.created_at IS NOT NULL
              AND fgi.serial_numbers IS NOT NULL
              AND jsonb_typeof(fgi.serial_numbers) = 'array'
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(fgi.serial_numbers) sn(elem)
                WHERE sn.elem = s.serial_no
              )
              AND ABS(EXTRACT(EPOCH FROM (fgi.receipt_time - s.created_at)) - {_EIGHT_HOURS_SEC}) <= {_TOLERANCE_SEC}
          );

        -- 成品入库表头 receipt_time（与明细同步修正）
        UPDATE apps_kuaizhizao_finished_goods_receipts fgr
        SET receipt_time = ((fgr.receipt_time AT TIME ZONE 'UTC') AT TIME ZONE '{_SITE_TZ}')
        WHERE fgr.status = '已入库'
          AND fgr.receipt_time IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM apps_kuaizhizao_finished_goods_receipt_items fgi
            WHERE fgi.receipt_id = fgr.id
              AND fgi.tenant_id = fgr.tenant_id
              AND fgi.status = '已入库'
              AND fgi.receipt_time IS NOT NULL
              AND ABS(EXTRACT(EPOCH FROM (fgr.receipt_time - fgi.receipt_time))) <= 5
              AND EXISTS (
                SELECT 1
                FROM apps_master_data_material_serials s
                WHERE s.tenant_id = fgi.tenant_id
                  AND s.material_id = fgi.material_id
                  AND s.deleted_at IS NULL
                  AND s.created_at IS NOT NULL
                  AND ABS(EXTRACT(EPOCH FROM (fgi.receipt_time - s.created_at)) - {_EIGHT_HOURS_SEC}) <= {_TOLERANCE_SEC}
              )
          );

        -- 序列号 production_date（修正后的 receipt_time → 站点日历日）
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
                AND jsonb_typeof(fgi.serial_numbers) = 'array'
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(fgi.serial_numbers) AS sn(elem)
                    WHERE sn.elem = s2.serial_no
                )
            JOIN apps_kuaizhizao_finished_goods_receipts fgr
                ON fgr.id = fgi.receipt_id AND fgr.tenant_id = fgi.tenant_id
            WHERE s2.deleted_at IS NULL
              AND COALESCE(fgi.receipt_time, fgr.receipt_time) IS NOT NULL
            ORDER BY s2.id, COALESCE(fgi.receipt_time, fgr.receipt_time) ASC NULLS LAST
        ) AS src
        WHERE s.id = src.serial_id
          AND s.production_date IS DISTINCT FROM src.inbound_date;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
