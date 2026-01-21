#!/usr/bin/env python3
"""
快速修复菜单状态同步问题

直接调用应用服务修复菜单状态同步。
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.services.application.application_service import ApplicationService
from infra.infrastructure.database.database import get_db_connection


async def quick_fix_menu_sync():
    """快速修复菜单状态同步"""

    print("🔧 开始快速修复应用菜单状态同步...")

    try:
        # 获取数据库连接
        conn = await get_db_connection()

        # 1. 查找所有禁用的应用
        disabled_apps = await conn.fetch("""
            SELECT uuid, code, name
            FROM core_applications
            WHERE is_active = FALSE AND is_installed = TRUE AND deleted_at IS NULL
        """)

        print(f"📋 发现 {len(disabled_apps)} 个禁用的应用")

        # 2. 为每个禁用的应用修复菜单状态
        for app in disabled_apps:
            app_uuid = app['uuid']
            app_code = app['code']
            app_name = app['name']

            print(f"\n🔧 修复应用: {app_name} ({app_code})")

            # 检查菜单状态
            menu_stats = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_active = TRUE) as active_count,
                    COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_count
                FROM core_menus
                WHERE application_uuid = $1 AND deleted_at IS NULL
            """, app_uuid)

            if menu_stats:
                total = menu_stats['total']
                active_count = menu_stats['active_count']
                inactive_count = menu_stats['inactive_count']

                print(f"  📊 菜单统计: 总计{total}, 启用{active_count}, 禁用{inactive_count}")

                # 如果有启用的菜单，禁用它们
                if active_count > 0:
                    updated = await conn.execute("""
                        UPDATE core_menus
                        SET is_active = FALSE, updated_at = NOW()
                        WHERE application_uuid = $1 AND is_active = TRUE AND deleted_at IS NULL
                    """, app_uuid)

                    print(f"  ✅ 已禁用 {active_count} 个菜单")
                else:
                    print("  ℹ️ 所有菜单已正确禁用")

        await conn.close()

        print("\n✅ 菜单状态同步修复完成！")
        print("💡 请刷新前端页面或清除缓存以查看最新菜单状态")

    except Exception as e:
        print(f"❌ 修复失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(quick_fix_menu_sync())
