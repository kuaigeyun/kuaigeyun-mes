"""
快格轻制造 APP - 数据验证模块

统一管理所有数据验证Schema。
"""

# 生产执行模块
from .work_order import *
from .reporting_record import *
from .outsource_order import *

# 仓储管理模块
from .warehouse import *

# 质量管理模块
from .quality import *

# 财务协同模块
from .finance import *

# 采购管理模块
from .purchase import *

# 销售管理模块
from .sales import *

# BOM管理模块
# BOM管理相关schema已移至master_data APP
# 只保留MaterialRequirement和MRPRequirement用于MRP计算
from .bom import MaterialRequirement, MRPRequirement

# 生产计划模块
from .planning import *

__all__ = [
    # 工单相关
    'WorkOrderBase',
    'WorkOrderCreate',
    'WorkOrderUpdate',
    'WorkOrderResponse',
    'WorkOrderListResponse',

    # 报工记录相关
    'ReportingRecordBase',
    'ReportingRecordCreate',
    'ReportingRecordUpdate',
    'ReportingRecordResponse',
    'ReportingRecordListResponse',

    # 委外单相关
    'OutsourceOrderBase',
    'OutsourceOrderCreate',
    'OutsourceOrderUpdate',
    'OutsourceOrderResponse',
    'OutsourceOrderListResponse',

    # 生产领料单相关
    'ProductionPickingBase',
    'ProductionPickingCreate',
    'ProductionPickingUpdate',
    'ProductionPickingResponse',
    'ProductionPickingListResponse',
    'ProductionPickingItemBase',
    'ProductionPickingItemCreate',
    'ProductionPickingItemUpdate',
    'ProductionPickingItemResponse',

    # 成品入库单相关
    'FinishedGoodsReceiptBase',
    'FinishedGoodsReceiptCreate',
    'FinishedGoodsReceiptUpdate',
    'FinishedGoodsReceiptResponse',
    'FinishedGoodsReceiptItemBase',
    'FinishedGoodsReceiptItemCreate',
    'FinishedGoodsReceiptItemUpdate',
    'FinishedGoodsReceiptItemResponse',

    # 销售出库单相关
    'SalesDeliveryBase',
    'SalesDeliveryCreate',
    'SalesDeliveryUpdate',
    'SalesDeliveryResponse',
    'SalesDeliveryItemBase',
    'SalesDeliveryItemCreate',
    'SalesDeliveryItemUpdate',
    'SalesDeliveryItemResponse',

    # 采购入库单相关
    'PurchaseReceiptBase',
    'PurchaseReceiptCreate',
    'PurchaseReceiptUpdate',
    'PurchaseReceiptResponse',
    'PurchaseReceiptItemBase',
    'PurchaseReceiptItemCreate',
    'PurchaseReceiptItemUpdate',
    'PurchaseReceiptItemResponse',

    # 来料检验单相关
    'IncomingInspectionBase',
    'IncomingInspectionCreate',
    'IncomingInspectionUpdate',
    'IncomingInspectionResponse',
    'IncomingInspectionListResponse',

    # 过程检验单相关
    'ProcessInspectionBase',
    'ProcessInspectionCreate',
    'ProcessInspectionUpdate',
    'ProcessInspectionResponse',
    'ProcessInspectionListResponse',

    # 成品检验单相关
    'FinishedGoodsInspectionBase',
    'FinishedGoodsInspectionCreate',
    'FinishedGoodsInspectionUpdate',
    'FinishedGoodsInspectionResponse',
    'FinishedGoodsInspectionListResponse',

    # 应付单相关
    'PayableBase',
    'PayableCreate',
    'PayableUpdate',
    'PayableResponse',
    'PayableListResponse',

    # 采购发票相关
    'PurchaseInvoiceBase',
    'PurchaseInvoiceCreate',
    'PurchaseInvoiceUpdate',
    'PurchaseInvoiceResponse',
    'PurchaseInvoiceListResponse',

    # 应收单相关
    'ReceivableBase',
    'ReceivableCreate',
    'ReceivableUpdate',
    'ReceivableResponse',
    'ReceivableListResponse',

    # 付款记录相关
    'PaymentRecordBase',
    'PaymentRecordCreate',
    'PaymentRecordResponse',

    # 收款记录相关
    'ReceiptRecordBase',
    'ReceiptRecordCreate',
    'ReceiptRecordResponse',

    # 销售预测相关
    'SalesForecastBase',
    'SalesForecastCreate',
    'SalesForecastUpdate',
    'SalesForecastResponse',
    'SalesForecastListResponse',
    'SalesForecastItemBase',
    'SalesForecastItemCreate',
    'SalesForecastItemUpdate',
    'SalesForecastItemResponse',

    # 销售订单相关
    'SalesOrderBase',
    'SalesOrderCreate',
    'SalesOrderUpdate',
    'SalesOrderResponse',
    'SalesOrderListResponse',
    'SalesOrderItemBase',
    'SalesOrderItemCreate',
    'SalesOrderItemUpdate',
    'SalesOrderItemResponse',

    # BOM物料清单相关
    # BOM管理相关schema已移至master_data APP
    # 只保留MaterialRequirement和MRPRequirement用于MRP计算

    # BOM展开和计算相关
    'BOMExpansionItem',
    'BOMExpansionResult',
    'MaterialRequirement',
    'MRPRequirement',

    # 生产计划相关
    'ProductionPlanBase',
    'ProductionPlanCreate',
    'ProductionPlanUpdate',
    'ProductionPlanResponse',
    'ProductionPlanListResponse',
    'ProductionPlanItemBase',
    'ProductionPlanItemCreate',
    'ProductionPlanItemUpdate',
    'ProductionPlanItemResponse',

    # MRP运算相关
    'MRPResultBase',
    'MRPResultCreate',
    'MRPResultResponse',
    'MRPResultListResponse',
    'MRPComputationRequest',
    'MRPComputationResult',

    # LRP运算相关
    'LRPResultBase',
    'LRPResultCreate',
    'LRPResultResponse',
    'LRPResultListResponse',
    'LRPComputationRequest',
    'LRPComputationResult',

    # 采购订单相关
    'PurchaseOrderBase',
    'PurchaseOrderCreate',
    'PurchaseOrderUpdate',
    'PurchaseOrderResponse',
    'PurchaseOrderListResponse',
    'PurchaseOrderItemBase',
    'PurchaseOrderItemCreate',
    'PurchaseOrderItemUpdate',
    'PurchaseOrderItemResponse',
    'PurchaseOrderApprove',
    'PurchaseOrderConfirm',
    'PurchaseOrderListParams',
]
