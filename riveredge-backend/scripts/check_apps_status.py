#!/usr/bin/env python3
"""
检查应用状态

查看数据库中所有应用的状态信息。
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from infra.infrastructure.database.database import get_db_connection


async def check_apps_status():
    """检查应用状态"""

    print("🔍 检查数据库中的应用状态...")

    try:
        conn = await get_db_connection()

        # 查询所有应用
        apps = await conn.fetch("""
            SELECT code, name, is_active, is_installed, created_at
            FROM core_applications
            WHERE deleted_at IS NULL
            ORDER BY code
        """)

        print(f"📋 数据库中的应用列表 ({len(apps)} 个):")
        print("-" * 80)

        for app in apps:
            status = "✅ 启用" if app['is_active'] else "❌ 禁用"
            installed = "✅ 已安装" if app['is_installed'] else "❌ 未安装"
            print(f"  {app['code']:15} | {app['name']:20} | {status:6} | {installed}")

            # 如果是已安装的应用，检查菜单状态
            if app['is_installed']:
                menu_stats = await conn.fetchrow("""
                    SELECT
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_active = TRUE) as active_menus,
                        COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_menus
                    FROM core_menus
                    WHERE application_uuid = (
                        SELECT uuid FROM core_applications WHERE code = $1
                    ) AND deleted_at IS NULL
                """, app['code'])

                if menu_stats and menu_stats['total'] > 0:
                    print(f"                     📊 菜单: 总计{menu_stats['total']}, 启用{menu_stats['active_menus']}, 禁用{menu_stats['inactive_menus']}")
                elif menu_stats:
                    print("                     📊 菜单: 无关联菜单")
        print("-" * 80)

        await conn.close()

    except Exception as e:
        print(f"❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(check_apps_status())
