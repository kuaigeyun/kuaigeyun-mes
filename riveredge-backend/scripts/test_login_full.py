"""
测试完整登录流程
"""
import asyncio
import sys
from pathlib import Path

src_path = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.infrastructure.database.database import TORTOISE_ORM
from soil.services.platform_superadmin_auth_service import PlatformSuperAdminAuthService
from soil.schemas.platform_superadmin import PlatformSuperAdminLoginRequest, PlatformSuperAdminLoginResponse

async def test_login_full():
    await Tortoise.init(config=TORTOISE_ORM)
    
    service = PlatformSuperAdminAuthService()
    login_data = PlatformSuperAdminLoginRequest(
        username='platform_admin',
        password='easthigh@1987'
    )
    
    try:
        result = await service.login(login_data)
        print('✅ 登录服务成功')
        print(f'   result 类型: {type(result)}')
        print(f'   result keys: {list(result.keys())}')
        print(f'   access_token 存在: {"access_token" in result}')
        print(f'   user 存在: {"user" in result}')
        if 'user' in result:
            user_data = result['user']
            print(f'   user 类型: {type(user_data)}')
            if isinstance(user_data, dict):
                print(f'   user keys: {list(user_data.keys())}')
                print(f'   user.uuid: {user_data.get("uuid", "(无)")}')
                print(f'   user.id: {user_data.get("id", "(无)")}')
        
        # 测试创建响应
        print(f'\n📋 测试创建 PlatformSuperAdminLoginResponse:')
        try:
            response = PlatformSuperAdminLoginResponse(**result)
            print(f'✅ 响应创建成功')
            print(f'   response.user.uuid: {response.user.uuid}')
            print(f'   response.user.id: {response.user.id}')
        except Exception as e:
            print(f'❌ 响应创建失败: {e}')
            import traceback
            traceback.print_exc()
            
    except Exception as e:
        print(f'❌ 登录服务失败: {e}')
        import traceback
        traceback.print_exc()
    
    await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_login_full())

