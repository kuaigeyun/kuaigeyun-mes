"""
凭证服务模块

提供凭证的业务逻辑处理，支持多组织隔离。
按照中国财务规范设计：借贷记账法、凭证审核、过账。
"""

from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from apps.kuaiacc.models.voucher import Voucher, VoucherEntry
from apps.kuaiacc.schemas.voucher_schemas import (
    VoucherCreate, VoucherUpdate, VoucherResponse,
    VoucherEntryCreate, VoucherEntryUpdate, VoucherEntryResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class VoucherService:
    """凭证服务"""
    
    @staticmethod
    async def create_voucher(
        tenant_id: int,
        data: VoucherCreate
    ) -> VoucherResponse:
        """
        创建凭证
        
        Args:
            tenant_id: 租户ID
            data: 凭证创建数据
            
        Returns:
            VoucherResponse: 创建的凭证对象
            
        Raises:
            ValidationError: 当编号已存在或借贷不平衡时抛出
        """
        # 检查编号是否已存在
        existing = await Voucher.filter(
            tenant_id=tenant_id,
            voucher_no=data.voucher_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"凭证编号 {data.voucher_no} 已存在")
        
        # 检查借贷是否平衡（中国财务要求）
        if data.total_debit != data.total_credit:
            raise ValidationError(f"凭证借贷不平衡：借方合计={data.total_debit}，贷方合计={data.total_credit}")
        
        # 创建凭证
        voucher = await Voucher.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        # 设置借贷平衡标志
        voucher.is_balanced = (voucher.total_debit == voucher.total_credit)
        await voucher.save()
        
        return VoucherResponse.model_validate(voucher)
    
    @staticmethod
    async def get_voucher_by_uuid(
        tenant_id: int,
        voucher_uuid: str
    ) -> VoucherResponse:
        """
        根据UUID获取凭证
        
        Args:
            tenant_id: 租户ID
            voucher_uuid: 凭证UUID
            
        Returns:
            VoucherResponse: 凭证对象
            
        Raises:
            NotFoundError: 当凭证不存在时抛出
        """
        voucher = await Voucher.filter(
            tenant_id=tenant_id,
            uuid=voucher_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not voucher:
            raise NotFoundError(f"凭证 {voucher_uuid} 不存在")
        
        return VoucherResponse.model_validate(voucher)
    
    @staticmethod
    async def list_vouchers(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        voucher_type: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[VoucherResponse]:
        """
        获取凭证列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            voucher_type: 凭证类型（过滤）
            status: 状态（过滤）
            start_date: 开始日期（过滤）
            end_date: 结束日期（过滤）
            
        Returns:
            List[VoucherResponse]: 凭证列表
        """
        query = Voucher.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if voucher_type:
            query = query.filter(voucher_type=voucher_type)
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(voucher_date__gte=start_date)
        if end_date:
            query = query.filter(voucher_date__lte=end_date)
        
        vouchers = await query.offset(skip).limit(limit).order_by("-voucher_date", "-id").all()
        
        return [VoucherResponse.model_validate(voucher) for voucher in vouchers]
    
    @staticmethod
    async def update_voucher(
        tenant_id: int,
        voucher_uuid: str,
        data: VoucherUpdate
    ) -> VoucherResponse:
        """
        更新凭证
        
        Args:
            tenant_id: 租户ID
            voucher_uuid: 凭证UUID
            data: 凭证更新数据
            
        Returns:
            VoucherResponse: 更新后的凭证对象
            
        Raises:
            NotFoundError: 当凭证不存在时抛出
            ValidationError: 当凭证已过账或借贷不平衡时抛出
        """
        voucher = await Voucher.filter(
            tenant_id=tenant_id,
            uuid=voucher_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not voucher:
            raise NotFoundError(f"凭证 {voucher_uuid} 不存在")
        
        # 检查凭证状态（已过账的凭证不能修改）
        if voucher.status == "已过账":
            raise ValidationError("已过账的凭证不能修改")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        
        # 如果更新了金额，需要检查借贷平衡
        if "total_debit" in update_data or "total_credit" in update_data:
            new_debit = update_data.get("total_debit", voucher.total_debit)
            new_credit = update_data.get("total_credit", voucher.total_credit)
            if new_debit != new_credit:
                raise ValidationError(f"凭证借贷不平衡：借方合计={new_debit}，贷方合计={new_credit}")
            update_data["is_balanced"] = True
        
        for key, value in update_data.items():
            setattr(voucher, key, value)
        
        await voucher.save()
        
        return VoucherResponse.model_validate(voucher)
    
    @staticmethod
    async def delete_voucher(
        tenant_id: int,
        voucher_uuid: str
    ) -> None:
        """
        删除凭证（软删除）
        
        Args:
            tenant_id: 租户ID
            voucher_uuid: 凭证UUID
            
        Raises:
            NotFoundError: 当凭证不存在时抛出
            ValidationError: 当凭证已过账时抛出
        """
        voucher = await Voucher.filter(
            tenant_id=tenant_id,
            uuid=voucher_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not voucher:
            raise NotFoundError(f"凭证 {voucher_uuid} 不存在")
        
        # 检查凭证状态（已过账的凭证不能删除）
        if voucher.status == "已过账":
            raise ValidationError("已过账的凭证不能删除")
        
        # 软删除
        voucher.deleted_at = datetime.now()
        await voucher.save()
    
    @staticmethod
    async def review_voucher(
        tenant_id: int,
        voucher_uuid: str,
        reviewer_id: int
    ) -> VoucherResponse:
        """
        审核凭证
        
        Args:
            tenant_id: 租户ID
            voucher_uuid: 凭证UUID
            reviewer_id: 审核人ID
            
        Returns:
            VoucherResponse: 审核后的凭证对象
            
        Raises:
            NotFoundError: 当凭证不存在时抛出
            ValidationError: 当凭证状态不允许审核时抛出
        """
        voucher = await Voucher.filter(
            tenant_id=tenant_id,
            uuid=voucher_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not voucher:
            raise NotFoundError(f"凭证 {voucher_uuid} 不存在")
        
        # 检查凭证状态
        if voucher.status != "草稿":
            raise ValidationError(f"只有草稿状态的凭证才能审核，当前状态：{voucher.status}")
        
        # 检查借贷平衡
        if not voucher.is_balanced:
            raise ValidationError("凭证借贷不平衡，无法审核")
        
        # 更新状态
        voucher.status = "已审核"
        voucher.reviewed_by = reviewer_id
        voucher.reviewed_at = datetime.now()
        await voucher.save()
        
        return VoucherResponse.model_validate(voucher)
    
    @staticmethod
    async def post_voucher(
        tenant_id: int,
        voucher_uuid: str,
        poster_id: int
    ) -> VoucherResponse:
        """
        过账凭证
        
        Args:
            tenant_id: 租户ID
            voucher_uuid: 凭证UUID
            poster_id: 过账人ID
            
        Returns:
            VoucherResponse: 过账后的凭证对象
            
        Raises:
            NotFoundError: 当凭证不存在时抛出
            ValidationError: 当凭证状态不允许过账时抛出
        """
        voucher = await Voucher.filter(
            tenant_id=tenant_id,
            uuid=voucher_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not voucher:
            raise NotFoundError(f"凭证 {voucher_uuid} 不存在")
        
        # 检查凭证状态（必须已审核才能过账）
        if voucher.status != "已审核":
            raise ValidationError(f"只有已审核状态的凭证才能过账，当前状态：{voucher.status}")
        
        # 检查借贷平衡
        if not voucher.is_balanced:
            raise ValidationError("凭证借贷不平衡，无法过账")
        
        # 更新状态
        voucher.status = "已过账"
        voucher.posted_by = poster_id
        voucher.posted_at = datetime.now()
        await voucher.save()
        
        # TODO: 这里应该更新总账和明细账
        
        return VoucherResponse.model_validate(voucher)


class VoucherEntryService:
    """凭证分录服务"""
    
    @staticmethod
    async def create_voucher_entry(
        tenant_id: int,
        data: VoucherEntryCreate
    ) -> VoucherEntryResponse:
        """
        创建凭证分录
        
        Args:
            tenant_id: 租户ID
            data: 分录创建数据
            
        Returns:
            VoucherEntryResponse: 创建的分录对象
        """
        # 创建分录
        entry = await VoucherEntry.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        # 更新凭证的借贷合计
        voucher = await Voucher.filter(
            tenant_id=tenant_id,
            id=data.voucher_id,
            deleted_at__isnull=True
        ).first()
        
        if voucher:
            voucher.total_debit += data.debit_amount
            voucher.total_credit += data.credit_amount
            voucher.is_balanced = (voucher.total_debit == voucher.total_credit)
            await voucher.save()
        
        return VoucherEntryResponse.model_validate(entry)
    
    @staticmethod
    async def list_voucher_entries(
        tenant_id: int,
        voucher_id: int
    ) -> List[VoucherEntryResponse]:
        """
        获取凭证分录列表
        
        Args:
            tenant_id: 租户ID
            voucher_id: 凭证ID
            
        Returns:
            List[VoucherEntryResponse]: 分录列表
        """
        entries = await VoucherEntry.filter(
            tenant_id=tenant_id,
            voucher_id=voucher_id,
            deleted_at__isnull=True
        ).order_by("entry_no").all()
        
        return [VoucherEntryResponse.model_validate(entry) for entry in entries]
    
    @staticmethod
    async def delete_voucher_entry(
        tenant_id: int,
        entry_uuid: str
    ) -> None:
        """
        删除凭证分录（软删除）
        
        Args:
            tenant_id: 租户ID
            entry_uuid: 分录UUID
            
        Raises:
            NotFoundError: 当分录不存在时抛出
        """
        entry = await VoucherEntry.filter(
            tenant_id=tenant_id,
            uuid=entry_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not entry:
            raise NotFoundError(f"凭证分录 {entry_uuid} 不存在")
        
        # 更新凭证的借贷合计
        voucher = await Voucher.filter(
            tenant_id=tenant_id,
            id=entry.voucher_id,
            deleted_at__isnull=True
        ).first()
        
        if voucher:
            voucher.total_debit -= entry.debit_amount
            voucher.total_credit -= entry.credit_amount
            voucher.is_balanced = (voucher.total_debit == voucher.total_credit)
            await voucher.save()
        
        # 软删除
        entry.deleted_at = datetime.now()
        await entry.save()

