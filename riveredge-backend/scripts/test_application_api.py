import asyncio
import sys
import os
from pathlib import Path

# Windows 上 asyncio 的策略调整
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# 添加 src 到 sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))

# 加载环境变量
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from core.api.applications.applications import router
from core.api.deps.deps import get_current_tenant
from core.services.application.application_service import ApplicationService
import inspect

# Debug: Check ApplicationService.install_application signature
print("DEBUG: ApplicationService.install_application signature:")
try:
    sig = inspect.signature(ApplicationService.install_application)
    print(sig)
except Exception as e:
    print(f"Could not get signature: {e}")

from infra.infrastructure.database.database import register_db, get_db_connection

# 模拟依赖
async def mock_get_current_tenant():
    return 1

# 创建测试应用
app = FastAPI()
app.include_router(router)
app.dependency_overrides[get_current_tenant] = mock_get_current_tenant

client = TestClient(app)

async def test_api_flow():
    print("\n" + "="*50)
    print("Testing Application API Flow")
    print("="*50)
    
    # 1. Test Catalog
    print("\n1. Testing GET /applications/catalog")
    response = client.get("/applications/catalog")
    if response.status_code == 200:
        catalog = response.json()
        print(f"✅ Success! Found {len(catalog)} apps in catalog")
        for app in catalog:
            print(f"   - {app.get('name')} ({app.get('code')})")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")
        return

    # 2. Test Install
    app_code = "master-data"
    print(f"\n2. Testing POST /applications/install/{app_code}")
    
    # 清理可能存在的旧数据
    conn = await get_db_connection()
    await conn.execute("DELETE FROM core_applications WHERE code = $1 AND tenant_id = 1", app_code)
    
    response = client.post(f"/applications/install/{app_code}")
    if response.status_code == 201:
        installed_app = response.json()
        print(f"✅ Success! Installed app: {installed_app.get('name')}")
        print(f"   UUID: {installed_app.get('uuid')}")
        print(f"   Route Path: {installed_app.get('route_path')}")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")

    # 3. Verify in List
    print("\n3. Testing GET /applications")
    response = client.get("/applications")
    if response.status_code == 200:
        apps = response.json()
        found = any(a['code'] == app_code for a in apps)
        if found:
            print(f"✅ Success! App {app_code} found in list")
        else:
            print(f"❌ Failed! App {app_code} NOT found in list")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    # 需要初始化 DB
    async def main():
        # 这里只是为了建立连接池，不做完整的 Tortoise 初始化
        # 因为 ApplicationService 使用的是 asyncpg 直接连接
        # 但是 TestClient 是同步调用的，它会触发 API 里的异步代码
        # 我们需要在运行测试前确保数据库连接可用
        
        # 由于 ApplicationService 使用 get_db_connection 获取 asyncpg 连接
        # 我们需要在测试开始前初始化它（虽然 get_db_connection 会自动处理）
        pass

    # 运行测试
    # 注意：FastAPI 的 TestClient 支持异步端点，但它本身是同步调用的。
    # 为了在脚本中混合使用异步数据库操作和 TestClient，我们需要小心处理事件循环。
    # 这里为了简单，我们让 TestClient 处理 API 调用，而我们在外部使用 asyncio 处理数据库清理。
    
    asyncio.run(test_api_flow())
