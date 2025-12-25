"""
QMS 服务模块

提供QMS相关的业务逻辑处理，支持多组织隔离。
"""

from apps.kuaiqms.services.inspection_task_service import InspectionTaskService
from apps.kuaiqms.services.inspection_record_service import InspectionRecordService
from apps.kuaiqms.services.nonconforming_product_service import NonconformingProductService
from apps.kuaiqms.services.nonconforming_handling_service import NonconformingHandlingService
from apps.kuaiqms.services.quality_traceability_service import QualityTraceabilityService
from apps.kuaiqms.services.iso_audit_service import ISOAuditService
from apps.kuaiqms.services.capa_service import CAPAService
from apps.kuaiqms.services.continuous_improvement_service import ContinuousImprovementService
from apps.kuaiqms.services.quality_objective_service import QualityObjectiveService
from apps.kuaiqms.services.quality_indicator_service import QualityIndicatorService

__all__ = [
    "InspectionTaskService",
    "InspectionRecordService",
    "NonconformingProductService",
    "NonconformingHandlingService",
    "QualityTraceabilityService",
    "ISOAuditService",
    "CAPAService",
    "ContinuousImprovementService",
    "QualityObjectiveService",
    "QualityIndicatorService",
]
