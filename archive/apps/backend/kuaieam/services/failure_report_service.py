"""
故障报修服务模块

提供故障报修的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.failure_report import FailureReport
from apps.kuaieam.schemas.failure_report_schemas import (
    FailureReportCreate, FailureReportUpdate, FailureReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class FailureReportService:
    """故障报修服务"""
    
    @staticmethod
    async def create_failure_report(
        tenant_id: int,
        data: FailureReportCreate
    ) -> FailureReportResponse:
        """创建故障报修"""
        existing = await FailureReport.filter(
            tenant_id=tenant_id,
            report_no=data.report_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"故障报修单编号 {data.report_no} 已存在")
        
        report = await FailureReport.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return FailureReportResponse.model_validate(report)
    
    @staticmethod
    async def get_failure_report_by_uuid(
        tenant_id: int,
        report_uuid: str
    ) -> FailureReportResponse:
        """根据UUID获取故障报修"""
        report = await FailureReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"故障报修 {report_uuid} 不存在")
        
        return FailureReportResponse.model_validate(report)
    
    @staticmethod
    async def list_failure_reports(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        failure_type: Optional[str] = None,
        failure_level: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[FailureReportResponse]:
        """获取故障报修列表"""
        query = FailureReport.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if failure_type:
            query = query.filter(failure_type=failure_type)
        if failure_level:
            query = query.filter(failure_level=failure_level)
        if status:
            query = query.filter(status=status)
        
        reports = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [FailureReportResponse.model_validate(r) for r in reports]
    
    @staticmethod
    async def update_failure_report(
        tenant_id: int,
        report_uuid: str,
        data: FailureReportUpdate
    ) -> FailureReportResponse:
        """更新故障报修"""
        report = await FailureReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"故障报修 {report_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(report, key, value)
        
        await report.save()
        
        return FailureReportResponse.model_validate(report)
    
    @staticmethod
    async def delete_failure_report(
        tenant_id: int,
        report_uuid: str
    ) -> None:
        """删除故障报修（软删除）"""
        report = await FailureReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"故障报修 {report_uuid} 不存在")
        
        report.deleted_at = datetime.utcnow()
        await report.save()
