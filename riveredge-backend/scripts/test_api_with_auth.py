"""
测试系统级API是否能正确返回数据
"""

import asyncio
import sys
from pathlib import Path
import jwt
from datetime import datetime, timedelta

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from soil.config.platform_config import platform_settings

def generate_test_token(user_id: int = 1, tenant_id: int = 1) -> str:
    """生成测试JWT Token"""
    payload = {
        'sub': str(user_id),
        'tenant_id': tenant_id,
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow(),
        'type': 'access'
    }

    token = jwt.encode(payload, platform_settings.JWT_SECRET_KEY, algorithm=platform_settings.JWT_ALGORITHM)
    return token

async def test_department_api():
    """测试部门API"""
    import aiohttp

    token = generate_test_token()
    print(f"生成的测试Token: {token[:50]}...")

    async with aiohttp.ClientSession() as session:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        try:
            # 测试部门树API
            print("\n=== 测试部门树API ===")
            async with session.get(
                'http://localhost:9000/api/v1/system/departments/tree',
                headers=headers
            ) as response:
                print(f"状态码: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print("✅ API调用成功!")
                    print(f"返回数据类型: {type(data)}")
                    if isinstance(data, dict) and 'items' in data:
                        print(f"部门数量: {len(data['items'])}")
                        if data['items']:
                            print(f"第一个部门: {data['items'][0].get('name', 'N/A')}")
                    else:
                        print(f"响应数据: {data}")
                else:
                    error_text = await response.text()
                    print(f"❌ API调用失败: {error_text}")

        except Exception as e:
            print(f"❌ 请求异常: {e}")

if __name__ == "__main__":
    asyncio.run(test_department_api())
