"""
停用与MES不相关的应用

此脚本用于停用所有与MES不直接相关的应用，只保留MES运行所必需的应用。

MES相关应用（保留）：
- master-data: 基础数据管理（必需）
- kuaiaps: 排产系统（必需）
- kuaiwms: 仓库管理（必需）
- kuaimes: MES本身（必需）
- kuaiqms: 质量管理（重要依赖，Phase 5）

其他应用将被停用。

使用方法：
    python -m scripts.disable_non_mes_applications
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

# MES相关应用代码列表（这些应用将被保留启用）
MES_RELATED_APPS = {
    'master-data',  # 基础数据管理（必需）
    'kuaiaps',      # 排产系统（必需）
    'kuaiwms',      # 仓库管理（必需）
    'kuaimes',      # MES本身（必需）
    'kuaiqms',      # 质量管理（重要依赖）
}


async def disable_non_mes_applications():
    """
    停用与MES不相关的应用
    
    步骤：
    1. 初始化 Tortoise ORM
    2. 获取默认租户（domain="default"）
    3. 获取所有已安装的应用
    4. 停用不在MES相关列表中的应用
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
        
        # 3. 获取所有已安装的应用
        logger.info("正在获取所有已安装的应用列表...")
        applications = await ApplicationService.get_installed_applications(
            tenant_id=default_tenant.id,
            is_active=None  # 不筛选启用状态
        )
        
        if not applications:
            logger.warning("⚠️ 没有找到任何已安装的应用")
            return
        
        logger.info(f"✅ 找到 {len(applications)} 个已安装的应用")
        
        # 4. 停用不在MES相关列表中的应用
        disabled_count = 0
        kept_count = 0
        error_count = 0
        
        logger.info("=" * 60)
        logger.info("开始处理应用...")
        logger.info("=" * 60)
        
        for app in applications:
            app_uuid = app.get('uuid')
            app_name = app.get('name', '未知应用')
            app_code = app.get('code', 'unknown')
            is_active = app.get('is_active', False)
            
            # 检查是否为MES相关应用
            if app_code in MES_RELATED_APPS:
                logger.info(f"✅ 保留应用: {app_name} ({app_code}) - MES相关")
                if not is_active:
                    logger.info(f"  🚀 正在启用应用: {app_name}...")
                    try:
                        await ApplicationService.enable_application(
                            tenant_id=default_tenant.id,
                            uuid=app_uuid
                        )
                        logger.info(f"  ✅ 应用启用成功: {app_name}")
                    except Exception as e:
                        logger.error(f"  ❌ 启用应用失败: {app_name} - {str(e)}")
                        error_count += 1
                else:
                    logger.info(f"  ℹ️  应用已启用: {app_name}")
                kept_count += 1
            else:
                # 停用非MES相关应用
                if is_active:
                    logger.info(f"⏸️  停用应用: {app_name} ({app_code}) - 非MES相关")
                    try:
                        await ApplicationService.disable_application(
                            tenant_id=default_tenant.id,
                            uuid=app_uuid
                        )
                        disabled_count += 1
                        logger.info(f"  ✅ 应用停用成功: {app_name}")
                    except Exception as e:
                        logger.error(f"  ❌ 停用应用失败: {app_name} - {str(e)}")
                        error_count += 1
                else:
                    logger.info(f"  ℹ️  应用已停用: {app_name}")
                    disabled_count += 1
        
        # 输出统计信息
        logger.info("=" * 60)
        logger.info("📊 操作统计:")
        logger.info(f"  - 总应用数: {len(applications)}")
        logger.info(f"  - MES相关应用（保留）: {kept_count}")
        logger.info(f"  - 非MES相关应用（停用）: {disabled_count}")
        logger.info(f"  - 错误数: {error_count}")
        logger.info("=" * 60)
        logger.info("✅ 应用停用处理完成！")
        
        # 输出MES相关应用列表
        logger.info("=" * 60)
        logger.info("📋 MES相关应用列表（已保留）:")
        for app_code in sorted(MES_RELATED_APPS):
            logger.info(f"  - {app_code}")
        logger.info("=" * 60)
        
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
    logger.info("🚀 开始停用与MES不相关的应用")
    logger.info("=" * 60)
    
    asyncio.run(disable_non_mes_applications())
    
    logger.info("=" * 60)
    logger.info("✨ 脚本执行完成")
    logger.info("=" * 60)

