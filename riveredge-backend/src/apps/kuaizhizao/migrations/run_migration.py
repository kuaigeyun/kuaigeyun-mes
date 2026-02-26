"""
历史数据迁移执行脚本

用于执行需求数据迁移的命令行工具。

使用方法（在 riveredge-backend 目录下，保证 .env 已配置）:
    cd riveredge-backend && PYTHONPATH=src uv run python -m apps.kuaizhizao.migrations.run_migration --tenant-id 1 --dry-run
    cd riveredge-backend && PYTHONPATH=src uv run python -m apps.kuaizhizao.migrations.run_migration --tenant-id 1 --validate
    cd riveredge-backend && PYTHONPATH=src uv run python -m apps.kuaizhizao.migrations.run_migration --tenant-id 1 --rollback

Author: Luigi Lu
Date: 2025-01-14
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from loguru import logger

# 加载 .env
_backend_root = Path(__file__).resolve().parent.parent.parent.parent.parent
_env_file = _backend_root / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

# 确保 src 在 path 中
src_root = _backend_root / "src"
if str(src_root) not in sys.path:
    sys.path.insert(0, str(src_root))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from apps.kuaizhizao.migrations.migrate_demand_data import DemandDataMigration


async def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="需求数据迁移工具")
    parser.add_argument("--tenant-id", type=int, required=True, help="租户ID")
    parser.add_argument("--dry-run", action="store_true", help="模拟运行（不实际迁移）")
    parser.add_argument("--validate", action="store_true", help="验证迁移数据")
    parser.add_argument("--rollback", action="store_true", help="回滚迁移数据")
    parser.add_argument("--source-type", type=str, choices=["sales_forecast", "sales_order"], help="源类型（用于回滚）")
    parser.add_argument("--output", type=str, help="输出结果到文件（JSON格式）")
    
    args = parser.parse_args()
    
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        migration = DemandDataMigration()
        if args.validate:
            # 验证迁移数据
            logger.info("执行数据验证...")
            result = await migration.validate_migration(args.tenant_id)
            print("\n=== 验证结果 ===")
            print(f"验证状态: {'通过' if result['valid'] else '失败'}")
            if result.get("errors"):
                print(f"\n错误数量: {len(result['errors'])}")
                for error in result["errors"]:
                    print(f"  - {error}")
            if result.get("warnings"):
                print(f"\n警告数量: {len(result['warnings'])}")
                for warning in result["warnings"]:
                    print(f"  - {warning}")
        
        elif args.rollback:
            # 回滚迁移数据
            logger.warning("执行数据回滚...")
            confirm = input(f"确认要回滚租户 {args.tenant_id} 的迁移数据吗？(yes/no): ")
            if confirm.lower() != "yes":
                print("已取消回滚操作")
                return
            
            result = await migration.rollback_migration(
                args.tenant_id,
                args.source_type
            )
            print("\n=== 回滚结果 ===")
            print(f"回滚数量: {result['count']}")
            if result.get("errors"):
                print(f"\n错误数量: {len(result['errors'])}")
                for error in result["errors"]:
                    print(f"  - {error}")
        
        else:
            # 执行迁移
            logger.info(f"执行数据迁移（dry_run={args.dry_run}）...")
            result = await migration.migrate_all(args.tenant_id, args.dry_run)
            print("\n=== 迁移结果 ===")
            print(f"迁移状态: {'成功' if result['success'] else '失败'}")
            print(f"销售预测数量: {result['sales_forecast_count']}")
            print(f"销售订单数量: {result['sales_order_count']}")
            if result.get("errors"):
                print(f"\n错误数量: {len(result['errors'])}")
                for error in result["errors"][:10]:  # 只显示前10个错误
                    print(f"  - {error}")
                if len(result["errors"]) > 10:
                    print(f"  ... 还有 {len(result['errors']) - 10} 个错误")
        
        # 输出结果到文件
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2, default=str)
            print(f"\n结果已保存到: {args.output}")
        
    except Exception as e:
        logger.error(f"执行失败: {e}")
        print(f"\n执行失败: {e}")
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
