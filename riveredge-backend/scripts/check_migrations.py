"""
检查数据库迁移完成情况

检查所有已建设模块的迁移是否已应用。
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ 已加载 .env 文件: {env_path}")

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise, connections
from infra.infrastructure.database.database import TORTOISE_ORM


async def check_migrations():
    """
    检查数据库迁移完成情况
    """
    try:
        print("=" * 60)
        print("检查数据库迁移完成情况")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        print("\n1. 初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("   ✅ Tortoise ORM 初始化成功")
        
        # 获取数据库连接
        conn = connections.get("default")
        
        # 检查各模块的表是否存在
        print("\n2. 检查各模块的表...")
        
        modules = {
            "CRM": [
                "seed_kuaicrm_leads",
                "seed_kuaicrm_opportunities",
                "seed_kuaicrm_sales_orders",
                "seed_kuaicrm_service_workorders",
                "seed_kuaicrm_warranties",
                "seed_kuaicrm_complaints",
                "seed_kuaicrm_installations",
                "seed_kuaicrm_service_contracts",
                "seed_kuaicrm_lead_followups",
                "seed_kuaicrm_opportunity_followups",
            ],
            "PDM": [
                "seed_kuaipdm_design_changes",
                "seed_kuaipdm_engineering_changes",
                "seed_kuaipdm_design_reviews",
                "seed_kuaipdm_research_processes",
                "seed_kuaipdm_knowledges",
            ],
            "MRP": [
                "seed_kuaimrp_mrp_plans",
                "seed_kuaimrp_lrp_batches",
                "seed_kuaimrp_material_requirements",
                "seed_kuaimrp_requirement_traceabilities",
                "seed_kuaimrp_shortage_alerts",
            ],
            "SRM": [
                "seed_kuaisrm_purchase_orders",
                "seed_kuaisrm_outsourcing_orders",
                "seed_kuaisrm_supplier_evaluations",
                "seed_kuaisrm_purchase_contracts",
            ],
            "WMS": [
                "seed_kuaiwms_inventories",
                "seed_kuaiwms_inbound_orders",
                "seed_kuaiwms_outbound_orders",
                "seed_kuaiwms_stocktakes",
                "seed_kuaiwms_inventory_adjustments",
            ],
            "MES": [
                "seed_kuaimes_orders",
                "seed_kuaimes_work_orders",
                "seed_kuaimes_production_reports",
                "seed_kuaimes_traceabilities",
                "seed_kuaimes_rework_orders",
            ],
        }
        
        # 检查核心表
        core_tables = [
            "core_approval_histories",
        ]
        
        results = {}
        
        # 检查各模块的表
        for module_name, tables in modules.items():
            module_results = {}
            for table in tables:
                try:
                    query = f"""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = '{table}'
                        );
                    """
                    result = await conn.execute_query(query)
                    exists = result[1][0][0] if result[1] and len(result[1]) > 0 else False
                    module_results[table] = exists
                except Exception as e:
                    module_results[table] = False
                    print(f"   ⚠️  检查表 {table} 时出错: {e}")
            results[module_name] = module_results
        
        # 检查核心表
        core_results = {}
        for table in core_tables:
            try:
                query = f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '{table}'
                    );
                """
                result = await conn.execute_query(query)
                exists = result[1][0][0] if result[1] and len(result[1]) > 0 else False
                core_results[table] = exists
            except Exception as e:
                core_results[table] = False
                print(f"   ⚠️  检查表 {table} 时出错: {e}")
        results["核心模块"] = core_results
        
        # 输出结果
        print("\n3. 迁移完成情况：")
        print("-" * 60)
        
        all_passed = True
        for module_name, table_results in results.items():
            print(f"\n【{module_name}】")
            module_passed = True
            for table, exists in table_results.items():
                status = "✅" if exists else "❌"
                print(f"  {status} {table}")
                if not exists:
                    module_passed = False
                    all_passed = False
            
            if module_passed:
                print(f"  ✅ {module_name} 模块迁移完成")
            else:
                print(f"  ❌ {module_name} 模块迁移未完成")
        
        print("\n" + "=" * 60)
        if all_passed:
            print("✅ 所有模块的迁移已完成！")
        else:
            print("⚠️  部分模块的迁移未完成，请检查上述结果")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_migrations())
