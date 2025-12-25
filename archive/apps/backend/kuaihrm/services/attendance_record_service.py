"""
打卡记录服务模块

提供打卡记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaihrm.models.attendance import AttendanceRecord
from apps.kuaihrm.schemas.attendance_record_schemas import (
    AttendanceRecordCreate, AttendanceRecordUpdate, AttendanceRecordResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AttendanceRecordService:
    """打卡记录服务"""
    
    @staticmethod
    async def create_attendance_record(
        tenant_id: int,
        data: AttendanceRecordCreate
    ) -> AttendanceRecordResponse:
        """创建打卡记录"""
        # 检查同一天是否已有记录
        existing = await AttendanceRecord.filter(
            tenant_id=tenant_id,
            record_date__date=data.record_date.date(),
            employee_id=data.employee_id,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"员工 {data.employee_id} 在 {data.record_date.date()} 已有打卡记录")
        
        record = await AttendanceRecord.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return AttendanceRecordResponse.model_validate(record)
    
    @staticmethod
    async def get_attendance_record_by_uuid(
        tenant_id: int,
        record_uuid: str
    ) -> AttendanceRecordResponse:
        """根据UUID获取打卡记录"""
        record = await AttendanceRecord.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"打卡记录 {record_uuid} 不存在")
        
        return AttendanceRecordResponse.model_validate(record)
    
    @staticmethod
    async def list_attendance_records(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[AttendanceRecordResponse]:
        """获取打卡记录列表"""
        query = AttendanceRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(record_date__gte=start_date)
        if end_date:
            query = query.filter(record_date__lte=end_date)
        
        records = await query.offset(skip).limit(limit).order_by("-record_date").all()
        
        return [AttendanceRecordResponse.model_validate(r) for r in records]
    
    @staticmethod
    async def update_attendance_record(
        tenant_id: int,
        record_uuid: str,
        data: AttendanceRecordUpdate
    ) -> AttendanceRecordResponse:
        """更新打卡记录"""
        record = await AttendanceRecord.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"打卡记录 {record_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(record, key, value)
        
        await record.save()
        
        return AttendanceRecordResponse.model_validate(record)
    
    @staticmethod
    async def delete_attendance_record(
        tenant_id: int,
        record_uuid: str
    ) -> None:
        """删除打卡记录（软删除）"""
        record = await AttendanceRecord.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"打卡记录 {record_uuid} 不存在")
        
        from datetime import datetime
        record.deleted_at = datetime.now()
        await record.save()

