"""
检查主数据管理 APP 的数据库迁移状态

查看 master_data 相关的数据库表和迁移状态
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def check_master_data_tables():
    """
    检查主数据管理相关的数据库表
    """
    try:
        print("=" * 60)
        print("检查主数据管理 APP 数据库迁移状态")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        print("\n1. 初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("   ✅ Tortoise ORM 初始化成功")
        
        # 检查表是否存在
        from tortoise import connections
        conn = connections.get("default")
        
        # 主数据管理相关的表
        master_data_tables = [
            # 工厂数据
            "seed_master_data_workshops",
            "seed_master_data_production_lines",
            "seed_master_data_workstations",
            # 仓库数据
            "seed_master_data_warehouses",
            "seed_master_data_storage_areas",
            "seed_master_data_storage_locations",
            # 物料数据
            "seed_master_data_material_groups",
            "seed_master_data_materials",
            "seed_master_data_bom",
            # 工艺数据
            "seed_master_data_defect_types",
            "seed_master_data_operations",
            "seed_master_data_process_routes",
            "seed_master_data_sop",
            # 供应链数据
            "seed_master_data_customers",
            "seed_master_data_suppliers",
            # 绩效数据
            "seed_master_data_holidays",
            "seed_master_data_skills",
        ]
        
        print("\n2. 检查主数据管理相关表...")
        existing_tables = []
        missing_tables = []
        
        for table in master_data_tables:
            result = await conn.execute_query(
                f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table}'
                );
                """
            )
            exists = result[1][0][0] if result[1] else False
            
            if exists:
                existing_tables.append(table)
                print(f"   ✅ {table}")
            else:
                missing_tables.append(table)
                print(f"   ❌ {table} (不存在)")
        
        # 检查迁移记录
        print("\n3. 检查迁移记录...")
        result = await conn.execute_query(
            """
            SELECT version, app 
            FROM aerich 
            WHERE app = 'models'
            ORDER BY id;
            """
        )
        
        migrations = result[1] if result[1] else []
        
        # 主数据管理相关的迁移文件
        master_data_migrations = [
            "33_20250111_add_master_data_models",
            "34_20250111_add_factory_models",
            "35_20250111_add_warehouse_models",
            "36_20250111_add_material_models",
            "37_20250111_add_process_models",
        ]
        
        print(f"\n   已应用的迁移 ({len(migrations)} 个):")
        applied_master_data_migrations = []
        for mig in migrations:
            version = mig[0]
            # 检查是否是主数据管理相关的迁移
            is_master_data = any(mdm in version for mdm in master_data_migrations)
            if is_master_data:
                applied_master_data_migrations.append(version)
            print(f"     {'⭐' if is_master_data else '  '} {version} (app: {mig[1]})")
        
        # 检查迁移文件
        print("\n4. 检查迁移文件...")
        migrate_dir = Path(__file__).parent.parent / "migrations" / "models"
        if migrate_dir.exists():
            migration_files = sorted([f.name.replace(".py", "") for f in migrate_dir.glob("*.py") if f.name != "__init__.py"])
            
            print(f"\n   迁移文件 ({len(migration_files)} 个):")
            for f in migration_files:
                is_master_data = any(mdm in f for mdm in master_data_migrations)
                # 匹配迁移版本号（aerich 表中存储的是带 .py 扩展名的完整文件名）
                applied = any(mig[0] == f"{f}.py" or mig[0] == f for mig in migrations)
                status = "✅ 已应用" if applied else "⏳ 待应用"
                marker = "⭐" if is_master_data else "  "
                print(f"     {marker} {status} - {f}")
        
        # 总结
        print("\n" + "=" * 60)
        print("总结")
        print("=" * 60)
        print(f"✅ 已存在的表: {len(existing_tables)}/{len(master_data_tables)}")
        print(f"❌ 缺失的表: {len(missing_tables)}/{len(master_data_tables)}")
        
        if missing_tables:
            print(f"\n⚠️  缺失的表列表:")
            for table in missing_tables:
                print(f"   - {table}")
            print(f"\n💡 建议: 运行数据库迁移以创建缺失的表")
            print(f"   cd riveredge-backend")
            print(f"   python scripts/run_master_data_migration.py")
        else:
            print(f"\n✅ 所有主数据管理相关的表都已存在！")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_master_data_tables())

