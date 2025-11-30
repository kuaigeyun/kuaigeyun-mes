"""
检查数据库表结构脚本

检查现有表并列出缺少的字段
"""

import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

import psycopg2
from soil.config.platform_config import platform_settings as settings


def check_tables():
    """
    检查数据库表结构
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
        print("=" * 60)
        
        cur = conn.cursor()
        
        # 检查所有表
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        
        tables = cur.fetchall()
        print(f"现有表数量: {len(tables)}")
        print("\n现有表列表:")
        for table in tables:
            print(f"  - {table[0]}")
        
        # 检查 platform_superadmin 相关表
        print("\n" + "=" * 60)
        print("检查 platform_superadmin 相关表:")
        
        for table_name in ['root_platform_superadmin', 'soil_platform_superadmin']:
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                )
            """, (table_name,))
            exists = cur.fetchone()[0]
            
            if exists:
                print(f"\n✅ 表 {table_name} 存在")
                # 检查表结构
                cur.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                    ORDER BY ordinal_position
                """, (table_name,))
                columns = cur.fetchall()
                print(f"  字段列表:")
                for col in columns:
                    print(f"    - {col[0]} ({col[1]}, nullable: {col[2]})")
            else:
                print(f"\n❌ 表 {table_name} 不存在")
        
        cur.close()
        conn.close()
        
        print("\n" + "=" * 60)
        print("检查完成！")
        
    except psycopg2.OperationalError as e:
        print(f"❌ 数据库连接失败: {e}")
        print("请确保 PostgreSQL 服务正在运行，并且数据库密码正确")
        return
    except Exception as e:
        print(f"❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
        return


if __name__ == "__main__":
    check_tables()

