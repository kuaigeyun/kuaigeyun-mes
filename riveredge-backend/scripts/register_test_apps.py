"""
注册测试应用脚本

扫描并注册应用，用于测试应用关联程序。

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


async def register_apps():
    """注册应用"""
    from core.services.application.application_service import ApplicationService

    # 使用默认租户ID 1
    tenant_id = 1

    logger.info(f"\n{'='*60}")
    logger.info("📋 开始扫描并注册应用")
    logger.info(f"{'='*60}")

    try:
        # 扫描并注册应用
        registered_apps = await ApplicationService.scan_and_register_plugins(tenant_id)

        logger.info(f"\n✅ 成功注册 {len(registered_apps)} 个应用:")
        for app in registered_apps:
            app_name = app.get('name', 'N/A') if isinstance(app, dict) else app.name
            app_code = app.get('code', 'N/A') if isinstance(app, dict) else app.code
            is_active = app.get('is_active', False) if isinstance(app, dict) else app.is_active
            is_installed = app.get('is_installed', False) if isinstance(app, dict) else app.is_installed
            logger.info(f"   - {app_name} ({app_code})")
            logger.info(f"     状态: 已安装={is_installed}, 已启用={is_active}")

        return len(registered_apps) > 0
    except Exception as e:
        logger.error(f"❌ 注册应用失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """主函数"""
    logger.info("\n" + "="*60)
    logger.info("🚀 开始注册测试应用")
    logger.info("="*60)

    # 初始化数据库
    await setup_database()

    # 注册应用
    success = await register_apps()

    # 关闭数据库连接
    await Tortoise.close_connections()
    logger.info("\n✅ 应用注册完成，数据库连接已关闭")

    return success


if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.warning("\n⚠️ 操作被用户中断")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ 执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


