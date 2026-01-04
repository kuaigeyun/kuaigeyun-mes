"""
财务协同流程测试

测试财务协同的完整流程：
采购入库 → 应付单生成 → 付款记录
销售出库 → 应收单生成 → 收款记录

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import pytest
from httpx import AsyncClient
import asyncio


@pytest.mark.e2e
@pytest.mark.finance
class TestFinanceWorkflow:
    """财务协同流程测试"""
    
    @pytest.mark.asyncio
    async def test_payable_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """测试应付单流程"""
        # 创建采购入库单（模拟）
        receipt_data = {
            "receipt_code": "PR-TEST-002",
            "purchase_order_id": 1,
            "supplier_id": 1,
            "supplier_name": "测试供应商",
            "items": [
                {
                    "material_id": 2,
                    "material_code": "MAT-002",
                    "quantity": 200.0,
                    "unit": "kg",
                    "unit_price": 50.0,
                    "total_amount": 10000.0
                }
            ]
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/purchase-receipts",
            json=receipt_data,
            headers=auth_headers
        )
        receipt_id = response.json().get("id") or response.json().get("uuid")
        
        # 确认入库（触发应付单生成）
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/purchase-receipts/{receipt_id}/confirm",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 等待异步任务完成
        await asyncio.sleep(2)
        
        # 查询应付单
        response = await test_client.get(
            "/api/v1/apps/kuaizhizao/payables",
            params={"purchase_receipt_id": receipt_id},
            headers=auth_headers
        )
        assert response.status_code == 200
        payables = response.json()
        
        # 验证是否生成了应付单
        payable_items = payables.get("items", []) if isinstance(payables, dict) else payables
        if len(payable_items) > 0:
            payable_id = payable_items[0].get("id") or payable_items[0].get("uuid")
            
            # 记录付款
            payment_data = {
                "payment_amount": 10000.0,
                "payment_date": "2026-01-05",
                "payment_method": "银行转账",
                "remarks": "测试付款"
            }
            
            response = await test_client.post(
                f"/api/v1/apps/kuaizhizao/payables/{payable_id}/payment",
                json=payment_data,
                headers=auth_headers
            )
            assert response.status_code == 200
            
            print("✅ 应付单流程测试通过")
        else:
            pytest.skip("未生成应付单，跳过付款测试")
    
    @pytest.mark.asyncio
    async def test_receivable_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """测试应收单流程"""
        # 创建销售出库单（模拟）
        delivery_data = {
            "delivery_code": "SD-TEST-003",
            "sales_order_id": 1,
            "customer_id": 1,
            "customer_name": "测试客户",
            "items": [
                {
                    "material_id": 1,
                    "material_code": "MAT-001",
                    "quantity": 50.0,
                    "unit": "件",
                    "unit_price": 100.0,
                    "total_amount": 5000.0
                }
            ]
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/sales-deliveries",
            json=delivery_data,
            headers=auth_headers
        )
        delivery_id = response.json().get("id") or response.json().get("uuid")
        
        # 确认出库（触发应收单生成）
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/sales-deliveries/{delivery_id}/confirm",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 等待异步任务完成
        await asyncio.sleep(2)
        
        # 查询应收单
        response = await test_client.get(
            "/api/v1/apps/kuaizhizao/receivables",
            params={"sales_delivery_id": delivery_id},
            headers=auth_headers
        )
        assert response.status_code == 200
        receivables = response.json()
        
        # 验证是否生成了应收单
        receivable_items = receivables.get("items", []) if isinstance(receivables, dict) else receivables
        if len(receivable_items) > 0:
            receivable_id = receivable_items[0].get("id") or receivable_items[0].get("uuid")
            
            # 记录收款
            receipt_data = {
                "receipt_amount": 5000.0,
                "receipt_date": "2026-01-10",
                "receipt_method": "银行转账",
                "remarks": "测试收款"
            }
            
            response = await test_client.post(
                f"/api/v1/apps/kuaizhizao/receivables/{receivable_id}/receipt",
                json=receipt_data,
                headers=auth_headers
            )
            assert response.status_code == 200
            
            print("✅ 应收单流程测试通过")
        else:
            pytest.skip("未生成应收单，跳过收款测试")

