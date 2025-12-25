"""
持续改进服务模块

提供持续改进的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.continuous_improvement import ContinuousImprovement
from apps.kuaiqms.schemas.continuous_improvement_schemas import (
    ContinuousImprovementCreate, ContinuousImprovementUpdate, ContinuousImprovementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ContinuousImprovementService:
    """持续改进服务"""
    
    @staticmethod
    async def create_continuous_improvement(
        tenant_id: int,
        data: ContinuousImprovementCreate
    ) -> ContinuousImprovementResponse:
        """创建持续改进"""
        existing = await ContinuousImprovement.filter(
            tenant_id=tenant_id,
            improvement_no=data.improvement_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"改进编号 {data.improvement_no} 已存在")
        
        improvement = await ContinuousImprovement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ContinuousImprovementResponse.model_validate(improvement)
    
    @staticmethod
    async def get_continuous_improvement_by_uuid(
        tenant_id: int,
        improvement_uuid: str
    ) -> ContinuousImprovementResponse:
        """根据UUID获取持续改进"""
        improvement = await ContinuousImprovement.filter(
            tenant_id=tenant_id,
            uuid=improvement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not improvement:
            raise NotFoundError(f"持续改进 {improvement_uuid} 不存在")
        
        return ContinuousImprovementResponse.model_validate(improvement)
    
    @staticmethod
    async def list_continuous_improvements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        improvement_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ContinuousImprovementResponse]:
        """获取持续改进列表"""
        query = ContinuousImprovement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if improvement_type:
            query = query.filter(improvement_type=improvement_type)
        if status:
            query = query.filter(status=status)
        
        improvements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ContinuousImprovementResponse.model_validate(i) for i in improvements]
    
    @staticmethod
    async def update_continuous_improvement(
        tenant_id: int,
        improvement_uuid: str,
        data: ContinuousImprovementUpdate
    ) -> ContinuousImprovementResponse:
        """更新持续改进"""
        improvement = await ContinuousImprovement.filter(
            tenant_id=tenant_id,
            uuid=improvement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not improvement:
            raise NotFoundError(f"持续改进 {improvement_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(improvement, key, value)
        
        await improvement.save()
        
        return ContinuousImprovementResponse.model_validate(improvement)
    
    @staticmethod
    async def delete_continuous_improvement(
        tenant_id: int,
        improvement_uuid: str
    ) -> None:
        """删除持续改进（软删除）"""
        improvement = await ContinuousImprovement.filter(
            tenant_id=tenant_id,
            uuid=improvement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not improvement:
            raise NotFoundError(f"持续改进 {improvement_uuid} 不存在")
        
        improvement.deleted_at = datetime.utcnow()
        await improvement.save()
