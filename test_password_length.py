#!/usr/bin/env python3
"""
密码长度测试脚本

专门测试bcrypt密码长度限制的修复情况
"""

import asyncio
import sys
import httpx
from typing import Dict, Any


class PasswordLengthTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def login(self, username: str = "admin", password: str = "admin123") -> bool:
        """登录获取token"""
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
                    return True

            return False
        except:
            return False

    async def test_password_length(self, length: int) -> bool:
        """测试指定长度的密码"""
        username = f"test_pwd_{length}"
        password = "a" * length  # 生成指定长度的密码

        user_data = {
            "username": username,
            "password": password,
            "full_name": f"密码长度测试{length}",
            "phone": f"1380013{str(length).zfill(4)}",
            "email": f"test{length}@example.com"
        }

        try:
            response = await self.client.post(
                f"{self.base_url}/api/v1/core/users",
                json=user_data
            )

            if response.status_code == 201:
                print(f"✅ 密码长度 {length} 字符: 成功")
                return True
            else:
                print(f"❌ 密码长度 {length} 字符: 失败 ({response.status_code})")
                print(f"   错误: {response.text[:200]}...")
                return False

        except Exception as e:
            print(f"❌ 密码长度 {length} 字符: 异常 - {e}")
            return False

    async def run_tests(self):
        """运行密码长度测试"""
        print("🔐 密码长度测试开始")
        print("=" * 40)

        # 测试不同长度的密码
        test_lengths = [1, 7, 8, 50, 72, 73, 100, 200, 500]

        passed = 0
        total = len(test_lengths)

        # 短密码应该失败（最小8字符）
        should_fail_lengths = [1, 7]

        for length in test_lengths:
            expected_success = length not in should_fail_lengths
            if await self.test_password_length(length) == expected_success:
                passed += 1
            else:
                print(f"   期望: {'成功' if expected_success else '失败'}")

        print("=" * 40)
        print(f"📊 测试结果: {passed}/{total} 通过")

        if passed == total:
            print("🎉 密码长度处理完全正确！")
            return True
        else:
            print("⚠️ 密码长度处理存在问题")
            return False


async def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

    async with PasswordLengthTester(base_url) as tester:
        if not await tester.login():
            print("❌ 登录失败，无法进行测试")
            sys.exit(1)

        success = await tester.run_tests()

        if success:
            print("\n✅ 密码长度测试通过！bcrypt正确处理各种长度的密码")
            sys.exit(0)
        else:
            print("\n❌ 密码长度测试失败！")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
