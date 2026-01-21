#!/usr/bin/env python3
import json
import uuid
from datetime import datetime
from pathlib import Path

# 直接使用sqlite3，不依赖后端代码
import sqlite3

def init_apps():
    """初始化应用数据到SQLite数据库"""

    # 查找数据库文件
    db_paths = [
        Path('riveredge-backend/riveredge.db'),
        Path('riveredge-backend/riveredge.sqlite'),
        Path('riveredge-backend/riveredge.sqlite3'),
        Path('riveredge-backend/src/riveredge.db'),
        Path('riveredge-backend/src/riveredge.sqlite'),
        Path('riveredge-backend/src/riveredge.sqlite3'),
    ]

    db_path = None
    for path in db_paths:
        if path.exists():
            db_path = path
            break

    if not db_path:
        print("未找到数据库文件")
        return

    print(f"使用数据库: {db_path}")

    # 连接数据库
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # 检查core_applications表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='core_applications'")
    if not cursor.fetchone():
        print("core_applications表不存在，请先运行数据库迁移")
        return

    # 扫描插件
    apps_dir = Path('riveredge-backend/src/apps')
    if not apps_dir.exists():
        print(f"应用目录不存在: {apps_dir}")
        return

    print(f"扫描应用目录: {apps_dir}")

    apps_registered = 0

    for app_dir in apps_dir.iterdir():
        if not app_dir.is_dir():
            continue

        manifest_file = app_dir / 'manifest.json'
        if not manifest_file.exists():
            continue

        try:
            with open(manifest_file, 'r', encoding='utf-8') as f:
                manifest = json.load(f)

            app_code = manifest.get('code')
            if not app_code:
                continue

            print(f"处理应用: {app_code}")

            # 检查应用是否已存在
            cursor.execute("SELECT id, is_active, is_installed FROM core_applications WHERE code = ? AND tenant_id = 1", (app_code,))
            existing = cursor.fetchone()

            if existing:
                print(f"  应用已存在，跳过: {app_code}")
                continue

            # 插入新应用
            app_data = {
                'uuid': str(uuid.uuid4()),
                'tenant_id': 1,
                'name': manifest.get('name', app_code),
                'code': app_code,
                'description': manifest.get('description', ''),
                'icon': manifest.get('icon', 'appstore'),
                'version': manifest.get('version', '1.0.0'),
                'route_path': manifest.get('route_path', f'/apps/{app_code}'),
                'entry_point': manifest.get('entry_point', f'../apps/{app_code}/index.tsx'),
                'menu_config': json.dumps(manifest.get('menu_config', {}), ensure_ascii=False),
                'permission_code': f'app:{app_code}',
                'is_system': True,
                'is_active': True,
                'is_installed': True,
                'sort_order': manifest.get('sort_order', 1000),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            }

            columns = list(app_data.keys())
            placeholders = ','.join(['?' for _ in columns])
            values = list(app_data.values())

            query = f"""
                INSERT INTO core_applications ({', '.join(columns)})
                VALUES ({placeholders})
            """

            cursor.execute(query, values)
            apps_registered += 1
            print(f"  应用已注册: {app_code}")

        except Exception as e:
            print(f"处理应用 {app_dir.name} 时出错: {e}")

    conn.commit()
    conn.close()

    print(f"\n应用初始化完成，共注册了 {apps_registered} 个应用")

if __name__ == '__main__':
    init_apps()