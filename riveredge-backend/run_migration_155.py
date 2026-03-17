#!/usr/bin/env python
"""
手动执行迁移 155：BOM 表增加失效相关字段（is_obsolete, obsoleted_at, obsolete_reason）

用法：cd riveredge-backend && PYTHONPATH=src python run_migration_155.py
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

    statements = [
        'ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "is_obsolete" BOOLEAN NOT NULL DEFAULT FALSE',
        'ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "obsoleted_at" TIMESTAMPTZ NULL',
        'ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "obsolete_reason" VARCHAR(500) NULL',
        "COMMENT ON COLUMN \"apps_master_data_bom\".\"is_obsolete\" IS '是否已失效（人为设置）'",
        "COMMENT ON COLUMN \"apps_master_data_bom\".\"obsoleted_at\" IS '失效时间'",
        "COMMENT ON COLUMN \"apps_master_data_bom\".\"obsolete_reason\" IS '失效原因'",
    ]

    try:
        for i, sql in enumerate(statements):
            cur.execute(sql)
            print(f"  155-{i + 1}: OK")
        print("✅ 迁移 155 执行成功：BOM 失效字段已添加")
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
