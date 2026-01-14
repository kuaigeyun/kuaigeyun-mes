"""
运行需求计算数据迁移脚本

用于执行MRP/LRP数据到统一需求计算结果表的迁移。

Author: Luigi Lu
Date: 2025-01-14
"""

import asyncio
import sys
import json
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

from tortoise import Tortoise
from loguru import logger

from apps.kuaizhizao.migrations.migrate_computation_data import ComputationDataMigration


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="需求计算数据迁移脚本")
    parser.add_argument("--tenant-id", type=int, required=True, help="租户ID")
    parser.add_argument("--dry-run", action="store_true", help="仅模拟运行，不实际迁移")
    parser.add_argument("--output", type=str, help="输出结果到JSON文件")
    
    args = parser.parse_args()
    
    # 初始化数据库连接
    await Tortoise.init(
        db_url="postgres://postgres:postgres@localhost:5432/riveredge",
        modules={"models": ["apps.kuaizhizao.models", "apps.master_data.models", "core.models", "infra.models"]}
    )
    
    try:
        # 执行迁移
        migration = ComputationDataMigration()
        result = await migration.migrate_all(
            tenant_id=args.tenant_id,
            dry_run=args.dry_run
        )
        
        # 输出结果
        print("\n" + "=" * 60)
        print("迁移结果")
        print("=" * 60)
        print(f"租户ID: {result['tenant_id']}")
        print(f"模拟运行: {result['dry_run']}")
        print(f"MRP迁移数量: {result['mrp_count']}")
        print(f"LRP迁移数量: {result['lrp_count']}")
        print(f"开始时间: {result['start_time']}")
        print(f"结束时间: {result['end_time']}")
        
        if result['errors']:
            print(f"\n错误数量: {len(result['errors'])}")
            for error in result['errors']:
                print(f"  - {error}")
        
        if result['migrated_computations']:
            print(f"\n已迁移的计算:")
            for comp in result['migrated_computations']:
                print(f"  - {comp['computation_code']} (类型: {comp['type']})")
        
        # 保存到文件
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"\n结果已保存到: {args.output}")
        
    except Exception as e:
        logger.error(f"迁移失败: {e}")
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
