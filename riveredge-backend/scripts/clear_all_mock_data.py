"""
清理所有MOCK数据脚本（物理删除）

清理所有业务相关的MOCK数据，使用物理删除（硬删除），保持数据表干净。
保留基础配置数据（租户、用户、应用配置等）。

清理范围：
1. 物料相关：物料分组、物料、BOM、物料编码映射、物料批次、物料序列号
2. 销售相关：销售订单、销售订单明细、销售预测、销售出库单
3. 生产相关：工单、工单明细、报工记录、质检记录
4. 计划相关：需求、需求明细、需求计算、需求计算明细
5. 采购相关：采购订单、采购订单明细
6. 库存相关：库存记录、库存调整记录
7. 其他业务数据：变体属性定义、工艺路线、标准作业流程等

保留数据：
- 租户信息（infra_tenants）
- 用户信息（core_users）
- 应用配置（core_applications）
- 菜单配置（core_menus）
- 权限配置（core_permissions）
- 编码规则（core_code_rules）

注意：
- 使用物理删除（DELETE），不是软删除
- 会清空所有业务数据表
- 已备份数据的情况下使用

Author: Luigi Lu
Date: 2026-01-21
"""

import asyncio
import sys
import os
from datetime import datetime
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from tortoise import Tortoise, connections
from infra.infrastructure.database.database import TORTOISE_ORM


async def clear_all_mock_data(tenant_id: int = 1, confirm: bool = False):
    """
    清理所有MOCK业务数据
    
    Args:
        tenant_id: 租户ID，默认为1
        confirm: 是否确认执行，默认为False（需要手动确认）
    """
    try:
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        print(f"✅ 成功连接到数据库")
        
        # 获取数据库连接
        conn = connections.get('default')
        
        print(f"📋 准备清理租户 {tenant_id} 的所有业务数据")
        
        # 统计各表的数据量
        print(f"\n📊 统计当前数据量...")
        
        tables_to_clear = [
            # 需求计算相关
            ('apps_kuaizhizao_demand_computation_items', '需求计算明细'),
            ('apps_kuaizhizao_demand_computations', '需求计算'),
            ('apps_kuaizhizao_demand_items', '需求明细'),
            ('apps_kuaizhizao_demands', '需求'),
            
            # 销售相关
            ('apps_kuaizhizao_sales_delivery_items', '销售出库单明细'),
            ('apps_kuaizhizao_sales_deliveries', '销售出库单'),
            ('apps_kuaizhizao_sales_order_items', '销售订单明细'),
            ('apps_kuaizhizao_sales_orders', '销售订单'),
            ('apps_kuaizhizao_sales_forecast_items', '销售预测明细'),
            ('apps_kuaizhizao_sales_forecasts', '销售预测'),
            
            # 生产相关
            ('apps_kuaizhizao_reporting_records', '报工记录'),
            ('apps_kuaizhizao_quality_inspections', '质检记录'),
            ('apps_kuaizhizao_work_order_items', '工单明细'),
            ('apps_kuaizhizao_work_orders', '工单'),
            ('apps_kuaizhizao_rework_orders', '返工单'),
            ('apps_kuaizhizao_outsource_work_orders', '委外工单'),
            ('apps_kuaizhizao_outsource_orders', '委外订单'),
            
            # 采购相关
            ('apps_kuaizhizao_purchase_order_items', '采购订单明细'),
            ('apps_kuaizhizao_purchase_orders', '采购订单'),
            
            # 库存相关
            ('apps_kuaizhizao_inventory_adjustments', '库存调整记录'),
            ('apps_kuaizhizao_inventory_records', '库存记录'),
            
            # 成本相关
            ('apps_kuaizhizao_cost_calculations', '成本计算'),
            ('apps_kuaizhizao_cost_rules', '成本规则'),
            
            # 物料相关（master-data应用）
            ('apps_master_data_material_code_mappings', '物料编码映射'),
            ('apps_master_data_material_batches', '物料批次'),
            ('apps_master_data_material_serials', '物料序列号'),
            ('apps_master_data_bom', 'BOM'),
            ('apps_master_data_materials', '物料'),
            ('apps_master_data_material_groups', '物料分组'),
            
            # 工艺相关
            ('apps_kuaizhizao_process_routes', '工艺路线'),
            ('apps_kuaizhizao_standard_operations', '标准作业流程'),
            
            # 设备相关
            ('apps_kuaizhizao_equipment_repairs', '设备维修记录'),
            ('apps_kuaizhizao_equipment_faults', '设备故障记录'),
            ('apps_kuaizhizao_maintenance_executions', '维护执行记录'),
            ('apps_kuaizhizao_maintenance_plans', '维护计划'),
            ('core_equipment', '设备'),
            ('core_mold_usages', '模具使用记录'),
            ('core_molds', '模具'),
            
            # 变体属性
            ('core_material_variant_attribute_definitions', '变体属性定义'),
            
            # 文档关系
            ('apps_kuaizhizao_document_relations', '文档关系'),
        ]
        
        # 统计数据量
        stats = {}
        for table_name, table_desc in tables_to_clear:
            try:
                # 检查表是否存在
                table_exists_result = await conn.execute_query_dict("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    ) as exists
                """, [table_name])
                
                table_exists = table_exists_result and len(table_exists_result) > 0 and table_exists_result[0].get('exists')
                
                if table_exists:
                    # 检查是否有tenant_id字段
                    has_tenant_id_result = await conn.execute_query_dict("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_schema = 'public' 
                            AND table_name = $1 
                            AND column_name = 'tenant_id'
                        ) as exists
                    """, [table_name])
                    
                    has_tenant_id = has_tenant_id_result and len(has_tenant_id_result) > 0 and has_tenant_id_result[0].get('exists')
                    
                    if has_tenant_id:
                        count_result = await conn.execute_query_dict(
                            f"SELECT COUNT(*) as count FROM {table_name} WHERE tenant_id = $1",
                            [tenant_id]
                        )
                        count = count_result[0]['count'] if count_result else 0
                    else:
                        count_result = await conn.execute_query_dict(f"SELECT COUNT(*) as count FROM {table_name}")
                        count = count_result[0]['count'] if count_result else 0
                    
                    if count > 0:
                        stats[table_name] = {
                            'desc': table_desc,
                            'count': count,
                            'has_tenant_id': has_tenant_id
                        }
            except Exception as e:
                print(f"  ⚠️  统计表 {table_name} 时出错: {e}")
        
        # 显示统计结果
        if stats:
            print(f"\n📊 找到 {len(stats)} 个表有数据:")
            total_records = 0
            for table_name, info in stats.items():
                print(f"  - {info['desc']} ({table_name}): {info['count']} 条")
                total_records += info['count']
            print(f"\n总计: {total_records} 条记录")
        else:
            print(f"\n✅ 没有找到需要清理的数据")
            return
        
        # 确认操作
        if not confirm:
            print(f"\n⚠️  警告：此操作将物理删除租户 {tenant_id} 的所有业务数据！")
            print(f"   - 使用物理删除（硬删除），数据无法恢复！")
            print(f"   - 请确保已经备份了数据！")
            print(f"\n是否继续? (yes/no): ", end='', flush=True)
            try:
                user_input = input().strip().lower()
            except (EOFError, KeyboardInterrupt):
                print(f"\n❌ 取消清理操作（非交互式环境，请使用 --yes 参数自动确认）")
                return
            if user_input not in ['yes', 'y']:
                print(f"\n❌ 取消清理操作")
                return
        
        # 开始清理
        print(f"\n🗑️  开始物理删除数据...")
        deleted_tables = 0
        deleted_records = 0
        
        # 按依赖关系顺序删除（先删除子表，再删除父表）
        # 注意：顺序很重要，必须按照外键依赖关系从下往上删除
        for table_name, table_desc in tables_to_clear:
            if table_name not in stats:
                continue
            
            try:
                info = stats[table_name]
                
                # 物理删除（硬删除），不使用软删除
                if info['has_tenant_id']:
                    # 先删除软删除的记录（如果有deleted_at字段）
                    has_deleted_at_result = await conn.execute_query_dict("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_schema = 'public' 
                            AND table_name = $1 
                            AND column_name = 'deleted_at'
                        ) as exists
                    """, [table_name])
                    
                    has_deleted_at = has_deleted_at_result and len(has_deleted_at_result) > 0 and has_deleted_at_result[0].get('exists')
                    
                    if has_deleted_at:
                        # 先物理删除已软删除的记录
                        await conn.execute_query(
                            f"DELETE FROM {table_name} WHERE tenant_id = $1 AND deleted_at IS NOT NULL",
                            [tenant_id]
                        )
                        # 再物理删除未软删除的记录
                        await conn.execute_query(
                            f"DELETE FROM {table_name} WHERE tenant_id = $1 AND deleted_at IS NULL",
                            [tenant_id]
                        )
                    else:
                        # 直接物理删除
                        await conn.execute_query(
                            f"DELETE FROM {table_name} WHERE tenant_id = $1",
                            [tenant_id]
                        )
                else:
                    # 没有tenant_id字段，直接物理删除所有数据
                    # 使用DELETE而不是TRUNCATE，避免影响序列和其他表
                    await conn.execute_query(f"DELETE FROM {table_name}")
                
                deleted_tables += 1
                deleted_records += info['count']
                print(f"  ✅ {table_desc}: 已物理删除 {info['count']} 条记录")
                
            except Exception as e:
                print(f"  ❌ 删除 {table_desc} ({table_name}) 时出错: {e}")
                import traceback
                traceback.print_exc()
        
        print(f"\n✅ 清理完成！")
        print(f"   - 已清理 {deleted_tables} 个表")
        print(f"   - 已删除 {deleted_records} 条记录")
        
        # 验证清理结果（物理删除后，所有记录都应该为0）
        print(f"\n🔍 验证清理结果...")
        remaining_count = 0
        remaining_tables = []
        for table_name, table_desc in tables_to_clear:
            if table_name not in stats:
                continue
            
            try:
                info = stats[table_name]
                if info['has_tenant_id']:
                    # 物理删除后，应该没有记录了
                    count_result = await conn.execute_query_dict(
                        f"SELECT COUNT(*) as count FROM {table_name} WHERE tenant_id = $1",
                        [tenant_id]
                    )
                    count = count_result[0]['count'] if count_result else 0
                else:
                    count_result = await conn.execute_query_dict(f"SELECT COUNT(*) as count FROM {table_name}")
                    count = count_result[0]['count'] if count_result else 0
                
                if count > 0:
                    remaining_count += count
                    remaining_tables.append(f"{table_desc} ({table_name}): {count} 条")
            except Exception as e:
                pass
        
        if remaining_count == 0:
            print(f"  ✅ 所有数据已物理删除完成，数据表已清空")
        else:
            print(f"  ⚠️  以下表仍有数据（可能需要手动处理外键约束）:")
            for table_info in remaining_tables:
                print(f"    - {table_info}")
            print(f"  总计: {remaining_count} 条记录")
        
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()
        print(f"\n✅ 数据库连接已关闭")


async def main():
    """
    主函数
    """
    import argparse
    
    parser = argparse.ArgumentParser(description='清理所有MOCK数据（物理删除）')
    parser.add_argument('--tenant-id', type=int, default=1, help='租户ID（默认：1）')
    parser.add_argument('--yes', '-y', action='store_true', help='自动确认，跳过交互式确认')
    parser.add_argument('--confirm', action='store_true', help='自动确认（与--yes相同）')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("清理所有MOCK数据（物理删除）")
    print("=" * 60)
    print()
    print("⚠️  警告：此操作将物理删除所有业务数据！")
    print("   请确保已经备份了数据！")
    print()
    
    # 执行清理
    await clear_all_mock_data(tenant_id=args.tenant_id, confirm=args.yes or args.confirm)


if __name__ == "__main__":
    asyncio.run(main())
