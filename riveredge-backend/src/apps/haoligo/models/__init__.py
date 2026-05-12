"""好力GO Tortoise 模型包（动态 ORM 加载 `apps.haoligo.models`）。"""

from apps.haoligo.models.equipment import (
    HaoligoEquipment,
    HaoligoEquipmentCategory,
    HaoligoInspectionParam,
    HaoligoInspectionParamSet,
    HaoligoInspectionParamSetItem,
    HaoligoManufacturer,
    HaoligoPatrolRoute,
    HaoligoPatrolRouteStep,
    HaoligoWorkshop,
)
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.patrol import HaoligoHazardReport

__all__ = [
    "HaoligoEquipment",
    "HaoligoEquipmentCategory",
    "HaoligoInspectionParam",
    "HaoligoInspectionParamSet",
    "HaoligoInspectionParamSetItem",
    "HaoligoManufacturer",
    "HaoligoPatrolRoute",
    "HaoligoPatrolRouteStep",
    "HaoligoWorkshop",
    "HaoligoMold",
    "HaoligoHazardReport",
]
