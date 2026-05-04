"""
物料单位 legacy 英文码迁移为中文取值（与标签一致），并同步业务表中的单位字段。

- 新租户由 SYSTEM_DICTIONARIES 的 MATERIAL_UNIT 直接生成中文项。
- 已存在库：将 EA/KG 等与单据、物料、字典项中的存量值映射为 个/千克 等，并软删除已废弃字典项。

不可逆：downgrade 返回空（无法可靠恢复英文码）。

Author: Auto
Date: 2026-05-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return r"""
        CREATE OR REPLACE FUNCTION riveredge_200_map_legacy_material_unit(p TEXT)
        RETURNS TEXT AS $f$
        BEGIN
            IF p IS NULL THEN
                RETURN NULL;
            END IF;
            RETURN CASE trim(both FROM p)
                WHEN 'EA' THEN '个'
                WHEN 'PC' THEN '件'
                WHEN 'UNIT' THEN '台'
                WHEN 'SET' THEN '套'
                WHEN 'BOX' THEN '箱'
                WHEN 'CASE' THEN '盒'
                WHEN 'BAG' THEN '包'
                WHEN 'PK' THEN '袋'
                WHEN 'BTL' THEN '瓶'
                WHEN 'DRM' THEN '桶'
                WHEN 'SHEET' THEN '片'
                WHEN 'PCS' THEN '片'
                WHEN 'STRIP' THEN '件'
                WHEN 'BLOCK' THEN '件'
                WHEN 'ONLY' THEN '个'
                WHEN 'HEAD' THEN '个'
                WHEN 'ROLL' THEN '卷'
                WHEN 'KG' THEN '千克'
                WHEN 'G' THEN '克'
                WHEN 'TON' THEN '吨'
                WHEN 'MG' THEN '克'
                WHEN 'ML' THEN '毫升'
                WHEN 'M' THEN '米'
                WHEN 'CM' THEN '厘米'
                WHEN 'MM' THEN '毫米'
                WHEN 'KM' THEN '千米'
                WHEN 'SQM' THEN '平方米'
                WHEN 'SQCM' THEN '平方厘米'
                WHEN 'L' THEN '升'
                WHEN 'CBM' THEN '立方米'
                ELSE trim(both FROM p)
            END;
        END;
        $f$ LANGUAGE plpgsql IMMUTABLE;

        UPDATE apps_master_data_materials
        SET base_unit = riveredge_200_map_legacy_material_unit(base_unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND base_unit IS NOT NULL;

        UPDATE apps_master_data_bom
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_master_data_products
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_kuaizhizao_purchase_order_items
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE unit IS NOT NULL;

        UPDATE apps_kuaizhizao_purchase_requisition_items
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE unit IS NOT NULL;

        UPDATE apps_kuaizhizao_batching_order_items
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_kuaizhizao_spare_parts
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_kuaicaiwu_invoice_items
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE unit IS NOT NULL;

        UPDATE apps_kuaizhizao_outsource_material_issues
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_kuaizhizao_outsource_material_receipts
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_kuaizhizao_outsource_material_returns
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_kuaizhizao_outsource_product_returns
        SET unit = riveredge_200_map_legacy_material_unit(unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND unit IS NOT NULL;

        UPDATE apps_kuaizhizao_semi_finished_goods_receipt_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_purchase_receipt_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_material_call_requests
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_material_call_request_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_sales_order_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_demand_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_sales_forecast_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_shipment_notice_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_sales_return_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_sales_delivery_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_quotation_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_receipt_notice_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_purchase_return_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_production_return_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_production_picking_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_other_outbound_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_other_inbound_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_material_borrow_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_material_return_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_line_side_inventory
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_incoming_inspections
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_finished_goods_receipt_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_demand_computation_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_delivery_notice_items
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE material_unit IS NOT NULL;

        UPDATE apps_kuaizhizao_backflush_records
        SET material_unit = riveredge_200_map_legacy_material_unit(material_unit), updated_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL AND material_unit IS NOT NULL;

        DO $BODY$
        DECLARE
            r RECORD;
            j jsonb;
            arr jsonb;
            nu jsonb;
            rec_elem RECORD;
            new_scen jsonb;
            k text;
            v text;
        BEGIN
            FOR r IN
                SELECT id, units
                FROM apps_master_data_materials
                WHERE deleted_at IS NULL
                  AND units IS NOT NULL
                  AND units::text <> 'null'
            LOOP
                j := r.units::jsonb;
                nu := j;
                IF j ? 'units' AND jsonb_typeof(j->'units') = 'array' THEN
                    arr := '[]'::jsonb;
                    FOR rec_elem IN
                        SELECT elem AS el FROM jsonb_array_elements(COALESCE(j->'units', '[]'::jsonb)) AS t(elem)
                    LOOP
                        arr := arr || jsonb_build_array(
                            (rec_elem.el - 'unit')
                            || jsonb_build_object(
                                'unit',
                                riveredge_200_map_legacy_material_unit(rec_elem.el->>'unit')
                            )
                        );
                    END LOOP;
                    nu := jsonb_set(nu, '{units}', arr, true);
                END IF;
                IF j ? 'scenarios' AND jsonb_typeof(j->'scenarios') = 'object' THEN
                    new_scen := '{}'::jsonb;
                    FOR k, v IN SELECT * FROM jsonb_each_text(j->'scenarios')
                    LOOP
                        new_scen := new_scen || jsonb_build_object(
                            k,
                            riveredge_200_map_legacy_material_unit(v)
                        );
                    END LOOP;
                    nu := jsonb_set(nu, '{scenarios}', new_scen, true);
                END IF;
                UPDATE apps_master_data_materials
                SET units = nu, updated_at = CURRENT_TIMESTAMP
                WHERE id = r.id;
            END LOOP;
        END;
        $BODY$;

        UPDATE core_dictionary_items di
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE di.deleted_at IS NULL
          AND di.dictionary_id IN (
              SELECT id FROM core_data_dictionaries
              WHERE code = 'MATERIAL_UNIT' AND deleted_at IS NULL
          )
          AND di.value IN (
              'ONLY', 'HEAD', 'PCS', 'STRIP', 'BLOCK', 'MG', 'KM', 'SQCM'
          );

        UPDATE core_dictionary_items di
        SET
            label = riveredge_200_map_legacy_material_unit(di.value),
            value = riveredge_200_map_legacy_material_unit(di.value),
            updated_at = CURRENT_TIMESTAMP
        WHERE di.deleted_at IS NULL
          AND di.dictionary_id IN (
              SELECT id FROM core_data_dictionaries
              WHERE code = 'MATERIAL_UNIT' AND deleted_at IS NULL
          )
          AND di.value IN (
              'EA', 'PC', 'UNIT', 'SET', 'BOX', 'CASE', 'BAG', 'PK', 'BTL', 'DRM',
              'SHEET', 'ROLL', 'KG', 'G', 'TON', 'M', 'CM', 'MM', 'SQM', 'L', 'ML', 'CBM'
          );

        INSERT INTO core_dictionary_items (
            uuid, tenant_id, dictionary_id, label, value, description,
            color, icon, sort_order, is_active, created_at, updated_at
        )
        SELECT
            gen_random_uuid()::text,
            d.tenant_id,
            d.id,
            x.label,
            x.value,
            x.description,
            NULL,
            NULL,
            x.sort_order,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM core_data_dictionaries d
        CROSS JOIN (
            VALUES
                ('卷', '卷', '计数：卷（卷材等）', 12),
                ('千米', '千米', '长度：千米', 19),
                ('平方厘米', '平方厘米', '面积：平方厘米', 21)
        ) AS x(label, value, description, sort_order)
        WHERE d.code = 'MATERIAL_UNIT'
          AND d.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM core_dictionary_items i
              WHERE i.dictionary_id = d.id
                AND i.value = x.value
                AND i.deleted_at IS NULL
          );

        DROP FUNCTION IF EXISTS riveredge_200_map_legacy_material_unit(TEXT);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
