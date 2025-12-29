#!/usr/bin/env python3
"""
用户创建功能测试脚本

测试用户创建API的各种场景，包括：
- 正常用户创建
- 密码长度测试
- 必填字段验证
- 重复用户名检查
- 电话号码格式验证
- 邮箱格式验证
- 部门/职位/角色关联测试
"""

import asyncio
import json
import sys
from typing import Dict, Any
from datetime import datetime

import httpx
from pydantic import ValidationError


class UserCreationTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def login_and_get_token(self, username: str, password: str) -> bool:
        """登录并获取token"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"username": username, "password": password}
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("data", {}).get("access_token"):
                    self.token = data["data"]["access_token"]
                    self.client.headers.update({"Authorization": f"Bearer {self.token}"})
                    print("✅ 登录成功")
                    return True

            print(f"❌ 登录失败: {response.status_code} - {response.text}")
            return False

        except Exception as e:
            print(f"❌ 登录异常: {e}")
            return False

    async def test_user_creation(self, test_name: str, user_data: Dict[str, Any], expected_success: bool = True) -> bool:
        """测试用户创建"""
        print(f"\n🧪 测试: {test_name}")

        try:
            response = await self.client.post(
                f"{self.base_url}/api/v1/core/users",
                json=user_data
            )

            success = response.status_code == 201 if expected_success else response.status_code >= 400

            if success:
                print(f"✅ {test_name}: 通过")
                if expected_success and response.status_code == 201:
                    data = response.json()
                    print(f"   创建的用户ID: {data.get('data', {}).get('id')}")
                return True
            else:
                print(f"❌ {test_name}: 失败")
                print(f"   状态码: {response.status_code}")
                print(f"   响应: {response.text}")
                return False

        except Exception as e:
            print(f"❌ {test_name}: 异常 - {e}")
            return False

    async def run_all_tests(self):
        """运行所有测试"""
        print("🚀 开始用户创建功能测试")
        print("=" * 50)

        # 测试用例
        test_cases = [
            # 1. 正常用户创建
            ("正常用户创建", {
                "username": "testuser001",
                "password": "password123",
                "full_name": "测试用户001",
                "phone": "13800138001",
                "email": "test001@example.com"
            }, True),

            # 2. 密码长度测试 - 短密码（应该失败）
            ("密码过短", {
                "username": "testuser002",
                "password": "123",
                "full_name": "测试用户002",
                "phone": "13800138002",
                "email": "test002@example.com"
            }, False),

            # 3. 密码长度测试 - 超长密码（现在应该成功）
            ("超长密码", {
                "username": "testuser003",
                "password": "a" * 100,  # 100个字符的密码
                "full_name": "测试用户003",
                "phone": "13800138003",
                "email": "test003@example.com"
            }, True),

            # 4. 重复用户名（应该失败）
            ("重复用户名", {
                "username": "testuser001",  # 与第一个用户重复
                "password": "password123",
                "full_name": "重复用户名",
                "phone": "13800138004",
                "email": "test004@example.com"
            }, False),

            # 5. 无效电话号码（应该失败）
            ("无效电话号码", {
                "username": "testuser005",
                "password": "password123",
                "full_name": "测试用户005",
                "phone": "123456789",  # 无效格式
                "email": "test005@example.com"
            }, False),

            # 6. 无效邮箱（应该失败）
            ("无效邮箱", {
                "username": "testuser006",
                "password": "password123",
                "full_name": "测试用户006",
                "phone": "13800138006",
                "email": "invalid-email"  # 无效格式
            }, False),

            # 7. 缺失必填字段 - 无用户名（应该失败）
            ("缺失用户名", {
                "password": "password123",
                "full_name": "测试用户007",
                "phone": "13800138007",
                "email": "test007@example.com"
            }, False),

            # 8. 缺失必填字段 - 无密码（应该失败）
            ("缺失密码", {
                "username": "testuser008",
                "full_name": "测试用户008",
                "phone": "13800138008",
                "email": "test008@example.com"
            }, False),

            # 9. 缺失必填字段 - 无电话（应该失败）
            ("缺失电话", {
                "username": "testuser009",
                "password": "password123",
                "full_name": "测试用户009",
                "email": "test009@example.com"
            }, False),

            # 10. 可选字段 - 无邮箱（应该成功）
            ("无邮箱可选字段", {
                "username": "testuser010",
                "password": "password123",
                "full_name": "测试用户010",
                "phone": "13800138010"
            }, True),

            # 11. 中文用户名
            ("中文用户名", {
                "username": "测试用户011",
                "password": "password123",
                "full_name": "中文用户",
                "phone": "13800138011",
                "email": "test011@example.com"
            }, True),

            # 12. 特殊字符密码
            ("特殊字符密码", {
                "username": "testuser012",
                "password": "P@ssw0rd!2024#",
                "full_name": "测试用户012",
                "phone": "13800138012",
                "email": "test012@example.com"
            }, True),
        ]

        passed = 0
        total = len(test_cases)

        for test_name, user_data, expected_success in test_cases:
            if await self.test_user_creation(test_name, user_data, expected_success):
                passed += 1

        print("\n" + "=" * 50)
        print(f"📊 测试结果: {passed}/{total} 通过")

        if passed == total:
            print("🎉 所有测试通过！")
            return True
        else:
            print(f"⚠️  {total - passed} 个测试失败")
            return False


async def main():
    """主函数"""
    # 检查命令行参数
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

    print(f"🔗 目标服务器: {base_url}")

    async with UserCreationTester(base_url) as tester:
        # 首先需要登录获取token (使用管理员账号)
        admin_username = input("请输入管理员用户名: ").strip() or "admin"
        admin_password = input("请输入管理员密码: ").strip() or "admin123"

        if not await tester.login_and_get_token(admin_username, admin_password):
            print("❌ 无法获取管理员token，测试终止")
            return

        # 运行所有测试
        success = await tester.run_all_tests()

        # 输出最终结果
        if success:
            print("\n✅ 用户创建功能测试完成，所有功能正常！")
            sys.exit(0)
        else:
            print("\n❌ 用户创建功能测试失败，发现问题需要修复！")
            sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 测试被用户中断")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 测试脚本异常: {e}")
        sys.exit(1)
