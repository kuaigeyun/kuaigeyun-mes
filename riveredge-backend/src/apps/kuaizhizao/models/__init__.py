"""
快格轻制造 APP - 数据模型模块

统一管理所有数据模型。
"""

# 生产执行模块
from .work_order import WorkOrder
from .reporting_record import ReportingRecord

# 仓储管理模块
from .production_picking import ProductionPicking
from .production_picking_item import ProductionPickingItem
from .finished_goods_receipt import FinishedGoodsReceipt
from .finished_goods_receipt_item import FinishedGoodsReceiptItem
from .sales_delivery import SalesDelivery
from .sales_delivery_item import SalesDeliveryItem
from .purchase_receipt import PurchaseReceipt
from .purchase_receipt_item import PurchaseReceiptItem

# 采购管理模块
from .purchase_order import PurchaseOrder, PurchaseOrderItem

# 质量管理模块
from .incoming_inspection import IncomingInspection
from .process_inspection import ProcessInspection
from .finished_goods_inspection import FinishedGoodsInspection

# 财务协同模块
from .payable import Payable
from .purchase_invoice import PurchaseInvoice
from .receivable import Receivable

# 销售管理模块
from .sales_forecast import SalesForecast
from .sales_forecast_item import SalesForecastItem
from .sales_order import SalesOrder
from .sales_order_item import SalesOrderItem

# BOM管理模块
from .bill_of_materials import BillOfMaterials
from .bill_of_materials_item import BillOfMaterialsItem

# 生产计划模块
from .production_plan import ProductionPlan
from .production_plan_item import ProductionPlanItem
from .mrp_result import MRPResult
from .lrp_result import LRPResult

__all__ = [
    # 生产执行模块
    'WorkOrder',
    'ReportingRecord',

    # 仓储管理模块
    'ProductionPicking',
    'ProductionPickingItem',
    'FinishedGoodsReceipt',
    'FinishedGoodsReceiptItem',
    'SalesDelivery',
    'SalesDeliveryItem',
    'PurchaseReceipt',
    'PurchaseReceiptItem',

    # 采购管理模块
    'PurchaseOrder',
    'PurchaseOrderItem',

    # 质量管理模块
    'IncomingInspection',
    'ProcessInspection',
    'FinishedGoodsInspection',

    # 财务协同模块
    'Payable',
    'PurchaseInvoice',
    'Receivable',

    # 销售管理模块
    'SalesForecast',
    'SalesForecastItem',
    'SalesOrder',
    'SalesOrderItem',

    # BOM管理模块
    'BillOfMaterials',
    'BillOfMaterialsItem',

    # 生产计划模块
    'ProductionPlan',
    'ProductionPlanItem',
    'MRPResult',
    'LRPResult',
]
