"""
测试部门API是否正常工作
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from platform.config.platform_config import platform_settings
from platform.infrastructure.database.database import get_db_connection, TORTOISE_ORM
from tortoise import Tortoise

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
        "alg": platform_settings.JWT_ALGORITHM,
        "typ": "JWT"
    }
    return base64url_encode(json.dumps(header))

def create_jwt_payload(user_id: int, tenant_id: int):
    """创建JWT载荷"""
    now = datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "tenant_id": tenant_id,
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
        "type": "access"
    }
    return base64url_encode(json.dumps(payload))

def create_jwt_signature(header: str, payload: str):
    """创建JWT签名"""
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

async def test_department_api():
    """测试部门API"""
    # 初始化数据库连接
    print("初始化数据库连接...")
    from platform.infrastructure.database.database import TORTOISE_ORM
    await Tortoise.init(config=TORTOISE_ORM)

    # 生成JWT Token
    token = generate_jwt_token(user_id=1, tenant_id=1)
    print(f"生成的JWT Token: {token[:50]}...")

    # 直接调用后端服务
    from core.services.department_service import DepartmentService

    try:
        print("\n=== 测试部门服务 ===")
        tree_data = await DepartmentService.get_department_tree(tenant_id=1, parent_id=None)
        print("✅ 部门服务调用成功!")
        print(f"部门数量: {len(tree_data)}")
        if tree_data:
            first_dept = tree_data[0]
            print(f"第一个部门: {first_dept.get('name', 'N/A')} (ID: {first_dept.get('id', 'N/A')})")

    except Exception as e:
        print(f"❌ 部门服务调用失败: {e}")
        import traceback
        traceback.print_exc()

    # 测试API路由（如果需要认证）
    print("\n=== 测试API路由 ===")
    try:
        from core.api.departments.departments import get_department_tree
        from platform.api.deps.deps import get_current_user
        from core.api.deps.deps import get_current_tenant
        from fastapi import Depends

        # 这里无法直接测试依赖注入，需要模拟
        print("API路由需要认证，无法直接测试")

    except Exception as e:
        print(f"API路由测试失败: {e}")
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_department_api())
