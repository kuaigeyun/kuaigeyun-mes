"""
质量管理流程测试

测试质量管理的完整流程：
来料检验 → 过程检验 → 成品检验

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import pytest
from httpx import AsyncClient


@pytest.mark.e2e
@pytest.mark.quality
class TestQualityWorkflow:
    """质量管理流程测试"""
    
    @pytest.mark.asyncio
    async def test_incoming_inspection_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """测试来料检验流程"""
        # 创建采购入库单（模拟）
        receipt_data = {
            "receipt_code": "PR-TEST-001",
            "purchase_order_id": 1,
            "items": [
                {
                    "material_id": 2,
                    "material_code": "MAT-002",
                    "quantity": 100.0,
                    "unit": "kg"
                }
            ]
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/purchase-receipts",
            json=receipt_data,
            headers=auth_headers
        )
        receipt_id = response.json().get("id") or response.json().get("uuid")
        
        # 创建来料检验单
        inspection_data = {
            "purchase_receipt_id": receipt_id,
            "inspection_code": "II-TEST-001",
            "items": [
                {
                    "material_id": 2,
                    "material_code": "MAT-002",
                    "inspection_quantity": 100.0,
                    "qualified_quantity": 98.0,
                    "unqualified_quantity": 2.0
                }
            ]
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/incoming-inspections",
            json=inspection_data,
            headers=auth_headers
        )
        assert response.status_code == 200 or response.status_code == 201
        
        inspection_id = response.json().get("id") or response.json().get("uuid")
        
        # 执行检验
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/incoming-inspections/{inspection_id}/conduct",
            json={"inspection_result": "合格"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        print("✅ 来料检验流程测试通过")
    
    @pytest.mark.asyncio
    async def test_process_inspection_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """测试过程检验流程"""
        # 创建工单（模拟）
        work_order_data = {
            "code": "WO-TEST-001",
            "name": "测试工单",
            "product_id": 1,
            "product_code": "MAT-001",
            "quantity": 100.0,
            "production_mode": "MTS"
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/work-orders",
            json=work_order_data,
            headers=auth_headers
        )
        work_order_id = response.json().get("id") or response.json().get("uuid")
        
        # 从工单创建过程检验单
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/process-inspections/from-work-order",
            params={"work_order_id": work_order_id, "operation_id": 1},
            headers=auth_headers
        )
        assert response.status_code == 200 or response.status_code == 201
        
        inspection_id = response.json().get("id") or response.json().get("uuid")
        
        # 执行检验
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/process-inspections/{inspection_id}/conduct",
            json={
                "inspection_quantity": 100.0,
                "qualified_quantity": 95.0,
                "unqualified_quantity": 5.0,
                "inspection_result": "合格"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        print("✅ 过程检验流程测试通过")
    
    @pytest.mark.asyncio
    async def test_finished_goods_inspection_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """测试成品检验流程"""
        # 创建工单（模拟）
        work_order_data = {
            "code": "WO-TEST-002",
            "name": "测试工单2",
            "product_id": 1,
            "product_code": "MAT-001",
            "quantity": 100.0,
            "production_mode": "MTS"
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/work-orders",
            json=work_order_data,
            headers=auth_headers
        )
        work_order_id = response.json().get("id") or response.json().get("uuid")
        
        # 从工单创建成品检验单
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/finished-goods-inspections/from-work-order",
            params={"work_order_id": work_order_id},
            headers=auth_headers
        )
        assert response.status_code == 200 or response.status_code == 201
        
        inspection_id = response.json().get("id") or response.json().get("uuid")
        
        # 执行检验
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/finished-goods-inspections/{inspection_id}/conduct",
            json={
                "inspection_quantity": 100.0,
                "qualified_quantity": 98.0,
                "unqualified_quantity": 2.0,
                "inspection_result": "合格"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        print("✅ 成品检验流程测试通过")

