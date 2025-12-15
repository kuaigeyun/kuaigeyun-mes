"""
启用所有主数据管理模块的数据

将所有已创建的主数据设置为启用状态（is_active=True）。

使用方法:
    python scripts/enable_all_master_data.py [--tenant-id TENANT_ID]
"""

import asyncio
import sys
from pathlib import Path

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


async def enable_all_data(tenant_id: int):
    """启用所有主数据"""
    print("\n📦 启用所有主数据...")
    
    # 工厂建模
    workshops_count = await Workshop.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用车间: {workshops_count} 条")
    
    production_lines_count = await ProductionLine.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用产线: {production_lines_count} 条")
    
    workstations_count = await Workstation.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用工位: {workstations_count} 条")
    
    # 仓库管理
    warehouses_count = await Warehouse.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用仓库: {warehouses_count} 条")
    
    storage_areas_count = await StorageArea.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用库区: {storage_areas_count} 条")
    
    storage_locations_count = await StorageLocation.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用库位: {storage_locations_count} 条")
    
    # 物料管理
    material_groups_count = await MaterialGroup.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用物料组: {material_groups_count} 条")
    
    materials_count = await Material.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用物料: {materials_count} 条")
    
    bom_count = await BOM.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用BOM: {bom_count} 条")
    
    # 工艺管理
    defect_types_count = await DefectType.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用不良品类型: {defect_types_count} 条")
    
    operations_count = await Operation.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用工序: {operations_count} 条")
    
    process_routes_count = await ProcessRoute.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用工艺路线: {process_routes_count} 条")
    
    sop_count = await SOP.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用SOP: {sop_count} 条")
    
    # 供应链
    customers_count = await Customer.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用客户: {customers_count} 条")
    
    suppliers_count = await Supplier.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用供应商: {suppliers_count} 条")
    
    # 绩效管理
    holidays_count = await Holiday.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用假期: {holidays_count} 条")
    
    skills_count = await Skill.filter(tenant_id=tenant_id, deleted_at__isnull=True).update(is_active=True)
    print(f"  ✅ 启用技能: {skills_count} 条")
    
    print("\n" + "=" * 60)
    print("✅ 所有主数据已启用！")
    print("=" * 60)


async def main(tenant_id: int = None, force: bool = False):
    """
    启用所有主数据
    
    Args:
        tenant_id: 组织ID（如果为None，则使用第一个租户）
        force: 是否强制（暂未使用）
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
        
        # 启用所有主数据
        await enable_all_data(tenant_id)
        
    except Exception as e:
        print("=" * 60)
        print(f"❌ 启用数据失败: {str(e)}")
        import traceback
        traceback.print_exc()
        print("=" * 60)
        raise
    finally:
        # 关闭连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="启用所有主数据管理模块的数据")
    parser.add_argument("--tenant-id", type=int, help="组织ID（可选，如果不指定则使用第一个租户）")
    parser.add_argument("--force", action="store_true", help="强制（暂未使用）")
    
    args = parser.parse_args()
    
    asyncio.run(main(args.tenant_id, args.force))
