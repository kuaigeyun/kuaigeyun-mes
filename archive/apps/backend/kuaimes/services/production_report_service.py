"""
生产报工服务模块

提供生产报工的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimes.models.production_report import ProductionReport
from apps.kuaimes.schemas.production_report_schemas import (
    ProductionReportCreate, ProductionReportUpdate, ProductionReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProductionReportService:
    """生产报工服务"""
    
    @staticmethod
    async def create_production_report(
        tenant_id: int,
        data: ProductionReportCreate
    ) -> ProductionReportResponse:
        """创建生产报工"""
        existing = await ProductionReport.filter(
            tenant_id=tenant_id,
            report_no=data.report_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"报工单编号 {data.report_no} 已存在")
        
        report = await ProductionReport.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProductionReportResponse.model_validate(report)
    
    @staticmethod
    async def get_production_report_by_uuid(
        tenant_id: int,
        report_uuid: str
    ) -> ProductionReportResponse:
        """根据UUID获取生产报工"""
        report = await ProductionReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"报工单 {report_uuid} 不存在")
        
        return ProductionReportResponse.model_validate(report)
    
    @staticmethod
    async def list_production_reports(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_uuid: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ProductionReportResponse]:
        """获取生产报工列表"""
        query = ProductionReport.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if work_order_uuid:
            query = query.filter(work_order_uuid=work_order_uuid)
        if status:
            query = query.filter(status=status)
        
        reports = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ProductionReportResponse.model_validate(r) for r in reports]
    
    @staticmethod
    async def update_production_report(
        tenant_id: int,
        report_uuid: str,
        data: ProductionReportUpdate
    ) -> ProductionReportResponse:
        """更新生产报工"""
        report = await ProductionReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"报工单 {report_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(report, key, value)
        
        await report.save()
        
        return ProductionReportResponse.model_validate(report)
    
    @staticmethod
    async def delete_production_report(
        tenant_id: int,
        report_uuid: str
    ) -> None:
        """删除生产报工（软删除）"""
        report = await ProductionReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"报工单 {report_uuid} 不存在")
        
        report.deleted_at = datetime.utcnow()
        await report.save()
