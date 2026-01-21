"""
临时脚本：更新快格轻制造应用的数据库记录
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to sys.path
project_root = Path(__file__).resolve().parent / "riveredge-backend" / "src"
sys.path.insert(0, str(project_root))

from infra.infrastructure.database.database import register_db
from core.models.application import Application
from tortoise import Tortoise


async def main():
    # 注册数据库
    from fastapi import FastAPI
    app = FastAPI()
    await register_db(app)

    try:
        # 查找快格轻制造应用
        app_record = await Application.get_or_none(code="kuaizhizao")
        if app_record:
            print(f"找到应用记录: {app_record.name} (code: {app_record.code})")
            print(f"当前 route_path: {app_record.route_path}")

            # 更新 route_path
            app_record.route_path = "/apps/kuaizhizao"
            await app_record.save()

            print(f"✅ 已更新 route_path 为: {app_record.route_path}")
        else:
            print("❌ 未找到快格轻制造应用记录")

        # 查找基础数据管理应用
        master_data_app = await Application.get_or_none(code="master-data")
        if master_data_app:
            print(f"\n基础数据管理应用 route_path: {master_data_app.route_path}")
        else:
            print("\n❌ 未找到基础数据管理应用记录")

    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
