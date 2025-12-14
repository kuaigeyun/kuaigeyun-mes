"""
测试 asyncpg 的 datetime 编码
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 设置时区环境变量
os.environ['USE_TZ'] = 'True'
os.environ['TIMEZONE'] = 'Asia/Shanghai'

from tortoise import timezone
import pytz
import asyncpg
from platform.config.platform_config import platform_settings

async def test_asyncpg_datetime():
    """测试 asyncpg 是否能正确处理 datetime"""
    # 测试 timezone.now() 返回的 datetime
    now = timezone.now()
    print('timezone.now():', now)
    print('tzinfo:', now.tzinfo)
    print('tzinfo type:', type(now.tzinfo))
    print('is_aware:', timezone.is_aware(now))
    
    # 连接到数据库
    conn = await asyncpg.connect(
        host='127.0.0.1',
        port=platform_settings.DB_PORT,
        user=platform_settings.DB_USER,
        password=platform_settings.DB_PASSWORD,
        database=platform_settings.DB_NAME,
        server_settings={'timezone': platform_settings.TIMEZONE}
    )
    
    try:
        # 测试 1: 直接传递 datetime 对象
        print('\n测试 1: 直接传递 datetime 对象')
        result = await conn.fetchval('SELECT $1::timestamptz', now)
        print('✅ asyncpg 可以正确处理 datetime:', result)
        print('result type:', type(result))
        print('result tzinfo:', result.tzinfo if hasattr(result, 'tzinfo') else 'N/A')
        
        # 测试 2: 使用 pytz.utc
        print('\n测试 2: 使用 pytz.utc')
        dt_utc = datetime.now(tz=pytz.utc)
        result2 = await conn.fetchval('SELECT $1::timestamptz', dt_utc)
        print('✅ asyncpg 可以正确处理 pytz.utc datetime:', result2)
        
        # 测试 3: 检查数据库时区
        print('\n测试 3: 检查数据库时区')
        db_tz = await conn.fetchval("SHOW TIMEZONE")
        print('数据库时区:', db_tz)
        
    except Exception as e:
        print('❌ asyncpg 处理 datetime 时出错:', e)
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(test_asyncpg_datetime())























