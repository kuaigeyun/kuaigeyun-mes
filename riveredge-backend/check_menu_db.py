#!/usr/bin/env python3
"""
临时脚本：查询 core_menus 表中 engineering-bom 相关菜单的 name 字段
用法：在 riveredge-backend 目录下运行 uv run python check_menu_db.py
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()


async def main():
    import asyncpg

    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "riveredge"),
    )

    try:
        # 查询 path 包含 engineering-bom 的菜单
        rows = await conn.fetch("""
            SELECT id, name, path, tenant_id
            FROM core_menus
            WHERE path ILIKE '%engineering-bom%'
            AND deleted_at IS NULL
            ORDER BY tenant_id, id
        """)
        print("=" * 60)
        print("core_menus 表中 path 包含 'engineering-bom' 的记录：")
        print("=" * 60)
        if not rows:
            print("(无记录)")
        else:
            for r in rows:
                print(f"  id: {r['id']}, name: {r['name']!r}, path: {r['path']}, tenant_id: {r['tenant_id']}")
        print("=" * 60)

        # 也查一下 name 为 工程BOM 或 物料清单BOM 的
        for name in ["工程BOM", "物料清单BOM"]:
            by_name = await conn.fetch(
                "SELECT id, name, path, tenant_id FROM core_menus WHERE name = $1 AND deleted_at IS NULL",
                name,
            )
            if by_name:
                print(f"\nname = {name!r} 的记录：")
                for r in by_name:
                    print(f"  id: {r['id']}, path: {r['path']}, tenant_id: {r['tenant_id']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
