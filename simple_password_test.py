#!/usr/bin/env python3
"""
简单密码测试脚本

专门测试bcrypt密码长度问题
"""

import json
import urllib.request
import urllib.error


def test_password_issue(base_url="http://localhost:8000"):
    """测试密码问题"""
    print("🔐 密码长度问题诊断")
    print("=" * 40)

    # 测试长密码
    long_password = "a" * 100
    test_data = {
        "username": "pwd_test_user",
        "password": long_password,
        "full_name": "密码测试用户",
        "phone": "13800138000",
        "email": "pwdtest@example.com"
    }

    print(f"测试密码长度: {len(long_password)} 字符")
    print(f"测试密码字节数: {len(long_password.encode('utf-8'))} 字节")

    try:
        json_data = json.dumps(test_data).encode('utf-8')
        req = urllib.request.Request(
            f"{base_url}/api/v1/core/users",
            data=json_data,
            headers={'Content-Type': 'application/json'}
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                status_code = response.getcode()
                print(f"✅ 请求成功: HTTP {status_code}")
                return True

        except urllib.error.HTTPError as e:
            status_code = e.code
            print(f"❌ 请求失败: HTTP {status_code}")

            try:
                error_content = e.read().decode('utf-8')
                error_data = json.loads(error_content)

                error_details = error_data.get("error", {}).get("details", {})
                error_message = error_details.get("message", "")

                if "password cannot be longer than 72 bytes" in error_message:
                    print("🔍 发现目标错误: bcrypt 72字节限制")
                    print(f"📝 错误信息: {error_message}")
                    print("💡 分析: 这表明bcrypt库本身抛出了长度限制错误")
                    return False
                else:
                    print(f"📝 其他错误: {error_message}")
                    return False

            except Exception as parse_error:
                print(f"📝 无法解析错误详情: {parse_error}")
                print(f"📄 原始错误内容: {error_content[:200]}...")
                return False

    except Exception as e:
        print(f"❌ 网络异常: {e}")
        return False


def analyze_bcrypt_behavior():
    """分析bcrypt行为"""
    print("\n🔬 bcrypt行为分析")
    print("=" * 30)

    try:
        from passlib.context import CryptContext

        # 测试不同的上下文
        contexts = {
            "bcrypt": CryptContext(schemes=["bcrypt"], deprecated="auto"),
            "pbkdf2": CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto"),
        }

        test_passwords = ["short", "a" * 72, "a" * 73, "a" * 100]

        for ctx_name, ctx in contexts.items():
            print(f"\n{ctx_name.upper()} 测试:")
            for pwd in test_passwords:
                pwd_bytes = len(pwd.encode('utf-8'))
                try:
                    hash_result = ctx.hash(pwd)
                    print(f"  ✅ {pwd_bytes:3d} 字节: 成功 ({len(hash_result)} 字符哈希)")
                except Exception as e:
                    print(f"  ❌ {pwd_bytes:3d} 字节: 失败 - {e}")

    except ImportError:
        print("❌ 无法导入passlib，跳过bcrypt分析")


if __name__ == "__main__":
    import sys
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

    print(f"目标服务器: {base_url}")

    # 测试密码问题
    success = test_password_issue(base_url)

    # 分析bcrypt行为
    analyze_bcrypt_behavior()

    print("\n" + "=" * 40)
    if success:
        print("✅ 密码长度问题已修复！")
    else:
        print("❌ 密码长度问题仍然存在")
        print("💡 建议检查:")
        print("   1. 后端是否使用正确的bcrypt配置")
        print("   2. 是否有其他地方还在主动检查密码长度")
        print("   3. 检查依赖版本是否正确")
