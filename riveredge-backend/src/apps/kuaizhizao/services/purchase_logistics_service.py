"""
采购物流记录服务模块

Author: RiverEdge Team
Date: 2026-03-04
"""

from typing import List, Optional

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.purchase_logistics import PurchaseLogistics
from apps.kuaizhizao.schemas.purchase_logistics import (
    PurchaseLogisticsCreate,
    PurchaseLogisticsUpdate,
    PurchaseLogisticsResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError


class PurchaseLogisticsService(AppBaseService[PurchaseLogistics]):
    """采购物流记录服务"""

    def __init__(self):
        super().__init__(PurchaseLogistics)

    async def create_logistics(
        self,
        tenant_id: int,
        data: PurchaseLogisticsCreate,
        created_by: int,
    ) -> PurchaseLogisticsResponse:
        """创建采购物流记录"""
        logistics = await PurchaseLogistics.create(
            tenant_id=tenant_id,
            created_by=created_by,
            **data.model_dump(),
        )
        return PurchaseLogisticsResponse.model_validate(logistics)

    async def get_by_id(
        self,
        tenant_id: int,
        logistics_id: int,
    ) -> PurchaseLogisticsResponse:
        """根据ID获取采购物流记录"""
        logistics = await PurchaseLogistics.get_or_none(
            tenant_id=tenant_id,
            id=logistics_id,
        )
        if not logistics:
            raise NotFoundError(f"采购物流记录不存在: {logistics_id}")
        return PurchaseLogisticsResponse.model_validate(logistics)

    async def list_logistics(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        purchase_order_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        tracking_number: Optional[str] = None,
        carrier: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[PurchaseLogisticsResponse]:
        """获取采购物流记录列表"""
        qs = PurchaseLogistics.filter(tenant_id=tenant_id).order_by("-created_at")
        if purchase_order_id is not None:
            qs = qs.filter(purchase_order_id=purchase_order_id)
        if supplier_id is not None:
            qs = qs.filter(supplier_id=supplier_id)
        if tracking_number:
            qs = qs.filter(tracking_number__icontains=tracking_number)
        if carrier:
            qs = qs.filter(carrier__icontains=carrier)
        if status:
            qs = qs.filter(status=status)

        items = await qs.offset(skip).limit(limit).all()
        return [PurchaseLogisticsResponse.model_validate(i) for i in items]

    async def update_logistics(
        self,
        tenant_id: int,
        logistics_id: int,
        data: PurchaseLogisticsUpdate,
        updated_by: int,
    ) -> PurchaseLogisticsResponse:
        """更新采购物流记录"""
        logistics = await PurchaseLogistics.get_or_none(
            tenant_id=tenant_id,
            id=logistics_id,
        )
        if not logistics:
            raise NotFoundError(f"采购物流记录不存在: {logistics_id}")

        update_data = data.model_dump(exclude_unset=True)
        await PurchaseLogistics.filter(tenant_id=tenant_id, id=logistics_id).update(
            updated_by=updated_by,
            **update_data,
        )
        logistics = await PurchaseLogistics.get(tenant_id=tenant_id, id=logistics_id)
        return PurchaseLogisticsResponse.model_validate(logistics)

    async def delete_logistics(
        self,
        tenant_id: int,
        logistics_id: int,
    ) -> None:
        """删除采购物流记录"""
        logistics = await PurchaseLogistics.get_or_none(
            tenant_id=tenant_id,
            id=logistics_id,
        )
        if not logistics:
            raise NotFoundError(f"采购物流记录不存在: {logistics_id}")
        await logistics.delete()
