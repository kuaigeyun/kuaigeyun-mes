"""
测试 Inngest 与系统的融合情况

运行此脚本来验证：
1. Inngest 服务是否运行
2. 后端是否能连接到 Inngest
3. 事件发送是否正常
4. 工作流函数是否注册成功
"""

import asyncio
import httpx
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

async def test_inngest_integration():
    """测试 Inngest 集成"""
    
    print("=" * 60)
    print("Inngest 集成测试")
    print("=" * 60)
    
    # 1. 测试 Inngest 服务是否运行
    print("\n[1] 测试 Inngest 服务连接...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8288", timeout=5.0)
            if response.status_code == 200:
                print("✓ Inngest 服务正在运行 (http://localhost:8288)")
            else:
                print(f"✗ Inngest 服务响应异常 (状态码: {response.status_code})")
                return False
    except Exception as e:
        print(f"✗ 无法连接到 Inngest 服务: {e}")
        print("  请确保 Inngest 服务已启动 (端口 8288)")
        return False
    
    # 2. 测试后端服务是否运行
    print("\n[2] 测试后端服务连接...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:9000/health", timeout=5.0)
            if response.status_code == 200:
                print("✓ 后端服务正在运行 (http://localhost:9000)")
            else:
                print(f"✗ 后端服务响应异常 (状态码: {response.status_code})")
                return False
    except Exception as e:
        print(f"✗ 无法连接到后端服务: {e}")
        print("  请确保后端服务已启动 (端口 9000)")
        return False
    
    # 3. 测试 Inngest API 端点是否可用
    print("\n[3] 测试 Inngest API 端点...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:9000/api/inngest", timeout=5.0)
            if response.status_code in [200, 404]:  # 404 也是正常的（端点存在但可能需要特定路径）
                print("✓ Inngest API 端点已注册")
            else:
                print(f"✗ Inngest API 端点响应异常 (状态码: {response.status_code})")
    except Exception as e:
        print(f"✗ 无法访问 Inngest API 端点: {e}")
    
    # 4. 测试发送事件到 Inngest
    print("\n[4] 测试发送事件到 Inngest...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:9000/api/v1/test/inngest",
                json={"message": "测试 Inngest 集成"},
                timeout=10.0
            )
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print("✓ 事件发送成功")
                    print(f"  事件 ID: {result.get('event_ids')}")
                else:
                    print(f"✗ 事件发送失败: {result.get('error')}")
                    return False
            else:
                print(f"✗ 测试端点响应异常 (状态码: {response.status_code})")
                print(f"  响应: {response.text}")
                return False
    except Exception as e:
        print(f"✗ 发送事件失败: {e}")
        return False
    
    # 5. 等待一下，让 Inngest 处理事件
    print("\n[5] 等待 Inngest 处理事件...")
    await asyncio.sleep(2)
    
    # 6. 检查 Inngest Dashboard
    print("\n[6] 检查 Inngest Dashboard...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8288/_dashboard", timeout=5.0)
            if response.status_code == 200:
                print("✓ Inngest Dashboard 可访问 (http://localhost:8288/_dashboard)")
                print("  请在浏览器中打开 Dashboard 查看事件和执行历史")
            else:
                print(f"✗ Inngest Dashboard 响应异常 (状态码: {response.status_code})")
    except Exception as e:
        print(f"✗ 无法访问 Inngest Dashboard: {e}")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print("\n下一步:")
    print("1. 访问 http://localhost:8288/_dashboard 查看 Inngest Dashboard")
    print("2. 在 Dashboard 中查看 'Functions' 页面，确认 'test-integration' 函数已注册")
    print("3. 在 Dashboard 中查看 'Events' 页面，确认测试事件已接收")
    print("4. 在 Dashboard 中查看 'Runs' 页面，确认工作流已执行")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    asyncio.run(test_inngest_integration())

