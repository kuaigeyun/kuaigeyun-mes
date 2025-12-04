#!/usr/bin/env python3
"""
直接执行数据库表重命名迁移
从环境变量或配置文件读取数据库连接信息

使用方法:
    python execute_migration_direct.py [--dry-run]
"""

import asyncio
import asyncpg
import sys
import os
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "riveredge-backend" / "src"))

try:
    from platform.config.platform_config import platform_settings as settings
except ImportError:
    # 如果无法导入，使用环境变量
    settings = None

# 从迁移文件读取 SQL
MIGRATION_SQL = """
        -- 数据库表重命名迁移
        -- 从植物系命名重构为常规B端命名
        
        -- ============================================
        -- 平台级表重命名 (soil_ → platform_)
        -- ============================================
        ALTER TABLE IF EXISTS "soil_platform_superadmin" RENAME TO "platform_superadmin";
        ALTER TABLE IF EXISTS "soil_packages" RENAME TO "platform_packages";
        
        -- ============================================
        -- 租户管理表重命名 (tree_ → platform_)
        -- ============================================
        ALTER TABLE IF EXISTS "tree_tenants" RENAME TO "platform_tenants";
        ALTER TABLE IF EXISTS "tree_tenant_configs" RENAME TO "platform_tenant_configs";
        ALTER TABLE IF EXISTS "tree_tenant_activity_logs" RENAME TO "platform_tenant_activity_logs";
        
        -- ============================================
        -- 系统级表重命名 (root_ → core_)
        -- ============================================
        ALTER TABLE IF EXISTS "root_menus" RENAME TO "core_menus";
        ALTER TABLE IF EXISTS "root_approval_instances" RENAME TO "core_approval_instances";
        ALTER TABLE IF EXISTS "root_login_logs" RENAME TO "core_login_logs";
        ALTER TABLE IF EXISTS "root_operation_logs" RENAME TO "core_operation_logs";
        ALTER TABLE IF EXISTS "root_message_logs" RENAME TO "core_message_logs";
        ALTER TABLE IF EXISTS "root_data_backups" RENAME TO "core_data_backups";
        ALTER TABLE IF EXISTS "root_user_preferences" RENAME TO "core_user_preferences";
        ALTER TABLE IF EXISTS "root_print_devices" RENAME TO "core_print_devices";
        ALTER TABLE IF EXISTS "root_print_templates" RENAME TO "core_print_templates";
        ALTER TABLE IF EXISTS "root_scripts" RENAME TO "core_scripts";
        ALTER TABLE IF EXISTS "root_electronic_records" RENAME TO "core_electronic_records";
        ALTER TABLE IF EXISTS "root_approval_processes" RENAME TO "core_approval_processes";
        ALTER TABLE IF EXISTS "root_scheduled_tasks" RENAME TO "core_scheduled_tasks";
        ALTER TABLE IF EXISTS "root_message_configs" RENAME TO "core_message_configs";
        ALTER TABLE IF EXISTS "root_message_templates" RENAME TO "core_message_templates";
        ALTER TABLE IF EXISTS "root_datasets" RENAME TO "core_datasets";
        ALTER TABLE IF EXISTS "root_data_sources" RENAME TO "core_data_sources";
        ALTER TABLE IF EXISTS "root_apis" RENAME TO "core_apis";
        ALTER TABLE IF EXISTS "root_files" RENAME TO "core_files";
        ALTER TABLE IF EXISTS "root_integration_configs" RENAME TO "core_integration_configs";
        ALTER TABLE IF EXISTS "root_applications" RENAME TO "core_applications";
        
        -- ============================================
        -- 系统级表重命名 (sys_ → core_)
        -- ============================================
        ALTER TABLE IF EXISTS "sys_users" RENAME TO "core_users";
        ALTER TABLE IF EXISTS "sys_saved_searches" RENAME TO "core_saved_searches";
        ALTER TABLE IF EXISTS "sys_data_dictionaries" RENAME TO "core_data_dictionaries";
        ALTER TABLE IF EXISTS "sys_languages" RENAME TO "core_languages";
        ALTER TABLE IF EXISTS "sys_site_settings" RENAME TO "core_site_settings";
        ALTER TABLE IF EXISTS "sys_invitation_codes" RENAME TO "core_invitation_codes";
        ALTER TABLE IF EXISTS "sys_custom_field_values" RENAME TO "core_custom_field_values";
        ALTER TABLE IF EXISTS "sys_custom_fields" RENAME TO "core_custom_fields";
        ALTER TABLE IF EXISTS "sys_code_rules" RENAME TO "core_code_rules";
        ALTER TABLE IF EXISTS "sys_code_sequences" RENAME TO "core_code_sequences";
        ALTER TABLE IF EXISTS "sys_system_parameters" RENAME TO "core_system_parameters";
        ALTER TABLE IF EXISTS "sys_dictionary_items" RENAME TO "core_dictionary_items";
        ALTER TABLE IF EXISTS "sys_departments" RENAME TO "core_departments";
        ALTER TABLE IF EXISTS "sys_roles" RENAME TO "core_roles";
        ALTER TABLE IF EXISTS "sys_positions" RENAME TO "core_positions";
        ALTER TABLE IF EXISTS "sys_permissions" RENAME TO "core_permissions";
        ALTER TABLE IF EXISTS "sys_role_permissions" RENAME TO "core_role_permissions";
        ALTER TABLE IF EXISTS "sys_user_roles" RENAME TO "core_user_roles";
"""


async def execute_migration(dry_run: bool = False):
    """执行迁移"""
    # 获取数据库配置
    if settings:
        db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST
        db_port = settings.DB_PORT
        db_user = settings.DB_USER
        db_password = settings.DB_PASSWORD
        db_name = settings.DB_NAME
    else:
        # 从环境变量读取
        db_host = os.getenv("DB_HOST", "127.0.0.1")
        db_port = int(os.getenv("DB_PORT", "5432"))
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("DB_PASSWORD", "postgres")
        db_name = os.getenv("DB_NAME", "riveredge")
    
    try:
        # 连接数据库
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )
        
        print("=" * 60)
        print("🔄 数据库表重命名迁移")
        print("=" * 60)
        print(f"数据库: {db_name}@{db_host}:{db_port}")
        print(f"用户: {db_user}")
        print(f"模式: {'预览模式（dry-run）' if dry_run else '实际执行'}")
        print("=" * 60)
        
        if dry_run:
            print("\n🔍 [预览] 将执行以下 SQL 语句:")
            print(MIGRATION_SQL[:500] + "...")
            print("\n⚠️  这是预览模式，未实际执行")
        else:
            # 开始事务
            async with conn.transaction():
                # 执行 SQL
                await conn.execute(MIGRATION_SQL)
                print("\n✅ 迁移执行成功！")
                print(f"✅ 已重命名 44 个表")
            
            # 验证：检查新表是否存在
            print("\n🔍 验证新表名...")
            new_tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                  AND (table_name LIKE 'platform_%' OR table_name LIKE 'core_%')
                ORDER BY table_name
            """)
            
            print(f"✅ 找到 {len(new_tables)} 个新表:")
            for table in new_tables[:10]:  # 只显示前10个
                print(f"   - {table['table_name']}")
            if len(new_tables) > 10:
                print(f"   ... 还有 {len(new_tables) - 10} 个表")
            
            # 检查旧表是否还存在
            old_tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                  AND (table_name LIKE 'soil_%' OR table_name LIKE 'root_%' OR table_name LIKE 'sys_%' OR table_name LIKE 'tree_%')
                ORDER BY table_name
            """)
            
            if old_tables:
                print(f"\n⚠️  发现 {len(old_tables)} 个旧表名仍存在:")
                for table in old_tables:
                    print(f"   - {table['table_name']}")
            else:
                print("\n✅ 所有旧表名已成功重命名")
        
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ 迁移执行失败: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    import argparse
    parser = argparse.ArgumentParser(description='执行数据库表重命名迁移')
    parser.add_argument('--dry-run', action='store_true', help='预览模式，不实际执行')
    args = parser.parse_args()
    
    # 执行迁移
    asyncio.run(execute_migration(dry_run=args.dry_run))


if __name__ == '__main__':
    main()

