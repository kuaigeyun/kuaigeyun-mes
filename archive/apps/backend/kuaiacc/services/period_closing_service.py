"""
期末结账服务模块

提供期末结账的业务逻辑处理，支持多组织隔离。
按照中国财务规范设计：月结、年结流程。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiacc.models.period_closing import PeriodClosing
from apps.kuaiacc.models.voucher import Voucher
from apps.kuaiacc.schemas.period_closing_schemas import (
    PeriodClosingCreate, PeriodClosingUpdate, PeriodClosingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PeriodClosingService:
    """期末结账服务"""
    
    @staticmethod
    async def create_period_closing(
        tenant_id: int,
        data: PeriodClosingCreate
    ) -> PeriodClosingResponse:
        """
        创建期末结账
        
        Args:
            tenant_id: 租户ID
            data: 结账创建数据
            
        Returns:
            PeriodClosingResponse: 创建的结账对象
            
        Raises:
            ValidationError: 当期间已结账时抛出
        """
        # 检查期间是否已结账
        existing = await PeriodClosing.filter(
            tenant_id=tenant_id,
            closing_period=data.closing_period,
            closing_type=data.closing_type,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"期间 {data.closing_period} 的{data.closing_type}已存在")
        
        # 创建结账
        closing = await PeriodClosing.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return PeriodClosingResponse.model_validate(closing)
    
    @staticmethod
    async def get_period_closing_by_uuid(
        tenant_id: int,
        closing_uuid: str
    ) -> PeriodClosingResponse:
        """
        根据UUID获取期末结账
        
        Args:
            tenant_id: 租户ID
            closing_uuid: 结账UUID
            
        Returns:
            PeriodClosingResponse: 结账对象
            
        Raises:
            NotFoundError: 当结账不存在时抛出
        """
        closing = await PeriodClosing.filter(
            tenant_id=tenant_id,
            uuid=closing_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not closing:
            raise NotFoundError(f"期末结账 {closing_uuid} 不存在")
        
        return PeriodClosingResponse.model_validate(closing)
    
    @staticmethod
    async def list_period_closings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        closing_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[PeriodClosingResponse]:
        """
        获取期末结账列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            closing_type: 结账类型（过滤）
            status: 状态（过滤）
            
        Returns:
            List[PeriodClosingResponse]: 结账列表
        """
        query = PeriodClosing.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if closing_type:
            query = query.filter(closing_type=closing_type)
        if status:
            query = query.filter(status=status)
        
        closings = await query.offset(skip).limit(limit).order_by("-closing_date", "-id").all()
        
        return [PeriodClosingResponse.model_validate(closing) for closing in closings]
    
    @staticmethod
    async def check_before_closing(
        tenant_id: int,
        closing_period: str
    ) -> dict:
        """
        结账前检查
        
        Args:
            tenant_id: 租户ID
            closing_period: 结账期间
            
        Returns:
            dict: 检查结果
        """
        # 检查是否有未审核的凭证
        unreviewed_count = await Voucher.filter(
            tenant_id=tenant_id,
            status="草稿",
            deleted_at__isnull=True
        ).count()
        
        # 检查是否有未过账的凭证
        unposted_count = await Voucher.filter(
            tenant_id=tenant_id,
            status="已审核",
            deleted_at__isnull=True
        ).count()
        
        # 检查是否有借贷不平衡的凭证
        unbalanced_count = await Voucher.filter(
            tenant_id=tenant_id,
            is_balanced=False,
            deleted_at__isnull=True
        ).count()
        
        check_result = {
            "unreviewed_vouchers": unreviewed_count,
            "unposted_vouchers": unposted_count,
            "unbalanced_vouchers": unbalanced_count,
            "can_close": (unreviewed_count == 0 and unposted_count == 0 and unbalanced_count == 0)
        }
        
        return check_result
    
    @staticmethod
    async def execute_closing(
        tenant_id: int,
        closing_uuid: str,
        closer_id: int
    ) -> PeriodClosingResponse:
        """
        执行结账
        
        Args:
            tenant_id: 租户ID
            closing_uuid: 结账UUID
            closer_id: 结账人ID
            
        Returns:
            PeriodClosingResponse: 结账后的对象
            
        Raises:
            NotFoundError: 当结账不存在时抛出
            ValidationError: 当检查不通过时抛出
        """
        closing = await PeriodClosing.filter(
            tenant_id=tenant_id,
            uuid=closing_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not closing:
            raise NotFoundError(f"期末结账 {closing_uuid} 不存在")
        
        # 检查状态
        if closing.status != "待结账":
            raise ValidationError(f"只有待结账状态的记录才能执行结账，当前状态：{closing.status}")
        
        # 执行结账前检查
        check_result = await PeriodClosingService.check_before_closing(
            tenant_id, closing.closing_period
        )
        
        if not check_result["can_close"]:
            raise ValidationError(
                f"结账前检查不通过：未审核凭证{check_result['unreviewed_vouchers']}个，"
                f"未过账凭证{check_result['unposted_vouchers']}个，"
                f"借贷不平衡凭证{check_result['unbalanced_vouchers']}个"
            )
        
        # 更新状态
        closing.status = "已结账"
        closing.closed_by = closer_id
        closing.closed_at = datetime.now()
        closing.check_result = check_result
        await closing.save()
        
        # TODO: 这里应该执行实际的结账逻辑（生成总账、明细账等）
        
        return PeriodClosingResponse.model_validate(closing)

