"""
质量目标服务模块

提供质量目标的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.quality_objective import QualityObjective
from apps.kuaiqms.schemas.quality_objective_schemas import (
    QualityObjectiveCreate, QualityObjectiveUpdate, QualityObjectiveResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class QualityObjectiveService:
    """质量目标服务"""
    
    @staticmethod
    async def create_quality_objective(
        tenant_id: int,
        data: QualityObjectiveCreate
    ) -> QualityObjectiveResponse:
        """创建质量目标"""
        existing = await QualityObjective.filter(
            tenant_id=tenant_id,
            objective_no=data.objective_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"目标编号 {data.objective_no} 已存在")
        
        objective = await QualityObjective.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return QualityObjectiveResponse.model_validate(objective)
    
    @staticmethod
    async def get_quality_objective_by_uuid(
        tenant_id: int,
        objective_uuid: str
    ) -> QualityObjectiveResponse:
        """根据UUID获取质量目标"""
        objective = await QualityObjective.filter(
            tenant_id=tenant_id,
            uuid=objective_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not objective:
            raise NotFoundError(f"质量目标 {objective_uuid} 不存在")
        
        return QualityObjectiveResponse.model_validate(objective)
    
    @staticmethod
    async def list_quality_objectives(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        period: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[QualityObjectiveResponse]:
        """获取质量目标列表"""
        query = QualityObjective.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if period:
            query = query.filter(period=period)
        if status:
            query = query.filter(status=status)
        
        objectives = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [QualityObjectiveResponse.model_validate(o) for o in objectives]
    
    @staticmethod
    async def update_quality_objective(
        tenant_id: int,
        objective_uuid: str,
        data: QualityObjectiveUpdate
    ) -> QualityObjectiveResponse:
        """更新质量目标"""
        objective = await QualityObjective.filter(
            tenant_id=tenant_id,
            uuid=objective_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not objective:
            raise NotFoundError(f"质量目标 {objective_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(objective, key, value)
        
        await objective.save()
        
        return QualityObjectiveResponse.model_validate(objective)
    
    @staticmethod
    async def delete_quality_objective(
        tenant_id: int,
        objective_uuid: str
    ) -> None:
        """删除质量目标（软删除）"""
        objective = await QualityObjective.filter(
            tenant_id=tenant_id,
            uuid=objective_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not objective:
            raise NotFoundError(f"质量目标 {objective_uuid} 不存在")
        
        objective.deleted_at = datetime.utcnow()
        await objective.save()
