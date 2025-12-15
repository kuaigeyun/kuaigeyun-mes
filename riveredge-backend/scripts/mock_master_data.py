"""
为主数据管理模块创建机械加工厂 Mock 数据脚本

用于快速创建测试数据，自动查找第一个租户并初始化主数据管理模块的数据。

使用方法:
    python scripts/mock_master_data.py [--tenant-id TENANT_ID] [--force]
"""

import asyncio
import sys
from pathlib import Path
from datetime import date, datetime, timedelta
import json

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 设置时区环境变量（必须在导入 Tortoise 之前）
from infra.config.platform_config import platform_settings, setup_tortoise_timezone_env
setup_tortoise_timezone_env()

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from infra.models.tenant import Tenant

# 导入主数据管理模型
from apps.master_data.models.factory import Workshop, ProductionLine, Workstation
from apps.master_data.models.warehouse import Warehouse, StorageArea, StorageLocation
from apps.master_data.models.material import MaterialGroup, Material, BOM
from apps.master_data.models.process import DefectType, Operation, ProcessRoute, SOP
from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier
from apps.master_data.models.performance import Holiday, Skill


async def create_factory_data(tenant_id: int):
    """创建工厂建模数据"""
    print("\n📦 创建工厂建模数据...")
    
    # 车间
    workshops_data = [
        {"code": "WS001", "name": "机加工车间", "description": "主要负责机械加工生产"},
        {"code": "WS002", "name": "装配车间", "description": "主要负责产品装配"},
        {"code": "WS003", "name": "热处理车间", "description": "主要负责热处理加工"},
    ]
    
    workshops = []
    for ws_data in workshops_data:
        workshop, created = await Workshop.get_or_create(
            tenant_id=tenant_id,
            code=ws_data["code"],
            defaults={
                "name": ws_data["name"],
                "description": ws_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not workshop.is_active:
            workshop.is_active = True
            await workshop.save()
        workshops.append(workshop)
        if created:
            print(f"  ✅ 创建车间: {workshop.code} - {workshop.name}")
        else:
            print(f"  ⏭️  车间已存在: {workshop.code} - {workshop.name}")
    
    # 产线
    production_lines_data = [
        {"code": "PL001", "name": "CNC加工产线", "workshop_code": "WS001", "description": "数控机床加工产线"},
        {"code": "PL002", "name": "普通车床产线", "workshop_code": "WS001", "description": "普通车床加工产线"},
        {"code": "PL003", "name": "铣床产线", "workshop_code": "WS001", "description": "铣床加工产线"},
        {"code": "PL004", "name": "装配产线A", "workshop_code": "WS002", "description": "产品装配产线A"},
        {"code": "PL005", "name": "装配产线B", "workshop_code": "WS002", "description": "产品装配产线B"},
    ]
    
    production_lines = []
    for pl_data in production_lines_data:
        workshop = next((w for w in workshops if w.code == pl_data["workshop_code"]), None)
        if not workshop:
            continue
        
        production_line, created = await ProductionLine.get_or_create(
            tenant_id=tenant_id,
            code=pl_data["code"],
            defaults={
                "name": pl_data["name"],
                "workshop_id": workshop.id,
                "description": pl_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not production_line.is_active:
            production_line.is_active = True
            await production_line.save()
        production_lines.append(production_line)
        if created:
            print(f"  ✅ 创建产线: {production_line.code} - {production_line.name}")
        else:
            print(f"  ⏭️  产线已存在: {production_line.code} - {production_line.name}")
    
    # 工位
    workstations_data = [
        {"code": "ST001", "name": "CNC-01工位", "production_line_code": "PL001", "description": "CNC加工工位1"},
        {"code": "ST002", "name": "CNC-02工位", "production_line_code": "PL001", "description": "CNC加工工位2"},
        {"code": "ST003", "name": "车床-01工位", "production_line_code": "PL002", "description": "普通车床工位1"},
        {"code": "ST004", "name": "车床-02工位", "production_line_code": "PL002", "description": "普通车床工位2"},
        {"code": "ST005", "name": "铣床-01工位", "production_line_code": "PL003", "description": "铣床工位1"},
        {"code": "ST006", "name": "装配-01工位", "production_line_code": "PL004", "description": "装配工位1"},
        {"code": "ST007", "name": "装配-02工位", "production_line_code": "PL004", "description": "装配工位2"},
        {"code": "ST008", "name": "装配-03工位", "production_line_code": "PL005", "description": "装配工位3"},
    ]
    
    for ws_data in workstations_data:
        production_line = next((pl for pl in production_lines if pl.code == ws_data["production_line_code"]), None)
        if not production_line:
            continue
        
        workstation, created = await Workstation.get_or_create(
            tenant_id=tenant_id,
            code=ws_data["code"],
            defaults={
                "name": ws_data["name"],
                "production_line_id": production_line.id,
                "description": ws_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not workstation.is_active:
            workstation.is_active = True
            await workstation.save()
        if created:
            print(f"  ✅ 创建工位: {workstation.code} - {workstation.name}")
        else:
            print(f"  ⏭️  工位已存在: {workstation.code} - {workstation.name}")


async def create_warehouse_data(tenant_id: int):
    """创建仓库管理数据"""
    print("\n📦 创建仓库管理数据...")
    
    # 仓库
    warehouses_data = [
        {"code": "WH001", "name": "原材料仓库", "description": "存储原材料"},
        {"code": "WH002", "name": "半成品仓库", "description": "存储半成品"},
        {"code": "WH003", "name": "成品仓库", "description": "存储成品"},
        {"code": "WH004", "name": "辅料仓库", "description": "存储辅料和耗材"},
    ]
    
    warehouses = []
    for wh_data in warehouses_data:
        warehouse, created = await Warehouse.get_or_create(
            tenant_id=tenant_id,
            code=wh_data["code"],
            defaults={
                "name": wh_data["name"],
                "description": wh_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not warehouse.is_active:
            warehouse.is_active = True
            await warehouse.save()
        warehouses.append(warehouse)
        if created:
            print(f"  ✅ 创建仓库: {warehouse.code} - {warehouse.name}")
        else:
            print(f"  ⏭️  仓库已存在: {warehouse.code} - {warehouse.name}")
    
    # 库区
    storage_areas_data = [
        {"code": "SA001", "name": "钢材区", "warehouse_code": "WH001", "description": "钢材存储区"},
        {"code": "SA002", "name": "铝材区", "warehouse_code": "WH001", "description": "铝材存储区"},
        {"code": "SA003", "name": "A区", "warehouse_code": "WH002", "description": "半成品A区"},
        {"code": "SA004", "name": "B区", "warehouse_code": "WH002", "description": "半成品B区"},
        {"code": "SA005", "name": "成品A区", "warehouse_code": "WH003", "description": "成品存储A区"},
        {"code": "SA006", "name": "成品B区", "warehouse_code": "WH003", "description": "成品存储B区"},
    ]
    
    storage_areas = []
    for sa_data in storage_areas_data:
        warehouse = next((w for w in warehouses if w.code == sa_data["warehouse_code"]), None)
        if not warehouse:
            continue
        
        storage_area, created = await StorageArea.get_or_create(
            tenant_id=tenant_id,
            code=sa_data["code"],
            defaults={
                "name": sa_data["name"],
                "warehouse_id": warehouse.id,
                "description": sa_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not storage_area.is_active:
            storage_area.is_active = True
            await storage_area.save()
        storage_areas.append(storage_area)
        if created:
            print(f"  ✅ 创建库区: {storage_area.code} - {storage_area.name}")
        else:
            print(f"  ⏭️  库区已存在: {storage_area.code} - {storage_area.name}")
    
    # 库位
    storage_locations_data = [
        {"code": "SL001", "name": "A-01-01", "storage_area_code": "SA001", "description": "钢材区A排01号01位"},
        {"code": "SL002", "name": "A-01-02", "storage_area_code": "SA001", "description": "钢材区A排01号02位"},
        {"code": "SL003", "name": "B-01-01", "storage_area_code": "SA002", "description": "铝材区B排01号01位"},
        {"code": "SL004", "name": "A-01-01", "storage_area_code": "SA003", "description": "半成品A区A排01号01位"},
        {"code": "SL005", "name": "A-01-01", "storage_area_code": "SA005", "description": "成品A区A排01号01位"},
    ]
    
    for sl_data in storage_locations_data:
        storage_area = next((sa for sa in storage_areas if sa.code == sl_data["storage_area_code"]), None)
        if not storage_area:
            continue
        
        storage_location, created = await StorageLocation.get_or_create(
            tenant_id=tenant_id,
            code=sl_data["code"],
            defaults={
                "name": sl_data["name"],
                "storage_area_id": storage_area.id,
                "description": sl_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not storage_location.is_active:
            storage_location.is_active = True
            await storage_location.save()
        if created:
            print(f"  ✅ 创建库位: {storage_location.code} - {storage_location.name}")
        else:
            print(f"  ⏭️  库位已存在: {storage_location.code} - {storage_location.name}")


async def create_material_data(tenant_id: int):
    """创建物料管理数据"""
    print("\n📦 创建物料管理数据...")
    
    # 物料组
    material_groups_data = [
        {"code": "MG001", "name": "原材料", "description": "原材料分类"},
        {"code": "MG002", "name": "钢材", "parent_code": "MG001", "description": "钢材分类"},
        {"code": "MG003", "name": "铝材", "parent_code": "MG001", "description": "铝材分类"},
        {"code": "MG004", "name": "半成品", "description": "半成品分类"},
        {"code": "MG005", "name": "成品", "description": "成品分类"},
        {"code": "MG006", "name": "辅料", "description": "辅料分类"},
    ]
    
    material_groups = []
    for mg_data in material_groups_data:
        parent = None
        if "parent_code" in mg_data:
            parent = next((mg for mg in material_groups if mg.code == mg_data["parent_code"]), None)
        
        material_group, created = await MaterialGroup.get_or_create(
            tenant_id=tenant_id,
            code=mg_data["code"],
            defaults={
                "name": mg_data["name"],
                "parent_id": parent.id if parent else None,
                "description": mg_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not material_group.is_active:
            material_group.is_active = True
            await material_group.save()
        material_groups.append(material_group)
        if created:
            print(f"  ✅ 创建物料组: {material_group.code} - {material_group.name}")
        else:
            print(f"  ⏭️  物料组已存在: {material_group.code} - {material_group.name}")
    
    # 物料
    materials_data = [
        {"code": "MAT001", "name": "Q235钢板", "group_code": "MG002", "specification": "10mm×1000mm×2000mm", "base_unit": "kg", "brand": "宝钢", "model": "Q235"},
        {"code": "MAT002", "name": "45#圆钢", "group_code": "MG002", "specification": "Φ50×3000mm", "base_unit": "kg", "brand": "首钢", "model": "45#"},
        {"code": "MAT003", "name": "6061铝板", "group_code": "MG003", "specification": "5mm×1000mm×2000mm", "base_unit": "kg", "brand": "中铝", "model": "6061"},
        {"code": "MAT004", "name": "加工件A", "group_code": "MG004", "specification": "100×50×30mm", "base_unit": "件", "brand": "自制", "model": "A型"},
        {"code": "MAT005", "name": "加工件B", "group_code": "MG004", "specification": "80×40×25mm", "base_unit": "件", "brand": "自制", "model": "B型"},
        {"code": "MAT006", "name": "成品零件X", "group_code": "MG005", "specification": "标准件", "base_unit": "件", "brand": "自制", "model": "X型"},
        {"code": "MAT007", "name": "切削液", "group_code": "MG006", "specification": "20L/桶", "base_unit": "桶", "brand": "美孚", "model": "标准型"},
        {"code": "MAT008", "name": "冷却液", "group_code": "MG006", "specification": "10L/桶", "base_unit": "桶", "brand": "嘉实多", "model": "高效型"},
    ]
    
    materials = []
    for mat_data in materials_data:
        material_group = next((mg for mg in material_groups if mg.code == mat_data["group_code"]), None)
        if not material_group:
            continue
        
        material, created = await Material.get_or_create(
            tenant_id=tenant_id,
            code=mat_data["code"],
            defaults={
                "name": mat_data["name"],
                "group_id": material_group.id,
                "specification": mat_data["specification"],
                "base_unit": mat_data["base_unit"],
                "brand": mat_data.get("brand"),
                "model": mat_data.get("model"),
                "batch_managed": False,
                "variant_managed": False,
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not material.is_active:
            material.is_active = True
            await material.save()
        materials.append(material)
        if created:
            print(f"  ✅ 创建物料: {material.code} - {material.name}")
        else:
            print(f"  ⏭️  物料已存在: {material.code} - {material.name}")
    
    # BOM（成品零件X由加工件A和加工件B组成）
    bom_data = [
        {
            "material_code": "MAT006",  # 成品零件X
            "items": [
                {"component_code": "MAT004", "quantity": 2, "unit": "件", "description": "需要2个加工件A"},
                {"component_code": "MAT005", "quantity": 1, "unit": "件", "description": "需要1个加工件B"},
            ]
        },
    ]
    
    for bom_info in bom_data:
        material = next((m for m in materials if m.code == bom_info["material_code"]), None)
        if not material:
            continue
        
        for item in bom_info["items"]:
            component = next((m for m in materials if m.code == item["component_code"]), None)
            if not component:
                continue
            
            # 检查是否已存在相同的BOM记录
            existing_bom = await BOM.filter(
                tenant_id=tenant_id,
                material_id=material.id,
                component_id=component.id,
                deleted_at__isnull=True
            ).first()
            
            if existing_bom:
                # 如果BOM已存在但未启用，启用它
                if not existing_bom.is_active:
                    existing_bom.is_active = True
                    await existing_bom.save()
                print(f"  ⏭️  BOM已存在: {material.code} -> {component.code}")
            else:
                bom = await BOM.create(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    component_id=component.id,
                    quantity=item["quantity"],
                    unit=item["unit"],
                    description=item.get("description"),
                    is_active=True,
                )
                print(f"  ✅ 创建BOM: {material.code} -> {component.code} ({bom.quantity} {bom.unit})")


async def create_process_data(tenant_id: int):
    """创建工艺管理数据"""
    print("\n📦 创建工艺管理数据...")
    
    # 不良品类型
    defect_types_data = [
        {"code": "DEF001", "name": "尺寸超差", "category": "尺寸不良", "description": "产品尺寸超出公差范围"},
        {"code": "DEF002", "name": "表面缺陷", "category": "外观不良", "description": "产品表面存在划痕、凹陷等缺陷"},
        {"code": "DEF003", "name": "材质问题", "category": "材质不良", "description": "材质不符合要求"},
        {"code": "DEF004", "name": "装配不良", "category": "装配不良", "description": "装配过程中出现的问题"},
    ]
    
    for dt_data in defect_types_data:
        defect_type, created = await DefectType.get_or_create(
            tenant_id=tenant_id,
            code=dt_data["code"],
            defaults={
                "name": dt_data["name"],
                "category": dt_data["category"],
                "description": dt_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not defect_type.is_active:
            defect_type.is_active = True
            await defect_type.save()
        if created:
            print(f"  ✅ 创建不良品类型: {defect_type.code} - {defect_type.name}")
        else:
            print(f"  ⏭️  不良品类型已存在: {defect_type.code} - {defect_type.name}")
    
    # 工序
    operations_data = [
        {"code": "OP001", "name": "下料", "description": "原材料下料工序", "standard_time": 30},
        {"code": "OP002", "name": "粗加工", "description": "粗加工工序", "standard_time": 60},
        {"code": "OP003", "name": "精加工", "description": "精加工工序", "standard_time": 90},
        {"code": "OP004", "name": "热处理", "description": "热处理工序", "standard_time": 120},
        {"code": "OP005", "name": "表面处理", "description": "表面处理工序", "standard_time": 45},
        {"code": "OP006", "name": "检验", "description": "质量检验工序", "standard_time": 20},
        {"code": "OP007", "name": "装配", "description": "产品装配工序", "standard_time": 150},
    ]
    
    operations = []
    for op_data in operations_data:
        operation, created = await Operation.get_or_create(
            tenant_id=tenant_id,
            code=op_data["code"],
            defaults={
                "name": op_data["name"],
                "description": op_data["description"],
                "standard_time": op_data.get("standard_time", 0),
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not operation.is_active:
            operation.is_active = True
            await operation.save()
        operations.append(operation)
        if created:
            print(f"  ✅ 创建工序: {operation.code} - {operation.name}")
        else:
            print(f"  ⏭️  工序已存在: {operation.code} - {operation.name}")
    
    # 工艺路线
    process_routes_data = [
        {
            "code": "PR001",
            "name": "标准加工路线",
            "description": "标准零件加工工艺路线",
            "operations": ["OP001", "OP002", "OP003", "OP006"],
        },
        {
            "code": "PR002",
            "name": "热处理路线",
            "description": "需要热处理的加工路线",
            "operations": ["OP001", "OP002", "OP004", "OP003", "OP006"],
        },
    ]
    
    for pr_data in process_routes_data:
        process_route, created = await ProcessRoute.get_or_create(
            tenant_id=tenant_id,
            code=pr_data["code"],
            defaults={
                "name": pr_data["name"],
                "description": pr_data["description"],
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not process_route.is_active:
            process_route.is_active = True
            await process_route.save()
        if created:
            print(f"  ✅ 创建工艺路线: {process_route.code} - {process_route.name}")
        else:
            print(f"  ⏭️  工艺路线已存在: {process_route.code} - {process_route.name}")
    
    # SOP
    sop_data = [
        {
            "code": "SOP001",
            "name": "CNC加工标准作业程序",
            "description": "CNC加工的标准作业程序",
            "flowConfig": {
                "nodes": [
                    {"id": "start", "type": "start", "position": {"x": 100, "y": 100}, "data": {"label": "开始"}},
                    {"id": "step1", "type": "step", "position": {"x": 300, "y": 100}, "data": {"label": "装夹工件", "description": "将工件装夹到CNC机床"}},
                    {"id": "step2", "type": "step", "position": {"x": 500, "y": 100}, "data": {"label": "设置参数", "description": "设置CNC加工参数"}},
                    {"id": "check1", "type": "check", "position": {"x": 700, "y": 100}, "data": {"label": "参数检查", "description": "检查加工参数是否正确"}},
                    {"id": "step3", "type": "step", "position": {"x": 900, "y": 100}, "data": {"label": "开始加工", "description": "启动CNC加工"}},
                    {"id": "end", "type": "end", "position": {"x": 1100, "y": 100}, "data": {"label": "结束"}},
                ],
                "edges": [
                    {"id": "e1", "source": "start", "target": "step1"},
                    {"id": "e2", "source": "step1", "target": "step2"},
                    {"id": "e3", "source": "step2", "target": "check1"},
                    {"id": "e4", "source": "check1", "target": "step3"},
                    {"id": "e5", "source": "step3", "target": "end"},
                ],
            },
        },
    ]
    
    for sop_info in sop_data:
        sop, created = await SOP.get_or_create(
            tenant_id=tenant_id,
            code=sop_info["code"],
            defaults={
                "name": sop_info["name"],
                "description": sop_info.get("description"),
                "flowConfig": sop_info.get("flowConfig"),
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not sop.is_active:
            sop.is_active = True
            await sop.save()
        if created:
            print(f"  ✅ 创建SOP: {sop.code} - {sop.name}")
        else:
            print(f"  ⏭️  SOP已存在: {sop.code} - {sop.name}")


async def create_supply_chain_data(tenant_id: int):
    """创建供应链数据"""
    print("\n📦 创建供应链数据...")
    
    # 客户
    customers_data = [
        {"code": "CUS001", "name": "北京机械制造有限公司", "short_name": "北京机械", "contact_person": "张经理", "phone": "010-12345678", "email": "zhang@bjmech.com", "address": "北京市朝阳区xxx路xxx号", "category": "A类客户"},
        {"code": "CUS002", "name": "上海精密设备股份有限公司", "short_name": "上海精密", "contact_person": "李经理", "phone": "021-87654321", "email": "li@shprecision.com", "address": "上海市浦东新区xxx路xxx号", "category": "A类客户"},
        {"code": "CUS003", "name": "深圳电子科技有限公司", "short_name": "深圳电子", "contact_person": "王经理", "phone": "0755-11223344", "email": "wang@sztech.com", "address": "深圳市南山区xxx路xxx号", "category": "B类客户"},
    ]
    
    for cus_data in customers_data:
        customer, created = await Customer.get_or_create(
            tenant_id=tenant_id,
            code=cus_data["code"],
            defaults={
                "name": cus_data["name"],
                "short_name": cus_data.get("short_name"),
                "contact_person": cus_data.get("contact_person"),
                "phone": cus_data.get("phone"),
                "email": cus_data.get("email"),
                "address": cus_data.get("address"),
                "category": cus_data.get("category"),
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not customer.is_active:
            customer.is_active = True
            await customer.save()
        if created:
            print(f"  ✅ 创建客户: {customer.code} - {customer.name}")
        else:
            print(f"  ⏭️  客户已存在: {customer.code} - {customer.name}")
    
    # 供应商
    suppliers_data = [
        {"code": "SUP001", "name": "宝钢集团有限公司", "short_name": "宝钢", "contact_person": "赵经理", "phone": "021-12345678", "email": "zhao@baosteel.com", "address": "上海市宝山区xxx路xxx号", "category": "原材料供应商"},
        {"code": "SUP002", "name": "首钢集团有限公司", "short_name": "首钢", "contact_person": "钱经理", "phone": "010-87654321", "email": "qian@shougang.com", "address": "北京市石景山区xxx路xxx号", "category": "原材料供应商"},
        {"code": "SUP003", "name": "中铝股份有限公司", "short_name": "中铝", "contact_person": "孙经理", "phone": "010-11223344", "email": "sun@chalco.com", "address": "北京市海淀区xxx路xxx号", "category": "原材料供应商"},
        {"code": "SUP004", "name": "美孚润滑油有限公司", "short_name": "美孚", "contact_person": "周经理", "phone": "021-55667788", "email": "zhou@mobil.com", "address": "上海市黄浦区xxx路xxx号", "category": "辅料供应商"},
    ]
    
    for sup_data in suppliers_data:
        supplier, created = await Supplier.get_or_create(
            tenant_id=tenant_id,
            code=sup_data["code"],
            defaults={
                "name": sup_data["name"],
                "short_name": sup_data.get("short_name"),
                "contact_person": sup_data.get("contact_person"),
                "phone": sup_data.get("phone"),
                "email": sup_data.get("email"),
                "address": sup_data.get("address"),
                "category": sup_data.get("category"),
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not supplier.is_active:
            supplier.is_active = True
            await supplier.save()
        if created:
            print(f"  ✅ 创建供应商: {supplier.code} - {supplier.name}")
        else:
            print(f"  ⏭️  供应商已存在: {supplier.code} - {supplier.name}")


async def create_performance_data(tenant_id: int):
    """创建绩效管理数据"""
    print("\n📦 创建绩效管理数据...")
    
    # 假期
    holidays_data = [
        {"name": "元旦", "holiday_date": date(2025, 1, 1), "holiday_type": "法定节假日", "description": "元旦节"},
        {"name": "春节", "holiday_date": date(2025, 1, 29), "holiday_type": "法定节假日", "description": "春节假期"},
        {"name": "清明节", "holiday_date": date(2025, 4, 4), "holiday_type": "法定节假日", "description": "清明节"},
        {"name": "劳动节", "holiday_date": date(2025, 5, 1), "holiday_type": "法定节假日", "description": "劳动节"},
        {"name": "端午节", "holiday_date": date(2025, 5, 31), "holiday_type": "法定节假日", "description": "端午节"},
        {"name": "中秋节", "holiday_date": date(2025, 10, 6), "holiday_type": "法定节假日", "description": "中秋节"},
        {"name": "国庆节", "holiday_date": date(2025, 10, 1), "holiday_type": "法定节假日", "description": "国庆节"},
        {"name": "公司年会", "holiday_date": date(2025, 12, 31), "holiday_type": "公司假期", "description": "公司年会日"},
    ]
    
    for h_data in holidays_data:
        holiday, created = await Holiday.get_or_create(
            tenant_id=tenant_id,
            holiday_date=h_data["holiday_date"],
            defaults={
                "name": h_data["name"],
                "holiday_type": h_data.get("holiday_type"),
                "description": h_data.get("description"),
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not holiday.is_active:
            holiday.is_active = True
            await holiday.save()
        if created:
            print(f"  ✅ 创建假期: {holiday.name} - {holiday.holiday_date}")
        else:
            print(f"  ⏭️  假期已存在: {holiday.name} - {holiday.holiday_date}")
    
    # 技能
    skills_data = [
        {"code": "SK001", "name": "CNC操作", "category": "操作技能", "description": "CNC机床操作技能", "level": "高级"},
        {"code": "SK002", "name": "普通车床操作", "category": "操作技能", "description": "普通车床操作技能", "level": "中级"},
        {"code": "SK003", "name": "铣床操作", "category": "操作技能", "description": "铣床操作技能", "level": "中级"},
        {"code": "SK004", "name": "质量检验", "category": "检验技能", "description": "产品质量检验技能", "level": "高级"},
        {"code": "SK005", "name": "装配技能", "category": "装配技能", "description": "产品装配技能", "level": "中级"},
        {"code": "SK006", "name": "热处理操作", "category": "操作技能", "description": "热处理设备操作技能", "level": "高级"},
    ]
    
    for sk_data in skills_data:
        skill, created = await Skill.get_or_create(
            tenant_id=tenant_id,
            code=sk_data["code"],
            defaults={
                "name": sk_data["name"],
                "category": sk_data.get("category"),
                "description": sk_data.get("description"),
                "level": sk_data.get("level"),
                "is_active": True,
            }
        )
        # 如果数据已存在，确保 is_active 为 True
        if not created and not skill.is_active:
            skill.is_active = True
            await skill.save()
        if created:
            print(f"  ✅ 创建技能: {skill.code} - {skill.name}")
        else:
            print(f"  ⏭️  技能已存在: {skill.code} - {skill.name}")


async def mock_master_data(tenant_id: int = None, force: bool = False):
    """
    创建主数据管理 Mock 数据
    
    Args:
        tenant_id: 组织ID（如果为None，则使用第一个租户）
        force: 是否强制重新初始化（暂未实现）
    """
    try:
        # 确保时区配置正确（动态更新）
        TORTOISE_ORM["use_tz"] = platform_settings.USE_TZ
        TORTOISE_ORM["timezone"] = platform_settings.TIMEZONE
        
        # 确保环境变量已设置（Tortoise ORM 从环境变量读取时区配置）
        import os
        os.environ["USE_TZ"] = str(platform_settings.USE_TZ)
        os.environ["TIMEZONE"] = platform_settings.TIMEZONE
        
        # 重新初始化时区环境（确保 Tortoise ORM 读取到最新配置）
        setup_tortoise_timezone_env()
        
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 如果没有指定租户ID，使用第一个租户
        if tenant_id is None:
            tenant = await Tenant.all().first()
            if not tenant:
                print("=" * 60)
                print("❌ 错误：未找到任何租户，请先创建租户")
                print("=" * 60)
                return
            tenant_id = tenant.id
            print("=" * 60)
            print(f"📋 使用租户: {tenant.name} (ID: {tenant_id})")
            print("=" * 60)
        else:
            # 验证租户是否存在
            tenant = await Tenant.filter(id=tenant_id).first()
            if not tenant:
                print("=" * 60)
                print(f"❌ 错误：租户 ID {tenant_id} 不存在")
                print("=" * 60)
                return
            print("=" * 60)
            print(f"📋 使用租户: {tenant.name} (ID: {tenant_id})")
            print("=" * 60)
        
        # 创建各类主数据
        await create_factory_data(tenant_id)
        await create_warehouse_data(tenant_id)
        await create_material_data(tenant_id)
        await create_process_data(tenant_id)
        await create_supply_chain_data(tenant_id)
        await create_performance_data(tenant_id)
        
        print("\n" + "=" * 60)
        print("✅ 主数据管理 Mock 数据创建完成！")
        print("=" * 60)
        
    except Exception as e:
        print("=" * 60)
        print(f"❌ Mock 数据创建失败: {str(e)}")
        import traceback
        traceback.print_exc()
        print("=" * 60)
        raise
    finally:
        # 关闭连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="为主数据管理模块创建机械加工厂 Mock 数据")
    parser.add_argument("--tenant-id", type=int, help="组织ID（可选，如果不指定则使用第一个租户）")
    parser.add_argument("--force", action="store_true", help="强制重新初始化（暂未实现）")
    
    args = parser.parse_args()
    
    asyncio.run(mock_master_data(args.tenant_id, args.force))
