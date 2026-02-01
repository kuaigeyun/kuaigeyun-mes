
import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
backend_path = Path(__file__).parent.parent
src_path = backend_path / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from infra.config.infra_config import infra_settings as settings

async def run_migration():
    """执行数据库迁移"""
    print(f"连接数据库: {settings.DB_URL}")
    
    # 初始化 Tortoise ORM
    await Tortoise.init(
        db_url=settings.DB_URL,
        modules={"models": []}
    )
    
    conn = Tortoise.get_connection("default")
    
    # 状态映射
    status_map = {
        "草稿": "DRAFT",
        "待审核": "PENDING_REVIEW",
        "已审核": "AUDITED",
        "已驳回": "REJECTED",
        "已确认": "CONFIRMED"
    }
    
    review_status_map = {
        "待审核": "PENDING",
        "审核通过": "APPROVED",
        "审核驳回": "REJECTED",
        "通过": "APPROVED",
        "驳回": "REJECTED"
    }
    
    try:
        # 更新 status
        print("开始更新 apps_kuaizhizao_demands 表 status 字段...")
        for old, new in status_map.items():
            # 使用参数化查询更安全，但这里是固定字典，f-string 也行，且更直观
            try:
                # 检查是否有需要更新的
                count = await conn.execute_query_dict(f"SELECT count(*) as c FROM apps_kuaizhizao_demands WHERE status = '{old}'")
                if count and count[0]['c'] > 0:
                    await conn.execute_query(
                        f"UPDATE apps_kuaizhizao_demands SET status = '{new}' WHERE status = '{old}'"
                    )
                    print(f"  - 更新 '{old}' -> '{new}': {count[0]['c']} 行")
            except Exception as e:
                print(f"  - 更新 '{old}' 失败: {e}")
            
        # 更新 review_status
        print("开始更新 apps_kuaizhizao_demands 表 review_status 字段...")
        for old, new in review_status_map.items():
            try:
                count = await conn.execute_query_dict(f"SELECT count(*) as c FROM apps_kuaizhizao_demands WHERE review_status = '{old}'")
                if count and count[0]['c'] > 0:
                    await conn.execute_query(
                        f"UPDATE apps_kuaizhizao_demands SET review_status = '{new}' WHERE review_status = '{old}'"
                    )
                    print(f"  - 更新 '{old}' -> '{new}': {count[0]['c']} 行")
            except Exception as e:
                print(f"  - 更新 '{old}' 失败: {e}")

        # 检查 apps_kuaizhizao_sales_orders 表
        try:
            # 兼容不同数据库的检查方式，这里假设是 PostgreSQL
            check = await conn.execute_query_dict("SELECT to_regclass('apps_kuaizhizao_sales_orders') as t")
            if check and check[0]['t']:
                print("检测到 apps_kuaizhizao_sales_orders 表，也进行更新...")
                
                print("开始更新 apps_kuaizhizao_sales_orders 表 status 字段...")
                for old, new in status_map.items():
                    count = await conn.execute_query_dict(f"SELECT count(*) as c FROM apps_kuaizhizao_sales_orders WHERE status = '{old}'")
                    if count and count[0]['c'] > 0:
                        await conn.execute_query(f"UPDATE apps_kuaizhizao_sales_orders SET status = '{new}' WHERE status = '{old}'")
                        print(f"  - 更新 '{old}' -> '{new}': {count[0]['c']} 行")
                        
                print("开始更新 apps_kuaizhizao_sales_orders 表 review_status 字段...")
                for old, new in review_status_map.items():
                    count = await conn.execute_query_dict(f"SELECT count(*) as c FROM apps_kuaizhizao_sales_orders WHERE review_status = '{old}'")
                    if count and count[0]['c'] > 0:
                        await conn.execute_query(f"UPDATE apps_kuaizhizao_sales_orders SET review_status = '{new}' WHERE review_status = '{old}'")
                        print(f"  - 更新 '{old}' -> '{new}': {count[0]['c']} 行")
            else:
                print("未检测到 apps_kuaizhizao_sales_orders 表，跳过。")
        except Exception as e:
            print(f"检查 SalesOrder 表时出错 (可能不影响主逻辑): {e}")

        print("✅ 数据库迁移完成！")
        return True
    
    except Exception as e:
        print(f"❌ 执行迁移时发生错误: {e}")
        return False
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(run_migration())
