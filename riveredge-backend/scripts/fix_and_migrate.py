"""
修复迁移文件并应用迁移

自动修复迁移文件中的索引删除问题，然后应用迁移
"""

import asyncio
import sys
import re
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from aerich import Command
from soil.infrastructure.database.database import TORTOISE_ORM


def fix_migration_files():
    """
    修复所有迁移文件中的索引删除问题
    """
    migrations_dir = Path(__file__).parent.parent / "migrations" / "models"
    if not migrations_dir.exists():
        return
    
    print("=" * 60)
    print("修复迁移文件中的索引删除问题")
    print("=" * 60)
    
    fixed_count = 0
    for migration_file in sorted(migrations_dir.glob("*.py")):
        if migration_file.name.startswith("__"):
            continue
        
        try:
            content = migration_file.read_text(encoding="utf-8")
            original_content = content
            
            # 修复 DROP INDEX 语句，使用 DO 块安全删除
            # 先检查是否已经修复过（避免重复修复）
            if 'DO $$' in content and 'idx_tree_tenant_tenant__481a89' in content:
                # 已经修复过，跳过
                continue
            
            # 修复简单的 DROP INDEX 语句
            pattern = r'DROP INDEX "idx_tree_tenant_tenant__481a89";'
            replacement = '''DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tree_tenant_tenant__481a89') THEN
        DROP INDEX "idx_tree_tenant_tenant__481a89";
    END IF;
END $$;'''
            
            if pattern in content:
                content = content.replace(pattern, replacement)
                migration_file.write_text(content, encoding="utf-8")
                print(f"  ✅ 已修复: {migration_file.name}")
                fixed_count += 1
        except Exception as e:
            print(f"  ⚠️  修复 {migration_file.name} 时出错: {e}")
    
    if fixed_count > 0:
        print(f"\n✅ 共修复 {fixed_count} 个迁移文件")
    else:
        print("\nℹ️  没有需要修复的迁移文件")


async def migrate_with_aerich():
    """
    使用 Aerich 进行数据库迁移
    """
    try:
        from tortoise import Tortoise
        
        # 先初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 创建 Command 实例
        command = Command(
            tortoise_config=TORTOISE_ORM,
            app="models",
            location="./migrations"
        )
        
        print("\n" + "=" * 60)
        print("使用 Aerich 进行数据库迁移")
        print("=" * 60)
        
        # 初始化 Aerich（如果需要）
        print("\n0. 初始化 Aerich...")
        try:
            await command.init()
            print("   ✅ Aerich 初始化成功")
        except Exception as e:
            if "already exists" in str(e).lower() or "已存在" in str(e):
                print("   ℹ️  Aerich 已初始化，跳过")
            else:
                print(f"   ⚠️  初始化警告: {e}")
        
        # 生成迁移文件
        print("\n1. 生成迁移文件...")
        try:
            migrate_result = await command.migrate("update_platform_superadmin_table_name")
            if migrate_result:
                print(f"   ✅ 迁移文件生成成功: {migrate_result}")
                # 重新修复新生成的迁移文件
                fix_migration_files()
            else:
                print("   ℹ️  没有检测到模型变化，无需生成迁移文件")
        except Exception as e:
            print(f"   ⚠️  生成迁移文件警告: {e}")
            if "no changes" in str(e).lower() or "没有变化" in str(e).lower():
                print("   ℹ️  模型没有变化，这是正常的")
            else:
                import traceback
                traceback.print_exc()
        
        # 修复所有迁移文件
        print("\n2. 修复迁移文件...")
        fix_migration_files()
        
        # 应用迁移
        print("\n3. 应用迁移...")
        try:
            upgrade_result = await command.upgrade()
            if upgrade_result:
                print(f"   ✅ 迁移应用成功")
                if isinstance(upgrade_result, list) and upgrade_result:
                    for result in upgrade_result:
                        print(f"      - {result}")
            else:
                print("   ℹ️  没有待应用的迁移")
        except Exception as e:
            print(f"   ❌ 应用迁移失败: {e}")
            import traceback
            traceback.print_exc()
            return
        
        print("\n" + "=" * 60)
        print("✅ 数据库迁移完成！")
        print("=" * 60)
        
        # 关闭连接
        await Tortoise.close_connections()
        
    except Exception as e:
        print(f"\n❌ 数据库迁移失败: {e}")
        import traceback
        traceback.print_exc()
        from tortoise import Tortoise
        await Tortoise.close_connections()
        return


if __name__ == "__main__":
    # 先修复现有迁移文件
    fix_migration_files()
    
    # 然后运行迁移
    asyncio.run(migrate_with_aerich())

