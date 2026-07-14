"""从 core_operation_logs 回填仍为空的 created_by / updated_by 及姓名。

匹配规则：operation_object_uuid 或 operation_object_id + tenant_id；
created_* 取最早 create 日志；updated_* 取最晚 create/update 日志。
无匹配日志则跳过；不写入假管理员。
"""

from tortoise import BaseDBAsyncClient


_TARGET_TABLES = (
    # master_data
    "apps_master_data_materials",
    "apps_master_data_material_groups",
    "apps_master_data_warehouses",
    "apps_master_data_storage_areas",
    "apps_master_data_storage_locations",
    "apps_master_data_bom",
    "apps_master_data_engineering_drawings",
    "apps_master_data_material_batches",
    "apps_master_data_material_serials",
    "apps_master_data_operations",
    "apps_master_data_process_routes",
    "apps_master_data_defect_types",
    "apps_master_data_sop",
    # kuaizhizao documents commonly shown with audit columns
    "apps_kuaizhizao_work_order_groups",
    "apps_kuaizhizao_work_orders",
    "apps_kuaizhizao_purchase_receipts",
    "apps_kuaizhizao_production_pickings",
    "apps_kuaizhizao_finished_goods_receipts",
    "apps_kuaizhizao_sales_deliveries",
    "apps_kuaizhizao_sales_returns",
    "apps_kuaizhizao_purchase_returns",
    "apps_kuaizhizao_other_inbounds",
    "apps_kuaizhizao_other_outbounds",
    "apps_kuaizhizao_material_borrows",
    "apps_kuaizhizao_material_returns",
    "apps_kuaizhizao_stocktakings",
    "apps_kuaizhizao_inventory_transfers",
    "apps_kuaizhizao_sales_orders",
    "apps_kuaizhizao_quotations",
    "apps_kuaizhizao_sales_contracts",
    "apps_kuaiai_knowledge_documents",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    table_list_sql = ",\n        ".join(f"'{t}'" for t in _TARGET_TABLES)
    return f"""
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        {table_list_sql}
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = t
        ) THEN
            CONTINUE;
        END IF;

        -- created_*: earliest create log for matching uuid/id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=t AND column_name='created_by'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=t AND column_name='created_by_name'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=t AND column_name='uuid'
        ) THEN
            EXECUTE format($sql$
                UPDATE %I x
                   SET created_by = sub.user_id,
                       created_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
                  FROM (
                        SELECT DISTINCT ON (x2.id)
                               x2.id AS row_id,
                               l.user_id
                          FROM %I x2
                          JOIN core_operation_logs l
                            ON l.tenant_id = x2.tenant_id
                           AND l.operation_type = 'create'
                           AND l.user_id IS NOT NULL
                           AND (
                                (l.operation_object_uuid IS NOT NULL
                                 AND CAST(l.operation_object_uuid AS text) = CAST(x2.uuid AS text))
                                OR (l.operation_object_id IS NOT NULL
                                    AND l.operation_object_id = x2.id)
                           )
                         WHERE x2.created_by IS NULL
                         ORDER BY x2.id, l.created_at ASC, l.id ASC
                  ) sub
                  JOIN core_users u ON u.id = sub.user_id
                 WHERE x.id = sub.row_id
                   AND x.created_by IS NULL
            $sql$, t, t);
        END IF;

        -- updated_*: latest create/update log for matching uuid/id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=t AND column_name='updated_by'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=t AND column_name='updated_by_name'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=t AND column_name='uuid'
        ) THEN
            EXECUTE format($sql$
                UPDATE %I x
                   SET updated_by = sub.user_id,
                       updated_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
                  FROM (
                        SELECT DISTINCT ON (x2.id)
                               x2.id AS row_id,
                               l.user_id
                          FROM %I x2
                          JOIN core_operation_logs l
                            ON l.tenant_id = x2.tenant_id
                           AND l.operation_type IN ('create', 'update')
                           AND l.user_id IS NOT NULL
                           AND (
                                (l.operation_object_uuid IS NOT NULL
                                 AND CAST(l.operation_object_uuid AS text) = CAST(x2.uuid AS text))
                                OR (l.operation_object_id IS NOT NULL
                                    AND l.operation_object_id = x2.id)
                           )
                         WHERE x2.updated_by IS NULL
                         ORDER BY x2.id, l.created_at DESC, l.id DESC
                  ) sub
                  JOIN core_users u ON u.id = sub.user_id
                 WHERE x.id = sub.row_id
                   AND x.updated_by IS NULL
            $sql$, t, t);
        END IF;
    END LOOP;
END$$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 一次性回填不做回退（避免清空已有正确操作人）。
SELECT 1;
    """
