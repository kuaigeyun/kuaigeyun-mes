#!/usr/bin/env python3
"""
修复应用菜单状态同步问题

检查并修复应用禁用状态与菜单状态不一致的问题。
"""

import asyncio
import asyncpg
import os
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


async def fix_menu_sync():
    """修复应用菜单状态同步"""

    # 数据库连接参数
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_port = int(os.getenv("DB_PORT", "5432"))
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_name = os.getenv("DB_NAME", "riveredge")

    print("🔧 开始修复应用菜单状态同步...")

    try:
        # 连接数据库
        conn = await asyncpg.connect(
            host=db_host, port=db_port, user=db_user,
            password=db_password, database=db_name
        )

        # 1. 检查所有禁用的应用
        disabled_apps = await conn.fetch("""
            SELECT uuid, code, name, is_active, is_installed
            FROM core_applications
            WHERE is_active = FALSE AND is_installed = TRUE AND deleted_at IS NULL
        """)

        print(f"📋 发现 {len(disabled_apps)} 个禁用的应用:")
        for app in disabled_apps:
            print(f"  - {app['name']} ({app['code']}): active={app['is_active']}")

        # 2. 检查这些应用的菜单状态
        for app in disabled_apps:
            app_uuid = app['uuid']
            app_code = app['code']
            app_name = app['name']

            # 查询关联菜单
            menus = await conn.fetch("""
                SELECT uuid, name, is_active
                FROM core_menus
                WHERE application_uuid = $1 AND deleted_at IS NULL
            """, app_uuid)

            print(f"\n🔍 检查应用 {app_name} ({app_code}) 的菜单:")

            if not menus:
                print("  ℹ️ 无关联菜单")
                continue

            # 检查菜单状态
            active_menus = [m for m in menus if m['is_active']]
            inactive_menus = [m for m in menus if not m['is_active']]

            print(f"  📊 总菜单数: {len(menus)}")
            print(f"  ✅ 启用菜单: {len(active_menus)}")
            print(f"  ❌ 禁用菜单: {len(inactive_menus)}")

            # 如果有启用的菜单，修复它们
            if active_menus:
                print("  🔧 发现不一致的菜单状态，开始修复...")

                # 禁用这些菜单
                menu_uuids = [m['uuid'] for m in active_menus]
                await conn.execute("""
                    UPDATE core_menus
                    SET is_active = FALSE, updated_at = NOW()
                    WHERE uuid = ANY($1)
                """, menu_uuids)

                print(f"  ✅ 已禁用 {len(active_menus)} 个菜单")

                # 显示修复的菜单
                for menu in active_menus:
                    print(f"    - {menu['name']}")

        # 3. 验证修复结果
        print("\n🔍 验证修复结果...")

        for app in disabled_apps:
            app_uuid = app['uuid']
            app_code = app['code']

            # 重新检查菜单状态
            menus = await conn.fetch("""
                SELECT COUNT(*) as total,
                       COUNT(*) FILTER (WHERE is_active = TRUE) as active_count,
                       COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_count
                FROM core_menus
                WHERE application_uuid = $1 AND deleted_at IS NULL
            """, app_uuid)

            if menus:
                stat = menus[0]
                print(f"  {app_code}: 总计{stat['total']}, 启用{stat['active_count']}, 禁用{stat['inactive_count']}")

        print("\n✅ 应用菜单状态同步修复完成！")
        print("💡 建议: 清除前端缓存或重新登录以查看最新菜单状态")

        await conn.close()

    except Exception as e:
        print(f"❌ 修复过程中出现错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(fix_menu_sync())
