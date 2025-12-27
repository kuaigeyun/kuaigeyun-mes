"""
质量检验记录服务模块

提供质量检验记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.inspection_record import InspectionRecord
from apps.kuaiqms.schemas.inspection_record_schemas import (
    InspectionRecordCreate, InspectionRecordUpdate, InspectionRecordResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InspectionRecordService:
    """质量检验记录服务"""
    
    @staticmethod
    async def create_inspection_record(
        tenant_id: int,
        data: InspectionRecordCreate
    ) -> InspectionRecordResponse:
        """创建质量检验记录"""
        existing = await InspectionRecord.filter(
            tenant_id=tenant_id,
            record_no=data.record_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"检验记录编号 {data.record_no} 已存在")
        
        record = await InspectionRecord.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return InspectionRecordResponse.model_validate(record)
    
    @staticmethod
    async def get_inspection_record_by_uuid(
        tenant_id: int,
        record_uuid: str
    ) -> InspectionRecordResponse:
        """根据UUID获取质量检验记录"""
        record = await InspectionRecord.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"检验记录 {record_uuid} 不存在")
        
        return InspectionRecordResponse.model_validate(record)
    
    @staticmethod
    async def list_inspection_records(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        inspection_type: Optional[str] = None,
        inspection_result: Optional[str] = None,
        task_uuid: Optional[str] = None
    ) -> List[InspectionRecordResponse]:
        """获取质量检验记录列表"""
        query = InspectionRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if inspection_type:
            query = query.filter(inspection_type=inspection_type)
        if inspection_result:
            query = query.filter(inspection_result=inspection_result)
        if task_uuid:
            query = query.filter(task_uuid=task_uuid)
        
        records = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [InspectionRecordResponse.model_validate(r) for r in records]
    
    @staticmethod
    async def update_inspection_record(
        tenant_id: int,
        record_uuid: str,
        data: InspectionRecordUpdate
    ) -> InspectionRecordResponse:
        """更新质量检验记录"""
        record = await InspectionRecord.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"检验记录 {record_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(record, key, value)
        
        await record.save()
        
        return InspectionRecordResponse.model_validate(record)
    
    @staticmethod
    async def delete_inspection_record(
        tenant_id: int,
        record_uuid: str
    ) -> None:
        """删除质量检验记录（软删除）"""
        record = await InspectionRecord.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"检验记录 {record_uuid} 不存在")
        
        record.deleted_at = datetime.utcnow()
        await record.save()
