"""
为默认租户安装并启用全部功能模块

此脚本用于为默认租户（domain="default"）安装并启用所有可用的应用模块。

使用方法：
    python -m scripts.install_all_applications_for_default_tenant
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from loguru import logger
from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from infra.services.tenant_service import TenantService
from core.services.application_service import ApplicationService
from infra.domain.tenant_context import set_current_tenant_id


async def install_all_applications_for_default_tenant():
    """
    为默认租户安装并启用全部功能模块
    
    步骤：
    1. 初始化 Tortoise ORM
    2. 获取默认租户（domain="default"）
    3. 获取所有应用
    4. 为每个应用执行安装和启用操作
    """
    try:
        # 1. 初始化 Tortoise ORM
        logger.info("正在初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        logger.info("✅ Tortoise ORM 初始化成功")
        
        # 2. 获取默认租户
        logger.info("正在查找默认租户...")
        tenant_service = TenantService()
        default_tenant = await tenant_service.get_tenant_by_domain(
            "default",
            skip_tenant_filter=True
        )
        
        if not default_tenant:
            logger.error("❌ 默认租户不存在，请先创建默认租户")
            return
        
        logger.info(f"✅ 找到默认租户: ID={default_tenant.id}, Name={default_tenant.name}")
        
        # 设置组织上下文
        set_current_tenant_id(default_tenant.id)
        
        # 3. 获取所有应用
        logger.info("正在获取所有应用列表...")
        applications = await ApplicationService.list_applications(
            tenant_id=default_tenant.id,
            skip=0,
            limit=1000,  # 获取所有应用
            is_installed=None,  # 不筛选安装状态
            is_active=None  # 不筛选启用状态
        )
        
        if not applications:
            logger.warning("⚠️ 没有找到任何应用")
            return
        
        logger.info(f"✅ 找到 {len(applications)} 个应用")
        
        # 4. 为每个应用执行安装和启用操作
        installed_count = 0
        enabled_count = 0
        skipped_count = 0
        
        for app in applications:
            app_uuid = app.get('uuid')
            app_name = app.get('name', '未知应用')
            app_code = app.get('code', 'unknown')
            is_installed = app.get('is_installed', False)
            is_active = app.get('is_active', False)
            
            logger.info(f"处理应用: {app_name} ({app_code}) - UUID: {app_uuid}")
            
            try:
                # 安装应用（如果未安装）
                if not is_installed:
                    logger.info(f"  📦 正在安装应用: {app_name}...")
                    await ApplicationService.install_application(
                        tenant_id=default_tenant.id,
                        uuid=app_uuid
                    )
                    installed_count += 1
                    logger.info(f"  ✅ 应用安装成功: {app_name}")
                else:
                    logger.info(f"  ℹ️  应用已安装: {app_name}")
                    skipped_count += 1
                
                # 启用应用（如果未启用）
                if not is_active:
                    logger.info(f"  🚀 正在启用应用: {app_name}...")
                    await ApplicationService.enable_application(
                        tenant_id=default_tenant.id,
                        uuid=app_uuid
                    )
                    enabled_count += 1
                    logger.info(f"  ✅ 应用启用成功: {app_name}")
                else:
                    logger.info(f"  ℹ️  应用已启用: {app_name}")
                    if is_installed:
                        skipped_count += 1
                
            except Exception as e:
                logger.error(f"  ❌ 处理应用失败: {app_name} - {str(e)}")
                import traceback
                logger.error(f"  详细错误: {traceback.format_exc()}")
        
        # 输出统计信息
        logger.info("=" * 60)
        logger.info("📊 操作统计:")
        logger.info(f"  - 总应用数: {len(applications)}")
        logger.info(f"  - 新安装: {installed_count}")
        logger.info(f"  - 新启用: {enabled_count}")
        logger.info(f"  - 已存在（跳过）: {skipped_count}")
        logger.info("=" * 60)
        logger.info("✅ 所有应用处理完成！")
        
    except Exception as e:
        logger.error(f"❌ 脚本执行失败: {str(e)}")
        import traceback
        logger.error(f"详细错误: {traceback.format_exc()}")
        raise
    finally:
        # 关闭 Tortoise ORM 连接
        await Tortoise.close_connections()
        logger.info("🔌 数据库连接已关闭")


if __name__ == "__main__":
    """
    主函数入口
    """
    logger.info("=" * 60)
    logger.info("🚀 开始为默认租户安装并启用全部功能模块")
    logger.info("=" * 60)
    
    asyncio.run(install_all_applications_for_default_tenant())
    
    logger.info("=" * 60)
    logger.info("✨ 脚本执行完成")
    logger.info("=" * 60)

