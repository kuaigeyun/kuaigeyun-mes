"""
检查测试数据库和基础数据

检查测试所需的基础数据是否存在，如果不存在则创建。

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import sys
import asyncio
from pathlib import Path

# 添加src目录到路径
backend_root = Path(__file__).parent.parent.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from infra.models.tenant import Tenant, TenantStatus
from apps.master_data.models.material import Material, BOM
from apps.master_data.models.supplier import Supplier
from apps.master_data.models.warehouse import Warehouse
from apps.master_data.models.factory import Workshop
from core.models.code_rule import CodeRule


async def check_and_create_test_data():
    """检查并创建测试数据"""
    print("=" * 60)
    print("检查测试数据库和基础数据")
    print("=" * 60)
    
    # 初始化数据库连接
    config = TORTOISE_ORM.copy()
    if "routers" not in config.get("apps", {}).get("models", {}):
        config.setdefault("apps", {}).setdefault("models", {})["routers"] = []
    
    await Tortoise.init(config=config)
    
    try:
        # 1. 检查测试租户
        print("\n1. 检查测试租户...")
        test_tenant = await Tenant.get_or_none(domain="test")
        if not test_tenant:
            print("  ❌ 测试租户不存在，创建中...")
            test_tenant = await Tenant.create(
                name="测试租户",
                code="TEST",
                domain="test",
                status=TenantStatus.ACTIVE
            )
            print(f"  ✅ 测试租户已创建: {test_tenant.name} (ID: {test_tenant.id})")
        else:
            print(f"  ✅ 测试租户已存在: {test_tenant.name} (ID: {test_tenant.id})")
        
        tenant_id = test_tenant.id
        
        # 2. 检查物料数据
        print("\n2. 检查物料数据...")
        material_count = await Material.filter(tenant_id=tenant_id).count()
        print(f"  当前物料数量: {material_count}")
        
        if material_count == 0:
            print("  ❌ 物料数据不存在，创建测试物料...")
            # 创建成品物料
            finished_product = await Material.create(
                tenant_id=tenant_id,
                code="PROD-001",
                name="测试成品A",
                category="成品",
                unit="PCS",
                base_unit="PCS",
                is_finished=True,
                is_active=True
            )
            print(f"  ✅ 创建成品物料: {finished_product.code} - {finished_product.name}")
            
            # 创建原材料
            raw_material = await Material.create(
                tenant_id=tenant_id,
                code="RAW-001",
                name="测试原材料A",
                category="原材料",
                unit="KG",
                base_unit="KG",
                is_finished=False,
                is_active=True
            )
            print(f"  ✅ 创建原材料: {raw_material.code} - {raw_material.name}")
        else:
            print("  ✅ 物料数据已存在")
        
        # 3. 检查BOM数据
        print("\n3. 检查BOM数据...")
        bom_count = await BOM.filter(tenant_id=tenant_id).count()
        print(f"  当前BOM数量: {bom_count}")
        
        if bom_count == 0:
            print("  ❌ BOM数据不存在，创建测试BOM...")
            # 获取成品和原材料
            finished_product = await Material.filter(tenant_id=tenant_id, code="PROD-001").first()
            raw_material = await Material.filter(tenant_id=tenant_id, code="RAW-001").first()
            
            if finished_product and raw_material:
                bom = await BOM.create(
                    tenant_id=tenant_id,
                    material_id=finished_product.id,
                    component_id=raw_material.id,
                    quantity=2.0,
                    unit="KG",
                    is_active=True
                )
                print(f"  ✅ 创建BOM: {finished_product.code} 需要 {bom.quantity} {bom.unit} {raw_material.code}")
            else:
                print("  ⚠️  无法创建BOM，物料不存在")
        else:
            print("  ✅ BOM数据已存在")
        
        # 4. 检查供应商数据
        print("\n4. 检查供应商数据...")
        supplier_count = await Supplier.filter(tenant_id=tenant_id).count()
        print(f"  当前供应商数量: {supplier_count}")
        
        # 检查是否已存在相同编码的供应商
        existing_supplier = await Supplier.get_or_none(tenant_id=tenant_id, code="SUP-001")
        if not existing_supplier:
            print("  ❌ 测试供应商不存在，创建测试供应商...")
            try:
                supplier = await Supplier.create(
                    tenant_id=tenant_id,
                    code="SUP-001",
                    name="测试供应商A",
                    contact_person="张三",
                    contact_phone="13800138000",
                    is_active=True
                )
                print(f"  ✅ 创建供应商: {supplier.code} - {supplier.name}")
            except Exception as e:
                print(f"  ⚠️  创建供应商失败: {e}，可能已存在")
        else:
            print(f"  ✅ 测试供应商已存在: {existing_supplier.code} - {existing_supplier.name}")
        
        if supplier_count == 0 and not existing_supplier:
            print("  ⚠️  当前租户没有供应商数据，但测试供应商创建可能失败")
        elif supplier_count > 0:
            print(f"  ✅ 供应商数据已存在（共 {supplier_count} 个）")
        
        # 5. 检查仓库数据
        print("\n5. 检查仓库数据...")
        warehouse_count = await Warehouse.filter(tenant_id=tenant_id).count()
        print(f"  当前仓库数量: {warehouse_count}")
        
        # 检查是否已存在相同编码的仓库
        existing_warehouse = await Warehouse.get_or_none(tenant_id=tenant_id, code="WH-001")
        if not existing_warehouse:
            print("  ❌ 测试仓库不存在，创建测试仓库...")
            try:
                warehouse = await Warehouse.create(
                    tenant_id=tenant_id,
                    code="WH-001",
                    name="测试仓库A",
                    is_active=True
                )
                print(f"  ✅ 创建仓库: {warehouse.code} - {warehouse.name}")
            except Exception as e:
                print(f"  ⚠️  创建仓库失败: {e}，可能已存在")
        else:
            print(f"  ✅ 测试仓库已存在: {existing_warehouse.code} - {existing_warehouse.name}")
        
        if warehouse_count == 0 and not existing_warehouse:
            print("  ⚠️  当前租户没有仓库数据，但测试仓库创建可能失败")
        elif warehouse_count > 0:
            print(f"  ✅ 仓库数据已存在（共 {warehouse_count} 个）")
        
        # 6. 检查车间数据
        print("\n6. 检查车间数据...")
        workshop_count = await Workshop.filter(tenant_id=tenant_id).count()
        print(f"  当前车间数量: {workshop_count}")
        
        # 检查是否已存在相同编码的车间
        existing_workshop = await Workshop.get_or_none(tenant_id=tenant_id, code="WS-001")
        if not existing_workshop:
            print("  ❌ 测试车间不存在，创建测试车间...")
            try:
                workshop = await Workshop.create(
                    tenant_id=tenant_id,
                    code="WS-001",
                    name="测试车间A",
                    is_active=True
                )
                print(f"  ✅ 创建车间: {workshop.code} - {workshop.name}")
            except Exception as e:
                print(f"  ⚠️  创建车间失败: {e}，可能已存在")
        else:
            print(f"  ✅ 测试车间已存在: {existing_workshop.code} - {existing_workshop.name}")
        
        if workshop_count == 0 and not existing_workshop:
            print("  ⚠️  当前租户没有车间数据，但测试车间创建可能失败")
        elif workshop_count > 0:
            print(f"  ✅ 车间数据已存在（共 {workshop_count} 个）")
        
        # 7. 检查编码规则数据
        print("\n7. 检查编码规则数据...")
        code_rules_to_create = [
            {
                "name": "销售预测编码规则",
                "code": "SALES_FORECAST_CODE",
                "expression": "SF{YYYY}{MM}{DD}{SEQ:4}",
                "description": "销售预测编码规则，格式：SF202601010001",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_active": True
            },
            {
                "name": "销售订单编码规则",
                "code": "SALES_ORDER_CODE",
                "expression": "SO{YYYY}{MM}{DD}{SEQ:4}",
                "description": "销售订单编码规则，格式：SO202601010001",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_active": True
            },
            {
                "name": "采购订单编码规则",
                "code": "PURCHASE_ORDER_CODE",
                "expression": "PO{YYYY}{MM}{DD}{SEQ:4}",
                "description": "采购订单编码规则，格式：PO202601010001",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_active": True
            },
            {
                "name": "工单编码规则",
                "code": "WORK_ORDER_CODE",
                "expression": "WO{YYYY}{MM}{DD}{SEQ:4}",
                "description": "工单编码规则，格式：WO202601010001",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_active": True
            }
        ]
        
        for rule_data in code_rules_to_create:
            existing_rule = await CodeRule.get_or_none(
                tenant_id=tenant_id,
                code=rule_data["code"],
                deleted_at__isnull=True
            )
            if not existing_rule:
                print(f"  ❌ 编码规则 {rule_data['code']} 不存在，创建中...")
                try:
                    rule = await CodeRule.create(
                        tenant_id=tenant_id,
                        **rule_data
                    )
                    print(f"  ✅ 创建编码规则: {rule.name} ({rule.code})")
                except Exception as e:
                    print(f"  ⚠️  创建编码规则失败: {e}，可能已存在")
            else:
                print(f"  ✅ 编码规则已存在: {existing_rule.name} ({existing_rule.code})")
        
        print("\n" + "=" * 60)
        print("✅ 测试数据检查完成")
        print("=" * 60)
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_and_create_test_data())

