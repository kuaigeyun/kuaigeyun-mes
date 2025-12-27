#!/usr/bin/env python3
"""
备份并删除已停用APP的数据表

此脚本会：
1. 识别所有已停用APP对应的数据表
2. 将这些表重命名为备份表（添加 _backup_disabled 后缀）
3. 删除原表（实际上是通过重命名实现的备份）
"""

import asyncio
import asyncpg
import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(project_root, 'src'))

from infra.config.infra_config import infra_settings


async def backup_and_drop_disabled_app_tables():
    """
    备份并删除已停用APP的数据表
    """
    print("🚀 开始备份和删除已停用APP的数据表...")

    conn = await asyncpg.connect(
        host=infra_settings.DB_HOST,
        port=infra_settings.DB_PORT,
        user=infra_settings.DB_USER,
        password=infra_settings.DB_PASSWORD,
        database=infra_settings.DB_NAME
    )

    try:
        # 获取所有表名
        tables = await conn.fetch("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)

        # 已停用的APP对应的表前缀
        disabled_app_prefixes = [
            'apps_kuaicrm_',    # 客户关系管理系统
            'apps_kuaieam_',    # 设备资产管理系统
            'apps_kuaimes_',    # 制造执行系统
            'apps_kuaimrp_',    # 物料需求规划系统
            'apps_kuaipdm_',    # 产品数据管理系统
            'apps_kuaiqms_',    # 质量管理系统
            'apps_kuaisrm_',    # 供应商关系管理系统
            'apps_kuaiwms_',    # 仓库管理系统
        ]

        tables_to_backup = []
        for table in tables:
            table_name = table['tablename']
            for prefix in disabled_app_prefixes:
                if table_name.startswith(prefix):
                    tables_to_backup.append(table_name)
                    break

        print(f"🔍 发现 {len(tables_to_backup)} 个需要备份和删除的表:")
        for table in tables_to_backup:
            print(f"  - {table}")

        if not tables_to_backup:
            print("✅ 没有需要备份的表")
            return

        # 显示将要执行的操作
        print("\n📋 操作计划:")
        print(f"  - 将重命名 {len(tables_to_backup)} 个表为备份表")
        print("  - 备份表后缀: _backup_disabled")
        # 检查命令行参数
        import sys
        force = '--force' in sys.argv or '-f' in sys.argv

        if not force:
            # 询问用户确认
            try:
                confirm = input(f"\n⚠️  确定要继续吗？此操作不可逆！(yes/no): ")
                if confirm.lower() != 'yes':
                    print("❌ 操作已取消")
                    return
            except EOFError:
                print("❌ 非交互式环境，取消操作。如需强制执行，请使用 --force 参数")
                return
        else:
            print("⚠️  强制执行模式，已跳过确认提示")

        # 开始备份和删除
        print("\n📦 开始备份表...")

        success_count = 0
        for table_name in tables_to_backup:
            backup_table_name = f"{table_name}_backup_disabled"

            try:
                # 检查备份表是否已存在
                exists = await conn.fetchval(
                    'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)',
                    backup_table_name
                )

                if exists:
                    print(f"⚠️  备份表 {backup_table_name} 已存在，跳过")
                    continue

                # 重命名表作为备份
                await conn.execute(f'ALTER TABLE "{table_name}" RENAME TO "{backup_table_name}"')
                print(f"✅ 已备份: {table_name} -> {backup_table_name}")
                success_count += 1

            except Exception as e:
                print(f"❌ 备份失败 {table_name}: {e}")

        print(f"\n🎉 备份完成！成功备份 {success_count}/{len(tables_to_backup)} 个表")

        if success_count > 0:
            print("📝 备份说明:")
            print("  - 备份表以 '_backup_disabled' 后缀命名")
            print("  - 如需恢复数据，可重命名备份表回原名")
            print("  - 备份表中的数据完全保留")

        # 显示最终结果
        print("\n📊 最终状态:")
        remaining_tables = await conn.fetch("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename LIKE 'apps_%'
            ORDER BY tablename
        """)

        active_apps = []
        backup_apps = []

        for table in remaining_tables:
            table_name = table['tablename']
            if table_name.endswith('_backup_disabled'):
                backup_apps.append(table_name)
            else:
                active_apps.append(table_name)

        print(f"  - 活跃应用表: {len(active_apps)} 个")
        print(f"  - 备份应用表: {len(backup_apps)} 个")

        if active_apps:
            print("  - 保留的应用: master_data")

    except Exception as e:
        print(f"❌ 操作失败: {e}")
        raise

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(backup_and_drop_disabled_app_tables())
