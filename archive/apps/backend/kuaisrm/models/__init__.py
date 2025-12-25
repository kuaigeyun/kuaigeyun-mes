"""
SRM 数据模型模块

定义SRM相关的数据模型，用于采购管理。
"""

from apps.kuaisrm.models.purchase_order import PurchaseOrder
from apps.kuaisrm.models.outsourcing_order import OutsourcingOrder
from apps.kuaisrm.models.supplier_evaluation import SupplierEvaluation
from apps.kuaisrm.models.purchase_contract import PurchaseContract

__all__ = [
    "PurchaseOrder",
    "OutsourcingOrder",
    "SupplierEvaluation",
    "PurchaseContract",
]
