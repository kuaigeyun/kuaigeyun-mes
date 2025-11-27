"""
认证服务测试脚本

测试认证服务的业务逻辑，包括注册、登录、Token 刷新等
"""

import sys
import asyncio
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from loguru import logger
from tortoise import Tortoise

from core.database import TORTOISE_ORM
from models.tenant import Tenant, TenantStatus, TenantPlan
from models.user import User
from schemas.auth import LoginRequest, RegisterRequest
from services.auth_service import AuthService


async def test_auth_service():
    """
    测试认证服务
    
    测试所有认证相关的业务逻辑
    """
    logger.info("=" * 60)
    logger.info("开始测试认证服务")
    logger.info("=" * 60)
    
    # 初始化数据库连接（使用 Tortoise ORM 官方方法）
    logger.info("\n初始化数据库连接...")
    await Tortoise.init(config=TORTOISE_ORM)
    logger.success("✅ 数据库连接初始化成功")
    
    try:
        # 1. 创建测试组织
        logger.info("\n1. 创建测试组织")
        tenant = await Tenant.get_or_none(domain="auth-test-tenant")
        if not tenant:
            tenant = await Tenant.create(
                name="认证测试组织",
                domain="auth-test-tenant",
                status=TenantStatus.ACTIVE,
                plan=TenantPlan.BASIC,
                max_users=100,
                max_storage=2048,
            )
            logger.success(f"✅ 组织创建成功: ID={tenant.id}, Domain={tenant.domain}")
        else:
            logger.info(f"✅ 使用现有组织: ID={tenant.id}, Domain={tenant.domain}")
        
        tenant_id = tenant.id
        
        # 2. 测试用户注册
        logger.info("\n2. 测试用户注册")
        auth_service = AuthService()
        register_data = RegisterRequest(
            username="testuser",
            email="testuser@example.com",
            password="password123",
            tenant_id=tenant_id,
            full_name="测试用户",
        )
        
        # 先删除可能存在的测试用户
        existing_user = await User.get_or_none(
            tenant_id=tenant_id,
            username=register_data.username
        )
        if existing_user:
            await existing_user.delete()
            logger.info("删除已存在的测试用户")
        
        try:
            user = await auth_service.register(register_data)
            logger.success(f"✅ 用户注册成功: ID={user.id}, Username={user.username}")
            logger.info(f"   邮箱: {user.email}")
            logger.info(f"   组织 ID: {user.tenant_id}")
            logger.info(f"   是否激活: {user.is_active}")
        except Exception as e:
            logger.error(f"❌ 用户注册失败: {e}")
            return
        
        # 3. 测试用户登录
        logger.info("\n3. 测试用户登录")
        login_data = LoginRequest(
            username=register_data.username,
            password=register_data.password,
            tenant_id=tenant_id,
        )
        
        try:
            result = await auth_service.login(login_data)
            logger.success(f"✅ 用户登录成功")
            logger.info(f"   Token: {result['access_token'][:50]}...")
            logger.info(f"   Token 类型: {result['token_type']}")
            logger.info(f"   过期时间: {result['expires_in']} 秒")
            logger.info(f"   用户信息: {result['user']}")
            access_token = result['access_token']
        except Exception as e:
            logger.error(f"❌ 用户登录失败: {e}")
            return
        
        # 4. 测试获取当前用户
        logger.info("\n4. 测试获取当前用户")
        try:
            current_user = await auth_service.get_current_user(access_token)
            logger.success(f"✅ 获取当前用户成功")
            logger.info(f"   用户 ID: {current_user.id}")
            logger.info(f"   用户名: {current_user.username}")
            logger.info(f"   邮箱: {current_user.email}")
            logger.info(f"   组织 ID: {current_user.tenant_id}")
        except Exception as e:
            logger.error(f"❌ 获取当前用户失败: {e}")
        
        # 5. 测试 Token 刷新
        logger.info("\n5. 测试 Token 刷新")
        try:
            refresh_result = await auth_service.refresh_token(access_token)
            logger.success(f"✅ Token 刷新成功")
            logger.info(f"   新 Token: {refresh_result['access_token'][:50]}...")
            logger.info(f"   过期时间: {refresh_result['expires_in']} 秒")
        except Exception as e:
            logger.error(f"❌ Token 刷新失败: {e}")
        
        # 6. 测试错误密码登录
        logger.info("\n6. 测试错误密码登录")
        wrong_login_data = LoginRequest(
            username=register_data.username,
            password="wrong_password",
            tenant_id=tenant_id,
        )
        try:
            await auth_service.login(wrong_login_data)
            logger.error("❌ 错误密码应该抛出异常，但登录成功了")
        except Exception as e:
            logger.success(f"✅ 错误密码正确抛出异常: {e}")
        
        # 7. 测试重复注册（应该失败）
        logger.info("\n7. 测试重复注册（应该失败）")
        try:
            await auth_service.register(register_data)
            logger.error("❌ 重复注册应该抛出异常，但注册成功了")
        except Exception as e:
            logger.success(f"✅ 重复注册正确抛出异常: {e}")
        
        logger.info("\n" + "=" * 60)
        logger.success("认证服务测试完成")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ 测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # 关闭数据库连接（使用 Tortoise ORM 官方方法）
        logger.info("\n关闭数据库连接...")
        await Tortoise.close_connections()
        logger.success("✅ 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(test_auth_service())

