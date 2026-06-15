"""
盘点单库存快照模块

根据仓库账面库存生成盘点明细快照行，复用报表服务的库存加载逻辑。

Author: AI Assistant
Date: 2026-06-15
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import List, Optional

from apps.kuaizhizao.services.report_service import ReportService


@dataclass
class InventorySnapshotLine:
    material_id: int
    material_code: str
    material_name: str
    warehouse_id: int
    batch_no: Optional[str]
    location_code: Optional[str]
    book_quantity: Decimal
    unit_price: Decimal


async def build_inventory_snapshot(
    tenant_id: int,
    warehouse_id: int,
    granularity: str = "batch",
    include_zero_stock: bool = False,
) -> List[InventorySnapshotLine]:
    """
    构建仓库账面库存快照。

    Args:
        tenant_id: 组织ID
        warehouse_id: 仓库ID
        granularity: material（物料汇总）| batch（批次行）
        include_zero_stock: 是否包含零库存行
    """
    report_service = ReportService()
    rows = await report_service._load_inventory_rows(
        tenant_id=tenant_id,
        warehouse_id=warehouse_id,
        include_expired=False,
    )
    if not include_zero_stock:
        rows = [r for r in rows if float(r.get("quantity") or 0) > 0]

    if granularity == "material":
        grouped: dict[int, dict] = {}
        for row in rows:
            material_id = int(row.get("material_id") or 0)
            if not material_id:
                continue
            if material_id not in grouped:
                grouped[material_id] = {
                    "material_id": material_id,
                    "material_code": str(row.get("material_code") or ""),
                    "material_name": str(row.get("material_name") or ""),
                    "quantity": Decimal("0"),
                }
            grouped[material_id]["quantity"] += Decimal(str(row.get("quantity") or 0))
        return [
            InventorySnapshotLine(
                material_id=item["material_id"],
                material_code=item["material_code"],
                material_name=item["material_name"],
                warehouse_id=warehouse_id,
                batch_no=None,
                location_code=None,
                book_quantity=item["quantity"],
                unit_price=Decimal("0"),
            )
            for item in grouped.values()
            if include_zero_stock or item["quantity"] > 0
        ]

    lines: List[InventorySnapshotLine] = []
    for row in rows:
        material_id = int(row.get("material_id") or 0)
        if not material_id:
            continue
        qty = Decimal(str(row.get("quantity") or 0))
        if not include_zero_stock and qty <= 0:
            continue
        lines.append(
            InventorySnapshotLine(
                material_id=material_id,
                material_code=str(row.get("material_code") or ""),
                material_name=str(row.get("material_name") or ""),
                warehouse_id=int(row.get("warehouse_id") or warehouse_id),
                batch_no=row.get("batch_no"),
                location_code=None,
                book_quantity=qty,
                unit_price=Decimal("0"),
            )
        )
    return lines
