#!/usr/bin/env python3
"""
调试密码问题的详细脚本

逐步排查密码哈希问题的根本原因
"""

import asyncio
import json
import sys
import urllib.request
import urllib.error
import traceback
from typing import Dict, Any


class PasswordDebugger:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.token = None

    def step_by_step_debug(self):
        """逐步调试密码问题"""
        print("🔍 密码问题逐步调试")
        print("=" * 50)

        # 步骤1: 测试API连通性
        print("\n📡 步骤1: 测试API连通性")
        self.test_api_connectivity()

        # 步骤2: 测试认证
        print("\n🔐 步骤2: 测试认证")
        self.test_authentication()

        # 步骤3: 测试短密码
        print("\n📝 步骤3: 测试短密码（应该成功）")
        self.test_short_password()

        # 步骤4: 测试长密码
        print("\n📏 步骤4: 测试长密码（关键测试）")
        self.test_long_password()

        # 步骤5: 测试边界情况
        print("\n🎯 步骤5: 测试边界情况")
        self.test_boundary_cases()

        # 步骤6: 检查服务端配置
        print("\n📋 步骤6: 检查服务端配置")
        self.check_server_config()

    def test_api_connectivity(self):
        """测试API连通性"""
        try:
            req = urllib.request.Request(f"{self.base_url}/docs")
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.getcode() == 200:
                    print("✅ API服务可访问")
                    return True
                else:
                    print(f"❌ API服务响应异常: {response.getcode()}")
                    return False
        except Exception as e:
            print(f"❌ API连接失败: {e}")
            return False

    def test_authentication(self):
        """测试认证"""
        try:
            data = json.dumps({"username": "test", "password": "test"}).encode('utf-8')
            req = urllib.request.Request(
                f"{self.base_url}/api/v1/auth/login",
                data=data,
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                status_code = response.getcode()
                if status_code == 422:  # 验证错误，说明API正常
                    print("✅ 认证端点响应正常")
                    return True
                elif status_code == 401:
                    print("✅ 认证端点返回401（预期行为）")
                    return True
                else:
                    print(f"❌ 认证端点异常: {status_code}")
                    return False
        except urllib.error.HTTPError as e:
            if e.code in [401, 422]:
                print("✅ 认证端点响应正常")
                return True
            else:
                print(f"❌ 认证端点异常: {e.code}")
                return False
        except Exception as e:
            print(f"❌ 认证测试失败: {e}")
            return False

    async def test_short_password(self):
        """测试短密码"""
        test_data = {
            "username": "debug_short",
            "password": "short123",
            "full_name": "短密码测试",
            "phone": "13800138001",
            "email": "short@test.com"
        }

        return await self.send_user_request("短密码", test_data)

    async def test_long_password(self):
        """测试长密码"""
        long_password = "a" * 100  # 100字符密码
        test_data = {
            "username": "debug_long",
            "password": long_password,
            "full_name": "长密码测试",
            "phone": "13800138002",
            "email": "long@test.com"
        }

        print(f"密码长度: {len(long_password)} 字符 ({len(long_password.encode('utf-8'))} 字节)")
        return await self.send_user_request("长密码", test_data)

    async def test_boundary_cases(self):
        """测试边界情况"""
        test_cases = [
            ("72字符密码", "a" * 72),
            ("73字符密码", "a" * 73),
            ("UTF-8中文密码", "密码" * 20),  # 中文字符
            ("特殊字符密码", "!@#$%^&*()" * 10),
        ]

        for case_name, password in test_cases:
            test_data = {
                "username": f"debug_{case_name.replace(' ', '_').lower()}",
                "password": password,
                "full_name": f"{case_name}测试",
                "phone": f"13800138{len(password):03d}",
                "email": f"{case_name.lower().replace(' ', '_')}@test.com"
            }

            pwd_bytes = password.encode('utf-8')
            print(f"测试: {case_name} - {len(password)}字符 ({len(pwd_bytes)}字节)")
            await self.send_user_request(case_name, test_data)

    def send_user_request(self, test_name: str, data: Dict[str, Any]) -> bool:
        """发送用户创建请求"""
        try:
            json_data = json.dumps(data).encode('utf-8')
            req = urllib.request.Request(
                f"{self.base_url}/api/v1/core/users",
                data=json_data,
                headers={'Content-Type': 'application/json'}
            )

            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    status_code = response.getcode()
                    if status_code == 201:
                        print(f"✅ {test_name}: 创建成功")
                        return True
                    else:
                        print(f"❌ {test_name}: 失败 ({status_code})")
                        return False
            except urllib.error.HTTPError as e:
                status_code = e.code
                if status_code == 401:
                    print(f"⚠️ {test_name}: 需要认证 (先获取token)")
                    return False
                elif status_code >= 400:
                    print(f"❌ {test_name}: 失败 ({status_code})")
                    try:
                        error_content = e.read().decode('utf-8')
                        error_data = json.loads(error_content)
                        if "details" in error_data.get("error", {}):
                            details = error_data["error"]["details"]
                            if "password cannot be longer" in details.get("message", ""):
                                print("   🔍 发现目标错误: bcrypt长度限制")
                                print(f"   密码长度: {len(data['password'])} 字符")
                                print(f"   密码字节数: {len(data['password'].encode('utf-8'))} 字节")
                            else:
                                print(f"   错误详情: {details}")
                        else:
                            print(f"   原始响应: {error_content[:200]}...")
                    except:
                        print(f"   无法解析错误详情")
                    return False
                else:
                    print(f"❌ {test_name}: 异常HTTP错误 - {e}")
                    return False

        except Exception as e:
            print(f"❌ {test_name}: 异常 - {e}")
            return False

    async def check_server_config(self):
        """检查服务端配置"""
        print("服务端密码处理配置检查:")

        # 检查bcrypt配置
        try:
            from passlib.context import CryptContext

            # 模拟我们的配置
            bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            pbkdf2_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

            print("✅ bcrypt配置正常")
            print("✅ pbkdf2配置正常")

            # 测试哈希
            test_pwd = "a" * 80
            hash1 = bcrypt_context.hash(test_pwd)
            hash2 = pbkdf2_context.hash(test_pwd)

            print(f"✅ bcrypt哈希测试: {len(hash1)} 字符")
            print(f"✅ pbkdf2哈希测试: {len(hash2)} 字符")

        except Exception as e:
            print(f"❌ 配置检查失败: {e}")


async def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

    print(f"🔗 目标服务器: {base_url}")

    async with PasswordDebugger(base_url) as debugger:
        try:
            await debugger.step_by_step_debug()
        except Exception as e:
            print(f"\n💥 调试过程异常: {e}")
            traceback.print_exc()

    print("\n" + "=" * 50)
    print("🔍 调试完成")
    print("如果仍然出现'password cannot be longer than 72 bytes'错误,")
    print("请检查是否有其他地方还在使用旧的密码处理逻辑。")


if __name__ == "__main__":
    asyncio.run(main())
