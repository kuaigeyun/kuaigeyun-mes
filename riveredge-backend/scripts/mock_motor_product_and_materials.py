"""
电机产品及全套材料 Mock 数据脚本

创建一台电机产品及其 BOM 下的各类物料，覆盖来源类型：
- Make（自制件）：成品电机、定子组件、转子组件等
- Buy（采购件）：硅钢片、漆包线、轴承、接线端子等
- Outsource（委外件）：外壳委外加工
- Phantom（虚拟件）：电机总成（仅用于 BOM 结构）
- Configure（配置件）：可选（本 mock 用半成品带变体示例）

运行方式（在 riveredge-backend 目录下）：
  PYTHONPATH=src uv run python scripts/mock_motor_product_and_materials.py
"""

import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from apps.master_data.models.material import BOM, Material, MaterialGroup
from apps.master_data.models.process import ProcessRoute
from apps.master_data.models.supplier import Supplier
from apps.master_data.schemas.material_schemas import (
    BOMCreate,
    MaterialCreate,
    MaterialGroupCreate,
    MaterialUpdate,
)
from apps.master_data.services.material_service import MaterialService
from infra.infrastructure.database.database import TORTOISE_ORM
from tortoise import Tortoise


# 默认租户 ID（可按需改）
DEFAULT_TENANT_ID = 1


async def get_or_create_process_route(tenant_id: int, code: str, name: str):
    """获取或创建工艺路线"""
    route = await ProcessRoute.filter(
        tenant_id=tenant_id, code=code, deleted_at__isnull=True
    ).first()
    if route:
        return route
    route = await ProcessRoute.create(
        tenant_id=tenant_id,
        code=code,
        name=name,
        description=f"{name}工艺路线",
        is_active=True,
    )
    print(f"  ✓ 创建工艺路线: {route.code} - {route.name}")
    return route


async def get_or_create_supplier(tenant_id: int, code: str, name: str):
    """获取或创建供应商"""
    sup = await Supplier.filter(
        tenant_id=tenant_id, code=code, deleted_at__isnull=True
    ).first()
    if sup:
        return sup
    sup = await Supplier.create(
        tenant_id=tenant_id,
        code=code,
        name=name,
        is_active=True,
    )
    print(f"  ✓ 创建供应商: {sup.code} - {sup.name}")
    return sup


async def get_or_create_material_group(tenant_id: int, code: str, name: str, parent_id=None):
    """获取或创建物料分组"""
    q = MaterialGroup.filter(tenant_id=tenant_id, code=code, deleted_at__isnull=True)
    group = await q.first()
    if group:
        return group
    group = await MaterialService.create_material_group(
        tenant_id=tenant_id,
        data=MaterialGroupCreate(
            code=code,
            name=name,
            parent_id=parent_id,
            description=f"{name}分组",
            is_active=True,
        ),
    )
    print(f"  ✓ 创建物料分组: {group.code} - {group.name}")
    return group


async def get_or_create_material_with_source(
    tenant_id: int,
    *,
    main_code: str,
    name: str,
    group_id: int,
    base_unit: str = "PCS",
    material_type: str = "SEMI",
    specification: str = None,
    source_type: str,
    source_config: dict = None,
    process_route_id: int = None,
):
    """获取或创建物料（含来源类型与 source_config）；已存在则直接返回"""
    existing = await Material.filter(
        tenant_id=tenant_id,
        main_code=main_code,
        deleted_at__isnull=True,
    ).first()
    if existing:
        print(f"  · 物料已存在: {main_code} - {existing.name}")
        return existing
    data = MaterialCreate(
        main_code=main_code,
        name=name,
        group_id=group_id,
        base_unit=base_unit,
        material_type=material_type,
        specification=specification or "",
        description=f"{name}",
        is_active=True,
        source_type=source_type,
        source_config=source_config or {},
    )
    material = await MaterialService.create_material(tenant_id=tenant_id, data=data)
    if process_route_id is not None:
        await MaterialService.update_material(
            tenant_id=tenant_id,
            material_uuid=material.uuid,
            data=MaterialUpdate(process_route_id=process_route_id),
        )
        material = await Material.filter(tenant_id=tenant_id, uuid=material.uuid).first()
    return material


async def main():
    await Tortoise.init(config=TORTOISE_ORM)
    tenant_id = DEFAULT_TENANT_ID

    try:
        print("=" * 60)
        print("电机产品及全套材料 Mock 数据")
        print("=" * 60)

        # 1. 工艺路线与供应商
        route_assembly = await get_or_create_process_route(
            tenant_id, "PR-MOTOR-ASM", "电机总装工艺"
        )
        route_stator = await get_or_create_process_route(
            tenant_id, "PR-STATOR", "定子绕线工艺"
        )
        route_rotor = await get_or_create_process_route(
            tenant_id, "PR-ROTOR", "转子加工工艺"
        )
        supplier_silicon = await get_or_create_supplier(tenant_id, "SUP-SILICON", "华东硅钢供应")
        supplier_copper = await get_or_create_supplier(tenant_id, "SUP-COPPER", "江南漆包线厂")
        supplier_bearing = await get_or_create_supplier(tenant_id, "SUP-BEARING", "伟达五金")
        supplier_outsource = await get_or_create_supplier(tenant_id, "SUP-OUTSOURCE", "精工外壳委外")

        # 2. 物料分组
        grp_fin = await get_or_create_material_group(tenant_id, "MG-MOTOR-FIN", "电机成品")
        grp_semi = await get_or_create_material_group(tenant_id, "MG-MOTOR-SEMI", "电机半成品")
        grp_raw = await get_or_create_material_group(tenant_id, "MG-MOTOR-RAW", "电机原材料")
        grp_pack = await get_or_create_material_group(tenant_id, "MG-MOTOR-PACK", "电机包装辅料")

        created = {}

        # 3. 成品 - Make（自制件，装配型）
        m_fin = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-FIN-001",
            name="小型交流电机（成品）",
            group_id=grp_fin.id,
            base_unit="PCS",
            material_type="FIN",
            specification="220V 50Hz 0.75kW",
            source_type="Make",
            source_config={
                "manufacturing_mode": "assembly",
                "production_lead_time": 5,
                "min_production_batch": 10,
                "production_waste_rate": 1,
            },
            process_route_id=route_assembly.id,
        )
        created["MOTOR-FIN-001"] = m_fin
        print(f"  ✓ 物料(Make): {m_fin.main_code} - {m_fin.name}")

        # 4. 半成品 - Make（自制件）
        m_stator = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-SEMI-STATOR",
            name="定子组件",
            group_id=grp_semi.id,
            base_unit="PCS",
            material_type="SEMI",
            specification="定子铁心+绕组",
            source_type="Make",
            source_config={
                "manufacturing_mode": "fabrication",
                "production_lead_time": 3,
                "min_production_batch": 20,
                "production_waste_rate": 2,
            },
            process_route_id=route_stator.id,
        )
        created["MOTOR-SEMI-STATOR"] = m_stator
        print(f"  ✓ 物料(Make): {m_stator.main_code} - {m_stator.name}")

        m_rotor = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-SEMI-ROTOR",
            name="转子组件",
            group_id=grp_semi.id,
            base_unit="PCS",
            material_type="SEMI",
            specification="转子铁心+轴",
            source_type="Make",
            source_config={
                "manufacturing_mode": "fabrication",
                "production_lead_time": 2,
                "min_production_batch": 20,
                "production_waste_rate": 1,
            },
            process_route_id=route_rotor.id,
        )
        created["MOTOR-SEMI-ROTOR"] = m_rotor
        print(f"  ✓ 物料(Make): {m_rotor.main_code} - {m_rotor.name}")

        # 5. 采购件 - Buy
        m_silicon = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-RAW-SILICON",
            name="硅钢片",
            group_id=grp_raw.id,
            base_unit="KG",
            material_type="RAW",
            specification="0.5mm 无取向",
            source_type="Buy",
            source_config={
                "purchase_price": 8.5,
                "purchase_lead_time": 7,
                "min_purchase_batch": 100,
                "default_supplier_id": supplier_silicon.id,
                "default_supplier_name": supplier_silicon.name,
            },
        )
        created["MOTOR-RAW-SILICON"] = m_silicon
        print(f"  ✓ 物料(Buy): {m_silicon.main_code} - {m_silicon.name}")

        m_copper = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-RAW-COPPER",
            name="漆包线",
            group_id=grp_raw.id,
            base_unit="KG",
            material_type="RAW",
            specification="0.5mm 聚酯漆包铜线",
            source_type="Buy",
            source_config={
                "purchase_price": 65,
                "purchase_lead_time": 5,
                "min_purchase_batch": 50,
                "default_supplier_id": supplier_copper.id,
                "default_supplier_name": supplier_copper.name,
            },
        )
        created["MOTOR-RAW-COPPER"] = m_copper
        print(f"  ✓ 物料(Buy): {m_copper.main_code} - {m_copper.name}")

        m_bearing = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-RAW-BEARING",
            name="轴承",
            group_id=grp_raw.id,
            base_unit="PCS",
            material_type="RAW",
            specification="6202ZZ",
            source_type="Buy",
            source_config={
                "purchase_price": 3.2,
                "purchase_lead_time": 3,
                "min_purchase_batch": 100,
                "default_supplier_id": supplier_bearing.id,
                "default_supplier_name": supplier_bearing.name,
            },
        )
        created["MOTOR-RAW-BEARING"] = m_bearing
        print(f"  ✓ 物料(Buy): {m_bearing.main_code} - {m_bearing.name}")

        m_terminal = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-RAW-TERMINAL",
            name="接线端子",
            group_id=grp_raw.id,
            base_unit="PCS",
            material_type="RAW",
            specification="插拔式 3P",
            source_type="Buy",
            source_config={
                "purchase_price": 0.8,
                "purchase_lead_time": 2,
                "min_purchase_batch": 500,
                "default_supplier_id": supplier_bearing.id,
                "default_supplier_name": supplier_bearing.name,
            },
        )
        created["MOTOR-RAW-TERMINAL"] = m_terminal
        print(f"  ✓ 物料(Buy): {m_terminal.main_code} - {m_terminal.name}")

        # 6. 委外件 - Outsource
        m_house = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-SEMI-HOUSE",
            name="电机外壳（委外）",
            group_id=grp_semi.id,
            base_unit="PCS",
            material_type="SEMI",
            specification="铝合金压铸",
            source_type="Outsource",
            source_config={
                "outsource_supplier_id": supplier_outsource.id,
                "outsource_supplier_name": supplier_outsource.name,
                "outsource_lead_time": 10,
                "min_outsource_batch": 50,
            },
        )
        created["MOTOR-SEMI-HOUSE"] = m_house
        print(f"  ✓ 物料(Outsource): {m_house.main_code} - {m_house.name}")

        # 7. 虚拟件 - Phantom（无 source_config 或空）
        m_phantom = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-PHANTOM-ASM",
            name="电机总成（虚拟）",
            group_id=grp_semi.id,
            base_unit="PCS",
            material_type="SEMI",
            specification="BOM 虚拟节点",
            source_type="Phantom",
            source_config={},
        )
        created["MOTOR-PHANTOM-ASM"] = m_phantom
        print(f"  ✓ 物料(Phantom): {m_phantom.main_code} - {m_phantom.name}")

        # 8. 包装辅料 - Buy
        m_box = await get_or_create_material_with_source(
            tenant_id,
            main_code="MOTOR-PACK-BOX",
            name="电机包装箱",
            group_id=grp_pack.id,
            base_unit="PCS",
            material_type="PACK",
            specification="单台装 内衬泡沫",
            source_type="Buy",
            source_config={
                "purchase_price": 5,
                "purchase_lead_time": 2,
                "min_purchase_batch": 200,
                "default_supplier_id": supplier_bearing.id,
                "default_supplier_name": supplier_bearing.name,
            },
        )
        created["MOTOR-PACK-BOX"] = m_box
        print(f"  ✓ 物料(Buy): {m_box.main_code} - {m_box.name}")

        # 9. BOM：成品电机 -> 定子、转子、外壳、轴承、端子、包装
        bom_list = [
            ("MOTOR-FIN-001", "MOTOR-SEMI-STATOR", 1.0),
            ("MOTOR-FIN-001", "MOTOR-SEMI-ROTOR", 1.0),
            ("MOTOR-FIN-001", "MOTOR-SEMI-HOUSE", 1.0),
            ("MOTOR-FIN-001", "MOTOR-RAW-BEARING", 2.0),
            ("MOTOR-FIN-001", "MOTOR-RAW-TERMINAL", 1.0),
            ("MOTOR-FIN-001", "MOTOR-PACK-BOX", 1.0),
            ("MOTOR-SEMI-STATOR", "MOTOR-RAW-SILICON", 2.5),
            ("MOTOR-SEMI-STATOR", "MOTOR-RAW-COPPER", 1.2),
            ("MOTOR-SEMI-ROTOR", "MOTOR-RAW-SILICON", 1.8),
        ]
        for parent_code, comp_code, qty in bom_list:
            if parent_code not in created or comp_code not in created:
                continue
            parent = created[parent_code]
            comp = created[comp_code]
            existing = await BOM.filter(
                tenant_id=tenant_id,
                material_id=parent.id,
                component_id=comp.id,
                deleted_at__isnull=True,
            ).first()
            if existing:
                continue
            await MaterialService.create_bom(
                tenant_id=tenant_id,
                data=BOMCreate(
                    material_id=parent.id,
                    component_id=comp.id,
                    quantity=qty,
                    unit=comp.base_unit,
                    description=f"{comp.name} -> {parent.name}",
                    is_active=True,
                ),
            )
            print(f"  ✓ BOM: {parent_code} x {qty} {comp_code}")

        print()
        print("=" * 60)
        print("Mock 完成。电机产品及材料一览：")
        print("  - 成品(Make): 小型交流电机（成品）")
        print("  - 半成品(Make): 定子组件、转子组件")
        print("  - 采购(Buy): 硅钢片、漆包线、轴承、接线端子、包装箱")
        print("  - 委外(Outsource): 电机外壳（委外）")
        print("  - 虚拟(Phantom): 电机总成（虚拟）")
        print("=" * 60)
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
