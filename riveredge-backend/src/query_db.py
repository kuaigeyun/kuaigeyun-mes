import asyncio
from pprint import pprint
import sys
from pathlib import Path

# Add src to sys.path
src_path = Path(__file__).parent
sys.path.insert(0, str(src_path))

from tortoise import Tortoise

async def init():
    from infra.config.database_config import TORTOISE_ORM
    await Tortoise.init(config=TORTOISE_ORM)

async def main():
    await init()
    from core.services.logging.login_log_service import LoginLogService
    from core.services.logging.online_user_service import OnlineUserService
    
    print("--- Login Log Stats ---")
    try:
        login_stats = await LoginLogService.get_login_log_stats(tenant_id=None)
        pprint(login_stats.model_dump())
    except Exception as e:
        print("Login stats error:", e)
    
    print("\n--- Online User Stats ---")
    try:
        # Check if it is get_statistics or get_online_user_statistics
        if hasattr(OnlineUserService, 'get_statistics'):
            online_stats = await OnlineUserService.get_statistics(tenant_id=None)
        else:
            online_stats = await OnlineUserService.get_online_user_statistics(tenant_id=None)
        pprint(online_stats.model_dump())
    except Exception as e:
        print("Online stats error:", e)
    
    await Tortoise.close_connections()

if __name__ == '__main__':
    asyncio.run(main())
