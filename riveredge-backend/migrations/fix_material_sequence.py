"""
修复物料表序列脚本

修复 apps_master_data_materials 表的序列，使其与当前最大 ID 同步。

使用方法：
1. 确保已设置数据库连接（通过 .env 文件）
2. 运行：uv run python migrations/fix_material_sequence.py

Author: Luigi Lu
Date: 2026-01-12
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 数据库连接配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "riveredge")


async def fix_sequence():
    """修复序列"""
    print(f"\n连接数据库: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        print("数据库连接成功\n")
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return
    
    try:
        # 开始事务
        async with conn.transaction():
            print("检查序列状态...")
            
            # 检查表是否存在
            table_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'apps_master_data_materials'
                )
            """)
            
            if not table_exists:
                print("  ⚠ 表 apps_master_data_materials 不存在")
                # 检查是否有 seed_ 前缀的表
                seed_table_exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'seed_master_data_materials'
                    )
                """)
                if seed_table_exists:
                    print("  ⚠ 发现表 seed_master_data_materials（可能是测试数据表）")
                return
            
            # 获取当前最大 ID
            max_id = await conn.fetchval("SELECT MAX(id) FROM apps_master_data_materials")
            print(f"  - 当前最大 ID: {max_id or 0}")
            
            # 检查序列是否存在
            sequence_name = "apps_master_data_materials_id_seq"
            seq_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM pg_class 
                    WHERE relname = $1
                )
            """, sequence_name)
            
            if not seq_exists:
                print(f"  ⚠ 序列 {sequence_name} 不存在，尝试创建...")
                # 尝试创建序列
                try:
                    await conn.execute(f"""
                        CREATE SEQUENCE {sequence_name}
                        START WITH {(max_id or 0) + 1}
                    """)
                    print(f"  ✓ 序列 {sequence_name} 创建成功")
                except Exception as e:
                    print(f"  ✗ 创建序列失败: {e}")
                    return
            else:
                # 获取当前序列值
                seq_val = await conn.fetchval(f"SELECT last_value FROM {sequence_name}")
                print(f"  - 当前序列值: {seq_val}")
                
                # 如果序列值小于最大 ID，修复序列
                if seq_val < (max_id or 0):
                    new_seq_val = (max_id or 0) + 1
                    print(f"  ⚠ 序列值 ({seq_val}) 小于最大 ID ({max_id})，需要修复")
                    print(f"  修复序列值到: {new_seq_val}")
                    
                    await conn.execute(f"""
                        SELECT setval('{sequence_name}', {new_seq_val}, false)
                    """)
                    
                    # 验证修复结果
                    new_seq_val_check = await conn.fetchval(f"SELECT last_value FROM {sequence_name}")
                    print(f"  ✓ 序列已修复，新值: {new_seq_val_check}")
                else:
                    print(f"  ✓ 序列值正常，无需修复")
            
            print("\n修复完成！")
            
    except Exception as e:
        print(f"\n修复失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(fix_sequence())
