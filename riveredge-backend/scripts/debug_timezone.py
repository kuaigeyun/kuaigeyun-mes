"""
调试时区配置问题
"""

import os
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

print("=== 环境变量检查 ===")
print(f"USE_TZ env: {os.environ.get('USE_TZ')}")
print(f"TIMEZONE env: {os.environ.get('TIMEZONE')}")

# 导入配置
from soil.config.platform_config import platform_settings, setup_tortoise_timezone_env

print("\n=== 平台配置（直接从类读取）===")
print(f"USE_TZ: {platform_settings.USE_TZ}")
print(f"TIMEZONE: {platform_settings.TIMEZONE}")

# 重新创建实例
from soil.config.platform_config import PlatformSettings
fresh_settings = PlatformSettings()
print("\n=== 重新创建的配置实例 ===")
print(f"USE_TZ: {fresh_settings.USE_TZ}")
print(f"TIMEZONE: {fresh_settings.TIMEZONE}")

# 调用setup函数
setup_tortoise_timezone_env()

print("\n=== setup函数调用后 ===")
print(f"USE_TZ env: {os.environ.get('USE_TZ')}")
print(f"TIMEZONE env: {os.environ.get('TIMEZONE')}")

# 导入Tortoise timezone
from tortoise import timezone as tz

print("\n=== Tortoise timezone (导入后) ===")
print(f"get_use_tz(): {tz.get_use_tz()}")
print(f"get_timezone(): {tz.get_timezone()}")

# 导入TORTOISE_ORM配置
from soil.infrastructure.database.database import TORTOISE_ORM

print("\n=== TORTOISE_ORM配置 ===")
print(f"use_tz: {TORTOISE_ORM.get('use_tz')}")
print(f"timezone: {TORTOISE_ORM.get('timezone')}")

# 检查server_settings
connections = TORTOISE_ORM.get('connections', {})
default_conn = connections.get('default', {})
credentials = default_conn.get('credentials', {})
server_settings = credentials.get('server_settings', {})

print("\n=== 数据库连接server_settings ===")
print(f"timezone: {server_settings.get('timezone')}")
