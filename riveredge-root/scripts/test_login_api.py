"""
测试登录API

直接通过HTTP请求测试登录API
"""

import requests
import json

# API地址
API_BASE_URL = "http://localhost:8000/api/v1"

def test_login():
    """测试登录API"""
    print("=" * 60)
    print("测试登录API")
    print("=" * 60)
    
    # 测试数据
    login_data = {
        "username": "superadmin",
        "password": "SuperAdmin@2024"
    }
    
    print(f"请求URL: {API_BASE_URL}/auth/login")
    print(f"请求数据: {json.dumps(login_data, indent=2, ensure_ascii=False)}")
    print()
    
    try:
        # 发送POST请求
        response = requests.post(
            f"{API_BASE_URL}/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        print()
        
        # 解析响应
        try:
            response_data = response.json()
            print("响应数据:")
            print(json.dumps(response_data, indent=2, ensure_ascii=False))
        except:
            print("响应文本:")
            print(response.text)
        
        print()
        
        if response.status_code == 200:
            print("✅ 登录成功！")
            if "access_token" in response_data:
                print(f"   Token: {response_data['access_token'][:50]}...")
        else:
            print(f"❌ 登录失败 (状态码: {response.status_code})")
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务器")
        print("   请确保后端服务正在运行: python scripts/start_backend.py")
    except requests.exceptions.Timeout:
        print("❌ 请求超时")
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_login()

