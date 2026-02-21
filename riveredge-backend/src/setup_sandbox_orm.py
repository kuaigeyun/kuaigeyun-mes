import asyncio
import os
import sys

from dotenv import load_dotenv
load_dotenv()

# Add src directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from tortoise import Tortoise, connections
from infra.infrastructure.database.database import TORTOISE_ORM
from apps.master_data.services.material_service import MaterialService
from apps.master_data.schemas.material_schemas import MaterialCreate, MaterialGroupCreate
from apps.master_data.services.process_service import ProcessService
from apps.master_data.schemas.process_schemas import OperationCreate, ProcessRouteCreate
from apps.master_data.models.material import Material, BOM
from apps.master_data.models.process import Operation, ProcessRoute
import json
import uuid
from decimal import Decimal

async def setup():
    await Tortoise.init(config=TORTOISE_ORM)
    tenant_id = 11

    # 1. Clean Up Legacy Data
    print("清理历史单据...")
    conn = connections.get("default")
    await conn.execute_query("DELETE FROM apps_kuaizhizao_work_orders WHERE tenant_id = $1", [tenant_id])
    for table in [
        'apps_kuaizhizao_sales_orders', 'apps_kuaizhizao_purchase_orders', 
        'apps_kuaizhizao_inventory_transactions', 'apps_kuaizhizao_inventory_balances',
        'apps_kuaizhizao_material_bindings', 'apps_kuaizhizao_outsource_orders',
        'apps_kuaizhizao_purchase_receipts', 'apps_kuaizhizao_sales_deliveries'
    ]:
        try:
            await conn.execute_query(f"DELETE FROM {table} WHERE tenant_id = $1", [tenant_id])
        except Exception:
            pass

    print("软删除现有主数据 (保持环境纯净)...")
    await conn.execute_query("UPDATE apps_master_data_materials SET deleted_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND deleted_at IS NULL", [tenant_id])
    await conn.execute_query("UPDATE apps_master_data_process_routes SET deleted_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND deleted_at IS NULL", [tenant_id])
    await conn.execute_query("UPDATE apps_master_data_operations SET deleted_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND deleted_at IS NULL", [tenant_id])
    await conn.execute_query("UPDATE apps_master_data_bom SET deleted_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND deleted_at IS NULL", [tenant_id])
    await conn.execute_query("UPDATE apps_master_data_material_groups SET deleted_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND deleted_at IS NULL", [tenant_id])

    # 1.5 Create Material Group
    print("创建测试物料分组...")
    grp_create = MaterialGroupCreate(
        code="M10",
        name="M10测试用分组",
        is_active=True
    )
    group_resp = await MaterialService.create_material_group(tenant_id, grp_create)

    # 2. Seed New Sandbox Materials using Application Services (respects rules)
    print("创建极简测试物料 (使用系统编码规则)...")
    materials_data = [
        ('M10测试总成', 'FIN', 'Make', '台'),
        ('M10车架组件', 'SEMI', 'Make', '套'),
        ('M10电机套件', 'SEMI', 'Outsource', '套'),
        ('M10高配电池夹', 'SEMI', 'Configure', '个'),
        ('环保瓦楞包装箱', 'PACK', 'Buy', '个'),
        ('前后刹车套装', 'RAW', 'Phantom', '套'),
        ('铝合金主梁', 'RAW', 'Buy', '根'),
        ('工业焊条', 'AUX', 'Buy', 'kg'),
        ('电机转金属芯', 'RAW', 'Buy', '个'),
        ('油压刹车片', 'RAW', 'Buy', '片')
    ]

    mat_obj_map = {}
    mat_unit_map = {}
    for name, t_type, s_type, unit in materials_data:
        # Construct Create Payload
        mat_create = MaterialCreate(
            name=name,
            material_type=t_type,
            source_type=s_type,
            base_unit=unit,
            group_id=group_resp.id,
            is_active=True
        )
        # Service handles code generation logic automatically
        created_mat_resp = await MaterialService.create_material(tenant_id, mat_create)
        mat_obj_map[name] = created_mat_resp.id
        mat_unit_map[name] = unit
        print(f"创建物料成功: {name} -> 编码: {created_mat_resp.main_code}")

    # 3. Seed SOP and Process Routes
    print("创建标准工序和工艺路线...")
    
    op_service = ProcessService()

    op_fin_10 = await op_service.create_operation(tenant_id, OperationCreate(
        code=f"OP-FIN-{uuid.uuid4().hex[:4].upper()}",
        name="M10整机组装",
        reporting_type="quantity",
        is_active=True
    ))
    op_fin_20 = await op_service.create_operation(tenant_id, OperationCreate(
        code=f"OP-FIN-{uuid.uuid4().hex[:4].upper()}",
        name="M10总检包装",
        reporting_type="quantity",
        is_active=True
    ))

    # Assemble Route
    route_fin = await op_service.create_process_route(tenant_id, ProcessRouteCreate(
        code=f"ROUTE-FIN-{uuid.uuid4().hex[:4].upper()}",
        name="总装产线",
        version="1.0",
        operation_sequence={
            "operations": [
                {"operation_uuid": op_fin_10.uuid, "operation_id": op_fin_10.id, "sequence": 10},
                {"operation_uuid": op_fin_20.uuid, "operation_id": op_fin_20.id, "sequence": 20}
            ],
            "sequence": [op_fin_10.uuid, op_fin_20.uuid]
        },
        is_active=True
    ))

    op_sem_10 = await op_service.create_operation(tenant_id, OperationCreate(
        code=f"OP-SEM-{uuid.uuid4().hex[:4].upper()}",
        name="型材下料",
        reporting_type="quantity",
        is_active=True
    ))
    op_sem_20 = await op_service.create_operation(tenant_id, OperationCreate(
        code=f"OP-SEM-{uuid.uuid4().hex[:4].upper()}",
        name="骨架焊接",
        reporting_type="quantity",
        is_active=True
    ))

    # Welding Route
    route_sem = await op_service.create_process_route(tenant_id, ProcessRouteCreate(
        code=f"ROUTE-SEM-{uuid.uuid4().hex[:4].upper()}",
        name="焊接车间",
        version="1.0",
        operation_sequence={
            "operations": [
                {"operation_uuid": op_sem_10.uuid, "operation_id": op_sem_10.id, "sequence": 10},
                {"operation_uuid": op_sem_20.uuid, "operation_id": op_sem_20.id, "sequence": 20}
            ],
            "sequence": [op_sem_10.uuid, op_sem_20.uuid]
        },
        is_active=True
    ))

    # 4. Bind SOP to Make Materials
    print("绑定工艺路线到自制件...")
    await conn.execute_query("UPDATE apps_master_data_materials SET process_route_id = $1 WHERE id = $2", [route_fin.id, mat_obj_map['M10测试总成']])
    await conn.execute_query("UPDATE apps_master_data_materials SET process_route_id = $1 WHERE id = $2", [route_sem.id, mat_obj_map['M10车架组件']])

    # 5. Seed New Sandbox BOM Structure
    print("创建极简BOM结构...")
    bom_data = [
        ('M10测试总成', 'M10车架组件', 1.0),
        ('M10测试总成', 'M10电机套件', 1.0),
        ('M10测试总成', 'M10高配电池夹', 1.0),
        ('M10测试总成', '环保瓦楞包装箱', 1.0),
        ('M10测试总成', '前后刹车套装', 1.0),
        ('M10车架组件', '铝合金主梁', 2.0),
        ('M10车架组件', '工业焊条', 0.2),
        ('M10电机套件', '电机转金属芯', 1.0),
        ('前后刹车套装', '油压刹车片', 2.0)
    ]
    
    for p_name, c_name, qty in bom_data:
        p_id = mat_obj_map[p_name]
        c_id = mat_obj_map[c_name]
        c_unit = mat_unit_map[c_name]
        
        await BOM.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            material_id=p_id,
            component_id=c_id,
            quantity=Decimal(str(qty)),
            unit=c_unit,
            is_required=True,
            version='1.0',
            approval_status='approved',
            is_active=True
        )

    print("沙盒数据重建完成！")
    await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(setup())
