"""
能源报表服务模块

提供能源报表的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiems.models.energy_report import EnergyReport
from apps.kuaiems.schemas.energy_report_schemas import (
    EnergyReportCreate, EnergyReportUpdate, EnergyReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EnergyReportService:
    """能源报表服务"""
    
    @staticmethod
    async def create_energy_report(
        tenant_id: int,
        data: EnergyReportCreate
    ) -> EnergyReportResponse:
        """创建能源报表"""
        existing = await EnergyReport.filter(
            tenant_id=tenant_id,
            report_no=data.report_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"能源报表编号 {data.report_no} 已存在")
        
        report = await EnergyReport.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EnergyReportResponse.model_validate(report)
    
    @staticmethod
    async def get_energy_report_by_uuid(
        tenant_id: int,
        report_uuid: str
    ) -> EnergyReportResponse:
        """根据UUID获取能源报表"""
        report = await EnergyReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"能源报表 {report_uuid} 不存在")
        
        return EnergyReportResponse.model_validate(report)
    
    @staticmethod
    async def list_energy_reports(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        report_type: Optional[str] = None,
        energy_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[EnergyReportResponse]:
        """获取能源报表列表"""
        query = EnergyReport.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if report_type:
            query = query.filter(report_type=report_type)
        if energy_type:
            query = query.filter(energy_type=energy_type)
        if status:
            query = query.filter(status=status)
        
        reports = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [EnergyReportResponse.model_validate(r) for r in reports]
    
    @staticmethod
    async def update_energy_report(
        tenant_id: int,
        report_uuid: str,
        data: EnergyReportUpdate
    ) -> EnergyReportResponse:
        """更新能源报表"""
        report = await EnergyReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"能源报表 {report_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(report, key, value)
        
        await report.save()
        
        return EnergyReportResponse.model_validate(report)
    
    @staticmethod
    async def delete_energy_report(
        tenant_id: int,
        report_uuid: str
    ) -> None:
        """删除能源报表（软删除）"""
        report = await EnergyReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"能源报表 {report_uuid} 不存在")
        
        report.deleted_at = datetime.utcnow()
        await report.save()

