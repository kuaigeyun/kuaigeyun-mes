"""
测试 executor 的 execute_insert 方法
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 设置时区环境变量（必须在导入 Tortoise 之前）
os.environ['USE_TZ'] = 'True'
os.environ['TIMEZONE'] = 'Asia/Shanghai'

from platform.config.platform_config import setup_tortoise_timezone_env, platform_settings
setup_tortoise_timezone_env()

from tortoise import Tortoise
from tortoise import timezone as tortoise_timezone
from platform.infrastructure.database.database import TORTOISE_ORM
from core.models.department import Department

async def test_executor_insert():
    """测试 executor 的 execute_insert 方法"""
    # 确保时区配置正确
    TORTOISE_ORM["use_tz"] = platform_settings.USE_TZ
    TORTOISE_ORM["timezone"] = platform_settings.TIMEZONE
    
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 创建一个新实例
        dept = Department(
            tenant_id=1,
            name="测试部门",
            code="TEST_EXEC",
            is_active=True
        )
        
        print("=" * 60)
        print("测试 executor 的 execute_insert 方法")
        print("=" * 60)
        
        # 获取 executor
        db = dept._choose_db(True)
        executor = db.executor_class(model=Department, db=db)
        
        # 检查 column_map
        print("\n检查 column_map:")
        for field_name in executor.regular_columns:
            field_object = Department._meta.fields_map[field_name]
            column_func = executor.column_map.get(field_name)
            print(f"  {field_name}: {type(column_func)}")
            
            # 测试 column_func
            if column_func:
                try:
                    value = getattr(dept, field_name, None)
                    db_value = column_func(value, dept)
                    print(f"    value: {value}")
                    print(f"    db_value: {db_value}")
                    print(f"    db_value type: {type(db_value)}")
                    if isinstance(db_value, datetime):
                        print(f"    db_value tzinfo: {db_value.tzinfo}")
                        print(f"    db_value tzinfo type: {type(db_value.tzinfo)}")
                        print(f"    is_aware: {tortoise_timezone.is_aware(db_value)}")
                        print(f"    is_naive: {tortoise_timezone.is_naive(db_value)}")
                except Exception as e:
                    print(f"    ❌ 错误: {e}")
                    import traceback
                    traceback.print_exc()
        
        print("=" * 60)
        
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_executor_insert())











