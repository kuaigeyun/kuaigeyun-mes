"""
重置数据库并重新初始化脚本

清空所有数据表并重新初始化：
1. 清空所有数据表
2. 重新运行迁移
3. 创建默认租户
4. 创建初始用户（超级用户、租户管理员、普通用户）
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from loguru import logger
from tortoise import Tortoise
from core.database import TORTOISE_ORM, close_db
from models.tenant import Tenant
from models.user import User
from models.role import Role
from models.permission import Permission
from models.tenant_config import TenantConfig
from core.security import hash_password


async def truncate_all_tables() -> None:
    """
    清空所有数据表
    
    按照依赖关系顺序清空表，避免外键约束错误
    """
    logger.info("=" * 60)
    logger.info("清空所有数据表")
    logger.info("=" * 60)
    
    try:
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 按照依赖关系顺序清空表（从依赖表到被依赖表）
        tables_to_truncate = [
            "core_users",  # 用户表（依赖租户）
            "core_roles",  # 角色表（依赖租户）
            "core_permissions",  # 权限表（依赖租户）
            "core_tenant_configs",  # 租户配置表（依赖租户）
            "core_tenants",  # 租户表
        ]
        
        for table in tables_to_truncate:
            try:
                # 使用 TRUNCATE CASCADE 清空表并级联删除相关数据
                await Tortoise.get_connection("default").execute_query(
                    f'TRUNCATE TABLE "{table}" CASCADE'
                )
                logger.success(f"✅ 已清空表: {table}")
            except Exception as e:
                logger.warning(f"⚠️  清空表 {table} 时出错（可能表不存在）: {e}")
        
        logger.success("所有数据表已清空")
        
    except Exception as e:
        logger.error(f"清空数据表时出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise
    finally:
        await close_db()


async def init_default_tenant() -> None:
    """
    初始化默认租户
    """
    logger.info("\n" + "=" * 60)
    logger.info("初始化默认租户")
    logger.info("=" * 60)
    
    try:
        await Tortoise.init(config=TORTOISE_ORM)
        
        from models.tenant import TenantStatus, TenantPlan
        
        # 检查是否已存在默认租户
        existing_tenant = await Tenant.get_or_none(domain="default")
        if existing_tenant:
            logger.info(f"默认租户已存在: {existing_tenant.name} (ID: {existing_tenant.id})")
            return existing_tenant
        
        # 创建默认租户
        default_tenant = await Tenant.create(
            name="默认租户",
            domain="default",
            status=TenantStatus.ACTIVE,
            plan=TenantPlan.ENTERPRISE,
            settings={
                "description": "系统默认租户，用于系统级数据和配置",
                "is_default": True,
            },
            max_users=1000,
            max_storage=10240,
            expires_at=None,
        )
        
        logger.success(f"✅ 默认租户创建成功: {default_tenant.name} (ID: {default_tenant.id})")
        return default_tenant
        
    except Exception as e:
        logger.error(f"初始化默认租户时出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise
    finally:
        await close_db()


async def init_users(default_tenant: Tenant) -> None:
    """
    初始化用户数据
    
    Args:
        default_tenant: 默认租户对象
    """
    logger.info("\n" + "=" * 60)
    logger.info("初始化用户数据")
    logger.info("=" * 60)
    
    try:
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 1. 创建系统级超级管理员（tenant_id=None，可以跨租户访问）
        logger.info("\n1. 创建系统级超级管理员")
        superuser_username = "superadmin"
        superuser_email = "superadmin@riveredge.local"
        superuser_password = "SuperAdmin@2024"  # ⭐ 超级用户密码
        
        # 系统级超级管理员：tenant_id=None 且 is_superuser=True
        existing_superuser = await User.get_or_none(
            tenant_id__isnull=True,
            username=superuser_username,
            is_superuser=True
        )
        
        if existing_superuser:
            logger.info(f"系统级超级管理员已存在，更新密码...")
            existing_superuser.password_hash = hash_password(superuser_password)
            existing_superuser.is_active = True
            existing_superuser.is_superuser = True
            existing_superuser.is_tenant_admin = False  # 系统级超级管理员不是租户管理员
            await existing_superuser.save()
            logger.success(f"✅ 系统级超级管理员密码已更新")
        else:
            superuser = await User.create(
                tenant_id=None,  # ⭐ 关键：系统级超级管理员 tenant_id 为 None
                username=superuser_username,
                email=superuser_email,
                password_hash=hash_password(superuser_password),
                full_name="系统级超级管理员",
                is_active=True,
                is_superuser=True,  # 系统级超级用户
                is_tenant_admin=False,  # 系统级超级管理员不是租户管理员
            )
            logger.success(f"✅ 系统级超级管理员创建成功")
        
        logger.info(f"   用户名: {superuser_username}")
        logger.info(f"   密码: {superuser_password} ⭐")
        logger.info(f"   邮箱: {superuser_email}")
        
        # 2. 创建租户管理员
        logger.info("\n2. 创建租户管理员")
        admin_username = "admin"
        admin_email = "admin@riveredge.local"
        admin_password = "Admin@2024"
        
        existing_admin = await User.get_or_none(
            tenant_id=default_tenant.id,
            username=admin_username
        )
        
        if existing_admin:
            logger.info(f"租户管理员已存在，更新密码...")
            existing_admin.password_hash = hash_password(admin_password)
            existing_admin.is_active = True
            await existing_admin.save()
            logger.success(f"✅ 租户管理员密码已更新")
        else:
            admin = await User.create(
                tenant_id=default_tenant.id,
                username=admin_username,
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name="租户管理员",
                is_active=True,
                is_superuser=False,
                is_tenant_admin=True,
            )
            logger.success(f"✅ 租户管理员创建成功")
        
        logger.info(f"   用户名: {admin_username}")
        logger.info(f"   密码: {admin_password}")
        logger.info(f"   邮箱: {admin_email}")
        
        # 3. 创建普通用户
        logger.info("\n3. 创建普通用户")
        user_username = "user"
        user_email = "user@riveredge.local"
        user_password = "User@2024"
        
        existing_user = await User.get_or_none(
            tenant_id=default_tenant.id,
            username=user_username
        )
        
        if existing_user:
            logger.info(f"普通用户已存在，更新密码...")
            existing_user.password_hash = hash_password(user_password)
            existing_user.is_active = True
            await existing_user.save()
            logger.success(f"✅ 普通用户密码已更新")
        else:
            user = await User.create(
                tenant_id=default_tenant.id,
                username=user_username,
                email=user_email,
                password_hash=hash_password(user_password),
                full_name="普通用户",
                is_active=True,
                is_superuser=False,
                is_tenant_admin=False,
            )
            logger.success(f"✅ 普通用户创建成功")
        
        logger.info(f"   用户名: {user_username}")
        logger.info(f"   密码: {user_password}")
        logger.info(f"   邮箱: {user_email}")
        
        # 输出登录信息摘要
        logger.info("\n" + "=" * 60)
        logger.info("用户初始化完成 - 登录信息摘要")
        logger.info("=" * 60)
        logger.info("⭐ 超级用户:")
        logger.info(f"  用户名: {superuser_username}")
        logger.info(f"  密码: {superuser_password}")
        logger.info(f"  邮箱: {superuser_email}")
        logger.info("\n租户管理员:")
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
        await close_db()


async def main() -> None:
    """
    主函数：重置数据库并重新初始化
    """
    logger.info("=" * 60)
    logger.info("RiverEdge SaaS 多租户框架 - 数据库重置和初始化脚本")
    logger.info("=" * 60)
    
    try:
        # 1. 清空所有数据表
        await truncate_all_tables()
        
        # 2. 初始化默认租户
        default_tenant = await init_default_tenant()
        
        # 3. 初始化用户数据
        await init_users(default_tenant)
        
        logger.success("\n" + "=" * 60)
        logger.success("数据库重置和初始化完成！")
        logger.success("=" * 60)
        
    except Exception as e:
        logger.error(f"重置和初始化失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


if __name__ == "__main__":
    """
    脚本入口
    
    运行此脚本以重置数据库并重新初始化。
    
    使用方法:
        python scripts/reset_and_init.py
    """
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.warning("用户中断操作")
        sys.exit(1)
    except Exception as e:
        logger.error(f"执行失败: {e}")
        sys.exit(1)

