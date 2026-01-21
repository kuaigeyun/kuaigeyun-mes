"""
清理 Inngest 数据库中的过期应用记录

用于清理使用旧端口（8300）时注册的应用，保留当前正常工作的应用。

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv
from datetime import datetime

# 加载环境变量
load_dotenv()


async def cleanup_inngest_apps():
    """
    清理 Inngest 数据库中的过期应用记录
    
    保留当前正常工作的应用（app_id: riveredge），删除其他过期应用。
    """
    conn = None
    try:
        # Inngest 数据库连接信息（从配置文件读取）
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = int(os.getenv('DB_PORT', 5432))
        db_user = os.getenv('DB_USER', 'postgres')
        db_password = os.getenv('DB_PASSWORD', 'postgres')
        db_name = 'inngest'  # Inngest 专用数据库
        
        # 当前应用的 app_id
        current_app_id = os.getenv('INNGEST_APP_ID', 'riveredge')
        
        print(f"📊 连接到 Inngest 数据库: {db_name}@{db_host}:{db_port}")
        
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )
        
        print(f"✅ 成功连接到 Inngest 数据库")
        
        # 检查 Inngest 数据库中的表结构
        # Inngest 通常使用 'apps' 表存储应用信息
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%app%'
            ORDER BY table_name
        """)
        
        print(f"\n📋 找到的应用相关表:")
        for table in tables:
            print(f"  - {table['table_name']}")
        
        # 检查 'apps' 表（Inngest 标准表名）
        if any(t['table_name'] == 'apps' for t in tables):
            # 查询所有应用
            apps = await conn.fetch("SELECT * FROM apps ORDER BY created_at DESC")
            
            print(f"\n📋 当前数据库中的应用记录:")
            for app in apps:
                app_id = app.get('id') or app.get('app_id') or app.get('name')
                created_at = app.get('created_at') or app.get('created')
                url = app.get('url') or app.get('sync_url') or app.get('syncUrl')
                
                print(f"  - App ID: {app_id}")
                print(f"    创建时间: {created_at}")
                print(f"    URL: {url}")
                print()
            
            # 查找需要删除的应用（URL 包含 8300 端口的，或者不是当前 app_id 的）
            apps_to_delete = []
            for app in apps:
                app_id = app.get('id') or app.get('app_id') or app.get('name')
                url = app.get('url') or app.get('sync_url') or app.get('syncUrl') or ''
                
                # 如果 URL 包含 8300（旧端口），或者 app_id 不是当前应用
                if '8300' in str(url) or (app_id and app_id != current_app_id):
                    apps_to_delete.append(app)
            
            if apps_to_delete:
                print(f"🗑️  找到 {len(apps_to_delete)} 个过期应用需要删除:")
                for app in apps_to_delete:
                    app_id = app.get('id') or app.get('app_id') or app.get('name')
                    url = app.get('url') or app.get('sync_url') or app.get('syncUrl')
                    print(f"  - App ID: {app_id}, URL: {url}")
                
                # 确认删除
                print(f"\n⚠️  是否删除这些过期应用? (y/n): ", end='')
                # 在脚本中自动确认（生产环境应该手动确认）
                confirm = 'y'  # 自动确认，实际使用时可以改为 input()
                
                if confirm.lower() == 'y':
                    for app in apps_to_delete:
                        app_id = app.get('id') or app.get('app_id') or app.get('name')
                        # 尝试不同的主键字段名
                        pk_field = 'id' if 'id' in app else ('app_id' if 'app_id' in app else 'name')
                        pk_value = app.get(pk_field)
                        
                        try:
                            await conn.execute(f"DELETE FROM apps WHERE {pk_field} = $1", pk_value)
                            print(f"  ✅ 已删除应用: {app_id}")
                        except Exception as e:
                            print(f"  ❌ 删除应用失败 {app_id}: {e}")
                    
                    print(f"\n✅ 清理完成！")
                else:
                    print(f"\n❌ 取消清理操作")
            else:
                print(f"✅ 没有找到需要清理的过期应用")
        else:
            print(f"\n⚠️  未找到 'apps' 表，Inngest 数据库结构可能不同")
            print(f"   请手动检查 Inngest 数据库中的应用记录")
        
        # 检查其他可能的表（如 'sync' 表）
        sync_tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%sync%' OR table_name LIKE '%function%')
            ORDER BY table_name
        """)
        
        if sync_tables:
            print(f"\n📋 其他相关表:")
            for table in sync_tables:
                print(f"  - {table['table_name']}")
        
    except asyncpg.exceptions.InvalidCatalogNameError:
        print(f"❌ Inngest 数据库 '{db_name}' 不存在")
        print(f"   请确保 Inngest 数据库已创建")
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()
            print(f"\n✅ 数据库连接已关闭")


if __name__ == "__main__":
    print("=" * 60)
    print("清理 Inngest 数据库中的过期应用记录")
    print("=" * 60)
    print()
    
    asyncio.run(cleanup_inngest_apps())

