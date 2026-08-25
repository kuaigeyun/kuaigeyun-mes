"""
辐条轮毂 BOM Seed — 创建辐条轮毂 SW-PRODUCT 的 BOM 头 + 6 个子件行
BOM-SW-PRODUCT-v1.0
  SW-HUB       × 1
  SW-HUB-BARREL × 1
  SW-DISPLACER × 1
  SW-SPOKE-220 × 100
  SW-SPOKE-210 × 100
  SW-NIPPLE     × 200
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/src")

from tortoise import Tortoise

from apps.master_data.models import Material, BOM
from infra.infrastructure.database.database import init_tortoise_dynamic


# BOM 子件清单:(子件编码, 用量, 单位, 损耗率, 发料方式)
BOM_ITEMS = [
    ("SW-HUB",         1,   "件", 0,    "pick"),    # 铝合金轮毂 × 1
    ("SW-HUB-BARREL",  1,   "件", 0,    "pick"),    # 花毂筒 × 1
    ("SW-DISPLACER",   1,   "件", 0,    "pick"),    # 变位器 × 1
    ("SW-SPOKE-220",   100, "根", 5,    "pick"),    # 钢丝 220mm × 100, 损耗 5%
    ("SW-SPOKE-210",   100, "根", 5,    "pick"),    # 钢丝 210mm × 100, 损耗 5%
    ("SW-NIPPLE",      200, "个", 3,    "pick"),    # 弹头 × 200, 损耗 3%
]

BOM_VERSION = "1.0"


async def seed():
    await init_tortoise_dynamic()
    product = await Material.get_or_none(main_code="SW-PRODUCT").first()
    if not product:
        print("ERROR: SW-PRODUCT 物料不存在,请先跑 seed_spoke_wheel.py")
        return

    # 检查已存在
    existed_count = await BOM.filter(material=product, version=BOM_VERSION, deleted_at__isnull=True).count()
    if existed_count > 0:
        print(f"已存在 {existed_count} 条 BOM 行 (version={BOM_VERSION}),跳过创建")
    else:
        # 注意:BOMItem 表里字段是 parent 物料(成品),quantity/unit/waste_rate/issue_method 等
        # 这里我们插入的是 BOMItem 行记录(每个子件一行)
        for code, qty, unit, waste, method in BOM_ITEMS:
            comp = await Material.get_or_none(main_code=code).first()
            if not comp:
                print(f"WARN: 子件 {code} 不存在,跳过")
                continue
            existed = await BOM.filter(
                material=product, component=comp, version=BOM_VERSION, deleted_at__isnull=True
            ).first()
            if existed:
                print(f"  · 已存在 {code} × {qty}")
                continue
            await BOM.create(
                tenant_id=1,
                material=product,
                component=comp,
                quantity=qty,
                unit=unit,
                waste_rate=waste,
                issue_method=method,
                version=BOM_VERSION,
                is_default=False,
                is_active=True,
                approval_status="draft",
                level=1,
                description=f"辐条轮毂 BOM v{BOM_VERSION} - {comp.name}",
                created_by_name="系统初始化",
            )
            print(f"  ✓ 创建 BOMItem: {product.main_code} <- {code} × {qty}{unit} (损耗 {waste}%)")

    print("\n验证:列出 SW-PRODUCT 的 BOMItems")
    items = await BOM.filter(material=product, version=BOM_VERSION, deleted_at__isnull=True).prefetch_related("component", "material")
    for it in items:
        comp = it.component
        mat = it.material
        print(f"  {mat.main_code} <- {comp.main_code} ({comp.name}) × {it.quantity}{it.unit}")


async def main():
    try:
        await seed()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())