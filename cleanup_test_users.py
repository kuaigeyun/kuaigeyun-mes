#!/usr/bin/env python3
"""
清理测试用户数据脚本

删除测试过程中创建的用户数据
"""

import asyncio
import sys
import httpx


class TestDataCleaner:
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

    async def get_test_users(self) -> list:
        """获取测试用户列表"""
        try:
            response = await self.client.get(
                f"{self.base_url}/api/v1/core/users?page=1&page_size=100"
            )

            if response.status_code == 200:
                data = response.json()
                users = data.get("data", {}).get("items", [])

                # 过滤测试用户
                test_users = []
                for user in users:
                    username = user.get("username", "")
                    if (username.startswith("testuser") or
                        username.startswith("test_pwd_") or
                        username.startswith("测试用户") or
                        "测试" in username):
                        test_users.append(user)

                return test_users

            return []

        except Exception as e:
            print(f"获取用户列表失败: {e}")
            return []

    async def delete_user(self, user_id: int, username: str) -> bool:
        """删除指定用户"""
        try:
            response = await self.client.delete(
                f"{self.base_url}/api/v1/core/users/{user_id}"
            )

            if response.status_code == 200:
                print(f"✅ 删除用户: {username} (ID: {user_id})")
                return True
            else:
                print(f"❌ 删除用户失败: {username} (ID: {user_id}) - {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ 删除用户异常: {username} - {e}")
            return False

    async def cleanup(self):
        """清理测试数据"""
        print("🧹 开始清理测试用户数据")
        print("=" * 40)

        # 获取测试用户
        test_users = await self.get_test_users()

        if not test_users:
            print("ℹ️ 没有找到测试用户")
            return True

        print(f"找到 {len(test_users)} 个测试用户")

        deleted = 0
        for user in test_users:
            user_id = user.get("id")
            username = user.get("username")

            if user_id and await self.delete_user(user_id, username):
                deleted += 1

        print("=" * 40)
        print(f"📊 清理完成: {deleted}/{len(test_users)} 个用户已删除")

        return deleted == len(test_users)


async def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

    async with TestDataCleaner(base_url) as cleaner:
        if not await cleaner.login():
            print("❌ 登录失败，无法清理数据")
            sys.exit(1)

        success = await cleaner.cleanup()

        if success:
            print("\n✅ 测试数据清理完成！")
            sys.exit(0)
        else:
            print("\n⚠️ 测试数据清理部分失败！")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
