import asyncio
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from tortoise import Tortoise
from loguru import logger

async def analyze():
    # Use the application's own configuration
    from core.config.database import TORTOISE_ORM
    
    # Wait, the config uses env variables, we might need to manually set it if they aren't exported
    # Better to just use the full models list
    await Tortoise.init(
        db_url="postgres://postgres:jetema4ev@localhost:5432/riveredge",
        modules={'models': [
            'apps.master_data.models.material', 
            'apps.master_data.models.process',
            'apps.master_data.models.material_code_alias',
            'apps.kuaizhizao.models.sales',
            'apps.kuaizhizao.models.purchase',
            'apps.kuaizhizao.models.production',
            'apps.kuaizhizao.models.inventory',
            'apps.kuaizhizao.models.warehouse'
        ]}
    )
    
    tenant_id = 11

    # 1. 查询物料
    from apps.master_data.models.material import Material, BOM
    materials = await Material.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
    print(f"--- 现有物料 (共 {len(materials)} 个) ---")
    for m in materials:
        print(f"[{m.main_code}] {m.name} - 类型: {m.material_type}, 来源: {m.source_type}")

    # 2. 查询 BOM
    boms = await BOM.filter(tenant_id=tenant_id, deleted_at__isnull=True).prefetch_related("material", "component").all()
    print(f"\n--- 现有 BOM (共 {len(boms)} 条明细) ---")
    for b in boms:
        print(f"父件: {getattr(b.material, 'main_code', b.material_id)} -> 子件: {getattr(b.component, 'main_code', b.component_id)}, 用量: {b.quantity}")

    # 3. 查询工艺路线
    from apps.master_data.models.process import ProcessRoute, Operation
    routes = await ProcessRoute.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
    print(f"\n--- 现有工艺路线 (共 {len(routes)} 个) ---")
    for r in routes:
        ops = await Operation.filter(process_route_id=r.id, deleted_at__isnull=True).order_by("sequence").all()
        ops_str = " -> ".join([f"[{o.sequence}]{o.name}" for o in ops])
        print(f"[{r.code}] {r.name}: {ops_str}")

    # 4. 快智造单据数量
    from apps.kuaizhizao.models.sales import SalesOrder
    from apps.kuaizhizao.models.purchase import PurchaseOrder
    from apps.kuaizhizao.models.production import WorkOrder
    from apps.kuaizhizao.models.inventory import InventoryTransaction, InventoryBalance
    
    so_count = await SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()
    po_count = await PurchaseOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()
    wo_count = await WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()
    inv_tx_count = await InventoryTransaction.filter(tenant_id=tenant_id).count()
    inv_bal_count = await InventoryBalance.filter(tenant_id=tenant_id).count()
    
    print(f"\n--- 遗留历史业务单据统计 ---")
    print(f"销售订单: {so_count}")
    print(f"采购订单: {po_count}")
    print(f"生产工单: {wo_count}")
    print(f"出入库明细记录: {inv_tx_count}")
    print(f"库存余额记录: {inv_bal_count}")

    await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(analyze())
