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
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet
from apps.haoligo.models.mold_return_sheet import HaoligoMoldReturnSheet
from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet
from apps.haoligo.models.mold_trial_dataset_binding import HaoligoMoldTrialDatasetBinding
from apps.haoligo.models.mold_ledger_dataset_binding import HaoligoMoldLedgerDatasetBinding
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
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
    "HaoligoMoldBorrowSheet",
    "HaoligoMoldReturnSheet",
    "HaoligoMoldTrialSheet",
    "HaoligoMoldTrialDatasetBinding",
    "HaoligoMoldLedgerDatasetBinding",
    "HaoligoMoldMaintenanceCompleteSheet",
    "HaoligoMoldMaintenanceSheet",
    "HaoligoMoldOutsourceMaintenanceCompleteSheet",
    "HaoligoMoldOutsourceMaintenanceSheet",
    "HaoligoHazardReport",
]
