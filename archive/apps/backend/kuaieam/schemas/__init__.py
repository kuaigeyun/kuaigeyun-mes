"""
EAM Schema 模块

导出所有EAM相关的Schema。
"""

from .maintenance_plan_schemas import (
    MaintenancePlanBase,
    MaintenancePlanCreate,
    MaintenancePlanUpdate,
    MaintenancePlanResponse,
)
from .maintenance_workorder_schemas import (
    MaintenanceWorkOrderBase,
    MaintenanceWorkOrderCreate,
    MaintenanceWorkOrderUpdate,
    MaintenanceWorkOrderResponse,
)
from .maintenance_execution_schemas import (
    MaintenanceExecutionBase,
    MaintenanceExecutionCreate,
    MaintenanceExecutionUpdate,
    MaintenanceExecutionResponse,
)
from .failure_report_schemas import (
    FailureReportBase,
    FailureReportCreate,
    FailureReportUpdate,
    FailureReportResponse,
)
from .failure_handling_schemas import (
    FailureHandlingBase,
    FailureHandlingCreate,
    FailureHandlingUpdate,
    FailureHandlingResponse,
)
from .spare_part_demand_schemas import (
    SparePartDemandBase,
    SparePartDemandCreate,
    SparePartDemandUpdate,
    SparePartDemandResponse,
)
from .spare_part_purchase_schemas import (
    SparePartPurchaseBase,
    SparePartPurchaseCreate,
    SparePartPurchaseUpdate,
    SparePartPurchaseResponse,
)
from .tooling_usage_schemas import (
    ToolingUsageBase,
    ToolingUsageCreate,
    ToolingUsageUpdate,
    ToolingUsageResponse,
)
from .mold_usage_schemas import (
    MoldUsageBase,
    MoldUsageCreate,
    MoldUsageUpdate,
    MoldUsageResponse,
)

__all__ = [
    "MaintenancePlanBase",
    "MaintenancePlanCreate",
    "MaintenancePlanUpdate",
    "MaintenancePlanResponse",
    "MaintenanceWorkOrderBase",
    "MaintenanceWorkOrderCreate",
    "MaintenanceWorkOrderUpdate",
    "MaintenanceWorkOrderResponse",
    "MaintenanceExecutionBase",
    "MaintenanceExecutionCreate",
    "MaintenanceExecutionUpdate",
    "MaintenanceExecutionResponse",
    "FailureReportBase",
    "FailureReportCreate",
    "FailureReportUpdate",
    "FailureReportResponse",
    "FailureHandlingBase",
    "FailureHandlingCreate",
    "FailureHandlingUpdate",
    "FailureHandlingResponse",
    "SparePartDemandBase",
    "SparePartDemandCreate",
    "SparePartDemandUpdate",
    "SparePartDemandResponse",
    "SparePartPurchaseBase",
    "SparePartPurchaseCreate",
    "SparePartPurchaseUpdate",
    "SparePartPurchaseResponse",
    "ToolingUsageBase",
    "ToolingUsageCreate",
    "ToolingUsageUpdate",
    "ToolingUsageResponse",
    "MoldUsageBase",
    "MoldUsageCreate",
    "MoldUsageUpdate",
    "MoldUsageResponse",
]
