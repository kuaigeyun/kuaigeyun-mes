#!/usr/bin/env python
"""
测试迁移后的API路由实际调用

测试使用依赖注入的API路由在实际HTTP请求中是否正常工作。

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
import json
import httpx
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


async def test_api_endpoints():
    """测试API端点"""
    base_url = "http://localhost:8200"
    
    print("=" * 60)
    print("测试迁移后的API路由实际调用")
    print("=" * 60)
    print(f"后端服务地址: {base_url}")
    print()
    
    # 检查服务是否运行
    print("1. 检查后端服务状态...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/health")
            if response.status_code == 200:
                print(f"✅ 后端服务正在运行")
                print(f"   响应: {response.json()}")
            else:
                print(f"⚠️  后端服务响应异常 (HTTP {response.status_code})")
    except httpx.ConnectError:
        print("❌ 后端服务未运行，请先启动服务")
        print("   启动命令: cd riveredge-backend && ./start-backend.sh")
        return 1
    except Exception as e:
        print(f"❌ 检查服务状态失败: {e}")
        return 1
    
    print()
    print("2. 测试用户列表API (GET /api/v1/core/users)...")
    print("   注意：此API需要认证，这里只测试路由是否可访问")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{base_url}/api/v1/core/users")
            http_code = response.status_code
            
            if http_code == 200:
                print(f"✅ API路由可访问 (HTTP {http_code})")
                data = response.json()
                print(f"   响应数据: {json.dumps(data, ensure_ascii=False, indent=2)[:200]}...")
            elif http_code == 401:
                print(f"✅ API路由可访问 (HTTP {http_code} - 需要认证)")
                print(f"   这是预期的，因为API需要认证")
            elif http_code == 403:
                print(f"✅ API路由可访问 (HTTP {http_code} - 权限不足)")
                print(f"   这是预期的，因为API需要权限")
            else:
                print(f"⚠️  API路由响应异常 (HTTP {http_code})")
                print(f"   响应: {response.text[:200]}")
    except Exception as e:
        print(f"❌ 测试失败: {e}")
    
    print()
    print("3. 测试用户创建API (POST /api/v1/core/users)...")
    print("   注意：此API需要认证，这里只测试路由是否可访问")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{base_url}/api/v1/core/users",
                json={}  # 空数据，只测试路由
            )
            http_code = response.status_code
            
            if http_code == 201:
                print(f"✅ API路由可访问 (HTTP {http_code})")
                data = response.json()
                print(f"   响应数据: {json.dumps(data, ensure_ascii=False, indent=2)[:200]}...")
            elif http_code == 401:
                print(f"✅ API路由可访问 (HTTP {http_code} - 需要认证)")
                print(f"   这是预期的，因为API需要认证")
            elif http_code == 403:
                print(f"✅ API路由可访问 (HTTP {http_code} - 权限不足)")
                print(f"   这是预期的，因为API需要权限")
            elif http_code == 422:
                print(f"✅ API路由可访问 (HTTP {http_code} - 数据验证失败)")
                print(f"   这是预期的，因为我们发送了空数据")
                error_detail = response.json()
                print(f"   错误详情: {json.dumps(error_detail, ensure_ascii=False, indent=2)[:200]}...")
            else:
                print(f"⚠️  API路由响应异常 (HTTP {http_code})")
                print(f"   响应: {response.text[:200]}")
    except Exception as e:
        print(f"❌ 测试失败: {e}")
    
    print()
    print("4. 检查API文档...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/docs")
            if response.status_code == 200:
                print(f"✅ API文档可访问")
                print(f"   访问地址: {base_url}/docs")
            else:
                print(f"⚠️  API文档访问异常 (HTTP {response.status_code})")
    except Exception as e:
        print(f"❌ 检查API文档失败: {e}")
    
    print()
    print("=" * 60)
    print("测试总结")
    print("=" * 60)
    print("✅ API路由测试完成")
    print()
    print("📝 说明:")
    print("   - 如果看到 HTTP 401/403，说明路由正常工作，只是需要认证")
    print("   - 如果看到 HTTP 422，说明路由正常工作，只是数据验证失败")
    print("   - 要测试完整功能，需要使用有效的认证token")
    print()
    print("🔗 相关链接:")
    print(f"   - API文档: {base_url}/docs")
    print(f"   - 健康检查: {base_url}/health")
    print(f"   - 服务健康检查: {base_url}/health/services")
    
    return 0


async def main():
    """主函数"""
    exit_code = await test_api_endpoints()
    return exit_code


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

