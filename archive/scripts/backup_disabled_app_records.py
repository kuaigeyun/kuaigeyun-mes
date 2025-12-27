#!/usr/bin/env python3
"""
备份并清理已停用应用的数据表记录

此脚本会：
1. 备份已停用应用的记录到备份表
2. 从主应用表中删除这些记录
"""

import asyncio
import asyncpg
import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(project_root, 'src'))

from infra.config.infra_config import infra_settings


async def backup_and_clean_disabled_app_records():
    """
    备份并清理已停用应用的数据表记录
    """
    print("🗂️ 开始备份和清理已停用应用记录...")

    conn = await asyncpg.connect(
        host=infra_settings.DB_HOST,
        port=infra_settings.DB_PORT,
        user=infra_settings.DB_USER,
        password=infra_settings.DB_PASSWORD,
        database=infra_settings.DB_NAME
    )

    try:
        # 已停用的应用代码列表
        disabled_app_codes = [
            'kuaiacc', 'kuaiaps', 'kuaicert', 'kuaicrm', 'kuaieam', 'kuaiehs',
            'kuaiems', 'kuaiepm', 'kuaihrm', 'kuaiiot', 'kuailims', 'kuaimes',
            'kuaimi', 'kuaimrp', 'kuaioa', 'kuaipdm', 'kuaipm', 'kuaiqms',
            'kuaiscm', 'kuaisrm', 'kuaitms', 'kuaiwms'
        ]

        # 检查备份表是否已存在
        backup_table_exists = await conn.fetchval(
            'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)',
            'core_applications_backup_disabled'
        )

        if backup_table_exists:
            print("⚠️  备份表已存在，跳过备份步骤")
        else:
            # 创建备份表并复制数据
            print("📋 创建备份表...")
            await conn.execute("""
                CREATE TABLE core_applications_backup_disabled AS
                SELECT * FROM core_applications
                WHERE code = ANY($1)
            """, disabled_app_codes)

            backup_count = await conn.fetchval(
                'SELECT COUNT(*) FROM core_applications_backup_disabled'
            )
            print(f"✅ 已备份 {backup_count} 个应用记录到 core_applications_backup_disabled")

        # 检查要删除的记录
        records_to_delete = await conn.fetch(
            'SELECT code, name FROM core_applications WHERE code = ANY($1)',
            disabled_app_codes
        )

        if not records_to_delete:
            print("✅ 没有需要清理的应用记录")
            return

        print(f"\n📋 将要清理的应用记录 ({len(records_to_delete)} 个):")
        for record in records_to_delete:
            print(f"  - {record['code']}: {record['name']}")

        # 询问用户确认
        force = '--force' in sys.argv or '-f' in sys.argv

        if not force:
            try:
                confirm = input(f"\n⚠️  确定要删除这些应用记录吗？此操作不可逆！(yes/no): ")
                if confirm.lower() != 'yes':
                    print("❌ 操作已取消")
                    return
            except EOFError:
                print("❌ 非交互式环境，取消操作。如需强制执行，请使用 --force 参数")
                return
        else:
            print("⚠️  强制执行模式，已跳过确认提示")

        # 删除应用记录
        print("\n🗑️ 删除应用记录...")
        delete_result = await conn.execute(
            'DELETE FROM core_applications WHERE code = ANY($1)',
            disabled_app_codes
        )

        # 解析删除结果
        if 'DELETE' in delete_result:
            deleted_count = int(delete_result.split(' ')[1])
            print(f"✅ 已删除 {deleted_count} 个应用记录")

        # 验证结果
        remaining_disabled = await conn.fetch(
            'SELECT COUNT(*) FROM core_applications WHERE code = ANY($1)',
            disabled_app_codes
        )

        print("\n🔍 验证结果:")
        print(f"  - 剩余的已停用应用记录: {remaining_disabled[0]['count']} 个")

        remaining_total = await conn.fetchval('SELECT COUNT(*) FROM core_applications')
        print(f"  - 应用表总记录数: {remaining_total} 个")

        if remaining_total == 1:
            remaining_app = await conn.fetchrow('SELECT code, name FROM core_applications LIMIT 1')
            if remaining_app and remaining_app['code'] == 'master-data':
                print("✅ 验证成功：只保留了 master-data 应用")

        print("\n📝 备份说明:")
        print("  - 备份表: core_applications_backup_disabled")
        print("  - 如需恢复，可从备份表复制记录回 core_applications")
        print("  - 备份包含所有应用配置信息")

    except Exception as e:
        print(f"❌ 操作失败: {e}")
        raise

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(backup_and_clean_disabled_app_records())
