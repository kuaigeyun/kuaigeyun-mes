"""
主数据管理 APP - 模型层

定义工厂数据、物料、客户、供应商、产品的数据模型。
"""

from .factory import Workshop, ProductionLine, Workstation
from .warehouse import Warehouse, StorageArea, StorageLocation
from .material import MaterialGroup, Material, BOM
from .material_code_mapping import MaterialCodeMapping
from .process import DefectType, Operation, ProcessRoute, SOP
from .customer import Customer
from .supplier import Supplier
from .performance import Holiday, Skill
from .product import Product

__all__ = [
    "Workshop",
    "ProductionLine",
    "Workstation",
    "Warehouse",
    "StorageArea",
    "StorageLocation",
    "MaterialGroup",
    "Material",
    "BOM",
    "MaterialCodeMapping",
    "DefectType",
    "Operation",
    "ProcessRoute",
    "SOP",
    "Customer",
    "Supplier",
    "Holiday",
    "Skill",
    "Product",
]
