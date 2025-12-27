"""
评估报告服务模块

提供评估报告的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.assessment_report import AssessmentReport
from apps.kuaicert.schemas.assessment_report_schemas import (
    AssessmentReportCreate, AssessmentReportUpdate, AssessmentReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AssessmentReportService:
    """评估报告服务"""
    
    @staticmethod
    async def create_assessmentreport(
        tenant_id: int,
        data: AssessmentReportCreate
    ) -> AssessmentReportResponse:
        """
        创建评估报告
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            AssessmentReportResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await AssessmentReport.filter(
            tenant_id=tenant_id,
            report_no=data.report_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"报告编号 {data.report_no} 已存在")
        
        # 创建对象
        obj = await AssessmentReport.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return AssessmentReportResponse.model_validate(obj)
    
    @staticmethod
    async def get_assessmentreport_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> AssessmentReportResponse:
        """
        根据UUID获取评估报告
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            AssessmentReportResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await AssessmentReport.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"评估报告 {obj_uuid} 不存在")
        
        return AssessmentReportResponse.model_validate(obj)
    
    @staticmethod
    async def list_assessmentreports(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[AssessmentReportResponse]:
        """
        获取评估报告列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[AssessmentReportResponse]: 对象列表
        """
        query = AssessmentReport.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [AssessmentReportResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_assessmentreport(
        tenant_id: int,
        obj_uuid: str,
        data: AssessmentReportUpdate
    ) -> AssessmentReportResponse:
        """
        更新评估报告
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            AssessmentReportResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await AssessmentReport.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"评估报告 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return AssessmentReportResponse.model_validate(obj)
    
    @staticmethod
    async def delete_assessmentreport(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除评估报告（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await AssessmentReport.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"评估报告 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
