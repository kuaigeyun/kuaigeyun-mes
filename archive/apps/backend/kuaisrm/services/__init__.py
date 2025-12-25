"""
SRM 服务模块

定义SRM相关的业务逻辑服务。
"""

from apps.kuaisrm.services.purchase_order_service import PurchaseOrderService
from apps.kuaisrm.services.outsourcing_order_service import OutsourcingOrderService
from apps.kuaisrm.services.supplier_evaluation_service import SupplierEvaluationService
from apps.kuaisrm.services.purchase_contract_service import PurchaseContractService

__all__ = [
    "PurchaseOrderService",
    "OutsourcingOrderService",
    "SupplierEvaluationService",
    "PurchaseContractService",
]
