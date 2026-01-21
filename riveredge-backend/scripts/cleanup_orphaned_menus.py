#!/usr/bin/env python3
"""
清理孤立菜单

删除没有关联应用或关联已删除应用的菜单记录。
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from infra.infrastructure.database.database import get_db_connection


async def cleanup_orphaned_menus():
    """清理孤立菜单"""

    print("🧹 开始清理孤立菜单记录...")

    try:
        conn = await get_db_connection()

        # 1. 查找所有孤立菜单（无应用关联或关联已删除的应用）
        orphaned_menus = await conn.fetch("""
            SELECT m.uuid, m.name, m.application_uuid
            FROM core_menus m
            LEFT JOIN core_applications a ON m.application_uuid = a.uuid AND a.deleted_at IS NULL
            WHERE m.deleted_at IS NULL
            AND (m.application_uuid IS NULL OR a.uuid IS NULL)
        """)

        print(f"📋 发现 {len(orphaned_menus)} 个孤立菜单记录")

        if not orphaned_menus:
            print("✅ 没有发现孤立菜单，无需清理")
            return

        # 显示前10个孤立菜单作为示例
        print("\n🔍 孤立菜单示例:")
        for menu in orphaned_menus[:10]:
            app_uuid = menu['application_uuid'][:8] + "..." if menu['application_uuid'] else "NULL"
            print(f"  - {menu['name']} (应用UUID: {app_uuid})")

        # 自动确认清理（生产环境建议保留确认）
        print(f"\n⚠️ 将删除 {len(orphaned_menus)} 个孤立菜单记录...")

        # 2. 软删除孤立菜单
        orphaned_uuids = [menu['uuid'] for menu in orphaned_menus]

        from datetime import datetime
        deleted_count = await conn.execute("""
            UPDATE core_menus
            SET deleted_at = $1, updated_at = $1
            WHERE uuid = ANY($2) AND deleted_at IS NULL
        """, datetime.now(), orphaned_uuids)

        print(f"✅ 已软删除 {deleted_count} 个孤立菜单记录")

        # 3. 验证清理结果
        remaining_orphaned = await conn.fetchval("""
            SELECT COUNT(*)
            FROM core_menus m
            LEFT JOIN core_applications a ON m.application_uuid = a.uuid AND a.deleted_at IS NULL
            WHERE m.deleted_at IS NULL
            AND (m.application_uuid IS NULL OR a.uuid IS NULL)
        """)

        print(f"🔍 清理后剩余孤立菜单: {remaining_orphaned}")

        await conn.close()

        print("\n✅ 孤立菜单清理完成！")
        print("💡 请刷新前端页面以查看清理后的菜单状态")

    except Exception as e:
        print(f"❌ 清理失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(cleanup_orphaned_menus())
