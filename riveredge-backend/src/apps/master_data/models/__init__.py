"""
主数据管理 APP - 模型层

定义工厂数据、物料、客户、供应商、产品的数据模型。
"""

from .factory import Plant, Workshop, ProductionLine, Workstation
from .warehouse import Warehouse, StorageArea, StorageLocation
from .material import MaterialGroup, Material, BOM
from .material_product_process import MaterialProductProcess
from .bom_change import BOMChange
from .material_code_mapping import MaterialCodeMapping
from .material_batch import MaterialBatch
from .material_serial import MaterialSerial
from .unit import MaterialUnit, MaterialUnitConversion
from .process import DefectType, Operation, ProcessRoute, SOP
from .process_route_change import ProcessRouteChange
from .drawing import EngineeringDrawing
from .customer import Customer
from .supplier import Supplier
from .performance import Holiday, Skill
from .shift_scheduling import Shift, ShiftRoster, ShiftAssignment
from .work_calendar import WorkCalendarConfig, OvertimePlan, StationUnavailableWindow
from .employee_performance import (
    EmployeePerformanceConfig,
    PieceRate,
    HourlyRate,
    KPIDefinition,
    EmployeeKPIScore,
    PerformanceSummary,
)
from .product import Product

__all__ = [
    "Plant",
    "Workshop",
    "ProductionLine",
    "Workstation",
    "Warehouse",
    "StorageArea",
    "StorageLocation",
    "MaterialGroup",
    "Material",
    "MaterialProductProcess",
    "BOM",
    "BOMChange",
    "MaterialCodeMapping",
    "MaterialBatch",
    "MaterialSerial",
    "MaterialUnit",
    "MaterialUnitConversion",
    "DefectType",
    "Operation",
    "ProcessRoute",
    "SOP",
    "ProcessRouteChange",
    "EngineeringDrawing",
    "Customer",
    "Supplier",
    "Holiday",
    "Skill",
    "Shift",
    "ShiftRoster",
    "ShiftAssignment",
    "WorkCalendarConfig",
    "OvertimePlan",
    "StationUnavailableWindow",
    "EmployeePerformanceConfig",
    "PieceRate",
    "HourlyRate",
    "KPIDefinition",
    "EmployeeKPIScore",
    "PerformanceSummary",
    "Product",
]
