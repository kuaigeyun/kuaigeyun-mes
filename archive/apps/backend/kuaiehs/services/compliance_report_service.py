"""
合规报告服务模块

提供合规报告的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.compliance import ComplianceReport
from apps.kuaiehs.schemas.compliance_report_schemas import (
    ComplianceReportCreate, ComplianceReportUpdate, ComplianceReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ComplianceReportService:
    """合规报告服务"""
    
    @staticmethod
    async def create_compliancereport(
        tenant_id: int,
        data: ComplianceReportCreate
    ) -> ComplianceReportResponse:
        """
        创建合规报告
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ComplianceReportResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ComplianceReport.filter(
            tenant_id=tenant_id,
            report_no=data.report_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"报告编号 {data.report_no} 已存在")
        
        # 创建对象
        obj = await ComplianceReport.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ComplianceReportResponse.model_validate(obj)
    
    @staticmethod
    async def get_compliancereport_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ComplianceReportResponse:
        """
        根据UUID获取合规报告
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ComplianceReportResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ComplianceReport.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"合规报告 {obj_uuid} 不存在")
        
        return ComplianceReportResponse.model_validate(obj)
    
    @staticmethod
    async def list_compliancereports(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ComplianceReportResponse]:
        """
        获取合规报告列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ComplianceReportResponse]: 对象列表
        """
        query = ComplianceReport.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ComplianceReportResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_compliancereport(
        tenant_id: int,
        obj_uuid: str,
        data: ComplianceReportUpdate
    ) -> ComplianceReportResponse:
        """
        更新合规报告
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ComplianceReportResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ComplianceReport.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"合规报告 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ComplianceReportResponse.model_validate(obj)
    
    @staticmethod
    async def delete_compliancereport(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除合规报告（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ComplianceReport.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"合规报告 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
