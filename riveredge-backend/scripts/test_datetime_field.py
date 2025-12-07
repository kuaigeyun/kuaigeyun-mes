"""
测试 DatetimeField 的 to_db_value 方法
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

async def test_datetime_field():
    """测试 DatetimeField 的 to_db_value 方法"""
    # 确保时区配置正确
    TORTOISE_ORM["use_tz"] = platform_settings.USE_TZ
    TORTOISE_ORM["timezone"] = platform_settings.TIMEZONE
    
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 创建一个新实例（不保存）
        dept = Department(
            tenant_id=1,
            name="测试部门",
            code="TEST",
            is_active=True
        )
        
        print("=" * 60)
        print("测试 DatetimeField 的 to_db_value 方法")
        print("=" * 60)
        
        # 检查实例属性
        print(f"_saved_in_db: {hasattr(dept, '_saved_in_db')}")
        if hasattr(dept, '_saved_in_db'):
            print(f"_saved_in_db value: {dept._saved_in_db}")
        
        # 检查 created_at 和 updated_at 字段
        print(f"created_at: {getattr(dept, 'created_at', None)}")
        print(f"updated_at: {getattr(dept, 'updated_at', None)}")
        
        # 获取字段对象
        created_at_field = dept._meta.fields_map.get('created_at')
        updated_at_field = dept._meta.fields_map.get('updated_at')
        
        if created_at_field:
            print(f"\ncreated_at field type: {type(created_at_field)}")
            print(f"created_at field auto_now_add: {created_at_field.auto_now_add}")
            
            # 测试 to_db_value
            print("\n测试 created_at.to_db_value:")
            try:
                db_value = created_at_field.to_db_value(None, dept)
                print(f"  to_db_value(None, dept): {db_value}")
                print(f"  type: {type(db_value)}")
                if isinstance(db_value, datetime):
                    print(f"  tzinfo: {db_value.tzinfo}")
                    print(f"  tzinfo type: {type(db_value.tzinfo)}")
                    print(f"  is_aware: {tortoise_timezone.is_aware(db_value)}")
                    print(f"  is_naive: {tortoise_timezone.is_naive(db_value)}")
            except Exception as e:
                print(f"  ❌ 错误: {e}")
                import traceback
                traceback.print_exc()
        
        if updated_at_field:
            print(f"\nupdated_at field type: {type(updated_at_field)}")
            print(f"updated_at field auto_now: {updated_at_field.auto_now}")
            
            # 测试 to_db_value
            print("\n测试 updated_at.to_db_value:")
            try:
                db_value = updated_at_field.to_db_value(None, dept)
                print(f"  to_db_value(None, dept): {db_value}")
                print(f"  type: {type(db_value)}")
                if isinstance(db_value, datetime):
                    print(f"  tzinfo: {db_value.tzinfo}")
                    print(f"  tzinfo type: {type(db_value.tzinfo)}")
                    print(f"  is_aware: {tortoise_timezone.is_aware(db_value)}")
                    print(f"  is_naive: {tortoise_timezone.is_naive(db_value)}")
            except Exception as e:
                print(f"  ❌ 错误: {e}")
                import traceback
                traceback.print_exc()
        
        print("=" * 60)
        
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_datetime_field())











