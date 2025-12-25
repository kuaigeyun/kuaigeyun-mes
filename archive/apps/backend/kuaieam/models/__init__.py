"""
EAM 数据模型模块

导出所有EAM相关的数据模型。
"""

from .maintenance_plan import MaintenancePlan
from .maintenance_workorder import MaintenanceWorkOrder
from .maintenance_execution import MaintenanceExecution
from .failure_report import FailureReport
from .failure_handling import FailureHandling
from .spare_part_demand import SparePartDemand
from .spare_part_purchase import SparePartPurchase
from .tooling_usage import ToolingUsage
from .mold_usage import MoldUsage

__all__ = [
    "MaintenancePlan",
    "MaintenanceWorkOrder",
    "MaintenanceExecution",
    "FailureReport",
    "FailureHandling",
    "SparePartDemand",
    "SparePartPurchase",
    "ToolingUsage",
    "MoldUsage",
]
