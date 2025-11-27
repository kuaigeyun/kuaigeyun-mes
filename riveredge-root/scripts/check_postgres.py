"""
检查 PostgreSQL 服务状态
"""

import asyncio
import asyncpg


async def check_postgres():
    """检查 PostgreSQL 服务状态"""
    print("=" * 60)
    print("PostgreSQL 服务状态检查")
    print("=" * 60)
    
    # 1. 检查连接到 postgres 数据库
    print("\n1. 检查 PostgreSQL 服务连接...")
    try:
        conn = await asyncpg.connect('postgres://postgres:postgres@localhost:5432/postgres')
        version = await conn.fetchval('SELECT version()')
        print(f"✓ PostgreSQL 服务运行正常")
        print(f"  版本: {version.split(',')[0]}")
        await conn.close()
    except Exception as e:
        print(f"✗ PostgreSQL 服务连接失败: {e}")
        return
    
    # 2. 检查 riveredge 数据库是否存在
    print("\n2. 检查 riveredge 数据库...")
    try:
        conn = await asyncpg.connect('postgres://postgres:postgres@localhost:5432/postgres')
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = 'riveredge'")
        if exists:
            print("✓ riveredge 数据库存在")
        else:
            print("✗ riveredge 数据库不存在，需要创建")
            print("  创建命令: CREATE DATABASE riveredge;")
        await conn.close()
    except Exception as e:
        print(f"✗ 检查失败: {e}")
    
    # 3. 检查 riveredge 数据库连接
    print("\n3. 检查 riveredge 数据库连接...")
    try:
        conn = await asyncpg.connect('postgres://postgres:postgres@localhost:5432/riveredge')
        print("✓ riveredge 数据库连接成功")
        await conn.close()
    except Exception as e:
        print(f"✗ riveredge 数据库连接失败: {e}")
        return
    
    # 4. 检查表是否存在
    print("\n4. 检查数据库表...")
    try:
        conn = await asyncpg.connect('postgres://postgres:postgres@localhost:5432/riveredge')
        tables = await conn.fetch(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name LIKE 'core_%' "
            "ORDER BY table_name"
        )
        print(f"✓ 找到 {len(tables)} 个 core_* 表")
        if tables:
            print("  表列表:")
            for table in tables:
                print(f"    - {table['table_name']}")
        else:
            print("  ✗ 没有找到 core_* 表，需要创建表结构")
        await conn.close()
    except Exception as e:
        print(f"✗ 查询失败: {e}")
    
    # 5. 检查连接数
    print("\n5. 检查 PostgreSQL 连接配置...")
    try:
        conn = await asyncpg.connect('postgres://postgres:postgres@localhost:5432/postgres')
        max_conn = await conn.fetchval("SELECT setting FROM pg_settings WHERE name = 'max_connections'")
        current_conn = await conn.fetchval("SELECT count(*) FROM pg_stat_activity")
        print(f"✓ 最大连接数: {max_conn}")
        print(f"✓ 当前活动连接数: {current_conn}")
        await conn.close()
    except Exception as e:
        print(f"✗ 查询失败: {e}")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    asyncio.run(check_postgres())

