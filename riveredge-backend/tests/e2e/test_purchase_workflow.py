"""
采购流程闭环测试

测试采购流程的完整闭环：
采购单 → 采购入库 → 来料检验 → 应付管理

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import pytest
from httpx import AsyncClient


@pytest.mark.e2e
@pytest.mark.purchase
class TestPurchaseWorkflow:
    """采购流程闭环测试"""
    
    @pytest.mark.asyncio
    async def test_purchase_complete_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """
        测试采购流程完整闭环
        
        流程步骤：
        1. 创建采购单
        2. 提交采购单
        3. 采购入库
        4. 来料检验
        5. 自动生成应付单
        """
        # 创建测试供应商
        from apps.master_data.models.supplier import Supplier
        import uuid as uuid_module
        
        supplier = await Supplier.get_or_none(
            tenant_id=test_tenant.id,
            code="TEST-SUPPLIER-001"
        )
        if not supplier:
            supplier = await Supplier.create(
                tenant_id=test_tenant.id,
                uuid=str(uuid_module.uuid4()),
                code="TEST-SUPPLIER-001",
                name="测试供应商",
                short_name="测试",
                contact_person="测试联系人",
                phone="13800000000",
                email="supplier@example.com",
                address="测试地址",
                category="测试分类",
                is_active=True
            )
        
        # 创建测试物料（如果不存在）
        from apps.master_data.models.material import Material
        material = await Material.get_or_none(
            tenant_id=test_tenant.id,
            code="MAT-002"
        )
        if not material:
            material = await Material.create(
                tenant_id=test_tenant.id,
                uuid=str(uuid_module.uuid4()),
                code="MAT-002",
                name="测试原材料",
                base_unit="kg",
                is_active=True
            )
        
        # 创建测试仓库（如果不存在）
        from apps.master_data.models.warehouse import Warehouse
        warehouse = await Warehouse.get_or_none(
            tenant_id=test_tenant.id,
            code="WH-TEST-001"
        )
        if not warehouse:
            warehouse = await Warehouse.create(
                tenant_id=test_tenant.id,
                uuid=str(uuid_module.uuid4()),
                code="WH-TEST-001",
                name="测试仓库",
                is_active=True
            )
        
        # 步骤1: 创建采购单
        purchase_order_data = {
            # order_code 可选，服务会自动生成
            "supplier_id": supplier.id,
            "supplier_name": supplier.name,
            "order_date": "2026-01-01",
            "delivery_date": "2026-01-10",  # 使用delivery_date而不是expected_delivery_date
            "items": [
                {
                    "material_id": material.id,
                    "material_code": material.code,
                    "material_name": material.name,
                    "ordered_quantity": 200.0,  # 使用ordered_quantity而不是quantity
                    "unit": material.base_unit,
                    "unit_price": 50.0,
                    "total_price": 10000.0,  # 添加total_price
                    "required_date": "2026-01-10"  # 添加required_date
                }
            ]
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/purchase-orders",
            json=purchase_order_data,
            headers=auth_headers
        )
        if response.status_code != 200 and response.status_code != 201:
            error_detail = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            print(f"❌ 采购单创建失败，状态码: {response.status_code}")
            print(f"请求数据: {purchase_order_data}")
            print(f"响应内容: {error_detail}")
        assert response.status_code == 200 or response.status_code == 201
        purchase_order = response.json()
        purchase_order_id = purchase_order.get("id") or purchase_order.get("uuid")
        
        # 步骤2: 提交采购单
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/purchase-orders/{purchase_order_id}/submit",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 步骤2.5: 审核采购单（需要审核后才能下推）
        approve_data = {
            "approved": True,
            "review_remarks": "测试审核通过"
        }
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/purchase-orders/{purchase_order_id}/approve",
            json=approve_data,
            headers=auth_headers
        )
        if response.status_code != 200:
            error_detail = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            print(f"❌ 采购单审核失败，状态码: {response.status_code}")
            print(f"请求数据: {approve_data}")
            print(f"响应内容: {error_detail}")
        assert response.status_code == 200
        
        # 步骤3: 从采购单下推生成采购入库单
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/purchase-orders/{purchase_order_id}/push-to-receipt",
            headers=auth_headers
        )
        assert response.status_code == 200
        receipt_response = response.json()
        # 从响应中提取receipt_id（可能在data字段中，或直接在响应中）
        receipt_id = receipt_response.get("receipt_id") or receipt_response.get("data", {}).get("receipt_id") or receipt_response.get("id")
        
        # 步骤4: 确认采购入库
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/purchase-receipts/{receipt_id}/confirm",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 步骤5: 创建来料检验单
        inspection_data = {
            "purchase_receipt_id": receipt_id,
            "inspection_code": "II-TEST-001",
            "items": [
                {
                    "material_id": 2,
                    "material_code": "MAT-002",
                    "inspection_quantity": 200.0,
                    "qualified_quantity": 195.0,
                    "unqualified_quantity": 5.0
                }
            ]
        }
        
        response = await test_client.post(
            "/api/v1/apps/kuaizhizao/incoming-inspections",
            json=inspection_data,
            headers=auth_headers
        )
        assert response.status_code == 200 or response.status_code == 201
        
        # 步骤6: 执行检验
        inspection_id = response.json().get("id") or response.json().get("uuid")
        response = await test_client.post(
            f"/api/v1/apps/kuaizhizao/incoming-inspections/{inspection_id}/conduct",
            json={"inspection_result": "合格"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 步骤7: 验证自动生成应付单
        # 等待异步任务完成（实际应该使用更好的等待机制）
        import asyncio
        await asyncio.sleep(2)
        
        response = await test_client.get(
            "/api/v1/apps/kuaizhizao/payables",
            params={"purchase_receipt_id": receipt_id},
            headers=auth_headers
        )
        assert response.status_code == 200
        payables = response.json()
        # 验证是否生成了应付单
        assert len(payables.get("items", [])) > 0 or payables.get("total", 0) > 0
        
        print("✅ 采购流程闭环测试通过")

