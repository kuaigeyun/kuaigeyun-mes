"""
查询指定销售订单在数据库中的真实状态及关联需求。

使用方式（在 backend 目录下，保证 .env 已配置）:
    cd riveredge-backend/src && uv run python ../scripts/check_sales_order_status.py XS202602210001
  或指定租户:
    cd riveredge-backend/src && uv run python ../scripts/check_sales_order_status.py XS202602210001 --tenant 1
"""

import argparse
import asyncio
import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parent.parent
_env_file = _backend_root / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

src_root = _backend_root / "src"
if str(src_root) not in sys.path:
    sys.path.insert(0, str(src_root))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.demand import Demand


async def run_check(order_code: str, tenant_id):
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        q = SalesOrder.filter(order_code=order_code, deleted_at__isnull=True)
        if tenant_id is not None:
            q = q.filter(tenant_id=tenant_id)
        order = await q.first()
        if not order:
            print(f"未找到销售订单: {order_code}" + (f" (tenant_id={tenant_id})" if tenant_id else ""))
            return
        print("=== 销售订单（数据库真实值）===")
        print(f"  id: {order.id}")
        print(f"  order_code: {order.order_code}")
        print(f"  status: {order.status!r}")
        print(f"  review_status: {order.review_status!r}")
        print(f"  tenant_id: {order.tenant_id}")
        print()

        # 关联需求：Demand 通过 source_type='sales_order', source_id=order.id 关联
        demands = await Demand.filter(
            tenant_id=order.tenant_id,
            source_type="sales_order",
            source_id=order.id,
            deleted_at__isnull=True,
        ).all()
        print("=== 关联需求（需求管理中可见即为此表）===")
        if not demands:
            print("  无。需求在「审核通过」时创建，撤销审核不会删除需求，若此处为空说明从未审核通过过。")
        else:
            for d in demands:
                print(f"  demand_id: {d.id}, demand_code: {d.demand_code!r}, status: {d.status!r}, review_status: {d.review_status!r}")
        print()
        print("说明: 销售订单撤销审核后 status 变为 PENDING_REVIEW（待审核），但已产生的 Demand 记录不会删除，")
        print("      因此需求管理里仍会看到该需求；需求状态与订单独立，仅来源关联 source_id 指向该订单。")
    finally:
        await Tortoise.close_connections()


def main():
    parser = argparse.ArgumentParser(description="查询销售订单及关联需求在库中的真实状态")
    parser.add_argument("order_code", help="销售订单编码，如 XS202602210001")
    parser.add_argument("--tenant", type=int, default=None, help="指定租户 ID（可选）")
    args = parser.parse_args()
    asyncio.run(run_check(args.order_code, args.tenant))


if __name__ == "__main__":
    main()
