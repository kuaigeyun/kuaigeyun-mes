"""
测试前端API调用
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from soil.infrastructure.database.database import get_db_connection

# 手动实现JWT编码（避免依赖外部库）
import base64
import json
import hashlib
import hmac

def base64url_encode(data):
    """Base64URL编码"""
    if isinstance(data, str):
        data = data.encode('utf-8')
    encoded = base64.urlsafe_b64encode(data).decode('utf-8')
    return encoded.rstrip('=')

def create_jwt_header():
    """创建JWT头部"""
    header = {
        "alg": "HS256",
        "typ": "JWT"
    }
    return base64url_encode(json.dumps(header))

def create_jwt_payload(user_id: int, tenant_id: int):
    """创建JWT载荷"""
    import time
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "tenant_id": tenant_id,
        "exp": now + 3600,  # 1小时后过期
        "iat": now,
        "type": "access"
    }
    return base64url_encode(json.dumps(payload))

def create_jwt_signature(header: str, payload: str):
    """创建JWT签名"""
    from soil.config.platform_config import platform_settings
    message = f"{header}.{payload}"
    secret = platform_settings.JWT_SECRET_KEY.encode('utf-8')
    signature = hmac.new(secret, message.encode('utf-8'), hashlib.sha256).digest()
    return base64url_encode(signature)

def generate_jwt_token(user_id: int, tenant_id: int) -> str:
    """生成JWT Token"""
    header = create_jwt_header()
    payload = create_jwt_payload(user_id, tenant_id)
    signature = create_jwt_signature(header, payload)
    return f"{header}.{payload}.{signature}"

async def test_api_endpoint():
    """测试API端点"""
    token = generate_jwt_token(user_id=1, tenant_id=1)
    print(f"生成的测试Token: {token[:50]}...")

    import aiohttp

    async with aiohttp.ClientSession() as session:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        try:
            print("\n=== 测试部门树API ===")
            async with session.get(
                'http://localhost:9000/api/v1/system/departments/tree',
                headers=headers
            ) as response:
                print(f"状态码: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print("✅ API调用成功!")
                    if isinstance(data, dict) and 'items' in data:
                        print(f"返回部门数量: {len(data['items'])}")
                        if data['items']:
                            first_dept = data['items'][0]
                            print(f"第一个部门: {first_dept.get('name', 'N/A')} (UUID: {first_dept.get('uuid', 'N/A')[:8]}...)")
                            print(f"部门结构: {list(first_dept.keys())}")
                    else:
                        print(f"响应数据: {data}")
                else:
                    error_text = await response.text()
                    print(f"❌ API调用失败: {error_text}")

        except Exception as e:
            print(f"❌ 请求异常: {e}")

if __name__ == "__main__":
    asyncio.run(test_api_endpoint())
