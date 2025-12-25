"""
生产追溯服务模块

提供生产追溯的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaimes.models.traceability import Traceability
from apps.kuaimes.schemas.traceability_schemas import (
    TraceabilityCreate, TraceabilityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class TraceabilityService:
    """生产追溯服务"""
    
    @staticmethod
    async def create_traceability(
        tenant_id: int,
        data: TraceabilityCreate
    ) -> TraceabilityResponse:
        """创建生产追溯"""
        existing = await Traceability.filter(
            tenant_id=tenant_id,
            trace_no=data.trace_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"追溯编号 {data.trace_no} 已存在")
        
        traceability = await Traceability.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return TraceabilityResponse.model_validate(traceability)
    
    @staticmethod
    async def get_traceability_by_uuid(
        tenant_id: int,
        trace_uuid: str
    ) -> TraceabilityResponse:
        """根据UUID获取生产追溯"""
        traceability = await Traceability.filter(
            tenant_id=tenant_id,
            uuid=trace_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not traceability:
            raise NotFoundError(f"追溯记录 {trace_uuid} 不存在")
        
        return TraceabilityResponse.model_validate(traceability)
    
    @staticmethod
    async def list_traceabilities(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        batch_no: Optional[str] = None,
        serial_no: Optional[str] = None
    ) -> List[TraceabilityResponse]:
        """获取生产追溯列表"""
        query = Traceability.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if batch_no:
            query = query.filter(batch_no=batch_no)
        if serial_no:
            query = query.filter(serial_no=serial_no)
        
        traceabilities = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [TraceabilityResponse.model_validate(t) for t in traceabilities]
