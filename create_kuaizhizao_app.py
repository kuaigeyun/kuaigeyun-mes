#!/usr/bin/env python3
"""
创建快格轻制造应用记录的脚本

用于在数据库中创建快格轻制造应用记录，使其显示在应用中心。
"""

import asyncio
import json
import uuid
from pathlib import Path

# 添加项目根目录到 Python 路径
import sys
sys.path.insert(0, str(Path(__file__).parent / "riveredge-backend" / "src"))

from tortoise import Tortoise
from core.models.application import Application
from infra.config.database_config import TORTOISE_ORM


async def create_kuaizhizao_app():
    """创建快格轻制造应用记录"""

    # 初始化数据库连接
    await Tortoise.init(
        config=TORTOISE_ORM
    )

    # 生成应用信息
    app_data = {
        "uuid": str(uuid.uuid4()),
        "tenant_id": 1,  # 默认租户ID
        "name": "快格轻制造",
        "code": "kuaizhizao",
        "description": "轻量级MES系统，专注生产执行核心流程",
        "icon": "production",
        "version": "1.0.0",
        "route_path": "/apps/kuaizhizao",
        "entry_point": "../apps/kuaizhizao/index.tsx",
        "menu_config": {
            "title": "快格轻制造",
            "icon": "production",
            "path": "/apps/kuaizhizao",
            "children": [
                {
                    "title": "生产执行",
                    "icon": "factory",
                    "sort_order": 1,
                    "children": [
                        {
                            "title": "工单管理",
                            "path": "/apps/kuaizhizao/production-execution/work-orders",
                            "permission": "kuaizhizao:work-order:view",
                            "sort_order": 1
                        },
                        {
                            "title": "报工管理",
                            "path": "/apps/kuaizhizao/production-execution/reporting",
                            "permission": "kuaizhizao:reporting:view",
                            "sort_order": 2
                        }
                    ]
                }
            ]
        },
        "permission_code": None,
        "is_system": False,
        "is_active": True,
        "is_installed": True,
        "sort_order": 980,
    }

    # 检查应用是否已存在
    existing_app = await Application.filter(code="kuaizhizao").first()
    if existing_app:
        print("✅ 快格轻制造应用已存在，更新配置...")
        # 更新现有应用
        await existing_app.update_from_dict(app_data)
        await existing_app.save()
        print("✅ 快格轻制造应用配置已更新")
    else:
        print("📝 创建快格轻制造应用...")
        # 创建新应用
        app = await Application.create(**app_data)
        print(f"✅ 快格轻制造应用创建成功，ID: {app.id}")

    # 关闭数据库连接
    await Tortoise.close_connections()


if __name__ == "__main__":
    print("🚀 开始创建快格轻制造应用记录...")
    asyncio.run(create_kuaizhizao_app())
    print("🎉 完成！")
