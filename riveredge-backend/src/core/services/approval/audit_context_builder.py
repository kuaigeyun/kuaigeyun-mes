"""提交审批时构建 instance.data 业务快照（供条件分支评估）。"""

from __future__ import annotations

from typing import Any, Dict

from loguru import logger


async def build_audit_context(tenant_id: int, entity_type: str, entity_id: int) -> Dict[str, Any]:
    """按 entity_type 拉取条件评估所需字段；缺失字段不造默认值。"""
    et = (entity_type or "").strip()
    try:
        if et == "sales_order":
            from apps.kuaizhizao.models.sales_order import SalesOrder

            order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True)
            if not order:
                return {}
            return {
                "total_amount": float(order.total_amount or 0),
                "department_id": getattr(order, "department_id", None),
                "customer_level": getattr(order, "customer_level", None) or "",
            }
        if et == "purchase_order":
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder

            po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True)
            if not po:
                return {}
            return {
                "total_amount": float(po.total_amount or 0),
                "supplier_id": getattr(po, "supplier_id", None),
            }
        if et == "quotation":
            from apps.kuaizhizao.models.quotation import Quotation

            q = await Quotation.get_or_none(tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True)
            if not q:
                return {}
            total = getattr(q, "total_amount", None)
            return {"total_amount": float(total or 0)}
    except Exception as e:
        logger.warning("构建审核上下文失败 entity_type={} entity_id={}: {}", et, entity_id, e)
    return {}
