"""
WMS Schema 模块

定义WMS相关的Pydantic Schema，用于数据验证和序列化。
"""

from apps.kuaiwms.schemas.inventory_schemas import (
    InventoryResponse
)
from apps.kuaiwms.schemas.inbound_order_schemas import (
    InboundOrderCreate, InboundOrderUpdate, InboundOrderResponse
)
from apps.kuaiwms.schemas.outbound_order_schemas import (
    OutboundOrderCreate, OutboundOrderUpdate, OutboundOrderResponse
)
from apps.kuaiwms.schemas.stocktake_schemas import (
    StocktakeCreate, StocktakeUpdate, StocktakeResponse
)
from apps.kuaiwms.schemas.inventory_adjustment_schemas import (
    InventoryAdjustmentCreate, InventoryAdjustmentUpdate, InventoryAdjustmentResponse
)

__all__ = [
    "InventoryResponse",
    "InboundOrderCreate", "InboundOrderUpdate", "InboundOrderResponse",
    "OutboundOrderCreate", "OutboundOrderUpdate", "OutboundOrderResponse",
    "StocktakeCreate", "StocktakeUpdate", "StocktakeResponse",
    "InventoryAdjustmentCreate", "InventoryAdjustmentUpdate", "InventoryAdjustmentResponse",
]
