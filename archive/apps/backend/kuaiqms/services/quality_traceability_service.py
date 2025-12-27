"""
质量追溯服务模块

提供质量追溯的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiqms.models.quality_traceability import QualityTraceability
from apps.kuaiqms.schemas.quality_traceability_schemas import (
    QualityTraceabilityCreate, QualityTraceabilityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class QualityTraceabilityService:
    """质量追溯服务"""
    
    @staticmethod
    async def create_quality_traceability(
        tenant_id: int,
        data: QualityTraceabilityCreate
    ) -> QualityTraceabilityResponse:
        """创建质量追溯"""
        existing = await QualityTraceability.filter(
            tenant_id=tenant_id,
            trace_no=data.trace_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"追溯编号 {data.trace_no} 已存在")
        
        traceability = await QualityTraceability.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return QualityTraceabilityResponse.model_validate(traceability)
    
    @staticmethod
    async def get_quality_traceability_by_uuid(
        tenant_id: int,
        trace_uuid: str
    ) -> QualityTraceabilityResponse:
        """根据UUID获取质量追溯"""
        traceability = await QualityTraceability.filter(
            tenant_id=tenant_id,
            uuid=trace_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not traceability:
            raise NotFoundError(f"质量追溯 {trace_uuid} 不存在")
        
        return QualityTraceabilityResponse.model_validate(traceability)
    
    @staticmethod
    async def list_quality_traceabilities(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        trace_type: Optional[str] = None,
        batch_no: Optional[str] = None,
        serial_no: Optional[str] = None
    ) -> List[QualityTraceabilityResponse]:
        """获取质量追溯列表"""
        query = QualityTraceability.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if trace_type:
            query = query.filter(trace_type=trace_type)
        if batch_no:
            query = query.filter(batch_no=batch_no)
        if serial_no:
            query = query.filter(serial_no=serial_no)
        
        traceabilities = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [QualityTraceabilityResponse.model_validate(t) for t in traceabilities]
