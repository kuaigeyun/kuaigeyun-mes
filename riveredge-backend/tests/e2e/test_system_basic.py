"""
系统基础功能验证测试

验证系统的基本功能是否正常，包括：
- API路由是否正常
- 数据库连接是否正常
- 基础模型是否正常

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import pytest
import sys
from pathlib import Path
from httpx import AsyncClient

# 添加src目录到路径
backend_root = Path(__file__).parent.parent.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from server.main import app
from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


@pytest.mark.asyncio
async def test_app_initialization():
    """测试应用初始化"""
    assert app is not None
    assert hasattr(app, 'routes')
    print("✅ 应用初始化正常")


@pytest.mark.asyncio
async def test_database_connection():
    """测试数据库连接"""
    try:
        config = TORTOISE_ORM.copy()
        if "routers" not in config.get("apps", {}).get("models", {}):
            config.setdefault("apps", {}).setdefault("models", {})["routers"] = []
        
        await Tortoise.init(config=config)
        
        # 尝试执行一个简单查询
        from infra.models.tenant import Tenant
        count = await Tenant.all().count()
        print(f"✅ 数据库连接正常，当前租户数量: {count}")
        
        await Tortoise.close_connections()
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        raise


@pytest.mark.asyncio
async def test_api_routes():
    """测试API路由"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 测试健康检查接口
        response = await client.get("/health")
        print(f"健康检查接口状态: {response.status_code}")
        
        # 检查应用路由
        routes = [route.path for route in app.routes]
        kuaizhizao_routes = [r for r in routes if "kuaizhizao" in r]
        print(f"✅ 发现 {len(kuaizhizao_routes)} 个kuaizhizao相关路由")
        if kuaizhizao_routes:
            print(f"示例路由: {kuaizhizao_routes[:5]}")


@pytest.mark.asyncio
async def test_models_import():
    """测试模型导入"""
    try:
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.sales_forecast import SalesForecast
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
        
        print("✅ 所有关键模型导入成功")
        print(f"  - WorkOrder: {WorkOrder}")
        print(f"  - SalesForecast: {SalesForecast}")
        print(f"  - SalesOrder: {SalesOrder}")
        print(f"  - PurchaseOrder: {PurchaseOrder}")
        print(f"  - IncomingInspection: {IncomingInspection}")
        print(f"  - ProcessInspection: {ProcessInspection}")
        print(f"  - FinishedGoodsInspection: {FinishedGoodsInspection}")
    except Exception as e:
        print(f"❌ 模型导入失败: {e}")
        raise


@pytest.mark.asyncio
async def test_services_import():
    """测试服务导入"""
    try:
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.services.sales_service import SalesForecastService, SalesOrderService
        from apps.kuaizhizao.services.purchase_service import PurchaseService
        from apps.kuaizhizao.services.quality_service import (
            IncomingInspectionService,
            ProcessInspectionService,
            FinishedGoodsInspectionService
        )
        
        print("✅ 所有关键服务导入成功")
        print(f"  - WorkOrderService: {WorkOrderService}")
        print(f"  - SalesForecastService: {SalesForecastService}")
        print(f"  - SalesOrderService: {SalesOrderService}")
        print(f"  - PurchaseService: {PurchaseService}")
        print(f"  - IncomingInspectionService: {IncomingInspectionService}")
        print(f"  - ProcessInspectionService: {ProcessInspectionService}")
        print(f"  - FinishedGoodsInspectionService: {FinishedGoodsInspectionService}")
    except Exception as e:
        print(f"❌ 服务导入失败: {e}")
        raise

