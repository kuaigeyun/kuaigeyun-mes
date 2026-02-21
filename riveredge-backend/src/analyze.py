import asyncio
import asyncpg
import json

async def analyze():
    # 连接到数据库
    conn = await asyncpg.connect("postgres://postgres:jetema4ev@localhost:5432/riveredge")
    tenant_id = 11
    
    # 快智造业务单据查询
    print(f"\n--- 遗留历史业务单据统计 ---")
    for table_name, display_name in [
        ('apps_kuaizhizao_sales_orders', '销售订单'),
        ('apps_kuaizhizao_purchase_orders', '采购订单'),
        ('apps_kuaizhizao_work_orders', '生产工单'),
        ('apps_kuaizhizao_inventory_transactions', '库存流水'),
        ('apps_kuaizhizao_inventory_balances', '库存余额'),
        ('apps_kuaizhizao_material_bindings', '工单物料绑定'),
        ('apps_kuaizhizao_outsource_orders', '委外工单'),
        ('apps_kuaizhizao_purchase_receipts', '采购收货单'),
        ('apps_kuaizhizao_sales_deliveries', '销售发货单')
    ]:
        try:
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {table_name} WHERE tenant_id = $1 AND deleted_at IS NULL", tenant_id)
        except Exception:
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table_name} WHERE tenant_id = $1", tenant_id)
            except Exception as e:
                count = f"Error or table absent: {e}"
        print(f"{display_name} ({table_name}): {count}")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(analyze())
