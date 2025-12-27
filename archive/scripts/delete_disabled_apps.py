#!/usr/bin/env python3
"""
直接删除已停用应用的数据表和记录

此脚本会：
1. 删除所有已停用应用的数据表（apps_* 开头的表）
2. 删除应用表中的已停用应用记录
"""

import asyncio
import asyncpg
import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(project_root, 'src'))

from infra.config.infra_config import infra_settings


async def delete_disabled_apps_completely():
    """
    直接删除已停用应用的数据表和记录
    """
    print("🗑️ 开始直接删除已停用应用...")

    conn = await asyncpg.connect(
        host=infra_settings.DB_HOST,
        port=infra_settings.DB_PORT,
        user=infra_settings.DB_USER,
        password=infra_settings.DB_PASSWORD,
        database=infra_settings.DB_NAME
    )

    try:
        # 已停用的应用前缀
        disabled_app_prefixes = [
            'apps_kuaicrm_', 'apps_kuaieam_', 'apps_kuaimes_', 'apps_kuaimrp_',
            'apps_kuaipdm_', 'apps_kuaiqms_', 'apps_kuaisrm_', 'apps_kuaiwms_',
        ]

        # 已停用的应用代码
        disabled_app_codes = [
            'kuaiacc', 'kuaiaps', 'kuaicert', 'kuaicrm', 'kuaieam', 'kuaiehs',
            'kuaiems', 'kuaiepm', 'kuaihrm', 'kuaiiot', 'kuailims', 'kuaimes',
            'kuaimi', 'kuaimrp', 'kuaioa', 'kuaipdm', 'kuaipm', 'kuaiqms',
            'kuaiscm', 'kuaisrm', 'kuaitms', 'kuaiwms'
        ]

        # 1. 删除数据表
        print("\n🗑️ 删除数据表...")

        # 获取所有要删除的表
        tables_to_drop = []
        all_tables = await conn.fetch("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename LIKE 'apps_%'
        """)

        for table in all_tables:
            table_name = table['tablename']
            # 跳过 master_data 表
            if table_name.startswith('apps_master_data_'):
                continue
            # 检查是否是要删除的应用表
            if any(table_name.startswith(prefix) for prefix in disabled_app_prefixes):
                tables_to_drop.append(table_name)

        print(f"📋 发现 {len(tables_to_drop)} 个要删除的数据表:")
        for table in tables_to_drop:
            print(f"  - {table}")

        if tables_to_drop:
            # 删除表
            for table_name in tables_to_drop:
                try:
                    await conn.execute(f'DROP TABLE "{table_name}" CASCADE')
                    print(f"✅ 已删除表: {table_name}")
                except Exception as e:
                    print(f"❌ 删除表失败 {table_name}: {e}")
        else:
            print("✅ 没有需要删除的数据表")

        # 2. 删除应用记录
        print("\n🗑️ 删除应用记录...")

        # 检查要删除的应用记录
        records_to_delete = await conn.fetch(
            'SELECT code, name FROM core_applications WHERE code = ANY($1)',
            disabled_app_codes
        )

        print(f"📋 发现 {len(records_to_delete)} 个要删除的应用记录:")
        for record in records_to_delete:
            print(f"  - {record['code']}: {record['name']}")

        if records_to_delete:
            # 删除应用记录
            delete_result = await conn.execute(
                'DELETE FROM core_applications WHERE code = ANY($1)',
                disabled_app_codes
            )

            if 'DELETE' in delete_result:
                deleted_count = int(delete_result.split(' ')[1])
                print(f"✅ 已删除 {deleted_count} 个应用记录")

        # 3. 删除备份表（如果存在）
        print("\n🗑️ 清理备份表...")

        backup_tables = [
            'core_applications_backup_disabled'
        ]

        # 查找所有备份表
        all_backup_tables = await conn.fetch("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename LIKE '%_backup_disabled'
        """)

        for table in all_backup_tables:
            table_name = table['tablename']
            try:
                await conn.execute(f'DROP TABLE "{table_name}" CASCADE')
                print(f"✅ 已删除备份表: {table_name}")
            except Exception as e:
                print(f"❌ 删除备份表失败 {table_name}: {e}")

        # 4. 验证结果
        print("\n🔍 验证删除结果...")

        # 检查剩余的 apps_ 表
        remaining_apps_tables = await conn.fetch("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename LIKE 'apps_%'
            ORDER BY tablename
        """)

        print(f"✅ 剩余数据表: {len(remaining_apps_tables)} 个")
        for table in remaining_apps_tables:
            print(f"  - {table['tablename']}")

        # 检查剩余的应用记录
        remaining_apps = await conn.fetch('SELECT code, name FROM core_applications ORDER BY code')

        print(f"✅ 剩余应用记录: {len(remaining_apps)} 个")
        for app in remaining_apps:
            print(f"  - {app['code']}: {app['name']}")

        # 检查是否还有备份表
        remaining_backups = await conn.fetch("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename LIKE '%_backup_disabled'
        """)

        if remaining_backups:
            print(f"⚠️  剩余备份表: {len(remaining_backups)} 个")
            for table in remaining_backups:
                print(f"  - {table['tablename']}")
        else:
            print("✅ 所有备份表已清理")

        print("\n🎉 已停用应用清理完成！")
        print("📝 注意：此操作不可逆，已停用应用的所有数据已被永久删除")

    except Exception as e:
        print(f"❌ 操作失败: {e}")
        raise

    finally:
        await conn.close()


if __name__ == "__main__":
    # 强制执行模式，不询问确认
    asyncio.run(delete_disabled_apps_completely())
