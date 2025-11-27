"""
初始化用户数据脚本

在系统初始化时创建默认用户：
1. 超级用户（系统级，在默认组织中，is_superuser=True, is_tenant_admin=True）
2. 组织管理员（在默认组织中，is_tenant_admin=True）
3. 普通用户（在默认组织中，普通用户）
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from loguru import logger
from core.database import TORTOISE_ORM
from tortoise import Tortoise
from models.tenant import Tenant
from models.user import User
from core.security import hash_password


async def init_users() -> None:
    """
    初始化用户数据
    
    在默认组织中创建超级用户、组织管理员和普通用户。
    """
    try:
        # 初始化数据库连接（使用 Tortoise ORM 官方方法）
        logger.info("正在初始化数据库连接...")
        await Tortoise.init(config=TORTOISE_ORM)
        logger.info("数据库连接初始化成功")
        
        # 获取或创建默认组织
        logger.info("正在检查默认组织...")
        default_tenant = await Tenant.get_or_none(domain="default")
        if not default_tenant:
            logger.error("默认组织不存在，请先运行 init_default_tenant.py 创建默认组织")
            return
        
        logger.info(f"找到默认组织: {default_tenant.name} (ID: {default_tenant.id})")
        
        # 1. 创建系统级超级管理员（tenant_id=None，可以跨组织访问）
        logger.info("\n" + "=" * 60)
        logger.info("1. 创建系统级超级管理员")
        logger.info("=" * 60)
        
        superuser_username = "superadmin"
        superuser_email = "superadmin@riveredge.local"
        superuser_password = "SuperAdmin@2024"  # 默认密码，建议首次登录后修改
        
        # 系统级超级管理员：tenant_id=None 且 is_superuser=True
        existing_superuser = await User.get_or_none(
            tenant_id__isnull=True,
            username=superuser_username,
            is_superuser=True
        )
        
        if existing_superuser:
            logger.info(f"系统级超级管理员已存在: {existing_superuser.username} (ID: {existing_superuser.id})")
        else:
            superuser = await User.create(
                tenant_id=None,  # ⭐ 关键：系统级超级管理员 tenant_id 为 None
                username=superuser_username,
                email=superuser_email,
                password_hash=hash_password(superuser_password),
                full_name="系统级超级管理员",
                is_active=True,
                is_superuser=True,  # 系统级超级用户
                is_tenant_admin=False,  # 系统级超级管理员不是组织管理员
            )
            logger.success(f"✅ 超级用户创建成功:")
            logger.info(f"   用户名: {superuser.username}")
            logger.info(f"   邮箱: {superuser.email}")
            logger.info(f"   密码: {superuser_password} (请首次登录后修改)")
            logger.info(f"   组织 ID: {superuser.tenant_id}")
            logger.info(f"   是否超级用户: {superuser.is_superuser}")
            logger.info(f"   是否组织管理员: {superuser.is_tenant_admin}")
        
        # 2. 创建组织管理员
        logger.info("\n" + "=" * 60)
        logger.info("2. 创建组织管理员")
        logger.info("=" * 60)
        
        admin_username = "admin"
        admin_email = "admin@riveredge.local"
        admin_password = "Admin@2024"  # 默认密码，建议首次登录后修改
        
        existing_admin = await User.get_or_none(
            tenant_id=default_tenant.id,
            username=admin_username
        )
        
        if existing_admin:
            logger.info(f"组织管理员已存在: {existing_admin.username} (ID: {existing_admin.id})")
        else:
            admin = await User.create(
                tenant_id=default_tenant.id,
                username=admin_username,
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name="组织管理员",
                is_active=True,
                is_superuser=False,
                is_tenant_admin=True,  # 组织管理员
            )
            logger.success(f"✅ 组织管理员创建成功:")
            logger.info(f"   用户名: {admin.username}")
            logger.info(f"   邮箱: {admin.email}")
            logger.info(f"   密码: {admin_password} (请首次登录后修改)")
            logger.info(f"   组织 ID: {admin.tenant_id}")
            logger.info(f"   是否组织管理员: {admin.is_tenant_admin}")
        
        # 3. 创建普通用户
        logger.info("\n" + "=" * 60)
        logger.info("3. 创建普通用户")
        logger.info("=" * 60)
        
        user_username = "user"
        user_email = "user@riveredge.local"
        user_password = "User@2024"  # 默认密码，建议首次登录后修改
        
        existing_user = await User.get_or_none(
            tenant_id=default_tenant.id,
            username=user_username
        )
        
        if existing_user:
            logger.info(f"普通用户已存在: {existing_user.username} (ID: {existing_user.id})")
        else:
            user = await User.create(
                tenant_id=default_tenant.id,
                username=user_username,
                email=user_email,
                password_hash=hash_password(user_password),
                full_name="普通用户",
                is_active=True,
                is_superuser=False,
                is_tenant_admin=False,  # 普通用户
            )
            logger.success(f"✅ 普通用户创建成功:")
            logger.info(f"   用户名: {user.username}")
            logger.info(f"   邮箱: {user.email}")
            logger.info(f"   密码: {user_password} (请首次登录后修改)")
            logger.info(f"   组织 ID: {user.tenant_id}")
        
        # 输出登录信息摘要
        logger.info("\n" + "=" * 60)
        logger.info("用户初始化完成 - 登录信息摘要")
        logger.info("=" * 60)
        logger.info("超级用户:")
        logger.info(f"  用户名: {superuser_username}")
        logger.info(f"  密码: {superuser_password}")
        logger.info(f"  邮箱: {superuser_email}")
        logger.info("\n组织管理员:")
        logger.info(f"  用户名: {admin_username}")
        logger.info(f"  密码: {admin_password}")
        logger.info(f"  邮箱: {admin_email}")
        logger.info("\n普通用户:")
        logger.info(f"  用户名: {user_username}")
        logger.info(f"  密码: {user_password}")
        logger.info(f"  邮箱: {user_email}")
        logger.info("\n⚠️  重要提示: 请首次登录后立即修改默认密码！")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"初始化用户数据时出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise
    finally:
        # 关闭数据库连接（使用 Tortoise ORM 官方方法）
        logger.info("\n正在关闭数据库连接...")
        await Tortoise.close_connections()
        logger.info("数据库连接已关闭")


if __name__ == "__main__":
    """
    脚本入口
    
    运行此脚本以初始化用户数据。
    
    使用方法:
        python scripts/init_users.py
    """
    logger.info("=" * 60)
    logger.info("RiverEdge SaaS 多组织框架 - 用户数据初始化脚本")
    logger.info("=" * 60)
    
    try:
        asyncio.run(init_users())
        logger.success("\n用户数据初始化完成！")
    except KeyboardInterrupt:
        logger.warning("用户中断操作")
        sys.exit(1)
    except Exception as e:
        logger.error(f"初始化失败: {e}")
        sys.exit(1)

