"""
测试 API 接口功能

验证重命名后的系统是否正常工作
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Windows 环境下修复异步网络兼容性问题
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import httpx
from app.config import settings

# API 基础 URL
BASE_URL = f"http://localhost:{settings.PORT}"


async def test_health_check():
    """测试健康检查接口"""
    print("=" * 60)
    print("测试健康检查接口")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{BASE_URL}/health")
            print(f"状态码: {response.status_code}")
            print(f"响应: {response.json()}")
            if response.status_code == 200:
                print("✅ 健康检查通过")
                return True
            else:
                print("❌ 健康检查失败")
                return False
        except Exception as e:
            print(f"❌ 健康检查失败: {e}")
            return False


async def test_superadmin_login():
    """测试超级管理员登录"""
    print("\n" + "=" * 60)
    print("测试超级管理员登录")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # 尝试登录
            login_data = {
                "username": "superadmin",
                "password": "superadmin123"
            }
            response = await client.post(
                f"{BASE_URL}/api/v1/superadmin/auth/login",
                json=login_data
            )
            print(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 登录成功")
                print(f"   Token: {data.get('access_token', '')[:50]}...")
                return data.get('access_token')
            else:
                print(f"❌ 登录失败: {response.text}")
                return None
        except Exception as e:
            print(f"❌ 登录失败: {e}")
            return None


async def test_user_login(tenant_id: int = 1):
    """测试普通用户登录"""
    print("\n" + "=" * 60)
    print(f"测试普通用户登录 (tenant_id={tenant_id})")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # 尝试登录
            login_data = {
                "username": "admin",
                "password": "admin123",
                "tenant_id": tenant_id
            }
            response = await client.post(
                f"{BASE_URL}/api/v1/auth/login",
                json=login_data
            )
            print(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 登录成功")
                print(f"   Token: {data.get('access_token', '')[:50]}...")
                return data.get('access_token')
            else:
                print(f"❌ 登录失败: {response.text}")
                return None
        except Exception as e:
            print(f"❌ 登录失败: {e}")
            return None


async def test_get_users(token: str):
    """测试获取用户列表"""
    print("\n" + "=" * 60)
    print("测试获取用户列表")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(
                f"{BASE_URL}/api/v1/users",
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 获取用户列表成功")
                print(f"   用户数量: {len(data.get('items', []))}")
                return True
            else:
                print(f"❌ 获取用户列表失败: {response.text}")
                return False
        except Exception as e:
            print(f"❌ 获取用户列表失败: {e}")
            return False


async def test_get_tenants(token: str):
    """测试获取组织列表"""
    print("\n" + "=" * 60)
    print("测试获取组织列表")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(
                f"{BASE_URL}/api/v1/superadmin/tenants",
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 获取组织列表成功")
                print(f"   组织数量: {len(data.get('items', []))}")
                return True
            else:
                print(f"❌ 获取组织列表失败: {response.text}")
                return False
        except Exception as e:
            print(f"❌ 获取组织列表失败: {e}")
            return False


async def test_tenant_isolation(token: str, tenant_id: int):
    """测试多租户隔离"""
    print("\n" + "=" * 60)
    print(f"测试多租户隔离 (tenant_id={tenant_id})")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(
                f"{BASE_URL}/api/v1/users",
                headers=headers,
                params={"tenant_id": tenant_id}
            )
            print(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 多租户隔离测试成功")
                print(f"   用户数量: {len(data.get('items', []))}")
                # 验证所有用户都属于指定组织
                users = data.get('items', [])
                all_same_tenant = all(user.get('tenant_id') == tenant_id for user in users)
                if all_same_tenant:
                    print(f"✅ 所有用户都属于组织 {tenant_id}")
                else:
                    print(f"⚠️  警告：存在跨组织用户")
                return True
            else:
                print(f"❌ 多租户隔离测试失败: {response.text}")
                return False
        except Exception as e:
            print(f"❌ 多租户隔离测试失败: {e}")
            return False


async def main():
    """主测试函数"""
    print("=" * 60)
    print("API 接口功能测试")
    print("=" * 60)
    print(f"API 地址: {BASE_URL}")
    print()
    
    results = {
        "health_check": False,
        "superadmin_login": False,
        "user_login": False,
        "get_users": False,
        "get_tenants": False,
        "tenant_isolation": False
    }
    
    # 1. 测试健康检查
    results["health_check"] = await test_health_check()
    
    if not results["health_check"]:
        print("\n❌ 健康检查失败，请确保后端服务正在运行")
        print("   启动命令: python scripts/start_backend.py")
        return
    
    # 2. 测试超级管理员登录
    superadmin_token = await test_superadmin_login()
    if superadmin_token:
        results["superadmin_login"] = True
        
        # 3. 测试获取组织列表
        results["get_tenants"] = await test_get_tenants(superadmin_token)
    
    # 4. 测试普通用户登录
    user_token = await test_user_login(tenant_id=1)
    if user_token:
        results["user_login"] = True
        
        # 5. 测试获取用户列表
        results["get_users"] = await test_get_users(user_token)
        
        # 6. 测试多租户隔离
        results["tenant_isolation"] = await test_tenant_isolation(user_token, tenant_id=1)
    
    # 输出测试结果
    print("\n" + "=" * 60)
    print("测试结果总结")
    print("=" * 60)
    for test_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{test_name:20s}: {status}")
    
    total = len(results)
    passed = sum(1 for r in results.values() if r)
    print(f"\n总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！")
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败")


if __name__ == "__main__":
    asyncio.run(main())

