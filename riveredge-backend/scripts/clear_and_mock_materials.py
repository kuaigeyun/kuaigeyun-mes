"""
清除并重新生成物料 Mock 数据脚本

清除所有物料相关数据（物料分组、物料、BOM），然后重新生成 mock 数据。
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from apps.master_data.models.material import BOM, Material, MaterialGroup
from apps.master_data.schemas.material_schemas import (
    BOMCreate,
    MaterialCreate,
    MaterialGroupCreate,
)
from apps.master_data.services.material_service import MaterialService
from infra.infrastructure.database.database import TORTOISE_ORM
from tortoise import Tortoise


async def clear_all_material_data(tenant_id: int):
    """
    清除所有物料相关数据
    
    Args:
        tenant_id: 租户ID
    """
    print(f"正在清除租户 {tenant_id} 的所有物料数据...")
    
    # 删除 BOM（先删除，因为有外键约束）
    bom_count = await BOM.filter(tenant_id=tenant_id).count()
    if bom_count > 0:
        await BOM.filter(tenant_id=tenant_id).delete()
        print(f"  ✓ 已删除 {bom_count} 条 BOM 记录")
    
    # 删除物料
    material_count = await Material.filter(tenant_id=tenant_id).count()
    if material_count > 0:
        await Material.filter(tenant_id=tenant_id).delete()
        print(f"  ✓ 已删除 {material_count} 条物料记录")
    
    # 删除物料分组（最后删除，因为有自引用外键）
    group_count = await MaterialGroup.filter(tenant_id=tenant_id).count()
    if group_count > 0:
        # 先删除所有子分组的外键引用
        await MaterialGroup.filter(tenant_id=tenant_id).update(parent_id=None)
        # 然后删除所有分组
        await MaterialGroup.filter(tenant_id=tenant_id).delete()
        print(f"  ✓ 已删除 {group_count} 条物料分组记录")
    
    print("✓ 所有物料数据已清除")


async def create_mock_material_data(tenant_id: int):
    """
    创建 Mock 物料数据
    
    Args:
        tenant_id: 租户ID
    """
    print(f"\n正在为租户 {tenant_id} 创建 Mock 物料数据...")
    
    # 创建物料分组（树形结构）
    groups_data = [
        # 一级分组
        {"code": "MG001", "name": "原材料", "parent_id": None},
        {"code": "MG002", "name": "半成品", "parent_id": None},
        {"code": "MG003", "name": "成品", "parent_id": None},
        {"code": "MG004", "name": "包装材料", "parent_id": None},
        {"code": "MG005", "name": "辅助材料", "parent_id": None},
    ]
    
    # 二级分组
    sub_groups_data = [
        {"code": "MG00101", "name": "金属材料", "parent_code": "MG001"},
        {"code": "MG00102", "name": "塑料材料", "parent_code": "MG001"},
        {"code": "MG00103", "name": "电子元件", "parent_code": "MG001"},
        {"code": "MG00201", "name": "机加工件", "parent_code": "MG002"},
        {"code": "MG00202", "name": "注塑件", "parent_code": "MG002"},
        {"code": "MG00301", "name": "标准产品", "parent_code": "MG003"},
        {"code": "MG00302", "name": "定制产品", "parent_code": "MG003"},
    ]
    
    # 创建一级分组
    created_groups = {}
    for group_data in groups_data:
        try:
            group = await MaterialService.create_material_group(
                tenant_id=tenant_id,
                data=MaterialGroupCreate(
                    code=group_data["code"],
                    name=group_data["name"],
                    parent_id=None,
                    description=f"{group_data['name']}分组",
                    is_active=True
                )
            )
            created_groups[group_data["code"]] = group
            print(f"  ✓ 创建物料分组: {group.code} - {group.name}")
        except Exception as e:
            print(f"  ⚠️ 创建物料分组 {group_data['code']} 失败: {e}")
    
    # 创建二级分组
    for sub_group_data in sub_groups_data:
        parent_code = sub_group_data["parent_code"]
        if parent_code in created_groups:
            parent_group = created_groups[parent_code]
            try:
                group = await MaterialService.create_material_group(
                    tenant_id=tenant_id,
                    data=MaterialGroupCreate(
                        code=sub_group_data["code"],
                        name=sub_group_data["name"],
                        parent_id=parent_group.id,
                        description=f"{sub_group_data['name']}分组",
                        is_active=True
                    )
                )
                created_groups[sub_group_data["code"]] = group
                print(f"  ✓ 创建物料分组: {group.code} - {group.name} (父分组: {parent_group.name})")
            except Exception as e:
                print(f"  ⚠️ 创建物料分组 {sub_group_data['code']} 失败: {e}")
    
    # 创建物料
    materials_data = [
        # 金属材料
        {"code": "MAT001", "name": "不锈钢板", "group_code": "MG00101", "base_unit": "kg", "specification": "304不锈钢，厚度2mm"},
        {"code": "MAT002", "name": "铝板", "group_code": "MG00101", "base_unit": "kg", "specification": "6061铝合金，厚度3mm"},
        {"code": "MAT003", "name": "铜线", "group_code": "MG00101", "base_unit": "m", "specification": "直径1.5mm"},
        # 塑料材料
        {"code": "MAT004", "name": "ABS塑料", "group_code": "MG00102", "base_unit": "kg", "specification": "黑色，注塑级"},
        {"code": "MAT005", "name": "PP塑料", "group_code": "MG00102", "base_unit": "kg", "specification": "白色，注塑级"},
        {"code": "MAT006", "name": "PC塑料", "group_code": "MG00102", "base_unit": "kg", "specification": "透明，注塑级"},
        # 电子元件
        {"code": "MAT007", "name": "电阻", "group_code": "MG00103", "base_unit": "pcs", "specification": "1KΩ，1/4W"},
        {"code": "MAT008", "name": "电容", "group_code": "MG00103", "base_unit": "pcs", "specification": "100μF，25V"},
        {"code": "MAT009", "name": "LED灯", "group_code": "MG00103", "base_unit": "pcs", "specification": "5mm，红色"},
        # 机加工件
        {"code": "MAT010", "name": "机加工外壳", "group_code": "MG00201", "base_unit": "pcs", "specification": "铝合金，CNC加工"},
        {"code": "MAT011", "name": "机加工支架", "group_code": "MG00201", "base_unit": "pcs", "specification": "不锈钢，CNC加工"},
        # 注塑件
        {"code": "MAT012", "name": "注塑外壳", "group_code": "MG00202", "base_unit": "pcs", "specification": "ABS，黑色"},
        {"code": "MAT013", "name": "注塑按钮", "group_code": "MG00202", "base_unit": "pcs", "specification": "PP，白色"},
        # 标准产品
        {"code": "MAT014", "name": "标准产品A", "group_code": "MG00301", "base_unit": "pcs", "specification": "标准配置"},
        {"code": "MAT015", "name": "标准产品B", "group_code": "MG00301", "base_unit": "pcs", "specification": "标准配置"},
        # 定制产品
        {"code": "MAT016", "name": "定制产品A", "group_code": "MG00302", "base_unit": "pcs", "specification": "按客户要求定制"},
        # 包装材料
        {"code": "MAT017", "name": "纸箱", "group_code": "MG004", "base_unit": "pcs", "specification": "标准纸箱，50x40x30cm"},
        {"code": "MAT018", "name": "泡沫", "group_code": "MG004", "base_unit": "pcs", "specification": "防震泡沫，5cm厚"},
        {"code": "MAT019", "name": "胶带", "group_code": "MG004", "base_unit": "roll", "specification": "透明胶带，48mm宽"},
        # 辅助材料
        {"code": "MAT020", "name": "螺丝", "group_code": "MG005", "base_unit": "pcs", "specification": "M3x10，不锈钢"},
        {"code": "MAT021", "name": "垫片", "group_code": "MG005", "base_unit": "pcs", "specification": "M3，橡胶"},
    ]
    
    created_materials = {}
    for material_data in materials_data:
        group_code = material_data["group_code"]
        if group_code in created_groups:
            group = created_groups[group_code]
            try:
                material = await MaterialService.create_material(
                    tenant_id=tenant_id,
                    data=MaterialCreate(
                        code=material_data["code"],
                        name=material_data["name"],
                        group_id=group.id,
                        base_unit=material_data["base_unit"],
                        specification=material_data.get("specification"),
                        description=f"{material_data['name']}的详细描述",
                        is_active=True
                    )
                )
                created_materials[material_data["code"]] = material
                print(f"  ✓ 创建物料: {material.code} - {material.name} (分组: {group.name})")
            except Exception as e:
                print(f"  ⚠️ 创建物料 {material_data['code']} 失败: {e}")
    
    # 创建一些 BOM（物料清单）
    bom_data = [
        # 标准产品A的BOM
        {"material_code": "MAT014", "component_code": "MAT010", "quantity": 1.0, "unit": "pcs"},
        {"material_code": "MAT014", "component_code": "MAT012", "quantity": 1.0, "unit": "pcs"},
        {"material_code": "MAT014", "component_code": "MAT007", "quantity": 10.0, "unit": "pcs"},
        {"material_code": "MAT014", "component_code": "MAT008", "quantity": 5.0, "unit": "pcs"},
        {"material_code": "MAT014", "component_code": "MAT009", "quantity": 3.0, "unit": "pcs"},
        {"material_code": "MAT014", "component_code": "MAT020", "quantity": 8.0, "unit": "pcs"},
        # 标准产品B的BOM
        {"material_code": "MAT015", "component_code": "MAT011", "quantity": 1.0, "unit": "pcs"},
        {"material_code": "MAT015", "component_code": "MAT013", "quantity": 2.0, "unit": "pcs"},
        {"material_code": "MAT015", "component_code": "MAT007", "quantity": 15.0, "unit": "pcs"},
        {"material_code": "MAT015", "component_code": "MAT008", "quantity": 8.0, "unit": "pcs"},
    ]
    
    bom_count = 0
    for bom_item in bom_data:
        material_code = bom_item["material_code"]
        component_code = bom_item["component_code"]
        if material_code in created_materials and component_code in created_materials:
            material = created_materials[material_code]
            component = created_materials[component_code]
            try:
                await MaterialService.create_bom(
                    tenant_id=tenant_id,
                    data=BOMCreate(
                        material_id=material.id,
                        component_id=component.id,
                        quantity=bom_item["quantity"],
                        unit=bom_item["unit"],
                        description=f"{component.name}用于{material.name}",
                        is_active=True
                    )
                )
                bom_count += 1
            except Exception as e:
                print(f"  ⚠️ 创建BOM {material_code} -> {component_code} 失败: {e}")
    
    if bom_count > 0:
        print(f"  ✓ 创建了 {bom_count} 条 BOM 记录")
    
    print(f"\n✓ Mock 物料数据创建完成")
    print(f"  - 物料分组: {len(created_groups)} 个")
    print(f"  - 物料: {len(created_materials)} 个")
    print(f"  - BOM: {bom_count} 条")


async def main():
    """
    主函数
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 默认租户ID（可以根据实际情况修改）
        tenant_id = 1
        
        print("=" * 60)
        print("清除并重新生成物料 Mock 数据")
        print("=" * 60)
        print(f"租户ID: {tenant_id}")
        print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        # 清除所有物料数据
        await clear_all_material_data(tenant_id)
        
        # 创建 Mock 数据
        await create_mock_material_data(tenant_id)
        
        print("\n" + "=" * 60)
        print("✓ 操作完成")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())

