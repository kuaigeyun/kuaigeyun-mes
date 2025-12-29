#!/usr/bin/env python3
"""
测试500错误的具体原因
"""

import json
import urllib.request
import urllib.error


def get_auth_token():
    """获取认证token"""
    try:
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        json_data = json.dumps(login_data).encode('utf-8')
        req = urllib.request.Request(
            "http://localhost:8000/api/v1/auth/login",
            data=json_data,
            headers={'Content-Type': 'application/json'}
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            if response.getcode() == 200:
                response_data = json.loads(response.read().decode('utf-8'))
                token = response_data.get("data", {}).get("access_token")
                if token:
                    print("✅ 成功获取认证token")
                    return token

        print("❌ 获取token失败")
        return None

    except Exception as e:
        print(f"❌ 登录失败: {e}")
        return None


def test_user_creation_error():
    """测试用户创建时的500错误"""
    print("🔍 分析用户创建500错误")
    print("=" * 40)

    # 获取token
    token = get_auth_token()
    if not token:
        print("❌ 无法获取认证token")
        return False

    # 测试数据 - 只传递最基本的字段
    test_data = {
        "username": "test500",
        "password": "password123",
        "full_name": "测试500错误",
        "phone": "13800138000"
    }

    try:
        json_data = json.dumps(test_data).encode('utf-8')
        req = urllib.request.Request(
            "http://localhost:8000/api/v1/core/users",
            data=json_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}'
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                status_code = response.getcode()
                response_data = response.read().decode('utf-8')
                print(f"✅ 请求成功: HTTP {status_code}")
                print(f"响应: {response_data}")
                return True

        except urllib.error.HTTPError as e:
            status_code = e.code
            error_content = e.read().decode('utf-8')

            print(f"❌ 请求失败: HTTP {status_code}")

            try:
                error_data = json.loads(error_content)
                print(f"错误类型: {error_data.get('error', {}).get('code', 'Unknown')}")
                print(f"错误消息: {error_data.get('error', {}).get('message', 'Unknown')}")
                print(f"错误详情: {error_data.get('error', {}).get('details', {}).get('message', 'No details')}")

                # 如果是500错误，打印完整堆栈
                if status_code == 500:
                    print("\n🔍 500错误详情:")
                    print(error_content)

            except json.JSONDecodeError:
                print(f"无法解析错误响应: {error_content}")

            return False

    except Exception as e:
        print(f"❌ 网络异常: {e}")
        return False


def check_server_health():
    """检查服务器健康状态"""
    print("\n🏥 检查服务器健康状态")
    print("=" * 30)

    try:
        req = urllib.request.Request("http://localhost:8000/docs")
        with urllib.request.urlopen(req, timeout=10) as response:
            print(f"✅ 服务器运行正常: HTTP {response.getcode()}")
            return True
    except Exception as e:
        print(f"❌ 服务器连接失败: {e}")
        return False


if __name__ == "__main__":
    print("开始诊断用户创建500错误...\n")

    # 先检查服务器健康
    if not check_server_health():
        print("❌ 服务器不健康，无法继续测试")
        exit(1)

    # 测试用户创建
    if not test_user_creation_error():
        print("\n❌ 发现500错误，需要进一步调查")
        exit(1)
    else:
        print("\n✅ 用户创建正常")
        exit(0)
