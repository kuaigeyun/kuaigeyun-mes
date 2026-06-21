"""
补充回填 production_date：
1. 入库明细 serial_numbers 为 JSON 字符串（历史 json.dumps 写入）
2. 序列号创建日与入库确认日为同一天且仅有一条候选入库单时，取该入库单 receipt_time
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 序列号：成品入库（serial_numbers 存为 JSON 字符串）
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
                AND jsonb_typeof(fgi.serial_numbers) = 'string'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text((fgi.serial_numbers #>> '{}')::jsonb) AS sn(elem)
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

        -- 序列号：唯一候选入库日（同物料、创建日与入库确认日相同且仅一条）
        UPDATE apps_master_data_material_serials AS s
        SET production_date = c.inbound_date
        FROM (
            SELECT serial_id, inbound_date
            FROM (
                SELECT
                    s2.id AS serial_id,
                    COALESCE(fgi.receipt_time, fgr.receipt_time)::date AS inbound_date,
                    COUNT(*) OVER (PARTITION BY s2.id) AS candidate_cnt
                FROM apps_master_data_material_serials s2
                JOIN apps_kuaizhizao_finished_goods_receipt_items fgi
                    ON fgi.tenant_id = s2.tenant_id
                    AND fgi.material_id = s2.material_id
                    AND fgi.status = '已入库'
                JOIN apps_kuaizhizao_finished_goods_receipts fgr
                    ON fgr.id = fgi.receipt_id
                    AND fgr.tenant_id = fgi.tenant_id
                    AND fgr.status = '已入库'
                WHERE s2.production_date IS NULL
                  AND s2.deleted_at IS NULL
                  AND COALESCE(fgi.receipt_time, fgr.receipt_time) IS NOT NULL
                  AND s2.created_at::date = COALESCE(fgi.receipt_time, fgr.receipt_time)::date
            ) x
            WHERE candidate_cnt = 1
        ) AS c
        WHERE s.id = c.serial_id;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
