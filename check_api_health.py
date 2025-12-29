#!/usr/bin/env python3
"""
API健康检查脚本

检查后端API是否正常运行
"""

import asyncio
import sys
import httpx
import time


async def check_api_health(base_url: str = "http://localhost:8000") -> bool:
    """检查API健康状态"""
    print(f"🔍 检查API健康状态: {base_url}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            start_time = time.time()

            # 检查健康检查端点
            response = await client.get(f"{base_url}/api/v1/core/health")

            elapsed = time.time() - start_time

            if response.status_code == 404:
                # 健康检查端点可能不存在，尝试其他端点
                print("⚠️ 健康检查端点不存在，尝试登录端点")

                login_response = await client.post(
                    f"{base_url}/api/v1/auth/login",
                    json={"username": "test", "password": "test"}
                )

                if login_response.status_code in [400, 401, 422]:
                    print(f"✅ API响应正常 (状态码: {login_response.status_code}) - {elapsed:.2f}s")
                    return True
                else:
                    print(f"❌ API响应异常 (状态码: {login_response.status_code})")
                    return False

            elif response.status_code == 200:
                print(f"✅ API健康检查通过 - {elapsed:.2f}s")
                return True
            else:
                print(f"❌ 健康检查失败 (状态码: {response.status_code})")
                print(f"   响应: {response.text[:200]}...")
                return False

    except httpx.ConnectError:
        print(f"❌ 连接失败: 无法连接到 {base_url}")
        return False
    except Exception as e:
        print(f"❌ 检查异常: {e}")
        return False


async def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

    print("🏥 API健康检查")
    print("=" * 30)

    if await check_api_health(base_url):
        print("\n✅ 后端API运行正常！")
        sys.exit(0)
    else:
        print("\n❌ 后端API存在问题！")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
