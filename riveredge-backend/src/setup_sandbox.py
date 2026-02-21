import asyncio
import asyncpg
import uuid
import json
from datetime import datetime, timezone

async def setup():
    conn = await asyncpg.connect("postgres://postgres:jetema4ev@localhost:5432/riveredge")
    tenant_id = 11
    now = datetime.now(timezone.utc)
    
    # 1. Clean Up Legacy Data
    print("清理历史单据...")
    await conn.execute("DELETE FROM apps_kuaizhizao_work_orders WHERE tenant_id = $1", tenant_id)
    # also cleanup other transactions just in case
    for table in [
        'apps_kuaizhizao_sales_orders', 'apps_kuaizhizao_purchase_orders', 
        'apps_kuaizhizao_inventory_transactions', 'apps_kuaizhizao_inventory_balances',
        'apps_kuaizhizao_material_bindings', 'apps_kuaizhizao_outsource_orders',
        'apps_kuaizhizao_purchase_receipts', 'apps_kuaizhizao_sales_deliveries'
    ]:
        try:
            await conn.execute(f"DELETE FROM {table} WHERE tenant_id = $1", tenant_id)
        except Exception:
            pass

    print("软删除现有主数据 (保持环境纯净)...")
    await conn.execute("UPDATE apps_master_data_materials SET deleted_at = $1 WHERE tenant_id = $2 AND deleted_at IS NULL AND code NOT LIKE 'FIN-M-%' AND code NOT LIKE 'SEM-%' AND code NOT LIKE 'PAC-%' AND code NOT LIKE 'RAW-%' AND code NOT LIKE 'AUX-%'", now, tenant_id)
    await conn.execute("UPDATE apps_master_data_process_routes SET deleted_at = $1 WHERE tenant_id = $2 AND deleted_at IS NULL AND code NOT LIKE 'ROUTE-%'", now, tenant_id)

    # Hard delete the generated data to make script idempotent
    codes_to_delete_mat = ['FIN-M-001','SEM-M-001','SEM-O-001','SEM-C-001','PAC-B-001','RAW-P-001','RAW-B-001','AUX-B-001','RAW-B-002','RAW-B-003']
    await conn.execute("DELETE FROM apps_master_data_bom WHERE tenant_id = $1", tenant_id)
    await conn.execute("DELETE FROM apps_master_data_materials WHERE tenant_id = $1 AND code = ANY($2)", tenant_id, codes_to_delete_mat)
    
    codes_to_delete_routes = ['ROUTE-FIN', 'ROUTE-SEM']
    await conn.execute("DELETE FROM apps_master_data_process_routes WHERE tenant_id = $1 AND code = ANY($2)", tenant_id, codes_to_delete_routes)
    
    codes_to_delete_ops = ['OP-FIN-10', 'OP-FIN-20', 'OP-SEM-10', 'OP-SEM-20']
    await conn.execute("DELETE FROM apps_master_data_operations WHERE tenant_id = $1 AND code = ANY($2)", tenant_id, codes_to_delete_ops)


    # 2. Seed New Sandbox Materials
    print("创建极简测试物料...")
    materials_data = [
        ('FIN-M-001', 'M10测试总成', 'FIN', 'Make', '台'),
        ('SEM-M-001', 'M10车架组件', 'SEMI', 'Make', '套'),
        ('SEM-O-001', 'M10电机套件', 'SEMI', 'Outsource', '套'),
        ('SEM-C-001', 'M10高配电池夹', 'SEMI', 'Configure', '个'),
        ('PAC-B-001', '环保瓦楞包装箱', 'PACK', 'Buy', '个'),
        ('RAW-P-001', '前后刹车套装', 'RAW', 'Phantom', '套'),
        ('RAW-B-001', '铝合金主梁', 'RAW', 'Buy', '根'),
        ('AUX-B-001', '工业焊条', 'AUX', 'Buy', 'kg'),
        ('RAW-B-002', '电机转金属芯', 'RAW', 'Buy', '个'),
        ('RAW-B-003', '油压刹车片', 'RAW', 'Buy', '片')
    ]
    
    mat_id_map = {}
    mat_unit_map = {}
    for code, name, t_type, s_type, unit in materials_data:
        m_uuid = str(uuid.uuid4())
        m_id = await conn.fetchval("""
            INSERT INTO apps_master_data_materials 
            (uuid, tenant_id, code, main_code, name, material_type, source_type, base_unit, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $3, $4, $5, $6, $7, true, $8, $8)
            RETURNING id
        """, m_uuid, tenant_id, code, name, t_type, s_type, unit, now)
        mat_id_map[code] = m_id
        mat_unit_map[code] = unit

    # 3. Seed SOP and Process Routes
    print("创建标准工序和工艺路线...")
    
    op_fin_uuid_10 = str(uuid.uuid4())
    op_fin_uuid_20 = str(uuid.uuid4())
    # 插入工序
    await conn.execute("""
        INSERT INTO apps_master_data_operations
        (uuid, tenant_id, code, name, reporting_type, allow_jump, is_active, created_at, updated_at)
        VALUES 
        ($1, $2, 'OP-FIN-10', 'M10整机组装', 'quantity', false, true, $3, $3),
        ($4, $2, 'OP-FIN-20', 'M10总检包装', 'quantity', false, true, $3, $3)
    """, op_fin_uuid_10, tenant_id, now, op_fin_uuid_20)

    # 组装路线
    r_fin_seq = json.dumps([
        {"operation_uuid": op_fin_uuid_10, "sequence": 10},
        {"operation_uuid": op_fin_uuid_20, "sequence": 20}
    ])
    r_fin_id = await conn.fetchval("""
        INSERT INTO apps_master_data_process_routes 
        (uuid, tenant_id, code, name, version, operation_sequence, is_active, created_at, updated_at)
        VALUES ($1, $2, 'ROUTE-FIN', '总装产线', '1.0', $3::jsonb, true, $4, $4)
        RETURNING id
    """, str(uuid.uuid4()), tenant_id, r_fin_seq, now)

    op_sem_uuid_10 = str(uuid.uuid4())
    op_sem_uuid_20 = str(uuid.uuid4())
    await conn.execute("""
        INSERT INTO apps_master_data_operations
        (uuid, tenant_id, code, name, reporting_type, allow_jump, is_active, created_at, updated_at)
        VALUES 
        ($1, $2, 'OP-SEM-10', '型材下料', 'quantity', false, true, $3, $3),
        ($4, $2, 'OP-SEM-20', '骨架焊接', 'quantity', false, true, $3, $3)
    """, op_sem_uuid_10, tenant_id, now, op_sem_uuid_20)

    # 焊接路线
    r_sem_seq = json.dumps([
        {"operation_uuid": op_sem_uuid_10, "sequence": 10},
        {"operation_uuid": op_sem_uuid_20, "sequence": 20}
    ])
    r_sem_id = await conn.fetchval("""
        INSERT INTO apps_master_data_process_routes 
        (uuid, tenant_id, code, name, version, operation_sequence, is_active, created_at, updated_at)
        VALUES ($1, $2, 'ROUTE-SEM', '焊接车间', '1.0', $3::jsonb, true, $4, $4)
        RETURNING id
    """, str(uuid.uuid4()), tenant_id, r_sem_seq, now)

    # 4. Bind SOP to Make Materials
    print("绑定工艺路线到自制件...")
    await conn.execute("UPDATE apps_master_data_materials SET process_route_id = $1 WHERE id = $2", r_fin_id, mat_id_map['FIN-M-001'])
    await conn.execute("UPDATE apps_master_data_materials SET process_route_id = $1 WHERE id = $2", r_sem_id, mat_id_map['SEM-M-001'])

    # 5. Seed New Sandbox BOM Structure
    print("创建极简BOM结构...")
    bom_data = [
        ('FIN-M-001', 'SEM-M-001', 1.0),
        ('FIN-M-001', 'SEM-O-001', 1.0),
        ('FIN-M-001', 'SEM-C-001', 1.0),
        ('FIN-M-001', 'PAC-B-001', 1.0),
        ('FIN-M-001', 'RAW-P-001', 1.0),
        ('SEM-M-001', 'RAW-B-001', 2.0),
        ('SEM-M-001', 'AUX-B-001', 0.2),
        ('SEM-O-001', 'RAW-B-002', 1.0),
        ('RAW-P-001', 'RAW-B-003', 2.0)
    ]
    
    for p_code, c_code, qty in bom_data:
        p_id = mat_id_map[p_code]
        c_id = mat_id_map[c_code]
        c_unit = mat_unit_map[c_code]
        await conn.execute("""
            INSERT INTO apps_master_data_bom 
            (uuid, tenant_id, material_id, component_id, quantity, unit, is_required, version, approval_status, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, '1.0', 'approved', true, $7, $7)
        """, str(uuid.uuid4()), tenant_id, p_id, c_id, qty, c_unit, now)

    print("沙盒数据重建完成！")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(setup())
