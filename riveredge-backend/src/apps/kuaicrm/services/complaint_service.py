"""
投诉服务模块

提供投诉的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.complaint import Complaint
from apps.kuaicrm.schemas.complaint_schemas import (
    ComplaintCreate, ComplaintUpdate, ComplaintResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ComplaintService:
    """投诉服务"""
    
    @staticmethod
    async def create_complaint(
        tenant_id: int,
        data: ComplaintCreate
    ) -> ComplaintResponse:
        """
        创建投诉
        
        Args:
            tenant_id: 租户ID
            data: 投诉创建数据
            
        Returns:
            ComplaintResponse: 创建的投诉对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Complaint.filter(
            tenant_id=tenant_id,
            complaint_no=data.complaint_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"投诉编号 {data.complaint_no} 已存在")
        
        # 创建投诉
        complaint = await Complaint.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ComplaintResponse.model_validate(complaint)
    
    @staticmethod
    async def get_complaint_by_uuid(
        tenant_id: int,
        complaint_uuid: str
    ) -> ComplaintResponse:
        """
        根据UUID获取投诉
        
        Args:
            tenant_id: 租户ID
            complaint_uuid: 投诉UUID
            
        Returns:
            ComplaintResponse: 投诉对象
            
        Raises:
            NotFoundError: 当投诉不存在时抛出
        """
        complaint = await Complaint.filter(
            tenant_id=tenant_id,
            uuid=complaint_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not complaint:
            raise NotFoundError(f"投诉 {complaint_uuid} 不存在")
        
        return ComplaintResponse.model_validate(complaint)
    
    @staticmethod
    async def list_complaints(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        handle_status: Optional[str] = None,
        complaint_type: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> List[ComplaintResponse]:
        """
        获取投诉列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            handle_status: 处理状态（过滤）
            complaint_type: 投诉类型（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            List[ComplaintResponse]: 投诉列表
        """
        query = Complaint.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if handle_status:
            query = query.filter(handle_status=handle_status)
        if complaint_type:
            query = query.filter(complaint_type=complaint_type)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        complaints = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ComplaintResponse.model_validate(c) for c in complaints]
    
    @staticmethod
    async def process_complaint(
        tenant_id: int,
        complaint_uuid: str,
        handle_result: str
    ) -> ComplaintResponse:
        """
        处理投诉
        
        Args:
            tenant_id: 租户ID
            complaint_uuid: 投诉UUID
            handle_result: 处理结果
            
        Returns:
            ComplaintResponse: 更新后的投诉对象
            
        Raises:
            NotFoundError: 当投诉不存在时抛出
        """
        complaint = await Complaint.filter(
            tenant_id=tenant_id,
            uuid=complaint_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not complaint:
            raise NotFoundError(f"投诉 {complaint_uuid} 不存在")
        
        from datetime import datetime
        complaint.handle_status = "已处理"
        complaint.handle_result = handle_result
        complaint.handle_time = datetime.utcnow()
        await complaint.save()
        
        return ComplaintResponse.model_validate(complaint)
    
    @staticmethod
    async def update_complaint(
        tenant_id: int,
        complaint_uuid: str,
        data: ComplaintUpdate
    ) -> ComplaintResponse:
        """
        更新投诉
        
        Args:
            tenant_id: 租户ID
            complaint_uuid: 投诉UUID
            data: 投诉更新数据
            
        Returns:
            ComplaintResponse: 更新后的投诉对象
            
        Raises:
            NotFoundError: 当投诉不存在时抛出
        """
        complaint = await Complaint.filter(
            tenant_id=tenant_id,
            uuid=complaint_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not complaint:
            raise NotFoundError(f"投诉 {complaint_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(complaint, key, value)
        
        await complaint.save()
        
        return ComplaintResponse.model_validate(complaint)
    
    @staticmethod
    async def delete_complaint(
        tenant_id: int,
        complaint_uuid: str
    ) -> None:
        """
        删除投诉（软删除）
        
        Args:
            tenant_id: 租户ID
            complaint_uuid: 投诉UUID
            
        Raises:
            NotFoundError: 当投诉不存在时抛出
        """
        complaint = await Complaint.filter(
            tenant_id=tenant_id,
            uuid=complaint_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not complaint:
            raise NotFoundError(f"投诉 {complaint_uuid} 不存在")
        
        from datetime import datetime
        complaint.deleted_at = datetime.utcnow()
        await complaint.save()
