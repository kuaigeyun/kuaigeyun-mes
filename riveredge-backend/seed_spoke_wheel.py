"""
辐条轮毂数据 Seed 脚本 — 通过 master_data API 注册 5 个部件 + 5 条工艺路线 + 1 个 BOM + 1 条总装工艺路线

业务流程:
  1. 铝合金轮毂: 轮辋 → 辐条孔加工 → 抛光(外协) → 电镀(外协) → 入库 → 镀金(外协) → 镀金成品入库
  2. 花毂筒:   锻造毛坯入库 → PCD孔加工 → 钢丝孔加工 → 抛光(外协) → 电镀(外协) → 入库 → 镀金(外协) → 镀金成品入库
  3. 变位器:   锻造毛坯入库 → 压螺栓 → 成品入库
  4. 钢丝:     电镀 220mm 辐条入库 → 镀金(外协) → 镀金成品入库(100 个)
  5. 弹头:     电镀成品入库 → 镀金(外协) → 镀金成品入库(200 个)

总装工艺:  4 等份固定 → 3 百分表调试(同心度 ≤ 0.8mm) → 穿钢丝弹头 → 包装入库

使用方法:
  export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
  export PATH=$HOME/.local/bin:$PATH  # 或本机 Windows: set PATH=D:\app\postgresql-18.6-1\bin;...
  uv run python seed_spoke_wheel.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/src")

from tortoise import Tortoise
from apps.master_data.models import (
    Material,
    MaterialGroup,
    Operation,
    ProcessRoute,
)
from infra.infrastructure.database.database import init_tortoise_dynamic


# === 物料定义 ===
MATERIALS = [
    # code, name, source_type, unit, spec, group_code
    ("SW-HUB", "铝合金轮毂", "make", "件", "辐条孔加工 / 抛光 / 电镀 / 镀金", "spoke-wheel"),
    ("SW-HUB-BARREL", "花毂筒", "make", "件", "PCD孔 / 钢丝孔 / 抛光 / 电镀 / 镀金", "spoke-wheel"),
    ("SW-DISPLACER", "变位器", "make", "件", "锻造毛坯 / 压螺栓 (200 根/批)", "spoke-wheel"),
    ("SW-SPOKE-220", "镀金钢丝 220mm", "buy", "根", "外协镀金,100 根/批", "spoke-wheel"),
    ("SW-SPOKE-210", "镀金钢丝 210mm", "buy", "根", "外协镀金,100 根/批", "spoke-wheel"),
    ("SW-NIPPLE", "镀金弹头", "buy", "个", "外协镀金,200 个/批", "spoke-wheel"),
    ("SW-PRODUCT", "辐条轮毂(成品)", "make", "件", "轮毂×1 + 花毂筒×1 + 变位器×1 + 钢丝×200 + 弹头×200", "spoke-wheel"),
]


# === 工艺路线定义 ===
# 每个工序的元组: (operation_code, operation_name, outsource_default, is_inspection)
OPERATIONS = [
    # 基础工序
    ("OP-CUT", "轮辋下料", False, False),
    ("OP-DRILL", "孔加工", False, False),
    ("OP-POLISH", "抛光", True, False),     # 外协
    ("OP-PLATE", "电镀", True, False),       # 外协
    ("OP-GILD", "镀金", True, False),         # 外协
    ("OP-WIN", "钢丝入库检验", False, True),
    ("OP-NIP-IN", "弹头入库检验", False, True),
    ("OP-FORGE", "锻造毛坯入库", False, False),
    ("OP-BOLT", "压螺栓", False, False),
    ("OP-INSPECT", "过程检验", False, True),
    ("OP-CONCEN", "同心度调试(0.8mm)", False, True),
    # 总装
    ("OP-FIX", "4 等份固定", False, False),
    ("OP-ASSEMBLE", "穿钢丝弹头", False, False),
    ("OP-PACK", "包装入库", False, False),
]


# 部件工艺路线: list of (seq, operation_code)
PART_ROUTES = {
    "SW-HUB": [
        ("PR-HUB", "铝合金轮毂工艺", [
            (10, "OP-CUT"),
            (20, "OP-DRILL"),
            (30, "OP-POLISH"),    # 外协
            (40, "OP-PLATE"),     # 外协
            (50, "OP-INSPECT"),   # 镀前检
            (60, "OP-GILD"),      # 外协
            (70, "OP-INSPECT"),   # 镀后检
        ]),
    ],
    "SW-HUB-BARREL": [
        ("PR-HUB-BARREL", "花毂筒工艺", [
            (10, "OP-FORGE"),
            (20, "OP-DRILL"),
            (30, "OP-DRILL"),     # PCD 孔加工 (复用 DRILL 工序,实际有 PCD 区别,seed 层用同名简化)
            (40, "OP-POLISH"),
            (50, "OP-PLATE"),
            (60, "OP-INSPECT"),
            (70, "OP-GILD"),
            (80, "OP-INSPECT"),
        ]),
    ],
    "SW-DISPLACER": [
        ("PR-DISPLACER", "变位器工艺", [
            (10, "OP-FORGE"),
            (20, "OP-BOLT"),
            (30, "OP-INSPECT"),
        ]),
    ],
    "SW-SPOKE-220": [
        ("PR-SPOKE-220", "钢丝 220mm 工艺", [
            (10, "OP-WIN"),       # 镀前钢丝入库
            (20, "OP-GILD"),
            (30, "OP-INSPECT"),
        ]),
    ],
    "SW-SPOKE-210": [
        ("PR-SPOKE-210", "钢丝 210mm 工艺", [
            (10, "OP-WIN"),
            (20, "OP-GILD"),
            (30, "OP-INSPECT"),
        ]),
    ],
    "SW-NIPPLE": [
        ("PR-NIPPLE", "弹头工艺", [
            (10, "OP-NIP-IN"),
            (20, "OP-GILD"),
            (30, "OP-INSPECT"),
        ]),
    ],
    # 总装工艺(成品 SW-PRODUCT)
    "SW-PRODUCT": [
        ("PR-FINAL-ASSEMBLY", "辐条轮毂总装工艺", [
            (10, "OP-FIX"),         # 4 等份固定
            (20, "OP-CONCEN"),      # 3 个百分表调试同心度 ≤0.8mm
            (30, "OP-ASSEMBLE"),    # 穿钢丝弹头
            (40, "OP-INSPECT"),     # 终检
            (50, "OP-PACK"),        # 包装入库
        ]),
    ],
}


async def seed():
    print("=" * 60)
    print("辐条轮毂数据 Seed 开始")
    print("=" * 60)

    # 1. 初始化 DB
    print("\n[1] 初始化 DB...")
    await init_tortoise_dynamic()

    # 2. 注册物料分组(若有)
    print("\n[2] 注册物料分组...")
    group, _ = await MaterialGroup.get_or_create(
        tenant_id=1,
        code="spoke-wheel",
        defaults={"name": "辐条轮毂组件", "description": "辐条轮毂相关物料"},
    )
    print(f"  ✓ MaterialGroup: {group.code} ({group.name})")

    # 3. 注册物料
    print("\n[3] 注册 7 个物料...")
    material_ids = {}
    for code, name, source_type, unit, spec, group_code in MATERIALS:
        # MES 用 main_code 作为唯一标识(code 字段已废弃)
        m, created = await Material.get_or_create(
            tenant_id=1,
            main_code=code,
            defaults={
                "name": name,
                "source_type": source_type,
                "base_unit": unit,
                "specification": spec,
                "material_group_id": group.id,
                "description": f"辐条轮毂组件 - {name}",
                "is_active": True,
            },
        )
        material_ids[code] = m.id
        print(f"  {'✓ 新建' if created else '· 已存在'} Material {code}: {name} (id={m.id})")

    # 4. 注册工序
    print("\n[4] 注册 14 个工序...")
    op_ids = {}
    for code, name, outsource_default, is_inspection in OPERATIONS:
        op, created = await Operation.get_or_create(
            tenant_id=1,
            code=code,
            defaults={
                "name": name,
                "outsource_default": outsource_default,
                "is_inspection": is_inspection,
                "description": f"工序 - {name}",
                "is_active": True,
            },
        )
        op_ids[code] = op.id
        print(f"  {'✓ 新建' if created else '· 已存在'} Operation {code}: {name}")

    # 5. 注册工艺路线 + 关联物料
    print("\n[5] 注册 7 条工艺路线(含总装)...")
    route_count = 0
    for material_code, route_defs in PART_ROUTES.items():
        material = await Material.get(id=material_ids[material_code])
        for route_code, route_name, steps in route_defs:
            # 构造 operation_sequence JSON (MES 用此存工序顺序)
            operations_seq = []
            for seq, op_code in steps:
                operations_seq.append({
                    "sequence": seq,
                    "operation_id": op_ids[op_code],
                    "operation_code": op_code,
                    "outsource_kind": "planned" if op_code in ("OP-POLISH", "OP-PLATE", "OP-GILD") else "none",
                })
            route, created = await ProcessRoute.get_or_create(
                tenant_id=1,
                code=route_code,
                defaults={
                    "name": route_name,
                    "operation_sequence": operations_seq,
                    "material_id": material.id if material_code != "SW-PRODUCT" else None,
                    "product_id": material.id if material_code == "SW-PRODUCT" else None,
                    "version": "1.0",
                    "is_active": True,
                    "description": f"{material.name} 的工艺路线",
                },
            )
            print(f"  {'✓ 新建' if created else '· 已存在'} ProcessRoute {route_code}: {route_name} (物料 {material_code}, {len(steps)} 工序)")
            route_count += 1

    print(f"\n[6] 共注册 {route_count} 条工艺路线")
    print("\n" + "=" * 60)
    print("✓ Seed 完成")
    print("=" * 60)
    print("\n下一步:")
    print("1. 后端重启后,访问 /api/v1/apps/spoke-wheel/assemblies 测试")
    print("2. 前端访问 /apps/spoke-wheel/assembly-debug 做总装调试")
    print("3. 在 MES 现有 UI(BOM/工艺/工单)查看刚才注册的辐条轮毂数据")


async def main():
    try:
        await seed()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())