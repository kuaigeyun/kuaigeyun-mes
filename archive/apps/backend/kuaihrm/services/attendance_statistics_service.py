"""
考勤统计服务模块

提供考勤统计的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.attendance import AttendanceStatistics
from apps.kuaihrm.schemas.attendance_statistics_schemas import (
    AttendanceStatisticsCreate, AttendanceStatisticsUpdate, AttendanceStatisticsResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AttendanceStatisticsService:
    """考勤统计服务"""
    
    @staticmethod
    async def create_attendance_statistics(
        tenant_id: int,
        data: AttendanceStatisticsCreate
    ) -> AttendanceStatisticsResponse:
        """创建考勤统计"""
        # 检查同期间是否已有统计
        existing = await AttendanceStatistics.filter(
            tenant_id=tenant_id,
            statistics_period=data.statistics_period,
            employee_id=data.employee_id,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"员工 {data.employee_id} 在期间 {data.statistics_period} 已有统计记录")
        
        statistics = await AttendanceStatistics.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return AttendanceStatisticsResponse.model_validate(statistics)
    
    @staticmethod
    async def get_attendance_statistics_by_uuid(
        tenant_id: int,
        statistics_uuid: str
    ) -> AttendanceStatisticsResponse:
        """根据UUID获取考勤统计"""
        statistics = await AttendanceStatistics.filter(
            tenant_id=tenant_id,
            uuid=statistics_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not statistics:
            raise NotFoundError(f"考勤统计 {statistics_uuid} 不存在")
        
        return AttendanceStatisticsResponse.model_validate(statistics)
    
    @staticmethod
    async def list_attendance_statistics(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        statistics_period: Optional[str] = None
    ) -> List[AttendanceStatisticsResponse]:
        """获取考勤统计列表"""
        query = AttendanceStatistics.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if statistics_period:
            query = query.filter(statistics_period=statistics_period)
        
        statistics_list = await query.offset(skip).limit(limit).all()
        
        return [AttendanceStatisticsResponse.model_validate(s) for s in statistics_list]
    
    @staticmethod
    async def update_attendance_statistics(
        tenant_id: int,
        statistics_uuid: str,
        data: AttendanceStatisticsUpdate
    ) -> AttendanceStatisticsResponse:
        """更新考勤统计"""
        statistics = await AttendanceStatistics.filter(
            tenant_id=tenant_id,
            uuid=statistics_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not statistics:
            raise NotFoundError(f"考勤统计 {statistics_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(statistics, key, value)
        
        await statistics.save()
        
        return AttendanceStatisticsResponse.model_validate(statistics)
    
    @staticmethod
    async def delete_attendance_statistics(
        tenant_id: int,
        statistics_uuid: str
    ) -> None:
        """删除考勤统计（软删除）"""
        statistics = await AttendanceStatistics.filter(
            tenant_id=tenant_id,
            uuid=statistics_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not statistics:
            raise NotFoundError(f"考勤统计 {statistics_uuid} 不存在")
        
        from datetime import datetime
        statistics.deleted_at = datetime.now()
        await statistics.save()

