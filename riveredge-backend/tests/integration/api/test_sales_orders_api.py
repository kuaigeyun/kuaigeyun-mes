"""
销售订单API集成测试

测试销售订单API端点的完整流程。

Author: Auto (AI Assistant)
Date: 2026-01-15
"""

import pytest
from datetime import date
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_sales_order_api(test_client: AsyncClient, auth_headers: dict, test_customer):
    """测试创建销售订单API"""
    # 准备请求数据
    order_data = {
        "order_code": "SO202601150001",
        "customer_id": test_customer.id,
        "customer_name": test_customer.name,
        "order_date": date.today().isoformat(),
        "delivery_date": date(2026, 2, 15).isoformat(),
        "order_type": "MTO",
        "status": "草稿",
        "items": [
            {
                "material_id": 1,
                "material_code": "MAT001",
                "material_name": "测试物料",
                "material_unit": "个",
                "order_quantity": 100.0,
                "delivered_quantity": 0.0,
                "remaining_quantity": 100.0,
                "unit_price": 10.0,
                "total_amount": 1000.0,
                "delivery_date": date(2026, 2, 15).isoformat(),
                "delivery_status": "待交货",
            }
        ],
    }
    
    # 发送请求
    response = await test_client.post(
        "/api/v1/apps/kuaizhizao/sales-orders",
        json=order_data,
        headers=auth_headers,
    )
    
    # 验证响应
    assert response.status_code == 200
    data = response.json()
    assert data["order_code"] == "SO202601150001"
    assert data["customer_id"] == test_customer.id
    assert data["order_type"] == "MTO"
    assert data["status"] == "草稿"
    assert data["total_quantity"] == 100.0
    assert data["total_amount"] == 1000.0


@pytest.mark.asyncio
async def test_list_sales_orders_api(test_client: AsyncClient, auth_headers: dict, test_customer, test_user):
    """测试获取销售订单列表API"""
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    from apps.kuaizhizao.schemas.sales import SalesOrderCreate
    from datetime import date
    
    # 先创建一些测试订单
    service = SalesOrderService()
    for i in range(3):
        order_data = SalesOrderCreate(
            order_code=f"SO20260115000{i+10}",
            customer_id=test_customer.id,
            customer_name=test_customer.name,
            order_date=date.today(),
            delivery_date=date(2026, 2, 15),
            order_type="MTO",
            status="草稿",
            items=[],
        )
        await service.create_sales_order(
            tenant_id=test_customer.tenant_id,
            order_data=order_data,
            created_by=test_user.id,
        )
    
    # 发送请求
    response = await test_client.get(
        "/api/v1/apps/kuaizhizao/sales-orders",
        params={"skip": 0, "limit": 20},
        headers=auth_headers,
    )
    
    # 验证响应
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3


@pytest.mark.asyncio
async def test_list_sales_orders_with_filters_api(test_client: AsyncClient, auth_headers: dict, test_customer, test_user):
    """测试带筛选条件的销售订单列表API"""
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    from apps.kuaizhizao.schemas.sales import SalesOrderCreate
    
    # 创建不同状态的订单
    service = SalesOrderService()
    order_data = SalesOrderCreate(
        order_code="SO202601150020",
        customer_id=test_customer.id,
        customer_name=test_customer.name,
        order_date=date.today(),
        delivery_date=date(2026, 2, 15),
        order_type="MTO",
        status="已审核",
        items=[],
    )
    await service.create_sales_order(
        tenant_id=test_customer.tenant_id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 按状态筛选
    response = await test_client.get(
        "/api/v1/apps/kuaizhizao/sales-orders",
        params={"skip": 0, "limit": 20, "status": "已审核"},
        headers=auth_headers,
    )
    
    # 验证响应
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert all(order["status"] == "已审核" for order in data)


@pytest.mark.asyncio
async def test_get_sales_order_by_id_api(test_client: AsyncClient, auth_headers: dict, test_customer, test_user):
    """测试根据ID获取销售订单API"""
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    from apps.kuaizhizao.schemas.sales import SalesOrderCreate
    
    # 创建订单
    service = SalesOrderService()
    order_data = SalesOrderCreate(
        order_code="SO202601150021",
        customer_id=test_customer.id,
        customer_name=test_customer.name,
        order_date=date.today(),
        delivery_date=date(2026, 2, 15),
        order_type="MTO",
        status="草稿",
        items=[],
    )
    created = await service.create_sales_order(
        tenant_id=test_customer.tenant_id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 发送请求
    response = await test_client.get(
        f"/api/v1/apps/kuaizhizao/sales-orders/{created.id}",
        headers=auth_headers,
    )
    
    # 验证响应
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == created.id
    assert data["order_code"] == "SO202601150021"


@pytest.mark.asyncio
async def test_update_sales_order_api(test_client: AsyncClient, auth_headers: dict, test_customer, test_user):
    """测试更新销售订单API"""
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    from apps.kuaizhizao.schemas.sales import SalesOrderCreate
    
    # 创建订单
    service = SalesOrderService()
    order_data = SalesOrderCreate(
        order_code="SO202601150022",
        customer_id=test_customer.id,
        customer_name=test_customer.name,
        order_date=date.today(),
        delivery_date=date(2026, 2, 15),
        order_type="MTO",
        status="草稿",
        notes="原始备注",
        items=[],
    )
    created = await service.create_sales_order(
        tenant_id=test_customer.tenant_id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 更新订单
    update_data = {
        "notes": "更新后的备注",
        "shipping_address": "新地址",
    }
    
    response = await test_client.put(
        f"/api/v1/apps/kuaizhizao/sales-orders/{created.id}",
        json=update_data,
        headers=auth_headers,
    )
    
    # 验证响应
    assert response.status_code == 200
    data = response.json()
    assert data["notes"] == "更新后的备注"
    assert data["shipping_address"] == "新地址"


@pytest.mark.asyncio
async def test_get_sales_order_not_found_api(test_client: AsyncClient, auth_headers: dict):
    """测试获取不存在的销售订单API"""
    # 发送请求
    response = await test_client.get(
        "/api/v1/apps/kuaizhizao/sales-orders/99999",
        headers=auth_headers,
    )
    
    # 验证响应
    assert response.status_code == 404

