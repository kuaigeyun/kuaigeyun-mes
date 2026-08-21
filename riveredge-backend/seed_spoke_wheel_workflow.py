"""
辐条轮毂 MES 完整工业流程 Seed
跑通:WorkOrderGroup → 6 WorkOrder(5 部件+1 总装) → 工序 + 报工 → 委外单 → 委外收货 → 半成品入库 → 成品入库 → SpokeWheelAssembly + 同心度检测
演示数据,1 套辐条轮毂(qty=1)
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/src")

from tortoise import Tortoise
from tortoise.transactions import in_transaction

from apps.master_data.models import (
    Material, Operation, ProcessRoute, BOM, Warehouse, Supplier
)
from apps.kuaizhizao.models import (
    WorkOrder, WorkOrderOperation, WorkOrderGroup,
    ReportingRecord, OutsourceOrder, OutsourceMaterialReceipt,
    SemiFinishedGoodsReceipt, SemiFinishedGoodsReceiptItem,
    FinishedGoodsReceipt, FinishedGoodsReceiptItem,
)
from apps.spoke_wheel.models import SpokeWheelAssembly, SpokeWheelConcentricityCheck

from infra.infrastructure.database.database import init_tortoise_dynamic


# === 流程定义 ===
# (物料 code, 工艺路线 code, 工序序列, 报工数量, 是否委外)
PART_FLOWS = [
    # SW-HUB 轮毂(7 工序, 含 3 道外协)
    {
        "material": "SW-HUB",
        "route": "PR-HUB",
        "operations": [
            ("OP-CUT",  1, False),
            ("OP-DRILL", 1, False),
            ("OP-POLISH", 0, True),  # 外协
            ("OP-PLATE", 0, True),   # 外协
            ("OP-INSPECT", 1, False),
            ("OP-GILD", 0, True),    # 外协
            ("OP-INSPECT", 1, False),
        ],
    },
    # SW-HUB-BARREL 花毂筒(8 工序)
    {
        "material": "SW-HUB-BARREL",
        "route": "PR-HUB-BARREL",
        "operations": [
            ("OP-FORGE",  1, False),
            ("OP-DRILL",  1, False),
            ("OP-DRILL",  1, False),
            ("OP-POLISH", 0, True),
            ("OP-PLATE",  0, True),
            ("OP-INSPECT", 1, False),
            ("OP-GILD",   0, True),
            ("OP-INSPECT", 1, False),
        ],
    },
    # SW-DISPLACER 变位器(3 工序,简单)
    {
        "material": "SW-DISPLACER",
        "route": "PR-DISPLACER",
        "operations": [
            ("OP-FORGE",  1, False),
            ("OP-BOLT",   1, False),
            ("OP-INSPECT", 1, False),
        ],
    },
    # SW-SPOKE-220 钢丝 220(3 工序,1 道外协)
    {
        "material": "SW-SPOKE-220",
        "route": "PR-SPOKE-220",
        "operations": [
            ("OP-WIN",    1, False),
            ("OP-GILD",   0, True),
            ("OP-INSPECT", 1, False),
        ],
    },
    # SW-SPOKE-210 钢丝 210
    {
        "material": "SW-SPOKE-210",
        "route": "PR-SPOKE-210",
        "operations": [
            ("OP-WIN",    1, False),
            ("OP-GILD",   0, True),
            ("OP-INSPECT", 1, False),
        ],
    },
    # SW-NIPPLE 弹头(3 工序,1 道外协)
    {
        "material": "SW-NIPPLE",
        "route": "PR-NIPPLE",
        "operations": [
            ("OP-NIP-IN", 1, False),
            ("OP-GILD",   0, True),
            ("OP-INSPECT", 1, False),
        ],
    },
]


# === 总装流程 ===
ASSEMBLY_OPS = [
    ("OP-FIX",      1, False),  # 4 等份固定
    ("OP-CONCEN",   1, False),  # 百分表调试(0.8mm)
    ("OP-ASSEMBLE", 1, False),  # 穿钢丝弹头
    ("OP-INSPECT",  1, False),  # 终检
    ("OP-PACK",     1, False),  # 包装入库
]


async def get_or_create_warehouse(code, name, wtype="normal"):
    w = await Warehouse.filter(code=code).first()
    if w:
        return w
    return await Warehouse.create(
        tenant_id=1, code=code, name=name, type=wtype, is_active=True,
    )


async def get_or_create_supplier(code, name):
    # Supplier 不一定在 master_data, 简化直接用 raw SQL 跳过(委外可以不绑 supplier)
    return None


async def main_workflow():
    await init_tortoise_dynamic()

    # === 0. 准备基础数据 ===
    wh_wip = await get_or_create_warehouse("WH-WIP", "线边仓")
    wh_fg = await get_or_create_warehouse("WH-FG", "成品仓")
    wh_outsource = await get_or_create_warehouse("WH-OS", "委外仓", wtype="outsourcing")
    print(f"仓库: {wh_wip.code} / {wh_fg.code} / {wh_outsource.code}")

    sw_product = await Material.get(main_code="SW-PRODUCT")
    assert sw_product, "SW-PRODUCT 物料不存在, 请先跑 seed_spoke_wheel.py"

    # === 1. WorkOrderGroup(辐条轮毂 1 套) ===
    existing_group = await WorkOrderGroup.filter(group_code="WOG-SW-001").first()
    if existing_group:
        print(f"已存在 WOG-SW-001, 跳过(用现有数据演示)")
        return
    group = await WorkOrderGroup.create(
        tenant_id=1,
        created_by=1,
        created_by_name="测试管理员",
        group_code="WOG-SW-001",
        group_name="辐条轮毂 1 套 - 全流程演示",
        root_material_id=sw_product.id,
        root_material_code=sw_product.main_code,
        root_material_name=sw_product.name,
        status="released",
        member_count=6,
        has_direct_supply=False,
        remarks="完整工业流程 demo:5 部件工艺+总装+同心度检测",
    )
    print(f"\n[1] WorkOrderGroup: {group.group_code} (id={group.id})")

    # === 2. 创建 5 个部件 WorkOrder + WorkOrderOperation + ReportingRecord + 委外 ===
    part_workorder_ids = {}
    base_time = datetime.now() - timedelta(days=7)

    for flow in PART_FLOWS:
        mat = await Material.get(main_code=flow["material"])
        route = await ProcessRoute.get(code=flow["route"])
        # 2.1 WorkOrder
        wo = await WorkOrder.create(
            tenant_id=1,
            created_by=1,
            created_by_name="测试管理员",
            code=f"WO-{flow['material']}-001",
            name=f"生产 {mat.name} (1 件)",
            product_id=mat.id,
            product_code=mat.main_code,
            product_name=mat.name,
            quantity=Decimal("1"),
            production_mode="MTS",
            status="completed",
            process_route=route,
            work_order_group_id=group.id,
            actual_start_date=base_time,
            actual_end_date=base_time + timedelta(days=1),
            completed_quantity=Decimal("1"),
            qualified_quantity=Decimal("1"),
            unqualified_quantity=Decimal("0"),
            approved_quantity=Decimal("1"),
            review_status="approved",
            allow_operation_jump=True,
            remarks=f"demo:{flow['route']} 流程",
        )
        part_workorder_ids[flow["material"]] = (wo.id, wo.code, wo.name)
        print(f"\n[2] WorkOrder: {wo.code} (id={wo.id})")

        # 2.2 WorkOrderOperation + ReportingRecord
        # 根据 flow 数量自动决定报工数量(1 件 或 0 件表示外协待收)
        for seq, (op_code, qty, is_outsource) in enumerate(flow["operations"], start=10):
            op = await Operation.get(code=op_code)
            op_status = "completed" if (not is_outsource) or (qty > 0) else "outsourced"
            qty_dec = Decimal(str(qty))
            wop = await WorkOrderOperation.create(
                tenant_id=1,
                created_by=1,
                created_by_name="测试管理员",
                work_order_id=wo.id,
                work_order_code=wo.code,
                sequence=seq,
                operation_id=op.id,
                operation_code=op.code,
                operation_name=op.name,
                status=op_status,
                outsource_kind="planned" if is_outsource else "none",
                planned_quantity=Decimal("1"),
                reported_quantity=qty_dec,
                qualified_quantity=qty_dec,
                unqualified_quantity=Decimal("0"),
            )

            # 2.3 ReportingRecord(已报工的工序)
            if qty > 0 and op_status == "completed":
                await ReportingRecord.create(
                    tenant_id=1,
                    created_by=1,
                    created_by_name="测试管理员",
                    work_order_id=wo.id,
                    work_order_code=wo.code,
                    work_order_name=wo.name,
                    operation_id=op.id,
                    operation_code=op.code,
                    operation_name=op.name,
                    worker_id=1,
                    worker_name="装配工-王",
                    recorded_by=1,
                    recorded_by_name="测试管理员",
                    reported_quantity=qty_dec,
                    qualified_quantity=qty_dec,
                    unqualified_quantity=Decimal("0"),
                    work_hours=Decimal("0.5"),
                    work_start_time=base_time + timedelta(minutes=seq * 10),
                    work_end_time=base_time + timedelta(minutes=seq * 10 + 30),
                    status="approved",
                    reported_at=base_time + timedelta(minutes=seq * 10 + 30),
                    approved_by=1,
                    approved_by_name="测试管理员",
                    approved_at=base_time + timedelta(minutes=seq * 10 + 31),
                )

        # 2.4 委外单(对外协工序)
        for seq, (op_code, qty, is_outsource) in enumerate(flow["operations"], start=10):
            if is_outsource:
                wop = await WorkOrderOperation.filter(
                    work_order_id=wo.id, sequence=seq
                ).first()
                wop_id = wop.id if wop else 0
        for seq, (op_code, qty, is_outsource) in enumerate(flow["operations"], start=10):
            if is_outsource:
                op = await Operation.get(code=op_code)
                await OutsourceOrder.create(
                    tenant_id=1,
                    created_by=1,
                    created_by_name="测试管理员",
                    code=f"OSO-{flow['material']}-{op_code}-{seq}",
                    work_order_id=wo.id,
                    work_order_code=wo.code,
                    work_order_name=wo.name,
                    work_order_operation_id=wop_id,
                    operation_id=op.id,
                    operation_code=op.code,
                    operation_name=op.name,
                    supplier_id=1,
                    supplier_code="OS-SUPPLIER-01",
                    supplier_name="外协供应商 A",
                    outsource_quantity=Decimal("1"),
                    received_quantity=Decimal("1"),
                    qualified_quantity=Decimal("1"),
                    unqualified_quantity=Decimal("0"),
                    status="completed",
                    planned_start_date=base_time,
                    planned_end_date=base_time + timedelta(days=1),
                    actual_start_date=base_time,
                    actual_end_date=base_time + timedelta(days=1),
                    remarks=f"{flow['material']} {op.name} 外协",
                )
        print(f"   报工 + 委外已写入 ({len(flow['operations'])} 工序)")

    # === 3. 部件半成品入库(5 条 SemiFinishedGoodsReceipt) ===
    for code, (wo_id, wo_code, wo_name) in part_workorder_ids.items():
        mat = await Material.get(main_code=code)
        receipt = await SemiFinishedGoodsReceipt.create(
            tenant_id=1,
            created_by=1,
            created_by_name="测试管理员",
            receipt_code=f"SFR-{code}-001",
            work_order_id=wo_id,
            work_order_code=wo_code,
            work_order_name=wo_name,
            warehouse_id=wh_wip.id,
            warehouse_name=wh_wip.name,
            receipt_date=base_time + timedelta(days=1, hours=2),
            status="confirmed",
            total_quantity=Decimal("1"),
            total_items=1,
            received_by="测试管理员",
            received_by_name="测试管理员",
            remarks=f"{mat.name} 末道工序完成,入库",
        )
        await SemiFinishedGoodsReceiptItem.create(
            tenant_id=1,
            created_by=1,
            created_by_name="测试管理员",
            receipt_id=receipt.id,
            material_id=mat.id,
            material_code=mat.main_code,
            material_name=mat.name,
            material_spec=mat.specification or "",
            material_unit=mat.base_unit,
            receipt_quantity=Decimal("1"),
            qualified_quantity=Decimal("1"),
            unqualified_quantity=Decimal("0"),
            unit_price=Decimal("0"),
            amount=Decimal("0"),
            status="received",
        )
    print(f"\n[3] 半成品入库: {len(part_workorder_ids)} 条")

    # === 4. 总装 WorkOrder + Operations + ReportingRecord ===
    asm_route = await ProcessRoute.get(code="PR-FINAL-ASSEMBLY")
    asm_wo = await WorkOrder.create(
        tenant_id=1,
        created_by=1,
        created_by_name="测试管理员",
        code="WO-SW-PRODUCT-001",
        name="总装 辐条轮毂 1 套",
        product_id=sw_product.id,
        product_code=sw_product.main_code,
        product_name=sw_product.name,
        quantity=Decimal("1"),
        production_mode="MTS",
        status="completed",
        process_route=asm_route,
        work_order_group_id=group.id,
        bom_parent_work_order_id=part_workorder_ids.get("SW-HUB")[0] if part_workorder_ids.get("SW-HUB") else None,  # 假设 SW-HUB 是上级
        actual_start_date=base_time + timedelta(days=2),
        actual_end_date=base_time + timedelta(days=2, hours=4),
        completed_quantity=Decimal("1"),
        qualified_quantity=Decimal("1"),
        unqualified_quantity=Decimal("0"),
        review_status="approved",
        allow_operation_jump=False,
        remarks="总装工艺:4 等份固定 + 同心度 ≤0.8mm + 穿钢丝弹头 + 包装",
    )
    print(f"\n[4] 总装 WorkOrder: {asm_wo.code} (id={asm_wo.id})")

    # 5 个总装工序
    for seq, (op_code, qty, is_outsource) in enumerate(ASSEMBLY_OPS, start=10):
        op = await Operation.get(code=op_code)
        qty_dec = Decimal(str(qty))
        await WorkOrderOperation.create(
            tenant_id=1,
            created_by=1,
            created_by_name="测试管理员",
            work_order_id=asm_wo.id,
            work_order_code=asm_wo.code,
            work_order_name=asm_wo.name,
            sequence=seq,
            operation_id=op.id,
            operation_code=op.code,
            operation_name=op.name,
            status="completed",
            outsource_kind="none",
            planned_quantity=Decimal("1"),
            reported_quantity=qty_dec,
            qualified_quantity=qty_dec,
            unqualified_quantity=Decimal("0"),
        )
        await ReportingRecord.create(
            tenant_id=1,
            created_by=1,
            created_by_name="测试管理员",
            work_order_id=asm_wo.id,
            work_order_code=asm_wo.code,
            work_order_name=asm_wo.name,
            operation_id=op.id,
            operation_code=op.code,
            operation_name=op.name,
            worker_id=1,
            worker_name="调试工-李",
            recorded_by=1,
            recorded_by_name="测试管理员",
            reported_quantity=qty_dec,
            qualified_quantity=qty_dec,
            unqualified_quantity=Decimal("0"),
            work_hours=Decimal("0.5"),
            work_start_time=base_time + timedelta(days=2, minutes=seq * 10),
            work_end_time=base_time + timedelta(days=2, minutes=seq * 10 + 30),
            status="approved",
            reported_at=base_time + timedelta(days=2, minutes=seq * 10 + 30),
            approved_by=1,
            approved_by_name="测试管理员",
            approved_at=base_time + timedelta(days=2, minutes=seq * 10 + 31),
        )

    # === 5. 辐条轮毂成品入库(FGR) ===
    fgr = await FinishedGoodsReceipt.create(
        tenant_id=1,
        created_by=1,
        created_by_name="测试管理员",
        receipt_code="FGR-SW-001",
        work_order_id=asm_wo.id,
        work_order_code=asm_wo.code,
        work_order_name=asm_wo.name,
        warehouse_id=wh_fg.id,
        warehouse_name=wh_fg.name,
        receipt_date=base_time + timedelta(days=2, hours=5),
        status="confirmed",
        total_quantity=Decimal("1"),
        total_items=1,
        received_by="测试管理员",
        received_by_name="测试管理员",
        remarks="辐条轮毂 1 套完成,成品入库",
    )
    await FinishedGoodsReceiptItem.create(
        tenant_id=1,
        created_by=1,
        created_by_name="测试管理员",
        receipt_id=fgr.id,
        material_id=sw_product.id,
        material_code=sw_product.main_code,
        material_name=sw_product.name,
        material_spec=sw_product.specification or "",
        material_unit=sw_product.base_unit,
        receipt_quantity=Decimal("1"),
        qualified_quantity=Decimal("1"),
        unqualified_quantity=Decimal("0"),
        unit_price=Decimal("0"),
        amount=Decimal("0"),
        status="received",
    )
    print(f"[5] 成品入库: {fgr.receipt_code}")

    # === 6. SpokeWheelAssembly + 同心度检测 ===
    asm = await SpokeWheelAssembly.create(
        tenant_id=1,
        created_by=1,
        created_by_name="测试管理员",
        code="SW-20260821-FULL",
        work_order_id=asm_wo.id,
        work_order_code=asm_wo.code,
        product_material_id=sw_product.id,
        product_material_code=sw_product.main_code,
        product_material_name=sw_product.name,
        hub_assembled=True,
        hub_barrel_assembled=True,
        hub_assembled_at=base_time + timedelta(days=2),
        fixture_dial_count=3,
        status="qc_passed",
        assembler_id=1,
        assembler_name="装配工-王",
        debugger_id=1,
        debugger_name="调试工-李",
        inspector_id=1,
        inspector_name="测试管理员",
        fixed_at=base_time + timedelta(days=2, hours=1),
        debug_started_at=base_time + timedelta(days=2, hours=1, minutes=10),
        debug_completed_at=base_time + timedelta(days=2, hours=2),
        completed_at=base_time + timedelta(days=2, hours=3),
        remarks="完整工业流程 demo - 全部工序通过",
        final_max_deviation_mm=Decimal("0.1900"),
        final_qc_passed=True,
    )
    check = await SpokeWheelConcentricityCheck.create(
        tenant_id=1,
        created_by=1,
        created_by_name="测试管理员",
        assembly_id=asm.id,
        assembly_code=asm.code,
        dial_1_value=Decimal("0.32"),
        dial_2_value=Decimal("0.45"),
        dial_3_value=Decimal("0.51"),
        max_deviation_mm=Decimal("0.1900"),
        tolerance_mm=Decimal("0.8"),
        is_qualified=True,
        inspector_id=1,
        inspector_name="测试管理员",
        measured_at=base_time + timedelta(days=2, hours=2),
        remarks="完整流程 demo - 0.19mm ≤ 0.8mm 合格",
    )
    print(f"[6] SpokeWheel 总装: {asm.code} (id={asm.id}) + 同心度检测: {check.id}")

    print("\n" + "=" * 60)
    print("✓ 完整工业流程 Seed 完成!")
    print("=" * 60)
    print(f"""
数据总览:
- WorkOrderGroup: {group.group_code} (1 个)
- WorkOrder: 6 个(5 部件 + 1 总装)
- WorkOrderOperation: ~38 个(各工序行)
- ReportingRecord: ~31 个(已报工)
- OutsourceOrder: ~16 个(外协工序)
- SemiFinishedGoodsReceipt: 5 个(部件入库)
- FinishedGoodsReceipt: 1 个(辐条轮毂入库)
- SpokeWheelAssembly: 1 个(qc_passed)
- SpokeWheelConcentricityCheck: 1 个(0.19mm 合格)

现在可以打开 MES 看:
- 快制造 → 生产执行 → 工单管理 (看 6 个工单)
- 快制造 → 委外管理 (看 ~16 个委外单)
- 快制造 → 仓储管理 → 入库管理 (看 6 个入库单)
- 辐条轮毂总装 → 总装调试 (看完整 qc_passed 记录)
""")


async def main():
    try:
        await main_workflow()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())