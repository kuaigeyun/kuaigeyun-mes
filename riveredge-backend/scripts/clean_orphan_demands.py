"""
一键清理孤儿需求：来源单据（销售订单/销售预测）已删除但需求记录仍存在的需求，直接物理删除（先删明细再删需求）。

使用方式（在 backend 目录下，保证 .env 已配置）:
    cd riveredge-backend/src && uv run python ../scripts/clean_orphan_demands.py
    指定租户: 加 --tenant 11
"""

import argparse
import asyncio
import sys
from pathlib import Path
from typing import Optional

# 先加载 backend/.env，再导入依赖 DB 配置的模块
_backend_root = Path(__file__).resolve().parent.parent
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
from apps.kuaizhizao.services.demand_service import DemandService
from apps.kuaizhizao.models.demand import Demand


async def run_clean(tenant_id: Optional[int]):
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        if tenant_id is not None:
            tenant_ids = [tenant_id]
        else:
            # 所有有需求记录的租户
            tenant_ids = await Demand.all().values_list("tenant_id", flat=True)
            tenant_ids = list(set(tenant_ids))

        total_cleaned = 0
        for tid in tenant_ids:
            result = await DemandService().clean_orphan_demands(tid)
            n = result.get("cleaned_count", 0)
            total_cleaned += n
            if n > 0:
                print(f"租户 {tid}: 已清理 {n} 条孤儿需求, demand_ids={result.get('demand_ids', [])}")
        print(f"合计清理 {total_cleaned} 条孤儿需求")
        return total_cleaned
    finally:
        await Tortoise.close_connections()


def main():
    parser = argparse.ArgumentParser(description="清理孤儿需求（改逻辑前遗留）")
    parser.add_argument("--tenant", type=int, default=None, help="指定租户 ID，不指定则清理所有租户")
    args = parser.parse_args()
    asyncio.run(run_clean(args.tenant))


if __name__ == "__main__":
    main()
