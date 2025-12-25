"""
付款服务模块

提供付款的业务逻辑处理，支持多组织隔离。
按照中国财务规范：付款核销管理。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiacc.models.payment import Payment
from apps.kuaiacc.schemas.payment_schemas import (
    PaymentCreate, PaymentUpdate, PaymentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PaymentService:
    """付款服务"""
    
    @staticmethod
    async def create_payment(
        tenant_id: int,
        data: PaymentCreate
    ) -> PaymentResponse:
        """
        创建付款
        
        Args:
            tenant_id: 租户ID
            data: 付款创建数据
            
        Returns:
            PaymentResponse: 创建的付款对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Payment.filter(
            tenant_id=tenant_id,
            payment_no=data.payment_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"付款单编号 {data.payment_no} 已存在")
        
        # 创建付款
        payment = await Payment.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return PaymentResponse.model_validate(payment)
    
    @staticmethod
    async def get_payment_by_uuid(
        tenant_id: int,
        payment_uuid: str
    ) -> PaymentResponse:
        """
        根据UUID获取付款
        
        Args:
            tenant_id: 租户ID
            payment_uuid: 付款UUID
            
        Returns:
            PaymentResponse: 付款对象
            
        Raises:
            NotFoundError: 当付款不存在时抛出
        """
        payment = await Payment.filter(
            tenant_id=tenant_id,
            uuid=payment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not payment:
            raise NotFoundError(f"付款 {payment_uuid} 不存在")
        
        return PaymentResponse.model_validate(payment)
    
    @staticmethod
    async def list_payments(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[PaymentResponse]:
        """
        获取付款列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            supplier_id: 供应商ID（过滤）
            status: 状态（过滤）
            start_date: 开始日期（过滤）
            end_date: 结束日期（过滤）
            
        Returns:
            List[PaymentResponse]: 付款列表
        """
        query = Payment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(payment_date__gte=start_date)
        if end_date:
            query = query.filter(payment_date__lte=end_date)
        
        payments = await query.offset(skip).limit(limit).order_by("-payment_date", "-id").all()
        
        return [PaymentResponse.model_validate(payment) for payment in payments]
    
    @staticmethod
    async def update_payment(
        tenant_id: int,
        payment_uuid: str,
        data: PaymentUpdate
    ) -> PaymentResponse:
        """
        更新付款
        
        Args:
            tenant_id: 租户ID
            payment_uuid: 付款UUID
            data: 付款更新数据
            
        Returns:
            PaymentResponse: 更新后的付款对象
            
        Raises:
            NotFoundError: 当付款不存在时抛出
        """
        payment = await Payment.filter(
            tenant_id=tenant_id,
            uuid=payment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not payment:
            raise NotFoundError(f"付款 {payment_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(payment, key, value)
        
        await payment.save()
        
        return PaymentResponse.model_validate(payment)
    
    @staticmethod
    async def delete_payment(
        tenant_id: int,
        payment_uuid: str
    ) -> None:
        """
        删除付款（软删除）
        
        Args:
            tenant_id: 租户ID
            payment_uuid: 付款UUID
            
        Raises:
            NotFoundError: 当付款不存在时抛出
        """
        payment = await Payment.filter(
            tenant_id=tenant_id,
            uuid=payment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not payment:
            raise NotFoundError(f"付款 {payment_uuid} 不存在")
        
        # 软删除
        payment.deleted_at = datetime.now()
        await payment.save()

