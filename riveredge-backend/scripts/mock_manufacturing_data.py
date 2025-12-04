"""
快速创建制造业 Mock 数据脚本

用于快速创建测试数据，自动查找第一个租户并初始化数据。

使用方法:
    python scripts/mock_manufacturing_data.py [--tenant-id TENANT_ID] [--force]
"""

import asyncio
import sys
import importlib.util
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 设置时区环境变量（必须在导入 Tortoise 之前）
from platform.config.platform_config import platform_settings, setup_tortoise_timezone_env
setup_tortoise_timezone_env()

from tortoise import Tortoise
from platform.infrastructure.database.database import TORTOISE_ORM
from platform.models.tenant import Tenant

# 导入初始化函数（使用相对导入）
import importlib.util
init_script_path = Path(__file__).parent / "init_manufacturing_default_data.py"
spec = importlib.util.spec_from_file_location("init_manufacturing_default_data", init_script_path)
init_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(init_module)
init_manufacturing_default_data = init_module.init_manufacturing_default_data


async def mock_data(tenant_id: int = None, force: bool = False):
    """
    创建 Mock 数据
    
    Args:
        tenant_id: 组织ID（如果为None，则使用第一个租户）
        force: 是否强制重新初始化
    """
    try:
        # 确保时区配置正确（动态更新）
        TORTOISE_ORM["use_tz"] = platform_settings.USE_TZ
        TORTOISE_ORM["timezone"] = platform_settings.TIMEZONE
        
        # 确保环境变量已设置（Tortoise ORM 从环境变量读取时区配置）
        import os
        os.environ["USE_TZ"] = str(platform_settings.USE_TZ)
        os.environ["TIMEZONE"] = platform_settings.TIMEZONE
        
        # 重新初始化时区环境（确保 Tortoise ORM 读取到最新配置）
        setup_tortoise_timezone_env()
        
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 如果没有指定租户ID，使用第一个租户
        if tenant_id is None:
            tenant = await Tenant.all().first()
            if not tenant:
                print("=" * 60)
                print("❌ 错误：未找到任何租户，请先创建租户")
                print("=" * 60)
                return
            tenant_id = tenant.id
            print("=" * 60)
            print(f"📋 使用租户: {tenant.name} (ID: {tenant_id})")
            print("=" * 60)
        else:
            # 验证租户是否存在
            tenant = await Tenant.filter(id=tenant_id).first()
            if not tenant:
                print("=" * 60)
                print(f"❌ 错误：租户 ID {tenant_id} 不存在")
                print("=" * 60)
                return
            print("=" * 60)
            print(f"📋 使用租户: {tenant.name} (ID: {tenant_id})")
            print("=" * 60)
        
        # 调用初始化函数
        await init_manufacturing_default_data(tenant_id, force)
        
    except Exception as e:
        print("=" * 60)
        print(f"❌ Mock 数据创建失败: {str(e)}")
        import traceback
        traceback.print_exc()
        print("=" * 60)
        raise
    finally:
        # 关闭连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="快速创建制造业 Mock 数据")
    parser.add_argument("--tenant-id", type=int, help="组织ID（可选，如果不指定则使用第一个租户）")
    parser.add_argument("--force", action="store_true", help="强制重新初始化")
    
    args = parser.parse_args()
    
    asyncio.run(mock_data(args.tenant_id, args.force))

