"""采购申请选料时分仓在库结存（自购在库，与即时库存汇总口径一致）。"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Dict, List

from apps.kuaizhizao.services.report_service import ReportService

_IN_STOCK_STATUSES = frozenset({"in_stock", "在库"})


def _is_countable_row(row: Dict[str, Any]) -> bool:
    qty = float(row.get("quantity") or 0)
    if qty <= 0:
        return False
    status = str(row.get("status") or "").strip()
    if status and status not in _IN_STOCK_STATUSES:
        return False
    ownership = str(row.get("ownership_type") or "company_owned").strip() or "company_owned"
    if ownership != "company_owned":
        return False
    if int(row.get("customer_id") or 0) != 0:
        return False
    return True


class PurchaseRequisitionStockService:
    @staticmethod
    async def material_on_hand_by_warehouse(
        tenant_id: int,
        material_ids: List[int],
    ) -> Dict[str, Any]:
        mids = sorted({int(m) for m in material_ids if m and int(m) > 0})
        if not mids:
            return {"by_material": {}}

        report = ReportService()
        raw = await report.query_batch_inventory(
            tenant_id=tenant_id,
            material_ids=mids,
            include_expired=False,
            include_zero_stock=False,
            aggregate_by_material=True,
            ownership_type="company_owned",
            customer_id=0,
        )
        rows = raw.get("items") or []

        # material_id -> warehouse_name -> qty
        bucket: Dict[int, Dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
        for row in rows:
            if not _is_countable_row(row):
                continue
            mid = int(row.get("material_id") or 0)
            if mid <= 0:
                continue
            wh_name = str(row.get("warehouse_name") or "").strip() or "—"
            bucket[mid][wh_name] += Decimal(str(row.get("quantity") or 0))

        by_material: Dict[str, List[Dict[str, Any]]] = {}
        for mid in mids:
            wh_map = bucket.get(mid) or {}
            lines = [
                {
                    "warehouse_name": name,
                    "quantity": float(qty),
                }
                for name, qty in wh_map.items()
            ]
            lines.sort(key=lambda x: (-float(x["quantity"]), x["warehouse_name"]))
            by_material[str(mid)] = lines

        return {"by_material": by_material}
