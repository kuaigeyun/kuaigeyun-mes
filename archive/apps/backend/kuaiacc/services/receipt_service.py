"""
收款服务模块

提供收款的业务逻辑处理，支持多组织隔离。
按照中国财务规范：收款核销管理。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiacc.models.receipt import Receipt
from apps.kuaiacc.schemas.receipt_schemas import (
    ReceiptCreate, ReceiptUpdate, ReceiptResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ReceiptService:
    """收款服务"""
    
    @staticmethod
    async def create_receipt(
        tenant_id: int,
        data: ReceiptCreate
    ) -> ReceiptResponse:
        """
        创建收款
        
        Args:
            tenant_id: 租户ID
            data: 收款创建数据
            
        Returns:
            ReceiptResponse: 创建的收款对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Receipt.filter(
            tenant_id=tenant_id,
            receipt_no=data.receipt_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"收款单编号 {data.receipt_no} 已存在")
        
        # 创建收款
        receipt = await Receipt.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ReceiptResponse.model_validate(receipt)
    
    @staticmethod
    async def get_receipt_by_uuid(
        tenant_id: int,
        receipt_uuid: str
    ) -> ReceiptResponse:
        """
        根据UUID获取收款
        
        Args:
            tenant_id: 租户ID
            receipt_uuid: 收款UUID
            
        Returns:
            ReceiptResponse: 收款对象
            
        Raises:
            NotFoundError: 当收款不存在时抛出
        """
        receipt = await Receipt.filter(
            tenant_id=tenant_id,
            uuid=receipt_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not receipt:
            raise NotFoundError(f"收款 {receipt_uuid} 不存在")
        
        return ReceiptResponse.model_validate(receipt)
    
    @staticmethod
    async def list_receipts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[ReceiptResponse]:
        """
        获取收款列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            customer_id: 客户ID（过滤）
            status: 状态（过滤）
            start_date: 开始日期（过滤）
            end_date: 结束日期（过滤）
            
        Returns:
            List[ReceiptResponse]: 收款列表
        """
        query = Receipt.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if customer_id:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(receipt_date__gte=start_date)
        if end_date:
            query = query.filter(receipt_date__lte=end_date)
        
        receipts = await query.offset(skip).limit(limit).order_by("-receipt_date", "-id").all()
        
        return [ReceiptResponse.model_validate(receipt) for receipt in receipts]
    
    @staticmethod
    async def update_receipt(
        tenant_id: int,
        receipt_uuid: str,
        data: ReceiptUpdate
    ) -> ReceiptResponse:
        """
        更新收款
        
        Args:
            tenant_id: 租户ID
            receipt_uuid: 收款UUID
            data: 收款更新数据
            
        Returns:
            ReceiptResponse: 更新后的收款对象
            
        Raises:
            NotFoundError: 当收款不存在时抛出
        """
        receipt = await Receipt.filter(
            tenant_id=tenant_id,
            uuid=receipt_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not receipt:
            raise NotFoundError(f"收款 {receipt_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(receipt, key, value)
        
        await receipt.save()
        
        return ReceiptResponse.model_validate(receipt)
    
    @staticmethod
    async def delete_receipt(
        tenant_id: int,
        receipt_uuid: str
    ) -> None:
        """
        删除收款（软删除）
        
        Args:
            tenant_id: 租户ID
            receipt_uuid: 收款UUID
            
        Raises:
            NotFoundError: 当收款不存在时抛出
        """
        receipt = await Receipt.filter(
            tenant_id=tenant_id,
            uuid=receipt_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not receipt:
            raise NotFoundError(f"收款 {receipt_uuid} 不存在")
        
        # 软删除
        receipt.deleted_at = datetime.now()
        await receipt.save()

