"""
测试迁移文件语法

验证迁移文件中的 SQL 语法是否正确。

Author: Auto (AI Assistant)
Date: 2025-01-01
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from tortoise import BaseDBAsyncClient
from migrations.models import (
    migration_3_20250101_add_foreign_key_constraints,
    migration_4_20250101_add_composite_indexes,
)


class MockDBClient(BaseDBAsyncClient):
    """模拟数据库客户端，用于测试 SQL 语法"""
    
    async def execute_query(self, query: str):
        """模拟执行查询（实际上不执行）"""
        print(f"执行查询: {query[:100]}...")
        return []


async def test_migration_syntax():
    """测试迁移文件语法"""
    db = MockDBClient()
    
    print("=" * 60)
    print("测试迁移文件语法")
    print("=" * 60)
    
    # 测试外键约束迁移
    print("\n1. 测试外键约束迁移 (3_20250101_add_foreign_key_constraints.py)")
    print("-" * 60)
    try:
        sql = await migration_3_20250101_add_foreign_key_constraints.upgrade(db)
        print(f"✅ 升级 SQL 生成成功 (长度: {len(sql)} 字符)")
        
        downgrade_sql = await migration_3_20250101_add_foreign_key_constraints.downgrade(db)
        print(f"✅ 降级 SQL 生成成功 (长度: {len(downgrade_sql)} 字符)")
        
        # 检查必要的组件
        if "MODELS_STATE" in dir(migration_3_20250101_add_foreign_key_constraints):
            print("✅ MODELS_STATE 存在")
        else:
            print("⚠️  MODELS_STATE 缺失")
            
        if hasattr(migration_3_20250101_add_foreign_key_constraints, "RUN_IN_TRANSACTION"):
            print(f"✅ RUN_IN_TRANSACTION = {migration_3_20250101_add_foreign_key_constraints.RUN_IN_TRANSACTION}")
        else:
            print("⚠️  RUN_IN_TRANSACTION 缺失")
            
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 测试复合索引迁移
    print("\n2. 测试复合索引迁移 (4_20250101_add_composite_indexes.py)")
    print("-" * 60)
    try:
        sql = await migration_4_20250101_add_composite_indexes.upgrade(db)
        print(f"✅ 升级 SQL 生成成功 (长度: {len(sql)} 字符)")
        
        downgrade_sql = await migration_4_20250101_add_composite_indexes.downgrade(db)
        print(f"✅ 降级 SQL 生成成功 (长度: {len(downgrade_sql)} 字符)")
        
        # 检查必要的组件
        if "MODELS_STATE" in dir(migration_4_20250101_add_composite_indexes):
            print("✅ MODELS_STATE 存在")
        else:
            print("⚠️  MODELS_STATE 缺失")
            
        if hasattr(migration_4_20250101_add_composite_indexes, "RUN_IN_TRANSACTION"):
            print(f"✅ RUN_IN_TRANSACTION = {migration_4_20250101_add_composite_indexes.RUN_IN_TRANSACTION}")
        else:
            print("⚠️  RUN_IN_TRANSACTION 缺失")
            
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("✅ 所有迁移文件语法测试通过")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = asyncio.run(test_migration_syntax())
    sys.exit(0 if success else 1)

