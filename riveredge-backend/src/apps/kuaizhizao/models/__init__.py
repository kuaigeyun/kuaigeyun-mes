"""
快格轻制造 APP - 数据模型模块

统一管理所有数据模型。
"""

# 生产执行模块
from .work_order import WorkOrder
from .reporting_record import ReportingRecord
from .rework_order import ReworkOrder
from .cost_rule import CostRule
from .cost_calculation import CostCalculation
from .outsource_order import OutsourceOrder
from .outsource_work_order import OutsourceWorkOrder, OutsourceMaterialIssue, OutsourceMaterialReceipt
from .work_order_operation import WorkOrderOperation
from .scrap_record import ScrapRecord
from .defect_record import DefectRecord
from .material_binding import MaterialBinding
from .stocktaking import Stocktaking, StocktakingItem
from .inventory_transfer import InventoryTransfer, InventoryTransferItem
from .inventory_alert import InventoryAlertRule, InventoryAlert
from .packing_binding import PackingBinding
from .customer_material_registration import CustomerMaterialRegistration, BarcodeMappingRule
from .document_node_timing import DocumentNodeTiming
from .material_shortage_exception import MaterialShortageException
from .delivery_delay_exception import DeliveryDelayException
from .quality_exception import QualityException
from .exception_process_record import ExceptionProcessRecord, ExceptionProcessHistory

# 仓储管理模块
from .production_picking import ProductionPicking
from .production_picking_item import ProductionPickingItem
from .finished_goods_receipt import FinishedGoodsReceipt
from .finished_goods_receipt_item import FinishedGoodsReceiptItem
from .sales_delivery import SalesDelivery
from .sales_delivery_item import SalesDeliveryItem
from .sales_return import SalesReturn
from .sales_return_item import SalesReturnItem
from .purchase_receipt import PurchaseReceipt
from .purchase_receipt_item import PurchaseReceiptItem
from .purchase_return import PurchaseReturn
from .purchase_return_item import PurchaseReturnItem
from .replenishment_suggestion import ReplenishmentSuggestion

# 采购管理模块
from .purchase_order import PurchaseOrder, PurchaseOrderItem

# 质量管理模块
from .incoming_inspection import IncomingInspection
from .process_inspection import ProcessInspection
from .finished_goods_inspection import FinishedGoodsInspection
from .quality_standard import QualityStandard

# 财务协同模块
from .payable import Payable
from .purchase_invoice import PurchaseInvoice
from .receivable import Receivable

# 销售管理模块
from .sales_forecast import SalesForecast
from .sales_forecast_item import SalesForecastItem
from .sales_order import SalesOrder
from .sales_order_item import SalesOrderItem
# 统一需求模型（新设计）
from .demand import Demand
from .demand_item import DemandItem

# BOM管理模块
# BOM管理已移至master_data APP，不再需要BillOfMaterials模型

# 生产计划模块
from .production_plan import ProductionPlan
from .production_plan_item import ProductionPlanItem
# 已废弃：MRPResult和LRPResult已合并为统一的需求计算模型
# from .mrp_result import MRPResult
# from .lrp_result import LRPResult

# 设备模具管理模块
from .equipment import Equipment
from .maintenance_plan import MaintenancePlan, MaintenanceExecution
from .equipment_fault import EquipmentFault, EquipmentRepair
from .mold import Mold, MoldUsage
from .equipment_status_monitor import EquipmentStatusMonitor, EquipmentStatusHistory
from .maintenance_reminder import MaintenanceReminder

__all__ = [
    # 生产执行模块
    'WorkOrder',
    'ReportingRecord',
    'ReworkOrder',
    'CostRule',
    'CostCalculation',
    'OutsourceOrder',
    'OutsourceWorkOrder',
    'OutsourceMaterialIssue',
    'OutsourceMaterialReceipt',
    'WorkOrderOperation',
    'ScrapRecord',
    'DefectRecord',
    'MaterialBinding',
    'Stocktaking',
    'StocktakingItem',
    'InventoryTransfer',
    'InventoryTransferItem',
    'InventoryAlertRule',
    'InventoryAlert',
    'PackingBinding',
    'BarcodeMappingRule',
    'CustomerMaterialRegistration',
    'DocumentNodeTiming',
    'MaterialShortageException',
    'DeliveryDelayException',
    'QualityException',
    'ExceptionProcessRecord',
    'ExceptionProcessHistory',

    # 仓储管理模块
    'ProductionPicking',
    'ProductionPickingItem',
    'FinishedGoodsReceipt',
    'FinishedGoodsReceiptItem',
    'SalesDelivery',
    'SalesDeliveryItem',
    'SalesReturn',
    'SalesReturnItem',
    'PurchaseReceipt',
    'PurchaseReceiptItem',
    'PurchaseReturn',
    'PurchaseReturnItem',
    'ReplenishmentSuggestion',

    # 采购管理模块
    'PurchaseOrder',
    'PurchaseOrderItem',

    # 质量管理模块
    'IncomingInspection',
    'ProcessInspection',
    'FinishedGoodsInspection',
    'QualityStandard',

    # 财务协同模块
    'Payable',
    'PurchaseInvoice',
    'Receivable',

    # 销售管理模块
    'SalesForecast',
    'SalesForecastItem',
    'SalesOrder',
    'SalesOrderItem',
    
    # 统一需求管理模块（新设计）
    'Demand',
    'DemandItem',

    # BOM管理模块
    # BillOfMaterials和BillOfMaterialsItem已移除，BOM管理在master_data APP中

    # 生产计划模块
    'ProductionPlan',
    'ProductionPlanItem',
    # 已废弃：MRPResult和LRPResult已合并为统一的需求计算模型
    # 'MRPResult',
    # 'LRPResult',

    # 设备模具管理模块
    'Equipment',
    'MaintenancePlan',
    'MaintenanceExecution',
    'EquipmentFault',
    'EquipmentRepair',
    'Mold',
    'MoldUsage',
    'EquipmentStatusMonitor',
    'EquipmentStatusHistory',
    'MaintenanceReminder',
]
