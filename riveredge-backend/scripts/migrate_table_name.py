"""
迁移表名脚本

将 root_platform_superadmin 表重命名为 soil_platform_superadmin
"""

import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

import psycopg2
from soil.config.platform_config import platform_settings as settings


def migrate_table_name():
    """
    迁移表名
    
    将 root_platform_superadmin 表重命名为 soil_platform_superadmin
    """
    # 连接数据库
    db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST
    
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
        )
        
        print("数据库连接成功")
        
        cur = conn.cursor()
        
        # 检查旧表是否存在
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'root_platform_superadmin'
            )
        """)
        old_exists = cur.fetchone()[0]
        
        # 检查新表是否存在
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'soil_platform_superadmin'
            )
        """)
        new_exists = cur.fetchone()[0]
        
        if old_exists and not new_exists:
            # 重命名表
            cur.execute("""
                ALTER TABLE root_platform_superadmin 
                RENAME TO soil_platform_superadmin
            """)
            conn.commit()
            print("✅ 表 root_platform_superadmin 已重命名为 soil_platform_superadmin")
        elif new_exists:
            print("ℹ️  表 soil_platform_superadmin 已存在，无需迁移")
            if old_exists:
                print("⚠️  警告：旧表 root_platform_superadmin 仍然存在")
                print("   如果需要，可以手动删除旧表：DROP TABLE root_platform_superadmin;")
        elif not old_exists and not new_exists:
            print("ℹ️  表不存在，将在下次运行 aerich migrate 时创建")
        else:
            print("ℹ️  表状态正常，无需迁移")
        
        cur.close()
        conn.close()
        print("数据库迁移完成！")
        
    except psycopg2.OperationalError as e:
        print(f"❌ 数据库连接失败: {e}")
        print("请确保 PostgreSQL 服务正在运行")
        return
    except Exception as e:
        print(f"❌ 数据库迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return


if __name__ == "__main__":
    migrate_table_name()
