"""
WMS 服务模块

定义WMS相关的业务逻辑服务。
"""

from apps.kuaiwms.services.inventory_service import InventoryService
from apps.kuaiwms.services.inbound_order_service import InboundOrderService
from apps.kuaiwms.services.outbound_order_service import OutboundOrderService
from apps.kuaiwms.services.stocktake_service import StocktakeService
from apps.kuaiwms.services.inventory_adjustment_service import InventoryAdjustmentService

__all__ = [
    "InventoryService",
    "InboundOrderService",
    "OutboundOrderService",
    "StocktakeService",
    "InventoryAdjustmentService",
]
