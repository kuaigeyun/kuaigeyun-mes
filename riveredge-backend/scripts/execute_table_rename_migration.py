#!/usr/bin/env python3
"""
直接执行数据库表重命名迁移
使用 asyncpg 直接连接数据库执行 SQL

使用方法:
    python execute_table_rename_migration.py [--dry-run] [--host HOST] [--port PORT] [--user USER] [--password PASSWORD] [--database DATABASE]
"""

import asyncio
import asyncpg
import argparse
import sys
from pathlib import Path

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


async def execute_migration(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str,
    dry_run: bool = False
):
    """执行迁移"""
    try:
        # 连接数据库
        conn = await asyncpg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database
        )
        
        print("=" * 60)
        print("🔄 数据库表重命名迁移")
        print("=" * 60)
        print(f"数据库: {database}@{host}:{port}")
        print(f"模式: {'预览模式（dry-run）' if dry_run else '实际执行'}")
        print("=" * 60)
        
        if dry_run:
            print("\n🔍 [预览] 将执行以下 SQL 语句:")
            print(MIGRATION_SQL)
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
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='执行数据库表重命名迁移',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--dry-run', action='store_true', help='预览模式，不实际执行')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='数据库主机')
    parser.add_argument('--port', type=int, default=5432, help='数据库端口')
    parser.add_argument('--user', type=str, default='postgres', help='数据库用户')
    parser.add_argument('--password', type=str, required=True, help='数据库密码')
    parser.add_argument('--database', type=str, required=True, help='数据库名称')
    
    args = parser.parse_args()
    
    # 执行迁移
    asyncio.run(execute_migration(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        dry_run=args.dry_run
    ))


if __name__ == '__main__':
    main()

