"""
SRM Schema 模块

定义SRM相关的Pydantic Schema，用于数据验证和序列化。
"""

from apps.kuaisrm.schemas.purchase_order_schemas import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse
)
from apps.kuaisrm.schemas.outsourcing_order_schemas import (
    OutsourcingOrderCreate, OutsourcingOrderUpdate, OutsourcingOrderResponse
)
from apps.kuaisrm.schemas.supplier_evaluation_schemas import (
    SupplierEvaluationCreate, SupplierEvaluationUpdate, SupplierEvaluationResponse
)
from apps.kuaisrm.schemas.purchase_contract_schemas import (
    PurchaseContractCreate, PurchaseContractUpdate, PurchaseContractResponse
)

__all__ = [
    "PurchaseOrderCreate", "PurchaseOrderUpdate", "PurchaseOrderResponse",
    "OutsourcingOrderCreate", "OutsourcingOrderUpdate", "OutsourcingOrderResponse",
    "SupplierEvaluationCreate", "SupplierEvaluationUpdate", "SupplierEvaluationResponse",
    "PurchaseContractCreate", "PurchaseContractUpdate", "PurchaseContractResponse",
]
