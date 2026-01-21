"""
清理孤立的应用菜单脚本

清理没有正确关联应用的菜单，只保留由应用配置自动生成的菜单。

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
from pathlib import Path

from fastapi import FastAPI
from loguru import logger
from tortoise import Tortoise

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 配置日志
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)


async def setup_database():
    """初始化数据库连接"""
    from infra.infrastructure.database.database import register_db

    # 创建临时FastAPI应用用于注册数据库
    temp_app = FastAPI()
    await register_db(temp_app)
    logger.info("✅ 数据库连接已建立")


async def cleanup_orphaned_menus(tenant_id: int = 1):
    """清理孤立的菜单"""
    from core.models.menu import Menu
    from core.models.application import Application
    from infra.infrastructure.database.database import get_db_connection

    logger.info(f"\n{'='*60}")
    logger.info("🧹 开始清理孤立的菜单")
    logger.info(f"{'='*60}")

    conn = await get_db_connection()
    try:
        # 获取所有已安装且启用的应用
        apps = await conn.fetch("""
            SELECT uuid, code, name
            FROM core_applications
            WHERE tenant_id = $1
              AND is_installed = TRUE
              AND is_active = TRUE
              AND deleted_at IS NULL
        """, tenant_id)

        app_uuids = {app['uuid'] for app in apps}
        logger.info(f"📋 找到 {len(app_uuids)} 个已安装且启用的应用")

        # 获取所有有关联应用的菜单
        menus_with_app = await conn.fetch("""
            SELECT uuid, name, path, application_uuid
            FROM core_menus
            WHERE tenant_id = $1
              AND application_uuid IS NOT NULL
              AND deleted_at IS NULL
        """, tenant_id)

        logger.info(f"📋 找到 {len(menus_with_app)} 个有关联应用的菜单")

        # 找出孤立的菜单（关联的应用不存在或未启用）
        orphaned_menus = []
        valid_menus = []

        for menu in menus_with_app:
            app_uuid = menu['application_uuid']
            if app_uuid not in app_uuids:
                orphaned_menus.append(menu)
            else:
                valid_menus.append(menu)

        logger.info(f"✅ 有效菜单: {len(valid_menus)} 个")
        logger.info(f"❌ 孤立菜单: {len(orphaned_menus)} 个")

        if orphaned_menus:
            logger.info(f"\n孤立菜单列表:")
            for menu in orphaned_menus:
                logger.info(f"  - {menu['name']} ({menu['path']}) - 关联应用: {menu['application_uuid']}")

            # 软删除孤立的菜单
            orphaned_uuids = [menu['uuid'] for menu in orphaned_menus]
            
            deleted_count = await conn.execute("""
                UPDATE core_menus
                SET deleted_at = NOW()
                WHERE tenant_id = $1
                  AND uuid = ANY($2::varchar[])
                  AND deleted_at IS NULL
            """, tenant_id, orphaned_uuids)

            logger.info(f"\n✅ 已删除 {deleted_count} 个孤立菜单")
        else:
            logger.info("\n✅ 没有发现孤立菜单")

        # 检查是否有重复的根菜单（相同路径但没有关联应用）
        root_menus = await conn.fetch("""
            SELECT uuid, name, path, application_uuid
            FROM core_menus
            WHERE tenant_id = $1
              AND parent_id IS NULL
              AND deleted_at IS NULL
            ORDER BY path, name
        """, tenant_id)

        # 按路径分组
        menus_by_path = {}
        for menu in root_menus:
            path = menu['path'] or ''
            if path not in menus_by_path:
                menus_by_path[path] = []
            menus_by_path[path].append(menu)

        # 找出重复的菜单
        duplicate_menus = []
        for path, menus in menus_by_path.items():
            if len(menus) > 1:
                # 优先保留有正确关联应用的菜单
                menus_with_valid_app = [m for m in menus if m['application_uuid'] in app_uuids]
                menus_without_app = [m for m in menus if m['application_uuid'] not in app_uuids]
                
                if menus_with_valid_app and menus_without_app:
                    # 删除没有关联应用的重复菜单
                    duplicate_menus.extend(menus_without_app)
                elif len(menus_with_valid_app) > 1:
                    # 如果有多个有效应用菜单，保留第一个，删除其他的
                    duplicate_menus.extend(menus_with_valid_app[1:])

        if duplicate_menus:
            logger.info(f"\n发现 {len(duplicate_menus)} 个重复的根菜单:")
            for menu in duplicate_menus:
                logger.info(f"  - {menu['name']} ({menu['path']}) - 关联应用: {menu['application_uuid']}")

            duplicate_uuids = [menu['uuid'] for menu in duplicate_menus]
            deleted_count = await conn.execute("""
                UPDATE core_menus
                SET deleted_at = NOW()
                WHERE tenant_id = $1
                  AND uuid = ANY($2::varchar[])
                  AND deleted_at IS NULL
            """, tenant_id, duplicate_uuids)

            logger.info(f"\n✅ 已删除 {deleted_count} 个重复菜单")
        else:
            logger.info("\n✅ 没有发现重复菜单")

    finally:
        await conn.close()


async def main():
    """主函数"""
    logger.info("\n" + "="*60)
    logger.info("🚀 开始清理孤立的应用菜单")
    logger.info("="*60)

    # 初始化数据库
    await setup_database()

    # 清理孤立菜单（使用默认租户ID 1）
    await cleanup_orphaned_menus(tenant_id=1)

    # 关闭数据库连接
    await Tortoise.close_connections()
    logger.info("\n✅ 清理完成，数据库连接已关闭")


if __name__ == "__main__":
    try:
        asyncio.run(main())
        sys.exit(0)
    except KeyboardInterrupt:
        logger.warning("\n⚠️ 操作被用户中断")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ 执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

