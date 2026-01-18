"""
快格轻制造 APP - 业务服务模块

统一管理所有业务服务。
"""

# 生产执行模块
from .work_order_service import WorkOrderService
from .reporting_service import ReportingService
from .rework_order_service import ReworkOrderService
from .cost_service import CostRuleService, CostCalculationService
from .outsource_service import OutsourceService

# 仓储管理模块
from .warehouse_service import (
    ProductionPickingService,
    FinishedGoodsReceiptService,
    SalesDeliveryService,
    SalesReturnService,
    PurchaseReceiptService,
    PurchaseReturnService,
)

# 质量管理模块
from .quality_service import (
    IncomingInspectionService,
    ProcessInspectionService,
    FinishedGoodsInspectionService,
)
from .quality_standard_service import QualityStandardService

# 财务协同模块
from .finance_service import (
    PayableService,
    PurchaseInvoiceService,
    ReceivableService,
)

# 采购管理模块
from .purchase_service import PurchaseService

# 销售管理模块
from .sales_service import (
    SalesForecastService,
    SalesOrderService,
)

# 统一需求管理模块（新设计）
from .demand_service import DemandService

# BOM管理已移至master_data APP，不再需要BOMService

# 生产计划模块
from .planning_service import ProductionPlanningService

__all__ = [
    # 生产执行模块
    'WorkOrderService',
    'ReportingService',
    'ReworkOrderService',
    'CostRuleService',
    'CostCalculationService',
    'OutsourceService',

    # 仓储管理模块
    'ProductionPickingService',
    'FinishedGoodsReceiptService',
    'SalesDeliveryService',
    'SalesReturnService',
    'PurchaseReceiptService',
    'PurchaseReturnService',

    # 质量管理模块
    'IncomingInspectionService',
    'ProcessInspectionService',
    'FinishedGoodsInspectionService',
    'QualityStandardService',

    # 财务协同模块
    'PayableService',
    'PurchaseInvoiceService',
    'ReceivableService',

    # 采购管理模块
    'PurchaseService',

    # 销售管理模块
    'SalesForecastService',
    'SalesOrderService',

    # 统一需求管理模块（新设计）
    'DemandService',

    # BOM管理模块
    # BOMService已移除，BOM管理在master_data APP中

    # 生产计划模块
    'ProductionPlanningService',
]
