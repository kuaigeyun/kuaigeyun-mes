#!/usr/bin/env python3
"""
检查孤立菜单

查找没有关联应用或关联已删除应用的菜单记录。
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from infra.infrastructure.database.database import get_db_connection


async def check_orphaned_menus():
    """检查孤立菜单"""

    print("🔍 检查孤立菜单记录...")

    try:
        conn = await get_db_connection()

        # 查询所有菜单，包括关联的应用信息
        menus = await conn.fetch("""
            SELECT
                m.uuid,
                m.name,
                m.application_uuid,
                m.is_active,
                m.created_at,
                a.code as app_code,
                a.name as app_name,
                a.is_active as app_is_active,
                a.is_installed as app_is_installed
            FROM core_menus m
            LEFT JOIN core_applications a ON m.application_uuid = a.uuid AND a.deleted_at IS NULL
            WHERE m.deleted_at IS NULL
            ORDER BY m.application_uuid, m.name
        """)

        print(f"📋 菜单记录总计: {len(menus)}")

        # 分类统计
        app_menus = []  # 有应用关联的菜单
        orphaned_menus = []  # 无应用关联的菜单
        disabled_app_menus = []  # 关联禁用应用的菜单

        for menu in menus:
            if menu['application_uuid'] is None:
                orphaned_menus.append(menu)
            elif menu['app_code'] is None:
                # application_uuid存在但应用已被删除
                orphaned_menus.append(menu)
            elif not menu['app_is_active']:
                # 应用被禁用
                disabled_app_menus.append(menu)
            else:
                app_menus.append(menu)

        print(f"📊 菜单分类:")
        print(f"  ✅ 正常菜单: {len(app_menus)} 个")
        print(f"  ⚠️ 孤立菜单: {len(orphaned_menus)} 个")
        print(f"  ❌ 禁用应用菜单: {len(disabled_app_menus)} 个")

        # 显示可疑的菜单
        if orphaned_menus:
            print("\n🔍 孤立菜单详情:")
            for menu in orphaned_menus[:10]:  # 只显示前10个
                print(f"  - {menu['name']} (uuid: {menu['uuid'][:8]}...)")

        if disabled_app_menus:
            print("\n🚫 禁用应用菜单详情:")
            for menu in disabled_app_menus[:10]:  # 只显示前10个
                print(f"  - {menu['name']} -> {menu['app_name']} ({menu['app_code']})")

        # 特别查找包含kuaiwms关键词的菜单
        kuaiwms_menus = [m for m in menus if 'kuaiwms' in m['name'].lower() or (m['app_code'] and 'kuaiwms' in m['app_code'])]
        if kuaiwms_menus:
            print(f"\n🎯 发现 {len(kuaiwms_menus)} 个与kuaiwms相关的菜单:")
            for menu in kuaiwms_menus:
                status = "启用" if menu['is_active'] else "禁用"
                app_info = f" -> {menu['app_name']} ({menu['app_code']})" if menu['app_code'] else " (无应用关联)"
                print(f"  - {menu['name']} [{status}]{app_info}")

        await conn.close()

    except Exception as e:
        print(f"❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(check_orphaned_menus())
