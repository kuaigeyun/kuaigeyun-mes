"""
认证 API 测试脚本

测试用户认证相关的 API 接口，包括注册、登录、Token 刷新等
"""

import sys
import asyncio
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import httpx
from loguru import logger


BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"


async def test_auth_api():
    """
    测试认证 API
    
    测试所有认证相关的接口
    """
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        logger.info("=" * 60)
        logger.info("开始测试认证 API")
        logger.info("=" * 60)
        
        # 首先需要创建一个组织（用于测试）
        logger.info("\n0. 创建测试组织")
        tenant_data = {
            "name": "认证测试组织",
            "domain": "auth-test-tenant",
            "status": "active",
            "plan": "basic",
            "max_users": 100,
            "max_storage": 2048,
        }
        tenant_id = None
        try:
            response = await client.post(
                f"{API_PREFIX}/tenants",
                json=tenant_data
            )
            if response.status_code == 201:
                tenant_result = response.json()
                tenant_id = tenant_result["id"]
                logger.success(f"✅ 组织创建成功: ID={tenant_id}")
            elif response.status_code == 400 and "已存在" in response.json().get("detail", ""):
                # 组织已存在，尝试获取
                logger.info("组织已存在，尝试获取...")
                response = await client.get(f"{API_PREFIX}/tenants?domain={tenant_data['domain']}")
                if response.status_code == 200:
                    result = response.json()
                    if result.get("items") and len(result["items"]) > 0:
                        tenant_id = result["items"][0]["id"]
                        logger.info(f"✅ 获取到现有组织: ID={tenant_id}")
            else:
                logger.error(f"❌ 创建组织失败: {response.status_code} - {response.json()}")
                return
        except Exception as e:
            logger.error(f"❌ 创建组织时出错: {e}")
            return
        
        if not tenant_id:
            logger.error("❌ 无法获取组织 ID，测试终止")
            return
        
        # 1. 测试用户注册
        logger.info("\n1. 测试用户注册")
        register_data = {
            "username": "testuser",
            "email": "testuser@example.com",
            "password": "password123",
            "tenant_id": tenant_id,
            "full_name": "测试用户",
        }
        user_id = None
        try:
            response = await client.post(
                f"{API_PREFIX}/auth/register",
                json=register_data
            )
            logger.info(f"状态码: {response.status_code}")
            logger.info(f"响应: {response.json()}")
            if response.status_code == 201:
                result = response.json()
                user_id = result["id"]
                logger.success(f"✅ 用户注册成功: ID={user_id}, Username={result['username']}")
            else:
                logger.error(f"❌ 用户注册失败: {response.status_code} - {response.json()}")
                # 如果用户已存在，尝试使用现有用户
                if response.status_code == 400 and "已被使用" in response.json().get("detail", ""):
                    logger.info("用户已存在，将使用现有用户进行登录测试")
        except Exception as e:
            logger.error(f"❌ 用户注册时出错: {e}")
        
        # 2. 测试用户登录
        logger.info("\n2. 测试用户登录")
        login_data = {
            "username": register_data["username"],
            "password": register_data["password"],
            "tenant_id": tenant_id,
        }
        access_token = None
        try:
            response = await client.post(
                f"{API_PREFIX}/auth/login",
                json=login_data
            )
            logger.info(f"状态码: {response.status_code}")
            result = response.json()
            logger.info(f"响应: {result}")
            if response.status_code == 200:
                access_token = result.get("access_token")
                logger.success(f"✅ 用户登录成功")
                logger.info(f"   Token: {access_token[:50]}...")
                logger.info(f"   Token 类型: {result.get('token_type')}")
                logger.info(f"   过期时间: {result.get('expires_in')} 秒")
                logger.info(f"   用户信息: {result.get('user')}")
            else:
                logger.error(f"❌ 用户登录失败: {response.status_code} - {result}")
        except Exception as e:
            logger.error(f"❌ 用户登录时出错: {e}")
        
        if not access_token:
            logger.error("❌ 无法获取访问令牌，后续测试终止")
            return
        
        # 3. 测试获取当前用户信息
        logger.info("\n3. 测试获取当前用户信息")
        try:
            response = await client.get(
                f"{API_PREFIX}/auth/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            logger.info(f"状态码: {response.status_code}")
            result = response.json()
            logger.info(f"响应: {result}")
            if response.status_code == 200:
                logger.success(f"✅ 获取当前用户信息成功")
                logger.info(f"   用户 ID: {result.get('id')}")
                logger.info(f"   用户名: {result.get('username')}")
                logger.info(f"   邮箱: {result.get('email')}")
                logger.info(f"   组织 ID: {result.get('tenant_id')}")
                logger.info(f"   是否激活: {result.get('is_active')}")
            else:
                logger.error(f"❌ 获取当前用户信息失败: {response.status_code} - {result}")
        except Exception as e:
            logger.error(f"❌ 获取当前用户信息时出错: {e}")
        
        # 4. 测试 Token 刷新
        logger.info("\n4. 测试 Token 刷新")
        try:
            refresh_data = {
                "refresh_token": access_token,  # 使用当前 token 作为 refresh token
            }
            response = await client.post(
                f"{API_PREFIX}/auth/refresh",
                json=refresh_data
            )
            logger.info(f"状态码: {response.status_code}")
            result = response.json()
            logger.info(f"响应: {result}")
            if response.status_code == 200:
                new_token = result.get("access_token")
                logger.success(f"✅ Token 刷新成功")
                logger.info(f"   新 Token: {new_token[:50]}...")
                logger.info(f"   过期时间: {result.get('expires_in')} 秒")
            else:
                logger.error(f"❌ Token 刷新失败: {response.status_code} - {result}")
        except Exception as e:
            logger.error(f"❌ Token 刷新时出错: {e}")
        
        # 5. 测试无效 Token
        logger.info("\n5. 测试无效 Token")
        try:
            response = await client.get(
                f"{API_PREFIX}/auth/me",
                headers={"Authorization": "Bearer invalid_token_12345"}
            )
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 401:
                logger.success(f"✅ 无效 Token 正确返回 401 错误")
            else:
                logger.warning(f"⚠️  无效 Token 返回状态码: {response.status_code}")
        except Exception as e:
            logger.error(f"❌ 测试无效 Token 时出错: {e}")
        
        # 6. 测试错误密码登录
        logger.info("\n6. 测试错误密码登录")
        try:
            wrong_login_data = {
                "username": register_data["username"],
                "password": "wrong_password",
                "tenant_id": tenant_id,
            }
            response = await client.post(
                f"{API_PREFIX}/auth/login",
                json=wrong_login_data
            )
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 401:
                logger.success(f"✅ 错误密码正确返回 401 错误")
            else:
                logger.warning(f"⚠️  错误密码返回状态码: {response.status_code}")
        except Exception as e:
            logger.error(f"❌ 测试错误密码时出错: {e}")
        
        logger.info("\n" + "=" * 60)
        logger.info("认证 API 测试完成")
        logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_auth_api())

