"""
从 manifest.json 同步 entry_point 到数据库

用法:
    python scripts/update_entry_point_from_manifest.py master-data 1
    或
    python scripts/update_entry_point_from_manifest.py --all 1
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Optional

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from core.models.application import Application
from infra.infrastructure.database.database import TORTOISE_ORM


async def update_entry_point_from_manifest(app_code: str, tenant_id: int = 1):
    """
    从 manifest.json 更新数据库中的 entry_point
    
    Args:
        app_code: 应用代码（如 'master-data'）
        tenant_id: 组织ID（默认 1）
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取应用
        app = await Application.filter(
            tenant_id=tenant_id,
            code=app_code,
            deleted_at__isnull=True
        ).first()
        
        if not app:
            print(f"❌ 应用 {app_code} 不存在")
            return
        
        # 读取 manifest.json
        # 注意：app_code 可能是 kebab-case（如 master-data），但目录可能是 snake_case（如 master_data）
        manifest_path = project_root / "src" / "apps" / app_code / "manifest.json"
        if not manifest_path.parent.exists():
            # 尝试转换为 snake_case（将连字符替换为下划线）
            snake_case_code = app_code.replace("-", "_")
            alt_manifest_path = project_root / "src" / "apps" / snake_case_code / "manifest.json"
            if alt_manifest_path.parent.exists():
                manifest_path = alt_manifest_path
                print(f"📁 使用目录: {snake_case_code} (app_code: {app_code})")
            else:
                print(f"❌ 目录 {app_code} 或 {snake_case_code} 不存在，无法读取 manifest.json")
                return
        
        if not manifest_path.exists():
            print(f"❌ manifest.json 不存在: {manifest_path}")
            return
        
        print(f"📄 读取 manifest.json: {manifest_path}")
        
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
        
        new_entry_point = manifest_data.get("entry_point")
        
        if not new_entry_point:
            print(f"⚠️ manifest.json 中没有 entry_point")
            return
        
        # 检查是否需要更新
        if app.entry_point == new_entry_point:
            print(f"✅ 应用 {app_code} 的 entry_point 已是最新: {new_entry_point}")
            return
        
        print(f"📝 更新 entry_point:")
        print(f"   旧值: {app.entry_point}")
        print(f"   新值: {new_entry_point}")
        
        # 更新数据库
        app.entry_point = new_entry_point
        await app.save()
        
        print(f"✅ 已更新应用 {app_code} 的 entry_point")
        
    finally:
        await Tortoise.close_connections()


async def main():
    if len(sys.argv) < 2:
        print("用法: python scripts/update_entry_point_from_manifest.py <app_code> [tenant_id]")
        print("或: python scripts/update_entry_point_from_manifest.py --all [tenant_id]")
        sys.exit(1)
    
    tenant_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    if sys.argv[1] == "--all":
        await Tortoise.init(config=TORTOISE_ORM)
        try:
            all_apps = await Application.filter(deleted_at__isnull=True).all()
            print(f"✅ 找到 {len(all_apps)} 个应用")
            print("============================================================")
            for app in all_apps:
                print(f"\n📦 处理应用: {app.name} (code: {app.code})")
                await update_entry_point_from_manifest(app.code, tenant_id)
            print("============================================================")
            print(f"✅ 成功更新: {len(all_apps)} 个应用的 entry_point")
        finally:
            await Tortoise.close_connections()
    else:
        app_code = sys.argv[1]
        await update_entry_point_from_manifest(app_code, tenant_id)


if __name__ == "__main__":
    asyncio.run(main())

