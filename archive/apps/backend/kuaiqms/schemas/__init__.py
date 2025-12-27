"""
QMS Schema 模块

定义QMS相关的 Pydantic Schema，用于数据验证和序列化。
"""

from apps.kuaiqms.schemas.inspection_task_schemas import (
    InspectionTaskCreate, InspectionTaskUpdate, InspectionTaskResponse
)
from apps.kuaiqms.schemas.inspection_record_schemas import (
    InspectionRecordCreate, InspectionRecordUpdate, InspectionRecordResponse
)
from apps.kuaiqms.schemas.nonconforming_product_schemas import (
    NonconformingProductCreate, NonconformingProductUpdate, NonconformingProductResponse
)
from apps.kuaiqms.schemas.nonconforming_handling_schemas import (
    NonconformingHandlingCreate, NonconformingHandlingUpdate, NonconformingHandlingResponse
)
from apps.kuaiqms.schemas.quality_traceability_schemas import (
    QualityTraceabilityCreate, QualityTraceabilityResponse
)
from apps.kuaiqms.schemas.iso_audit_schemas import (
    ISOAuditCreate, ISOAuditUpdate, ISOAuditResponse
)
from apps.kuaiqms.schemas.capa_schemas import (
    CAPACreate, CAPAUpdate, CAPAResponse
)
from apps.kuaiqms.schemas.continuous_improvement_schemas import (
    ContinuousImprovementCreate, ContinuousImprovementUpdate, ContinuousImprovementResponse
)
from apps.kuaiqms.schemas.quality_objective_schemas import (
    QualityObjectiveCreate, QualityObjectiveUpdate, QualityObjectiveResponse
)
from apps.kuaiqms.schemas.quality_indicator_schemas import (
    QualityIndicatorCreate, QualityIndicatorUpdate, QualityIndicatorResponse
)

__all__ = [
    "InspectionTaskCreate",
    "InspectionTaskUpdate",
    "InspectionTaskResponse",
    "InspectionRecordCreate",
    "InspectionRecordUpdate",
    "InspectionRecordResponse",
    "NonconformingProductCreate",
    "NonconformingProductUpdate",
    "NonconformingProductResponse",
    "NonconformingHandlingCreate",
    "NonconformingHandlingUpdate",
    "NonconformingHandlingResponse",
    "QualityTraceabilityCreate",
    "QualityTraceabilityResponse",
    "ISOAuditCreate",
    "ISOAuditUpdate",
    "ISOAuditResponse",
    "CAPACreate",
    "CAPAUpdate",
    "CAPAResponse",
    "ContinuousImprovementCreate",
    "ContinuousImprovementUpdate",
    "ContinuousImprovementResponse",
    "QualityObjectiveCreate",
    "QualityObjectiveUpdate",
    "QualityObjectiveResponse",
    "QualityIndicatorCreate",
    "QualityIndicatorUpdate",
    "QualityIndicatorResponse",
]
