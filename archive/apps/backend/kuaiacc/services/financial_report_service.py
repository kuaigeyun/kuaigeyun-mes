"""
财务报表服务模块

提供财务报表的业务逻辑处理，支持多组织隔离。
按照中国企业会计准则：资产负债表、利润表、现金流量表。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiacc.models.financial_report import FinancialReport
from apps.kuaiacc.schemas.financial_report_schemas import (
    FinancialReportCreate, FinancialReportUpdate, FinancialReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class FinancialReportService:
    """财务报表服务"""
    
    @staticmethod
    async def create_financial_report(
        tenant_id: int,
        data: FinancialReportCreate
    ) -> FinancialReportResponse:
        """
        创建财务报表
        
        Args:
            tenant_id: 租户ID
            data: 报表创建数据
            
        Returns:
            FinancialReportResponse: 创建的报表对象
            
        Raises:
            ValidationError: 当报表已存在时抛出
        """
        # 检查报表是否已存在
        existing = await FinancialReport.filter(
            tenant_id=tenant_id,
            report_type=data.report_type,
            report_period=data.report_period,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"期间 {data.report_period} 的{data.report_type}已存在")
        
        # 创建报表
        report = await FinancialReport.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return FinancialReportResponse.model_validate(report)
    
    @staticmethod
    async def get_financial_report_by_uuid(
        tenant_id: int,
        report_uuid: str
    ) -> FinancialReportResponse:
        """
        根据UUID获取财务报表
        
        Args:
            tenant_id: 租户ID
            report_uuid: 报表UUID
            
        Returns:
            FinancialReportResponse: 报表对象
            
        Raises:
            NotFoundError: 当报表不存在时抛出
        """
        report = await FinancialReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"财务报表 {report_uuid} 不存在")
        
        return FinancialReportResponse.model_validate(report)
    
    @staticmethod
    async def list_financial_reports(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        report_type: Optional[str] = None,
        year: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[FinancialReportResponse]:
        """
        获取财务报表列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            report_type: 报表类型（过滤）
            year: 年度（过滤）
            status: 状态（过滤）
            
        Returns:
            List[FinancialReportResponse]: 报表列表
        """
        query = FinancialReport.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if report_type:
            query = query.filter(report_type=report_type)
        if year:
            query = query.filter(year=year)
        if status:
            query = query.filter(status=status)
        
        reports = await query.offset(skip).limit(limit).order_by("-report_date", "-id").all()
        
        return [FinancialReportResponse.model_validate(report) for report in reports]
    
    @staticmethod
    async def update_financial_report(
        tenant_id: int,
        report_uuid: str,
        data: FinancialReportUpdate
    ) -> FinancialReportResponse:
        """
        更新财务报表
        
        Args:
            tenant_id: 租户ID
            report_uuid: 报表UUID
            data: 报表更新数据
            
        Returns:
            FinancialReportResponse: 更新后的报表对象
            
        Raises:
            NotFoundError: 当报表不存在时抛出
        """
        report = await FinancialReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"财务报表 {report_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(report, key, value)
        
        await report.save()
        
        return FinancialReportResponse.model_validate(report)
    
    @staticmethod
    async def delete_financial_report(
        tenant_id: int,
        report_uuid: str
    ) -> None:
        """
        删除财务报表（软删除）
        
        Args:
            tenant_id: 租户ID
            report_uuid: 报表UUID
            
        Raises:
            NotFoundError: 当报表不存在时抛出
        """
        report = await FinancialReport.filter(
            tenant_id=tenant_id,
            uuid=report_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not report:
            raise NotFoundError(f"财务报表 {report_uuid} 不存在")
        
        # 软删除
        report.deleted_at = datetime.now()
        await report.save()
    
    @staticmethod
    async def generate_report(
        tenant_id: int,
        report_type: str,
        report_period: str
    ) -> FinancialReportResponse:
        """
        生成财务报表
        
        Args:
            tenant_id: 租户ID
            report_type: 报表类型
            report_period: 报表期间
            
        Returns:
            FinancialReportResponse: 生成的报表对象
            
        Raises:
            ValidationError: 当报表类型或期间无效时抛出
        """
        # TODO: 实现财务报表生成逻辑
        # 根据报表类型和期间，从总账、明细账等数据生成报表数据
        # 按照中国企业会计准则格式生成
        
        raise NotImplementedError("财务报表生成功能待实现")

