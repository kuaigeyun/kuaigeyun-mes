"""
标准成本库服务
"""

from datetime import date
from typing import List, Optional

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.standard_cost import StandardCost
from apps.kuaicaiwu.schemas.standard_cost import (
    StandardCostCreate,
    StandardCostUpdate,
    StandardCostResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class StandardCostService(AppBaseService[StandardCost]):
    """标准成本库 CRUD"""

    def __init__(self):
        super().__init__(StandardCost)

    async def create_standard_cost(
        self,
        tenant_id: int,
        data: StandardCostCreate,
        created_by: int,
    ) -> StandardCostResponse:
        async with in_transaction():
            existing = await StandardCost.filter(
                tenant_id=tenant_id,
                target_type=data.target_type,
                target_id=data.target_id,
                cost_item_type=data.cost_item_type,
                version=data.version,
                deleted_at__isnull=True,
            ).first()
            if existing:
                raise ValidationError(
                    f"标准成本已存在：{data.target_type}#{data.target_id} / {data.cost_item_type} v{data.version}"
                )

            row = await StandardCost.create(
                tenant_id=tenant_id,
                **data.model_dump(exclude_unset=True),
            )
            return StandardCostResponse.model_validate(row)

    async def get_standard_cost_by_id(
        self, tenant_id: int, standard_cost_id: int
    ) -> StandardCostResponse:
        row = await StandardCost.get_or_none(
            tenant_id=tenant_id, id=standard_cost_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"标准成本不存在: {standard_cost_id}")
        return StandardCostResponse.model_validate(row)

    async def list_standard_costs(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        target_type: Optional[str] = None,
        target_id: Optional[int] = None,
        cost_item_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> tuple[List[StandardCostResponse], int]:
        query = StandardCost.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if target_type:
            query = query.filter(target_type=target_type)
        if target_id is not None:
            query = query.filter(target_id=target_id)
        if cost_item_type:
            query = query.filter(cost_item_type=cost_item_type)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if search:
            query = query.filter(
                Q(target_code__icontains=search)
                | Q(target_name__icontains=search)
                | Q(description__icontains=search)
            )

        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-effective_date", "-id")
        return [StandardCostResponse.model_validate(row) for row in rows], total

    async def update_standard_cost(
        self,
        tenant_id: int,
        standard_cost_id: int,
        data: StandardCostUpdate,
    ) -> StandardCostResponse:
        async with in_transaction():
            row = await StandardCost.get_or_none(
                tenant_id=tenant_id, id=standard_cost_id, deleted_at__isnull=True
            )
            if not row:
                raise NotFoundError(f"标准成本不存在: {standard_cost_id}")

            update_data = data.model_dump(exclude_unset=True)
            if update_data:
                await StandardCost.filter(tenant_id=tenant_id, id=standard_cost_id).update(
                    **update_data
                )
            return await self.get_standard_cost_by_id(tenant_id, standard_cost_id)

    async def delete_standard_cost(self, tenant_id: int, standard_cost_id: int) -> None:
        row = await StandardCost.get_or_none(
            tenant_id=tenant_id, id=standard_cost_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"标准成本不存在: {standard_cost_id}")
        from datetime import datetime

        await StandardCost.filter(tenant_id=tenant_id, id=standard_cost_id).update(
            deleted_at=datetime.now(),
            is_active=False,
        )

    async def get_active_standard_value(
        self,
        tenant_id: int,
        target_type: str,
        target_id: int,
        cost_item_type: str,
        as_of: Optional[date] = None,
    ) -> Optional[StandardCostResponse]:
        ref_date = as_of or date.today()
        row = await StandardCost.filter(
            tenant_id=tenant_id,
            target_type=target_type,
            target_id=target_id,
            cost_item_type=cost_item_type,
            is_active=True,
            deleted_at__isnull=True,
            effective_date__lte=ref_date,
        ).order_by("-effective_date", "-id").first()
        if not row:
            return None
        if row.expiry_date and row.expiry_date < ref_date:
            return None
        return StandardCostResponse.model_validate(row)
