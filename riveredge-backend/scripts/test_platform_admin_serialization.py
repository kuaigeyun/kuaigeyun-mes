"""
测试平台超级管理员序列化
"""
import asyncio
import sys
from pathlib import Path

src_path = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from platform.models.platform_superadmin import PlatformSuperAdmin
from platform.infrastructure.database.database import TORTOISE_ORM
from platform.schemas.platform_superadmin import PlatformSuperAdminResponse

async def test_serialization():
    await Tortoise.init(config=TORTOISE_ORM)
    
    admin = await PlatformSuperAdmin.get_or_none(username='platform_admin')
    if not admin:
        print('❌ 平台超级管理员不存在')
        await Tortoise.close_connections()
        return
    
    print(f'✅ 找到管理员: {admin.username}')
    print(f'   ID: {admin.id}')
    print(f'   UUID: {getattr(admin, "uuid", None)}')
    print(f'   UUID 类型: {type(getattr(admin, "uuid", None))}')
    print(f'   UUID 值: {repr(getattr(admin, "uuid", None))}')
    
    # 检查所有字段
    print(f'\n📋 模型字段:')
    for field_name in admin._meta.fields_map.keys():
        value = getattr(admin, field_name, None)
        print(f'   {field_name}: {value} (类型: {type(value).__name__})')
    
    try:
        response = PlatformSuperAdminResponse.model_validate(admin)
        print(f'\n✅ 序列化成功')
        print(f'   Response UUID: {response.uuid}')
        print(f'   Response ID: {response.id}')
        print(f'   Response 所有字段: {list(response.model_fields.keys())}')
    except Exception as e:
        print(f'\n❌ 序列化失败: {e}')
        import traceback
        traceback.print_exc()
    
    await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_serialization())

