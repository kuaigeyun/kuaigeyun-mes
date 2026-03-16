#!/usr/bin/env python
"""
手动执行迁移 153、154：BOM 配置位 + 订单 configurable_selections

用法：cd riveredge-backend && PYTHONPATH=src python run_migration_153_154.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def main():
    import psycopg2
    from infra.config.infra_config import infra_settings as settings

    db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST
    conn = psycopg2.connect(
        host=db_host,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        dbname=settings.DB_NAME,
    )
    conn.autocommit = True
    cur = conn.cursor()

    statements_153 = [
        'ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "is_configurable" BOOLEAN NOT NULL DEFAULT FALSE',
        'ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "configurable_group_id" INT NULL',
        'ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "is_default_configurable" BOOLEAN NOT NULL DEFAULT FALSE',
        "COMMENT ON COLUMN \"apps_master_data_bom\".\"is_configurable\" IS '是否为配置位（用户在下单/开工单时选择）'",
        "COMMENT ON COLUMN \"apps_master_data_bom\".\"configurable_group_id\" IS '配置位组ID（同组多行=该位置的可选物料）'",
        "COMMENT ON COLUMN \"apps_master_data_bom\".\"is_default_configurable\" IS '配置位组内是否为默认选项'",
    ]

    statements_154 = [
        'ALTER TABLE "apps_kuaizhizao_sales_order_items" ADD COLUMN IF NOT EXISTS "configurable_selections" JSONB NULL',
        'ALTER TABLE "apps_kuaizhizao_work_orders" ADD COLUMN IF NOT EXISTS "configurable_selections" JSONB NULL',
        'ALTER TABLE "apps_kuaizhizao_demand_items" ADD COLUMN IF NOT EXISTS "configurable_selections" JSONB NULL',
        "COMMENT ON COLUMN \"apps_kuaizhizao_sales_order_items\".\"configurable_selections\" IS '配置位选择（用户在下单时选择的配置位物料）'",
        "COMMENT ON COLUMN \"apps_kuaizhizao_work_orders\".\"configurable_selections\" IS '配置位选择（用户在开工单时选择的配置位物料）'",
        "COMMENT ON COLUMN \"apps_kuaizhizao_demand_items\".\"configurable_selections\" IS '配置位选择（用户选择的配置位物料）'",
    ]

    try:
        for i, sql in enumerate(statements_153):
            cur.execute(sql)
            print(f"  153-{i+1}: OK")
        print("✅ 迁移 153 执行成功：BOM 配置位字段已添加")

        for i, sql in enumerate(statements_154):
            cur.execute(sql)
            print(f"  154-{i+1}: OK")
        print("✅ 迁移 154 执行成功：订单 configurable_selections 字段已添加")
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
