#!/usr/bin/env python3
"""
插件管理器菜单初始化脚本

为插件管理器创建菜单项，确保在系统管理 > 应用中心下显示插件管理菜单。
"""

import asyncio
import uuid
from datetime import datetime
import asyncpg
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
import sys
sys.path.insert(0, str(project_root))

from src.infra.infrastructure.database.database import get_db_connection


async def init_plugin_manager_menu():
    """
    初始化插件管理器菜单

    为插件管理器创建菜单项：
    - 在"应用中心"菜单下添加"插件管理"子菜单
    """
    conn = await get_db_connection()

    try:
        # 获取默认租户ID（通常是1）
        tenant_id = 1

        # 查找"应用中心"菜单
        application_menu = await conn.fetchrow(
            """
            SELECT id, uuid FROM core_menus
            WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL
            """,
            tenant_id, "应用中心"
        )

        if not application_menu:
            print("❌ 未找到'应用中心'菜单，无法添加插件管理菜单")
            return

        parent_menu_id = application_menu['id']

        # 检查插件管理菜单是否已存在
        existing_menu = await conn.fetchval(
            """
            SELECT id FROM core_menus
            WHERE tenant_id = $1 AND name = $2 AND parent_id = $3 AND deleted_at IS NULL
            """,
            tenant_id, "插件管理", parent_menu_id
        )

        if existing_menu:
            print("✅ 插件管理菜单已存在，跳过创建")
            return

        # 创建插件管理菜单
        menu_uuid = str(uuid.uuid4())

        await conn.execute(
            """
            INSERT INTO core_menus (
                uuid, tenant_id, name, path, icon, component, permission_code,
                parent_id, sort_order, is_active, is_external, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            """,
            menu_uuid,
            tenant_id,
            "插件管理",
            "/system/plugin-manager",
            "api",
            None,  # component
            "core:plugin-manager:view",  # 权限代码
            parent_menu_id,
            100,  # 排序在应用中心后面
            True,  # 启用
            False,  # 不是外部链接
            datetime.utcnow(),
            datetime.utcnow()
        )

        print("✅ 插件管理菜单创建成功")
        print(f"   菜单UUID: {menu_uuid}")
        print(f"   路径: /system/plugin-manager")
        print(f"   权限: core:plugin-manager:view")

    except Exception as e:
        print(f"❌ 创建插件管理菜单失败: {str(e)}")
        import traceback
        traceback.print_exc()

    finally:
        await conn.close()


async def main():
    """主函数"""
    print("🚀 开始初始化插件管理器菜单...")
    await init_plugin_manager_menu()
    print("✅ 插件管理器菜单初始化完成")


if __name__ == "__main__":
    asyncio.run(main())
