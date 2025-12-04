"""
电子记录管理服务模块

提供电子记录的 CRUD 操作和 Inngest 工作流集成功能。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.electronic_record import ElectronicRecord
from core.schemas.electronic_record import (
    ElectronicRecordCreate,
    ElectronicRecordUpdate,
    ElectronicRecordSignRequest,
    ElectronicRecordArchiveRequest,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ElectronicRecordService:
    """
    电子记录管理服务类
    
    提供电子记录的 CRUD 操作和 Inngest 工作流集成功能。
    """
    
    @staticmethod
    async def create_electronic_record(
        tenant_id: int,
        data: ElectronicRecordCreate
    ) -> ElectronicRecord:
        """
        创建电子记录
        
        Args:
            tenant_id: 组织ID
            data: 电子记录创建数据
            
        Returns:
            ElectronicRecord: 创建的电子记录对象
            
        Raises:
            ValidationError: 当记录代码已存在时抛出
        """
        try:
            electronic_record = ElectronicRecord(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await electronic_record.save()
            
            # TODO: 集成 Inngest 工作流注册
            # 如果需要自动启动签名工作流，可以在这里触发
            
            return electronic_record
        except IntegrityError:
            raise ValidationError(f"电子记录代码 {data.code} 已存在")
    
    @staticmethod
    async def get_electronic_record_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> ElectronicRecord:
        """
        根据UUID获取电子记录
        
        Args:
            tenant_id: 组织ID
            uuid: 电子记录UUID
            
        Returns:
            ElectronicRecord: 电子记录对象
            
        Raises:
            NotFoundError: 当电子记录不存在时抛出
        """
        electronic_record = await ElectronicRecord.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not electronic_record:
            raise NotFoundError("电子记录不存在")
        
        return electronic_record
    
    @staticmethod
    async def list_electronic_records(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        status: Optional[str] = None,
        lifecycle_stage: Optional[str] = None
    ) -> List[ElectronicRecord]:
        """
        获取电子记录列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 记录类型筛选
            status: 记录状态筛选
            lifecycle_stage: 生命周期阶段筛选
            
        Returns:
            List[ElectronicRecord]: 电子记录列表
        """
        query = ElectronicRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if status:
            query = query.filter(status=status)
        
        if lifecycle_stage:
            query = query.filter(lifecycle_stage=lifecycle_stage)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_electronic_record(
        tenant_id: int,
        uuid: str,
        data: ElectronicRecordUpdate
    ) -> ElectronicRecord:
        """
        更新电子记录
        
        Args:
            tenant_id: 组织ID
            uuid: 电子记录UUID
            data: 电子记录更新数据
            
        Returns:
            ElectronicRecord: 更新后的电子记录对象
            
        Raises:
            NotFoundError: 当电子记录不存在时抛出
        """
        electronic_record = await ElectronicRecordService.get_electronic_record_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(electronic_record, key, value)
        
        await electronic_record.save()
        return electronic_record
    
    @staticmethod
    async def delete_electronic_record(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除电子记录（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 电子记录UUID
            
        Raises:
            NotFoundError: 当电子记录不存在时抛出
        """
        electronic_record = await ElectronicRecordService.get_electronic_record_by_uuid(tenant_id, uuid)
        electronic_record.deleted_at = datetime.now()
        await electronic_record.save()
    
    @staticmethod
    async def sign_electronic_record(
        tenant_id: int,
        uuid: str,
        user_id: int,
        data: ElectronicRecordSignRequest
    ) -> ElectronicRecord:
        """
        签名电子记录（触发 Inngest 工作流）
        
        Args:
            tenant_id: 组织ID
            uuid: 电子记录UUID
            user_id: 操作人ID
            data: 签名请求数据
            
        Returns:
            ElectronicRecord: 更新后的电子记录对象
            
        Raises:
            NotFoundError: 当电子记录不存在时抛出
            ValidationError: 当记录状态不允许签名时抛出
        """
        electronic_record = await ElectronicRecordService.get_electronic_record_by_uuid(tenant_id, uuid)
        
        if electronic_record.status != "draft":
            raise ValidationError("只有草稿状态的记录才能签名")
        
        # 更新生命周期阶段
        electronic_record.lifecycle_stage = "signing"
        electronic_record.signer_id = data.signer_id
        await electronic_record.save()
        
        # TODO: 集成 Inngest 工作流触发
        # 触发签名工作流事件
        # from core.inngest.client import inngest_client
        # from inngest import Event
        # await inngest_client.send_event(
        #     event=Event(
        #         name="electronic-record/sign",
        #         data={
        #             "tenant_id": tenant_id,
        #             "record_id": str(electronic_record.uuid),
        #             "signer_id": data.signer_id,
        #             "signature_data": data.signature_data
        #         }
        #     )
        # )
        
        return electronic_record
    
    @staticmethod
    async def archive_electronic_record(
        tenant_id: int,
        uuid: str,
        data: ElectronicRecordArchiveRequest
    ) -> ElectronicRecord:
        """
        归档电子记录（触发 Inngest 工作流）
        
        Args:
            tenant_id: 组织ID
            uuid: 电子记录UUID
            data: 归档请求数据
            
        Returns:
            ElectronicRecord: 更新后的电子记录对象
            
        Raises:
            NotFoundError: 当电子记录不存在时抛出
            ValidationError: 当记录状态不允许归档时抛出
        """
        electronic_record = await ElectronicRecordService.get_electronic_record_by_uuid(tenant_id, uuid)
        
        if electronic_record.status != "signed":
            raise ValidationError("只有已签名的记录才能归档")
        
        # 更新生命周期阶段
        electronic_record.lifecycle_stage = "archiving"
        if data.archive_location:
            electronic_record.archive_location = data.archive_location
        await electronic_record.save()
        
        # TODO: 集成 Inngest 工作流触发
        # 触发归档工作流事件
        # from core.inngest.client import inngest_client
        # from inngest import Event
        # await inngest_client.send_event(
        #     event=Event(
        #         name="electronic-record/archive",
        #         data={
        #             "tenant_id": tenant_id,
        #             "record_id": str(electronic_record.uuid),
        #             "archive_location": data.archive_location
        #         }
        #     )
        # )
        
        return electronic_record

