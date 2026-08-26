"""
快格轻制造 APP - 数据模型模块

统一管理所有数据模型。
"""

# 生产执行模块
from .work_order import WorkOrder
from .work_order_group import WorkOrderGroup
from .reporting_record import ReportingRecord
from .rework_order import ReworkOrder
from .rework_order_operation import ReworkOrderOperation
# CostRule, CostCalculation 已迁移至 kuaicaiwu
from .outsource_order import OutsourceOrder
from .outsource_work_order import (
    OutsourceWorkOrder,
    OutsourceMaterialIssue,
    OutsourceMaterialReceipt,
    OutsourceMaterialReturn,
    OutsourceProductReturn,
)
from .work_order_operation import WorkOrderOperation
from .scrap_record import ScrapRecord
from .defect_record import DefectRecord
from .material_binding import MaterialBinding
from .stocktaking import Stocktaking, StocktakingItem
from .inventory_transfer import InventoryTransfer, InventoryTransferItem
from .assembly_order import AssemblyOrder, AssemblyOrderItem
from .assembly_template import AssemblyTemplate, AssemblyTemplateItem
from .assembly_material_binding import AssemblyMaterialBinding
from .batching_order import BatchingOrder, BatchingOrderItem
from .disassembly_order import DisassemblyOrder, DisassemblyOrderItem
from .inventory_alert import InventoryAlertRule, InventoryAlert
from .packing_binding import PackingBinding
from .customer_material_registration import (
    CustomerMaterialRegistration,
    CustomerMaterialRegistrationItem,
    BarcodeMappingRule,
)
from .document_node_timing import DocumentNodeTiming
from .material_shortage_exception import MaterialShortageException
from .delivery_delay_exception import DeliveryDelayException
from .quality_exception import QualityException
from .exception_process_record import ExceptionProcessRecord, ExceptionProcessHistory
from .quality_8d_report import Quality8DReport
from .oqc_inspection import OQCInspection
from .fai_characteristic import FaiCharacteristic
from .fai_order import FaiOrder
from .qms_internal_audit import QmsInternalAudit
from .qms_management_review import QmsManagementReview
from .qms_iso_clause import QmsIsoClause
from .qms_system_document import QmsSystemDocument
from .spc_sample import SPCSample

# 仓储管理模块
from .production_picking import ProductionPicking
from .production_picking_item import ProductionPickingItem
from .production_return import ProductionReturn
from .production_return_item import ProductionReturnItem
from .finished_goods_receipt import FinishedGoodsReceipt
from .finished_goods_receipt_item import FinishedGoodsReceiptItem
from .semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from .semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem
from .sales_delivery import SalesDelivery
from .sales_delivery_item import SalesDeliveryItem
from .sales_return import SalesReturn
from .sales_return_item import SalesReturnItem
from .purchase_receipt import PurchaseReceipt
from .purchase_receipt_item import PurchaseReceiptItem
from .purchase_return import PurchaseReturn
from .purchase_return_item import PurchaseReturnItem
from .other_inbound import OtherInbound
from .other_inbound_item import OtherInboundItem
from .other_outbound import OtherOutbound
from .other_outbound_item import OtherOutboundItem
from .material_borrow import MaterialBorrow
from .material_borrow_item import MaterialBorrowItem
from .material_return import MaterialReturn
from .material_return_item import MaterialReturnItem
from .replenishment_suggestion import ReplenishmentSuggestion
from .line_side_inventory import LineSideInventory
from .material_stock_movement import MaterialStockMovement
from .backflush_record import BackflushRecord
from .material_call_request import MaterialCallRequest
from .material_call_request_item import MaterialCallRequestItem
from .station_andon_call import StationAndonCall
from .station_sop_acknowledgment import StationSopAcknowledgment
from .station_operation_downtime import StationOperationDowntime
from .operator_skill import OperatorSkillQualification
from .station_shift_handover import StationShiftHandover

# 采购管理模块
from .purchase_order import PurchaseOrder, PurchaseOrderItem
from .purchase_arrival_delay_report import PurchaseArrivalDelayReport
from .purchase_order_change_order import PurchaseOrderChangeOrder, PurchaseOrderChangeItem
from .purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
from .purchase_inquiry import (
    PurchaseInquiry,
    PurchaseInquiryItem,
    PurchaseInquiryVendor,
    PurchaseSupplierQuote,
    PurchaseSupplierQuoteItem,
)

# 质量管理模块
from .incoming_inspection import IncomingInspection
from .process_inspection import ProcessInspection
from .finished_goods_inspection import FinishedGoodsInspection
from .quality_standard import QualityStandard
from .inspection_plan import InspectionPlan, InspectionPlanStep

# 财务协同模块（Payable, PurchaseInvoice, Receivable, Invoice 已迁移至 kuaicaiwu）

# 销售管理模块
from .sales_forecast import SalesForecast
from .sales_forecast_item import SalesForecastItem
from .sales_order import SalesOrder
from .sales_order_item import SalesOrderItem
from .sales_order_change_order import SalesOrderChangeOrder, SalesOrderChangeItem
from .sales_contract import SalesContract
from .sales_contract_item import SalesContractItem
from .sales_contract_milestone import SalesContractMilestone
from .sales_contract_change import SalesContractChange
from .sales_contract_term_item import SalesContractTermItem
from .sales_contract_term_group import SalesContractTermGroup
from .sales_contract_term_group_item import SalesContractTermGroupItem
from .quotation import Quotation
from .quotation_item import QuotationItem
from .sales_review import SalesReview
from .sales_review_item import SalesReviewItem
from .sales_review_dept_opinion import SalesReviewDeptOpinion
from .delivery_notice import DeliveryNotice
from .delivery_notice_item import DeliveryNoticeItem
from .logistics import (
    Driver,
    FreightBill,
    FreightBillItem,
    FreightOrder,
    FreightOrderReceipt,
    FreightOrderSource,
    FreightTrackingEvent,
    LogisticsCarrier,
    Vehicle,
)
from .shipment_notice import ShipmentNotice
from .shipment_notice_item import ShipmentNoticeItem
from .receipt_notice import ReceiptNotice
from .receipt_notice_item import ReceiptNoticeItem
from .customer_follow_up import CustomerFollowUp
from .after_sales_ticket import AfterSalesTicket
from .after_sales_ticket_item import AfterSalesTicketItem
from .install_execution_job import InstallExecutionJob
from .install_execution_stage import InstallExecutionStage
from .install_execution_cost import InstallExecutionCost
from .install_execution_task import InstallExecutionTask
from .after_sales_service import (
    ServiceAsset,
    RepairOrder,
    RepairOrderItem,
    ServiceDispatchOrder,
    AfterSalesSparePartRequisition,
    AfterSalesSparePartRequisitionItem,
    ServiceSettlement,
    ServiceSettlementItem,
    CustomerReturnVisit,
)
from .sales_opportunity import SalesOpportunity
from .customer_pool_log import CustomerPoolLog
from .customer_pool_rule import CustomerPoolRule
from .customer_collaborator import CustomerCollaborator
# 统一需求模型（新设计）
from .demand import Demand
from .demand_item import DemandItem
from .demand_snapshot import DemandSnapshot
from .demand_recalc_history import DemandRecalcHistory
from .demand_computation import DemandComputation
from .demand_computation_item import DemandComputationItem
from .demand_computation_snapshot import DemandComputationSnapshot
from .demand_computation_recalc_history import DemandComputationRecalcHistory
from .demand_change_event import DemandChangeEvent
from .demand_impact_record import DemandImpactRecord
from .demand_replan_task import DemandReplanTask

# BOM管理模块
# BOM管理已移至master_data APP，不再需要BillOfMaterials模型

# 生产计划模块
from .production_plan import ProductionPlan
from .production_plan_item import ProductionPlanItem
# 已废弃：MRPResult和LRPResult已合并为统一的需求计算模型
# from .mrp_result import MRPResult
# from .lrp_result import LRPResult

# 设备模具管理模块
from .equipment import Equipment, EquipmentCalibration
from .maintenance_plan import MaintenancePlan, MaintenanceExecution
from .equipment_fault import EquipmentFault, EquipmentRepair
from .mold import Mold, MoldUsage, MoldCalibration
from .mold_ops import (
    MoldMaintenanceItem,
    MoldMaintenanceScheme,
    MoldMaintenanceSchemeLine,
    MoldRepairItem,
    MoldRepairScheme,
    MoldRepairSchemeLine,
    MoldSchemeBinding,
    MoldTrial,
    MoldBorrow,
    MoldReturn,
    MoldMaintenance,
    MoldMaintenanceLine,
    MoldRepair,
    MoldRepairLine,
    MoldScrapApplication,
)
from .equipment_status_monitor import EquipmentStatusMonitor, EquipmentStatusHistory
from .maintenance_reminder import MaintenanceReminder
from .spare_part import SparePart, SparePartInventory, SparePartStockRecord, SparePartRequisition, SparePartRequisitionLine
from .equipment_ops import (
    EquipmentInspectionItem,
    EquipmentInspectionScheme,
    EquipmentInspectionSchemeLine,
    EquipmentSchemeBinding,
    EquipmentPatrolRoute,
    EquipmentPatrolRouteStep,
    EquipmentMaintenanceItem,
    EquipmentMaintenanceScheme,
    EquipmentMaintenanceSchemeLine,
    EquipmentSpotCheck,
    EquipmentSpotCheckLine,
    EquipmentRoutePatrol,
    EquipmentRoutePatrolLine,
    EquipmentScrapApplication,
    EquipmentTransferApplication,
)
from .tool import Tool, ToolUsage, ToolMaintenance, ToolCalibration
from .tool_ops import (
    ToolMaintenanceItem,
    ToolMaintenanceScheme,
    ToolMaintenanceSchemeLine,
    ToolRepairItem,
    ToolRepairScheme,
    ToolRepairSchemeLine,
    ToolSchemeBinding,
    ToolBorrow,
    ToolReturn,
    ToolOpsCalibration,
    ToolMaintenance as ToolOpsMaintenance,
    ToolMaintenanceLine as ToolOpsMaintenanceLine,
    ToolRepair as ToolOpsRepair,
    ToolRepairLine as ToolOpsRepairLine,
    ToolScrapApplication,
)

# 状态流转模块（审核流程已统一至 core ApprovalInstance）
from .state_transition import StateTransitionRule, StateTransitionLog

# 单据关联逻辑
from .document_relation import DocumentRelation
from .scheduling_config import SchedulingConfig
from .work_order_score import WorkOrderScore
from .rolling_schedule_plan import RollingSchedulePlan, RollingSchedulePlanLine

__all__ = [
    # 生产执行模块
    'WorkOrder',
    'WorkOrderGroup',
    'ReportingRecord',
    'ReworkOrder',
    'ReworkOrderOperation',
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
    'Quality8DReport',
    'OQCInspection',
    'FaiOrder',
    'FaiCharacteristic',
    'QmsSystemDocument',
    'QmsInternalAudit',
    'QmsManagementReview',
    'SPCSample',

    # 仓储管理模块
    'ProductionPicking',
    'ProductionPickingItem',
    'ProductionReturn',
    'ProductionReturnItem',
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
    'OtherInbound',
    'OtherInboundItem',
    'OtherOutbound',
    'OtherOutboundItem',
    'MaterialBorrow',
    'MaterialBorrowItem',
    'MaterialReturn',
    'MaterialReturnItem',
    'ReplenishmentSuggestion',
    'LineSideInventory',
    'MaterialStockMovement',
    'BackflushRecord',
    'BatchingOrder',
    'BatchingOrderItem',
    'MaterialCallRequest',
    'MaterialCallRequestItem',

    # 采购管理模块
    'PurchaseOrder',
    'PurchaseOrderItem',
    'PurchaseOrderChangeOrder',
    'PurchaseOrderChangeItem',
    'PurchaseRequisition',
    'PurchaseRequisitionItem',
    'PurchaseInquiry',
    'PurchaseInquiryItem',
    'PurchaseInquiryVendor',
    'PurchaseSupplierQuote',
    'PurchaseSupplierQuoteItem',

    # 质量管理模块
    'IncomingInspection',
    'ProcessInspection',
    'FinishedGoodsInspection',
    'QualityStandard',
    'InspectionPlan',
    'InspectionPlanStep',

    # 销售管理模块
    'SalesForecast',
    'SalesForecastItem',
    'SalesOrder',
    'SalesOrderItem',
    'SalesOrderChangeOrder',
    'SalesOrderChangeItem',
    'SalesContract',
    'SalesContractItem',
    'SalesContractMilestone',
    'SalesContractChange',
    'SalesContractTermItem',
    'SalesContractTermGroup',
    'SalesContractTermGroupItem',
    'Quotation',
    'QuotationItem',
    'SalesReview',
    'SalesReviewItem',
    'SalesReviewDeptOpinion',
    'DeliveryNotice',
    'DeliveryNoticeItem',
    'LogisticsCarrier',
    'Vehicle',
    'Driver',
    'FreightOrder',
    'FreightOrderSource',
    'FreightTrackingEvent',
    'FreightOrderReceipt',
    'FreightBill',
    'FreightBillItem',
    'ShipmentNotice',
    'ShipmentNoticeItem',
    'ReceiptNotice',
    'ReceiptNoticeItem',
    'CustomerFollowUp',
    'AfterSalesTicket',
    'AfterSalesTicketItem',
    'ServiceAsset',
    'RepairOrder',
    'RepairOrderItem',
    'ServiceDispatchOrder',
    'AfterSalesSparePartRequisition',
    'AfterSalesSparePartRequisitionItem',
    'ServiceSettlement',
    'ServiceSettlementItem',
    'CustomerReturnVisit',
    'SalesOpportunity',
    'CustomerPoolLog',
    'CustomerPoolRule',

    # 统一需求管理模块（新设计）
    'Demand',
    'DemandItem',
    'DemandSnapshot',
    'DemandRecalcHistory',
    'DemandComputation',
    'DemandComputationItem',
    'DemandComputationSnapshot',
    'DemandComputationRecalcHistory',
    'DemandChangeEvent',
    'DemandImpactRecord',
    'DemandReplanTask',

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
    'EquipmentInspectionItem',
    'EquipmentInspectionScheme',
    'EquipmentInspectionSchemeLine',
    'EquipmentSchemeBinding',
    'EquipmentPatrolRoute',
    'EquipmentPatrolRouteStep',
    'EquipmentMaintenanceItem',
    'EquipmentMaintenanceScheme',
    'EquipmentMaintenanceSchemeLine',
    'EquipmentSpotCheck',
    'EquipmentSpotCheckLine',
    'EquipmentRoutePatrol',
    'EquipmentRoutePatrolLine',
    'EquipmentScrapApplication',
    'EquipmentTransferApplication',
    'Mold',
    'MoldUsage',
    'EquipmentStatusMonitor',
    'EquipmentStatusHistory',
    'MaintenanceReminder',
    'SparePart',
    'SparePartInventory',
    'SparePartStockRecord',
    'SparePartRequisition',
    'SparePartRequisitionLine',
    'Tool',
    'ToolUsage',
    'ToolMaintenance',
    'ToolCalibration',
    'ToolMaintenanceItem',
    'ToolMaintenanceScheme',
    'ToolMaintenanceSchemeLine',
    'ToolRepairItem',
    'ToolRepairScheme',
    'ToolRepairSchemeLine',
    'ToolSchemeBinding',
    'ToolBorrow',
    'ToolReturn',
    'ToolOpsCalibration',
    'ToolOpsMaintenance',
    'ToolOpsMaintenanceLine',
    'ToolOpsRepair',
    'ToolOpsRepairLine',
    'ToolScrapApplication',
    'MoldCalibration',
    'MoldMaintenanceItem',
    'MoldMaintenanceScheme',
    'MoldMaintenanceSchemeLine',
    'MoldRepairItem',
    'MoldRepairScheme',
    'MoldRepairSchemeLine',
    'MoldSchemeBinding',
    'MoldTrial',
    'MoldBorrow',
    'MoldReturn',
    'MoldMaintenance',
    'MoldMaintenanceLine',
    'MoldRepair',
    'MoldRepairLine',
    'MoldScrapApplication',
    'EquipmentCalibration',

    # 状态流转
    'StateTransitionRule',
    'StateTransitionLog',
    
    # 单据关联
    'DocumentRelation',
    'SchedulingConfig',
    'WorkOrderScore',
    'RollingSchedulePlan',
    'RollingSchedulePlanLine',
]
