"""
QMS 数据模型模块

定义QMS相关的数据模型，用于质量管理。
"""

from apps.kuaiqms.models.inspection_task import InspectionTask
from apps.kuaiqms.models.inspection_record import InspectionRecord
from apps.kuaiqms.models.nonconforming_product import NonconformingProduct
from apps.kuaiqms.models.nonconforming_handling import NonconformingHandling
from apps.kuaiqms.models.quality_traceability import QualityTraceability
from apps.kuaiqms.models.iso_audit import ISOAudit
from apps.kuaiqms.models.capa import CAPA
from apps.kuaiqms.models.continuous_improvement import ContinuousImprovement
from apps.kuaiqms.models.quality_objective import QualityObjective
from apps.kuaiqms.models.quality_indicator import QualityIndicator

__all__ = [
    "InspectionTask",
    "InspectionRecord",
    "NonconformingProduct",
    "NonconformingHandling",
    "QualityTraceability",
    "ISOAudit",
    "CAPA",
    "ContinuousImprovement",
    "QualityObjective",
    "QualityIndicator",
]
