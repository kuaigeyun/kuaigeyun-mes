"""
销售订单MOCK数据生成脚本

用于生成测试用的销售订单数据。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

import asyncio
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

# 添加项目根目录到路径
import sys
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

try:
    from dotenv import load_dotenv
    load_dotenv(project_root / ".env")
except ImportError:
    # 如果没有dotenv，尝试直接读取.env文件
    pass

from tortoise import Tortoise
from loguru import logger

from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem


async def init_db():
    """初始化数据库连接"""
    db_config = {
        "connections": {
            "default": {
                "engine": "tortoise.backends.asyncpg",
                "credentials": {
                    "host": os.getenv("DB_HOST", "localhost"),
                    "port": int(os.getenv("DB_PORT", 5432)),
                    "user": os.getenv("DB_USER", "postgres"),
                    "password": os.getenv("DB_PASSWORD", ""),
                    "database": os.getenv("DB_NAME", "riveredge"),
                }
            }
        },
        "apps": {
            "models": {
                "models": [
                    "apps.kuaizhizao.models.sales_order",
                    "apps.kuaizhizao.models.sales_order_item",
                ],
                "default_connection": "default",
            }
        }
    }
    
    await Tortoise.init(config=db_config)
    logger.info("✅ 数据库连接初始化成功")


async def generate_order_code(tenant_id: int, index: int) -> str:
    """生成订单编码"""
    today = datetime.now().strftime("%Y%m%d")
    # 检查订单编码是否已存在，如果存在则添加时间戳后缀
    base_code = f"SO{today}{str(index).zfill(3)}"
    existing = await SalesOrder.get_or_none(order_code=base_code)
    if existing:
        # 如果已存在，添加时间戳后缀确保唯一性
        timestamp = datetime.now().strftime("%H%M%S")
        return f"{base_code}_{timestamp}"
    return base_code


async def create_mock_sales_orders(tenant_id: int = 1, created_by: int = 1):
    """创建MOCK销售订单数据"""
    logger.info(f"🔄 开始创建销售订单MOCK数据，租户ID: {tenant_id}")
    
    # MOCK数据定义
    mock_orders = [
        {
            "customer_id": 1,
            "customer_name": "客户A",
            "customer_contact": "张三",
            "customer_phone": "13800138001",
            "order_type": "MTO",
            "status": "已审核",
            "salesman_name": "李销售",
            "shipping_address": "北京市朝阳区xxx街道xxx号",
            "shipping_method": "快递",
            "payment_terms": "货到付款",
            "notes": "优先处理订单",
            "items": [
                {
                    "material_id": 1,
                    "material_code": "MAT001",
                    "material_name": "产品A",
                    "material_spec": "规格A",
                    "material_unit": "个",
                    "order_quantity": Decimal("100.00"),
                    "unit_price": Decimal("50.00"),
                    "delivery_date": date.today() + timedelta(days=30),
                },
                {
                    "material_id": 2,
                    "material_code": "MAT002",
                    "material_name": "产品B",
                    "material_spec": "规格B",
                    "material_unit": "个",
                    "order_quantity": Decimal("200.00"),
                    "unit_price": Decimal("30.00"),
                    "delivery_date": date.today() + timedelta(days=30),
                },
            ]
        },
        {
            "customer_id": 2,
            "customer_name": "客户B",
            "customer_contact": "李四",
            "customer_phone": "13800138002",
            "order_type": "MTO",
            "status": "已确认",
            "salesman_name": "王销售",
            "shipping_address": "上海市浦东新区xxx路xxx号",
            "shipping_method": "物流",
            "payment_terms": "月结30天",
            "notes": "常规订单",
            "items": [
                {
                    "material_id": 3,
                    "material_code": "MAT003",
                    "material_name": "产品C",
                    "material_spec": "规格C",
                    "material_unit": "个",
                    "order_quantity": Decimal("150.00"),
                    "unit_price": Decimal("80.00"),
                    "delivery_date": date.today() + timedelta(days=45),
                },
            ]
        },
        {
            "customer_id": 3,
            "customer_name": "客户C",
            "customer_contact": "王五",
            "customer_phone": "13800138003",
            "order_type": "MTS",
            "status": "草稿",
            "salesman_name": "赵销售",
            "shipping_address": "广州市天河区xxx大道xxx号",
            "shipping_method": "快递",
            "payment_terms": "预付款",
            "notes": "待确认订单",
            "items": [
                {
                    "material_id": 1,
                    "material_code": "MAT001",
                    "material_name": "产品A",
                    "material_spec": "规格A",
                    "material_unit": "个",
                    "order_quantity": Decimal("50.00"),
                    "unit_price": Decimal("50.00"),
                    "delivery_date": date.today() + timedelta(days=15),
                },
                {
                    "material_id": 2,
                    "material_code": "MAT002",
                    "material_name": "产品B",
                    "material_spec": "规格B",
                    "material_unit": "个",
                    "order_quantity": Decimal("80.00"),
                    "unit_price": Decimal("30.00"),
                    "delivery_date": date.today() + timedelta(days=15),
                },
                {
                    "material_id": 3,
                    "material_code": "MAT003",
                    "material_name": "产品C",
                    "material_spec": "规格C",
                    "material_unit": "个",
                    "order_quantity": Decimal("120.00"),
                    "unit_price": Decimal("80.00"),
                    "delivery_date": date.today() + timedelta(days=15),
                },
            ]
        },
        {
            "customer_id": 1,
            "customer_name": "客户A",
            "customer_contact": "张三",
            "customer_phone": "13800138001",
            "order_type": "MTO",
            "status": "进行中",
            "salesman_name": "李销售",
            "shipping_address": "北京市朝阳区xxx街道xxx号",
            "shipping_method": "物流",
            "payment_terms": "月结60天",
            "notes": "加急订单",
            "items": [
                {
                    "material_id": 4,
                    "material_code": "MAT004",
                    "material_name": "产品D",
                    "material_spec": "规格D",
                    "material_unit": "个",
                    "order_quantity": Decimal("300.00"),
                    "unit_price": Decimal("100.00"),
                    "delivery_date": date.today() + timedelta(days=20),
                },
            ]
        },
        {
            "customer_id": 2,
            "customer_name": "客户B",
            "customer_contact": "李四",
            "customer_phone": "13800138002",
            "order_type": "MTO",
            "status": "已完成",
            "salesman_name": "王销售",
            "shipping_address": "上海市浦东新区xxx路xxx号",
            "shipping_method": "快递",
            "payment_terms": "货到付款",
            "notes": "已完成订单",
            "items": [
                {
                    "material_id": 2,
                    "material_code": "MAT002",
                    "material_name": "产品B",
                    "material_spec": "规格B",
                    "material_unit": "个",
                    "order_quantity": Decimal("100.00"),
                    "unit_price": Decimal("30.00"),
                    "delivery_date": date.today() - timedelta(days=5),
                    "delivered_quantity": Decimal("100.00"),
                    "delivery_status": "已交货",
                },
            ]
        },
    ]
    
    created_count = 0
    today = date.today()
    
    for index, order_data in enumerate(mock_orders, start=1):
        try:
            # 生成订单编码
            order_code = await generate_order_code(tenant_id, index)
            
            # 计算订单总数量和总金额
            total_quantity = Decimal("0.00")
            total_amount = Decimal("0.00")
            
            for item in order_data["items"]:
                quantity = item["order_quantity"]
                price = item["unit_price"]
                total_quantity += quantity
                total_amount += quantity * price
            
            # 创建销售订单
            order = await SalesOrder.create(
                tenant_id=tenant_id,
                order_code=order_code,
                customer_id=order_data["customer_id"],
                customer_name=order_data["customer_name"],
                customer_contact=order_data["customer_contact"],
                customer_phone=order_data["customer_phone"],
                order_date=today - timedelta(days=index * 2),  # 订单日期递增
                delivery_date=order_data["items"][0]["delivery_date"],
                order_type=order_data["order_type"],
                total_quantity=total_quantity,
                total_amount=total_amount,
                status=order_data["status"],
                salesman_name=order_data["salesman_name"],
                shipping_address=order_data["shipping_address"],
                shipping_method=order_data["shipping_method"],
                payment_terms=order_data["payment_terms"],
                notes=order_data["notes"],
                created_by=created_by,
            )
            
            # 创建订单明细
            for item_data in order_data["items"]:
                remaining_quantity = item_data["order_quantity"] - item_data.get("delivered_quantity", Decimal("0.00"))
                
                await SalesOrderItem.create(
                    tenant_id=tenant_id,
                    sales_order_id=order.id,
                    material_id=item_data["material_id"],
                    material_code=item_data["material_code"],
                    material_name=item_data["material_name"],
                    material_spec=item_data.get("material_spec", ""),
                    material_unit=item_data["material_unit"],
                    order_quantity=item_data["order_quantity"],
                    delivered_quantity=item_data.get("delivered_quantity", Decimal("0.00")),
                    remaining_quantity=remaining_quantity,
                    unit_price=item_data["unit_price"],
                    total_amount=item_data["order_quantity"] * item_data["unit_price"],
                    delivery_date=item_data["delivery_date"],
                    delivery_status=item_data.get("delivery_status", "待交货"),
                )
            
            created_count += 1
            logger.info(f"✅ 创建销售订单成功: {order_code} (ID: {order.id})")
            
        except Exception as e:
            logger.error(f"❌ 创建销售订单失败 (索引 {index}): {str(e)}")
            continue
    
    logger.info(f"✅ MOCK数据创建完成，共创建 {created_count} 条销售订单")
    return created_count


async def main():
    """主函数"""
    try:
        # 初始化数据库
        await init_db()
        
        # 创建MOCK数据
        tenant_id = int(os.getenv("DEFAULT_TENANT_ID", "1"))
        created_by = int(os.getenv("DEFAULT_USER_ID", "1"))
        
        await create_mock_sales_orders(tenant_id=tenant_id, created_by=created_by)
        
    except Exception as e:
        logger.error(f"❌ 执行失败: {str(e)}")
        raise
    finally:
        await Tortoise.close_connections()
        logger.info("✅ 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(main())

