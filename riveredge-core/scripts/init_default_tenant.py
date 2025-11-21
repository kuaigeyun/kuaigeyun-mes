"""
初始化默认组织脚本

在系统初始化时创建默认组织，用于系统级数据和配置。
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.database import TORTOISE_ORM
from tortoise import Tortoise
from services.tenant_service import TenantService
from schemas.tenant import TenantCreate
from models.tenant import TenantStatus, TenantPlan
from loguru import logger


async def init_default_tenant() -> None:
    """
    初始化默认组织
    
    检查是否已存在默认组织（domain="default"），如果不存在则创建。
    """
    try:
        # 初始化数据库连接（使用 Tortoise ORM 官方方法）
        logger.info("正在初始化数据库连接...")
        await Tortoise.init(config=TORTOISE_ORM)
        logger.info("数据库连接初始化成功")
        
        # 创建组织服务实例
        service = TenantService()
        
        # 检查是否已存在默认组织
        logger.info("正在检查是否已存在默认组织...")
        existing_tenant = await service.get_tenant_by_domain("default", skip_tenant_filter=True)
        
        if existing_tenant:
            logger.info(f"默认组织已存在: {existing_tenant.name} (ID: {existing_tenant.id}, Domain: {existing_tenant.domain})")
            return
        
        # 创建默认组织
        logger.info("正在创建默认组织...")
        default_tenant_data = TenantCreate(
            name="默认组织",
            domain="default",
            status=TenantStatus.ACTIVE,
            plan=TenantPlan.ENTERPRISE,
            settings={
                "description": "系统默认组织，用于系统级数据和配置",
                "is_default": True,
            },
            max_users=1000,  # 默认组织允许更多用户
            max_storage=10240,  # 默认组织允许更多存储空间（10GB）
            expires_at=None,  # 默认组织永不过期
        )
        
        tenant = await service.create_tenant(default_tenant_data)
        logger.success(f"默认组织创建成功: {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain})")
        
        # 初始化组织数据（占位，后续完善）
        logger.info("正在初始化组织数据...")
        await service.initialize_tenant_data(tenant.id)
        logger.info("组织数据初始化完成")
        
    except Exception as e:
        logger.error(f"初始化默认组织时出错: {e}")
        raise
    finally:
        # 关闭数据库连接（使用 Tortoise ORM 官方方法）
        logger.info("正在关闭数据库连接...")
        await Tortoise.close_connections()
        logger.info("数据库连接已关闭")


if __name__ == "__main__":
    """
    脚本入口
    
    运行此脚本以初始化默认组织。
    
    使用方法:
        python scripts/init_default_tenant.py
    """
    logger.info("=" * 60)
    logger.info("RiverEdge SaaS 多组织框架 - 默认组织初始化脚本")
    logger.info("=" * 60)
    
    try:
        asyncio.run(init_default_tenant())
        logger.success("默认组织初始化完成！")
    except KeyboardInterrupt:
        logger.warning("用户中断操作")
        sys.exit(1)
    except Exception as e:
        logger.error(f"初始化失败: {e}")
        sys.exit(1)

