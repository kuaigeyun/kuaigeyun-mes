#!/usr/bin/env python3
"""
应用清单同步工具

用于将前端应用的manifest.json文件同步到数据库中的应用配置。
解决应用菜单更新后需要重新安装的问题。
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 直接导入数据库连接函数，避免依赖问题
import asyncpg
from riveredge.infra.config.database_config import DATABASE_CONFIG

async def get_db_connection():
    """获取数据库连接"""
    return await asyncpg.connect(
        host=DATABASE_CONFIG['host'],
        port=DATABASE_CONFIG['port'],
        user=DATABASE_CONFIG['user'],
        password=DATABASE_CONFIG['password'],
        database=DATABASE_CONFIG['database']
    )

# 简单的logger
class SimpleLogger:
    def info(self, msg): print(f"[INFO] {msg}")
    def error(self, msg): print(f"[ERROR] {msg}")
    def warning(self, msg): print(f"[WARN] {msg}")

logger = SimpleLogger()


class AppManifestSyncService:
    """应用清单同步服务"""

    @staticmethod
    async def get_application_by_code(tenant_id: int, code: str) -> Optional[Dict[str, Any]]:
        """根据代码获取应用"""
        conn = await get_db_connection()
        try:
            query = """
                SELECT * FROM core_applications
                WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                LIMIT 1
            """
            row = await conn.fetchrow(query, tenant_id, code)
            if row:
                # 转换Row为字典
                app_dict = dict(row)
                # 解析JSON字段
                if app_dict.get('menu_config'):
                    try:
                        app_dict['menu_config'] = json.loads(app_dict['menu_config'])
                    except:
                        app_dict['menu_config'] = None
                return app_dict
            return None
        finally:
            await conn.close()

    @staticmethod
    async def update_application_menu_config(
        tenant_id: int,
        app_uuid: str,
        menu_config: Dict[str, Any],
        version: str = None
    ) -> bool:
        """更新应用菜单配置"""
        conn = await get_db_connection()
        try:
            # 构建更新查询
            update_fields = ["menu_config = $1", "updated_at = NOW()"]
            params = [json.dumps(menu_config, ensure_ascii=False)]
            param_index = 2

            if version:
                update_fields.append(f"version = ${param_index}")
                params.append(version)
                param_index += 1

            query = f"""
                UPDATE core_applications
                SET {', '.join(update_fields)}
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
            """

            params.insert(0, tenant_id)
            params.insert(1, app_uuid)

            result = await conn.execute(query, *params)

            if result == "UPDATE 1":
                logger.info(f"✅ 应用菜单配置更新成功: {app_uuid}")

                # 同步菜单到系统
                from riveredge.core.services.system.menu_service import MenuService
                app = await AppManifestSyncService.get_application_by_code(tenant_id, "kuaizhizao")
                if app and app.get('is_active', False):
                    await MenuService.sync_menus_from_application_config(
                        tenant_id=tenant_id,
                        application_uuid=app_uuid,
                        menu_config=menu_config,
                        is_active=True
                    )
                    logger.info("✅ 菜单同步完成")

                return True
            else:
                logger.error(f"❌ 应用更新失败: {result}")
                return False

        except Exception as e:
            logger.error(f"❌ 更新应用配置失败: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            await conn.close()

    @staticmethod
    async def sync_manifest_to_database(
        tenant_id: int,
        manifest_path: str,
        app_code: str = "kuaizhizao"
    ) -> bool:
        """将manifest.json同步到数据库"""

        # 读取manifest.json
        if not os.path.exists(manifest_path):
            logger.error(f"❌ manifest.json文件不存在: {manifest_path}")
            return False

        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON格式错误: {e}")
            return False

        logger.info(f"📋 读取应用配置: {manifest.get('name', 'unknown')} v{manifest.get('version', 'unknown')}")

        # 获取应用信息
        app = await AppManifestSyncService.get_application_by_code(tenant_id, app_code)
        if not app:
            logger.error(f"❌ 未找到应用: {app_code}")
            return False

        logger.info(f"🔍 数据库中的应用: {app['name']} (UUID: {app['uuid']})")

        # 检查版本是否需要更新
        current_version = app.get('version', '0.0.0')
        new_version = manifest.get('version', '0.0.0')

        if current_version == new_version:
            logger.info(f"📌 版本相同，无需更新: {current_version}")
        else:
            logger.info(f"⬆️ 版本更新: {current_version} -> {new_version}")

        # 更新菜单配置
        menu_config = manifest.get('menu_config')
        if not menu_config:
            logger.error("❌ manifest.json缺少menu_config配置")
            return False

        logger.info("🔄 开始更新应用菜单配置...")
        success = await AppManifestSyncService.update_application_menu_config(
            tenant_id=tenant_id,
            app_uuid=str(app['uuid']),
            menu_config=menu_config,
            version=new_version
        )

        if success:
            logger.info("🎉 应用配置同步完成！")
            logger.info("💡 请刷新前端页面查看新菜单")
        else:
            logger.error("❌ 应用配置同步失败")

        return success


async def main():
    """主函数"""
    logger.info("🚀 开始同步应用清单...")

    # 默认参数
    tenant_id = 1  # 默认租户ID
    manifest_path = "riveredge-frontend/src/apps/kuaizhizao/manifest.json"
    app_code = "kuaizhizao"

    # 检查命令行参数
    if len(sys.argv) > 1:
        tenant_id = int(sys.argv[1])
    if len(sys.argv) > 2:
        manifest_path = sys.argv[2]
    if len(sys.argv) > 3:
        app_code = sys.argv[3]

    logger.info(f"配置参数:")
    logger.info(f"  租户ID: {tenant_id}")
    logger.info(f"  清单文件: {manifest_path}")
    logger.info(f"  应用代码: {app_code}")

    try:
        success = await AppManifestSyncService.sync_manifest_to_database(
            tenant_id=tenant_id,
            manifest_path=manifest_path,
            app_code=app_code
        )

        if success:
            logger.info("✅ 同步完成！请刷新前端页面查看效果。")
            sys.exit(0)
        else:
            logger.error("❌ 同步失败！")
            sys.exit(1)

    except Exception as e:
        logger.error(f"❌ 执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
