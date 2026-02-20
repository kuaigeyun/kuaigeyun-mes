"""
一键将现有客户和供应商全部设为启用（is_active=True）

使用方式（在项目根目录，已配置好数据库环境时）:
    cd src && uv run python -c "
from asyncio import run
from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from apps.master_data.models import Customer, Supplier

async def main():
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        customers = await Customer.filter(is_active=False).all()
        suppliers = await Supplier.filter(is_active=False).all()
        for c in customers:
            c.is_active = True
            await c.save()
        for s in suppliers:
            s.is_active = True
            await s.save()
        print(f'已启用客户: {len(customers)} 条')
        print(f'已启用供应商: {len(suppliers)} 条')
    finally:
        await Tortoise.close_connections()

run(main())
"
"""

import asyncio
import sys
from pathlib import Path

# 确保 src 在 path 中（scripts -> master_data -> apps -> src）
src = Path(__file__).resolve().parent.parent.parent.parent
if str(src) not in sys.path:
    sys.path.insert(0, str(src))

from tortoise import Tortoise
from loguru import logger

from infra.infrastructure.database.database import TORTOISE_ORM
from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier


async def activate_all():
    """将所有未启用的客户和供应商设为启用"""
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        customers = await Customer.filter(is_active=False).all()
        suppliers = await Supplier.filter(is_active=False).all()
        for c in customers:
            c.is_active = True
            await c.save()
        for s in suppliers:
            s.is_active = True
            await s.save()
        logger.info(f"已启用客户: {len(customers)} 条，已启用供应商: {len(suppliers)} 条")
        return len(customers), len(suppliers)
    finally:
        await Tortoise.close_connections()


def main():
    n_c, n_s = asyncio.run(activate_all())
    print(f"已启用客户: {n_c} 条，已启用供应商: {n_s} 条")


if __name__ == "__main__":
    main()
