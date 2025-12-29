#!/usr/bin/env python3
"""
简单的用户创建测试脚本

使用标准库测试用户创建功能
"""

import json
import sys
import subprocess
from typing import Dict, Any


def run_curl_test(test_name: str, method: str, url: str, headers: Dict[str, str] = None, data: Dict[str, Any] = None) -> bool:
    """运行curl测试"""
    print(f"\n🧪 {test_name}")

    cmd = ["curl", "-s", "-X", method, url]

    if headers:
        for key, value in headers.items():
            cmd.extend(["-H", f"{key}: {value}"])

    if data:
        cmd.extend(["-H", "Content-Type: application/json"])
        cmd.extend(["-d", json.dumps(data)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            try:
                response_data = json.loads(result.stdout)
                status_code = response_data.get("status_code", 200)
            except:
                # 如果不是JSON响应，检查HTTP状态码
                if "201" in result.stdout or "success" in result.stdout.lower():
                    status_code = 201
                elif "400" in result.stdout or "error" in result.stdout.lower():
                    status_code = 400
                else:
                    status_code = 200

            if status_code == 201:
                print(f"✅ {test_name}: 成功")
                return True
            else:
                print(f"❌ {test_name}: 失败 (状态码: {status_code})")
                print(f"   响应: {result.stdout[:200]}...")
                return False
        else:
            print(f"❌ {test_name}: curl命令失败")
            return False

    except subprocess.TimeoutExpired:
        print(f"❌ {test_name}: 请求超时")
        return False
    except Exception as e:
        print(f"❌ {test_name}: 异常 - {e}")
        return False


def test_user_creation():
    """测试用户创建功能"""
    base_url = "http://localhost:8000"
    if len(sys.argv) > 1:
        base_url = sys.argv[1]

    print(f"🔗 测试服务器: {base_url}")
    print("=" * 50)

    # 注意：这个简单测试需要先手动获取token
    # 在实际使用时，需要先登录获取token
    token = input("请输入管理员token (Bearer token): ").strip()

    if not token:
        print("❌ 未提供token，使用示例token测试API结构")
        token = "example_token"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 测试用例
    test_cases = [
        ("正常用户创建", "POST", f"{base_url}/api/v1/core/users", headers, {
            "username": "testuser001",
            "password": "password123456",
            "full_name": "测试用户001",
            "phone": "13800138001",
            "email": "test001@example.com"
        }),

        ("超长密码测试", "POST", f"{base_url}/api/v1/core/users", headers, {
            "username": "testuser002",
            "password": "a" * 100,  # 100字符密码
            "full_name": "测试用户002",
            "phone": "13800138002",
            "email": "test002@example.com"
        }),

        ("密码过短测试", "POST", f"{base_url}/api/v1/core/users", headers, {
            "username": "testuser003",
            "password": "123",  # 3字符，过短
            "full_name": "测试用户003",
            "phone": "13800138003",
            "email": "test003@example.com"
        }),

        ("无效电话号码", "POST", f"{base_url}/api/v1/core/users", headers, {
            "username": "testuser004",
            "password": "password123",
            "full_name": "测试用户004",
            "phone": "123456789",  # 无效格式
            "email": "test004@example.com"
        }),

        ("重复用户名", "POST", f"{base_url}/api/v1/core/users", headers, {
            "username": "testuser001",  # 重复
            "password": "password123",
            "full_name": "重复用户",
            "phone": "13800138005",
            "email": "test005@example.com"
        }),
    ]

    passed = 0
    total = len(test_cases)

    for test_name, method, url, headers, data in test_cases:
        if run_curl_test(test_name, method, url, headers, data):
            passed += 1

    print("\n" + "=" * 50)
    print(f"📊 测试结果: {passed}/{total} 通过")

    if passed == total:
        print("🎉 所有测试通过！")
        return True
    else:
        print(f"⚠️  {total - passed} 个测试失败")
        return False


if __name__ == "__main__":
    try:
        success = test_user_creation()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🛑 测试被用户中断")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 测试脚本异常: {e}")
        sys.exit(1)
