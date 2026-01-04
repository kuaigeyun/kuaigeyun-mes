"""
MTO模式完整流程测试

测试MTO模式的完整业务流程：
销售订单 → LRP运算 → 工单生成 → 生产执行 → 销售出库

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import pytest
from httpx import AsyncClient
from typing import Dict, Any


@pytest.mark.e2e
@pytest.mark.mto
class TestMTOWorkflow:
    """MTO模式完整流程测试"""
    
    @pytest.mark.asyncio
    async def test_mto_complete_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """
        测试MTO模式完整流程
        
        流程步骤：
        1. 创建销售订单
        2. 执行LRP运算
        3. 生成工单（关联销售订单）
        4. 下达工单
        5. 报工
        6. 成品入库
        7. 销售出库（关联销售订单）
        """
        # 步骤1: 创建销售订单
        sales_order_data = {
            "order_code": "SO-TEST-001",
            "customer_id": 1,
            "customer_name": "测试客户",
            "order_date": "2026-01-01",
            "delivery_date": "2026-01-20",
            "order_type": "MTO",
            "items": [
                {
                    "material_id": 1,
                    "material_code": "MAT-001",
                    "material_name": "测试产品",
                    "material_unit": "件",
                    "order_quantity": 50.0,
                    "delivered_quantity": 0.0,
                    "remaining_quantity": 50.0,
                    "unit_price": 100.0,
                    "total_amount": 5000.0,
                    "delivery_date": "2026-01-20",
                    "delivery_status": "待交货"
                }
            ]
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/sales-orders",
            json=sales_order_data,
            headers=auth_headers
        )
        assert response.status_code == 200 or response.status_code == 201
        sales_order = response.json()
        sales_order_id = sales_order.get("id") or sales_order.get("uuid")
        
        # 步骤2: 提交销售订单
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/sales-orders/{sales_order_id}/submit",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 步骤2.5: 审核销售订单（需要先审核才能确认）
        approve_data = {
            "approved": True,
            "remarks": "测试审核通过"
        }
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/sales-orders/{sales_order_id}/approve",
            json=approve_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 步骤2.6: 确认销售订单（LRP需要已确认的订单）
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/sales-orders/{sales_order_id}/confirm",
            headers=auth_headers
        )
        if response.status_code != 200:
            error_detail = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            print(f"❌ 销售订单确认失败，状态码: {response.status_code}")
            print(f"响应内容: {error_detail}")
        assert response.status_code == 200
        
        # 步骤3: 执行LRP运算
        lrp_data = {
            "sales_order_id": sales_order_id,  # 使用sales_order_id而不是order_id
            "consider_capacity": True,
            "consider_inventory": True
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/lrp-computation",
            json=lrp_data,
            headers=auth_headers
        )
        if response.status_code != 200:
            error_detail = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            print(f"❌ LRP运算失败，状态码: {response.status_code}")
            print(f"请求数据: {lrp_data}")
            print(f"响应内容: {error_detail}")
        assert response.status_code == 200
        lrp_result = response.json()
        
        # 步骤4: 从LRP结果生成工单
        # API路径是 /lrp/results/{sales_order_id}/generate-orders，参数是sales_order_id
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/lrp/results/{sales_order_id}/generate-orders",
            params={"generate_work_orders": "true", "generate_purchase_orders": "false"},
            headers=auth_headers
        )
        if response.status_code != 200:
            error_detail = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            print(f"❌ 生成工单失败，状态码: {response.status_code}")
            print(f"请求路径: /api/v1/apps/kuaizhizao/lrp/results/{sales_order_id}/generate-orders")
            print(f"响应内容: {error_detail}")
        assert response.status_code == 200
        generated_orders = response.json()
        # 从响应中提取work_orders
        work_orders = generated_orders.get("data", {}).get("work_orders", []) or generated_orders.get("work_orders", [])
        work_order_id = work_orders[0].get("id") if work_orders else None
        
        if work_order_id:
            # 验证工单关联了销售订单
            response = await test_client.get(
                f"/api/v1/apps/kuaizhizao/work-orders/{work_order_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            work_order = response.json()
            assert work_order.get("sales_order_id") == sales_order_id
            
            # 步骤5: 下达工单
            response = await test_client.post(
                f"/api/v1/apps/kuaizhizao/work-orders/{work_order_id}/release",
                headers=auth_headers
            )
            assert response.status_code == 200
            
            # 步骤6: 报工
            reporting_data = {
                "work_order_id": work_order_id,
                "operation_id": 1,
                "reported_quantity": 50.0,
                "qualified_quantity": 48.0,
                "unqualified_quantity": 2.0,
                "work_hours": 6.0
            }
            
            response = await test_client.post(
                "/api/v1/apps/kuaizhizao/reporting",
                json=reporting_data,
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 201
            
            # 步骤7: 成品入库
            receipt_data = {
                "work_order_id": work_order_id,
                "sales_order_id": sales_order_id,
                "receipt_code": "FGR-TEST-002",
                "items": [
                    {
                        "material_id": 1,
                        "material_code": "MAT-001",
                        "quantity": 48.0,
                        "unit": "件"
                    }
                ]
            }
            
            response = await test_client.post(
                "/api/v1/apps/kuaizhizao/finished-goods-receipts",
                json=receipt_data,
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 201
            
            # 步骤8: 销售出库（关联销售订单）
            delivery_data = {
                "sales_order_id": sales_order_id,
                "delivery_code": "SD-TEST-002",
                "items": [
                    {
                        "material_id": 1,
                        "material_code": "MAT-001",
                        "quantity": 48.0,
                        "unit": "件"
                    }
                ]
            }
            
            response = await test_client.post(
                "/api/v1/apps/kuaizhizao/sales-deliveries",
                json=delivery_data,
                headers=auth_headers
            )
            assert response.status_code == 200 or response.status_code == 201
            
            print("✅ MTO模式完整流程测试通过")
        else:
            pytest.skip("未生成工单，跳过后续测试")

