"""
销售订单服务单元测试

测试销售订单服务的核心业务逻辑。

Author: Auto (AI Assistant)
Date: 2026-01-15
"""

import pytest
import sys
from pathlib import Path
from datetime import date, datetime
from decimal import Decimal

# 添加src目录到路径
backend_root = Path(__file__).parent.parent.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from apps.kuaizhizao.services.sales_service import SalesOrderService
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.schemas.sales import (
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesOrderItemCreate,
)
from decimal import Decimal
from infra.exceptions.exceptions import NotFoundError, ValidationError


@pytest.mark.asyncio
async def test_create_sales_order(db_setup, test_tenant, test_customer, test_user):
    """测试创建销售订单"""
    service = SalesOrderService()
    
    # 准备测试数据
    order_data = SalesOrderCreate(
        order_code="SO202601150001",
        customer_id=test_customer.id,
        customer_name=test_customer.name,
        order_date=date.today(),
        delivery_date=date(2026, 2, 15),
        order_type="MTO",
        status="草稿",
        items=[
            SalesOrderItemCreate(
                material_id=1,
                material_code="MAT001",
                material_name="测试物料",
                material_unit="个",
                order_quantity=100.0,
                delivered_quantity=0.0,
                remaining_quantity=100.0,
                unit_price=10.0,
                total_amount=1000.0,
                delivery_date=date(2026, 2, 15),
                delivery_status="待交货",
            )
        ],
    )
    
    # 创建订单
    result = await service.create_sales_order(
        tenant_id=test_tenant.id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 验证结果
    assert result is not None
    assert result.order_code == "SO202601150001"
    assert result.customer_id == test_customer.id
    assert result.order_type == "MTO"
    assert result.status == "草稿"
    assert result.total_quantity == 100.0
    assert result.total_amount == 1000.0
    
    # 验证订单已保存到数据库
    saved_order = await SalesOrder.get_or_none(id=result.id)
    assert saved_order is not None
    assert saved_order.order_code == "SO202601150001"


@pytest.mark.asyncio
async def test_list_sales_orders(db_setup, test_tenant, test_customer, test_user):
    """测试获取销售订单列表"""
    service = SalesOrderService()
    
    # 创建测试订单
    order_data = SalesOrderCreate(
        order_code="SO202601150002",
        customer_id=test_customer.id,
        customer_name=test_customer.name,
        order_date=date.today(),
        delivery_date=date(2026, 2, 15),
        order_type="MTO",
        status="草稿",
        items=[],
    )
    
    await service.create_sales_order(
        tenant_id=test_tenant.id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 获取列表
    result = await service.list_sales_orders(
        tenant_id=test_tenant.id,
        skip=0,
        limit=20,
    )
    
    # 验证结果
    assert isinstance(result, list)
    assert len(result) > 0
    assert any(order.order_code == "SO202601150002" for order in result)


@pytest.mark.asyncio
async def test_list_sales_orders_with_filters(db_setup, test_tenant, test_customer, test_user):
    """测试带筛选条件的销售订单列表"""
    service = SalesOrderService()
    
    # 创建不同状态的订单
    for i, status in enumerate(["草稿", "已审核", "进行中"]):
        order_data = SalesOrderCreate(
            order_code=f"SO20260115000{i+3}",
            customer_id=test_customer.id,
            customer_name=test_customer.name,
            order_date=date.today(),
            delivery_date=date(2026, 2, 15),
            order_type="MTO",
            status=status,
            items=[],
        )
        await service.create_sales_order(
            tenant_id=test_tenant.id,
            order_data=order_data,
            created_by=test_user.id,
        )
    
    # 按状态筛选
    result = await service.list_sales_orders(
        tenant_id=test_tenant.id,
        skip=0,
        limit=20,
        status="草稿",
    )
    
    # 验证结果
    assert isinstance(result, list)
    assert all(order.status == "草稿" for order in result)
    
    # 按客户筛选
    result = await service.list_sales_orders(
        tenant_id=test_tenant.id,
        skip=0,
        limit=20,
        customer_id=test_customer.id,
    )
    
    # 验证结果
    assert isinstance(result, list)
    assert all(order.customer_id == test_customer.id for order in result)


@pytest.mark.asyncio
async def test_get_sales_order_by_id(db_setup, test_tenant, test_customer, test_user):
    """测试根据ID获取销售订单"""
    service = SalesOrderService()
    
    # 创建订单
    order_data = SalesOrderCreate(
        order_code="SO202601150004",
        customer_id=test_customer.id,
        customer_name=test_customer.name,
        order_date=date.today(),
        delivery_date=date(2026, 2, 15),
        order_type="MTO",
        status="草稿",
        items=[],
    )
    
    created = await service.create_sales_order(
        tenant_id=test_tenant.id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 获取订单
    result = await service.get_sales_order_by_id(
        tenant_id=test_tenant.id,
        order_id=created.id,
    )
    
    # 验证结果
    assert result is not None
    assert result.id == created.id
    assert result.order_code == "SO202601150004"
    assert result.customer_id == test_customer.id


@pytest.mark.asyncio
async def test_get_sales_order_not_found(db_setup, test_tenant):
    """测试获取不存在的销售订单"""
    service = SalesOrderService()
    
    # 尝试获取不存在的订单
    with pytest.raises(NotFoundError):
        await service.get_sales_order_by_id(
            tenant_id=test_tenant.id,
            order_id=99999,
        )


@pytest.mark.asyncio
async def test_update_sales_order(db_setup, test_tenant, test_customer, test_user):
    """测试更新销售订单"""
    service = SalesOrderService()
    
    # 创建订单
    order_data = SalesOrderCreate(
        order_code="SO202601150005",
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
        tenant_id=test_tenant.id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 更新订单
    update_data = SalesOrderUpdate(
        notes="更新后的备注",
        shipping_address="新地址",
    )
    
    result = await service.update_sales_order(
        tenant_id=test_tenant.id,
        order_id=created.id,
        order_data=update_data,
        updated_by=test_user.id,
    )
    
    # 验证结果
    assert result is not None
    assert result.notes == "更新后的备注"
    assert result.shipping_address == "新地址"


@pytest.mark.asyncio
async def test_create_sales_order_with_items(db_setup, test_tenant, test_customer, test_user):
    """测试创建带明细项的销售订单"""
    service = SalesOrderService()
    
    # 准备测试数据（包含多个明细项）
    order_data = SalesOrderCreate(
        order_code="SO202601150006",
        customer_id=test_customer.id,
        customer_name=test_customer.name,
        order_date=date.today(),
        delivery_date=date(2026, 2, 15),
        order_type="MTO",
        status="草稿",
        items=[
            SalesOrderItemCreate(
                material_id=1,
                material_code="MAT001",
                material_name="物料1",
                material_unit="个",
                order_quantity=50.0,
                delivered_quantity=0.0,
                remaining_quantity=50.0,
                unit_price=10.0,
                total_amount=500.0,
                delivery_date=date(2026, 2, 15),
                delivery_status="待交货",
            ),
            SalesOrderItemCreate(
                material_id=2,
                material_code="MAT002",
                material_name="物料2",
                material_unit="个",
                order_quantity=30.0,
                delivered_quantity=0.0,
                remaining_quantity=30.0,
                unit_price=20.0,
                total_amount=600.0,
                delivery_date=date(2026, 2, 20),
                delivery_status="待交货",
            ),
        ],
    )
    
    # 创建订单
    result = await service.create_sales_order(
        tenant_id=test_tenant.id,
        order_data=order_data,
        created_by=test_user.id,
    )
    
    # 验证结果
    assert result is not None
    assert result.total_quantity == 80.0  # 50 + 30
    assert result.total_amount == 1100.0  # 500 + 600
    
    # 验证明细项已保存
    items = await SalesOrderItem.filter(sales_order_id=result.id).all()
    assert len(items) == 2
    assert float(items[0].order_quantity) == 50.0
    assert float(items[1].order_quantity) == 30.0

