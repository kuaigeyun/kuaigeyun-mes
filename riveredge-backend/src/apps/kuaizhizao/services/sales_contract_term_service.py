"""
销售合同条款服务
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.sales_contract_term_group import SalesContractTermGroup
from apps.kuaizhizao.models.sales_contract_term_group_item import SalesContractTermGroupItem
from apps.kuaizhizao.models.sales_contract_term_item import SalesContractTermItem
from apps.kuaizhizao.schemas.sales_contract_term import (
    SalesContractTermGroupCreate,
    SalesContractTermGroupItemDetail,
    SalesContractTermGroupItemRef,
    SalesContractTermGroupListResponse,
    SalesContractTermGroupResponse,
    SalesContractTermGroupUpdate,
    SalesContractTermItemCreate,
    SalesContractTermItemListResponse,
    SalesContractTermItemResponse,
    SalesContractTermItemUpdate,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError


class SalesContractTermService:
    """条款项与条款组 CRUD"""

    @staticmethod
    def _item_to_response(item: SalesContractTermItem) -> SalesContractTermItemResponse:
        return SalesContractTermItemResponse(
            id=item.id,
            uuid=str(item.uuid),
            tenant_id=item.tenant_id,
            term_code=item.term_code,
            term_name=item.term_name,
            content=item.content,
            sort_order=item.sort_order,
            is_active=item.is_active,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def _group_items_detail(
        self, tenant_id: int, group_id: int
    ) -> List[SalesContractTermGroupItemDetail]:
        links = await SalesContractTermGroupItem.filter(tenant_id=tenant_id, group_id=group_id).order_by(
            "sort_order", "id"
        )
        if not links:
            return []
        item_ids = [lk.term_item_id for lk in links]
        items = await SalesContractTermItem.filter(
            tenant_id=tenant_id, id__in=item_ids, deleted_at__isnull=True
        )
        item_map = {it.id: it for it in items}
        result: List[SalesContractTermGroupItemDetail] = []
        for lk in links:
            it = item_map.get(lk.term_item_id)
            if not it:
                continue
            result.append(
                SalesContractTermGroupItemDetail(
                    term_item_id=it.id,
                    term_code=it.term_code,
                    term_name=it.term_name,
                    content=it.content,
                    sort_order=lk.sort_order,
                )
            )
        return result

    async def _group_to_response(
        self, group: SalesContractTermGroup, include_items: bool = False
    ) -> SalesContractTermGroupResponse:
        items = None
        if include_items:
            items = await self._group_items_detail(group.tenant_id, group.id)
        return SalesContractTermGroupResponse(
            id=group.id,
            uuid=str(group.uuid),
            tenant_id=group.tenant_id,
            group_code=group.group_code,
            group_name=group.group_name,
            description=group.description,
            is_active=group.is_active,
            created_at=group.created_at,
            updated_at=group.updated_at,
            items=items,
        )

    async def list_term_items(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> SalesContractTermItemListResponse:
        qs = SalesContractTermItem.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        if keyword:
            qs = qs.filter(
                Q(term_name__icontains=keyword)
                | Q(term_code__icontains=keyword)
                | Q(content__icontains=keyword)
            )
        total = await qs.count()
        rows = await qs.order_by("sort_order", "id").offset(skip).limit(limit)
        return SalesContractTermItemListResponse(
            items=[self._item_to_response(r) for r in rows],
            total=total,
        )

    async def get_term_item(self, tenant_id: int, item_id: int) -> SalesContractTermItemResponse:
        item = await SalesContractTermItem.get_or_none(
            tenant_id=tenant_id, id=item_id, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError("条款项不存在")
        return self._item_to_response(item)

    async def create_term_item(
        self, tenant_id: int, data: SalesContractTermItemCreate
    ) -> SalesContractTermItemResponse:
        if not (data.term_name or "").strip():
            raise ValidationError("条款名称不能为空")
        if not (data.content or "").strip():
            raise ValidationError("条款内容不能为空")
        if data.term_code:
            dup = await SalesContractTermItem.filter(
                tenant_id=tenant_id, term_code=data.term_code, deleted_at__isnull=True
            ).exists()
            if dup:
                raise ValidationError(f"条款编码 {data.term_code} 已存在")
        item = await SalesContractTermItem.create(
            tenant_id=tenant_id,
            term_code=data.term_code,
            term_name=data.term_name.strip(),
            content=data.content.strip(),
            sort_order=data.sort_order,
            is_active=data.is_active,
        )
        return self._item_to_response(item)

    async def update_term_item(
        self, tenant_id: int, item_id: int, data: SalesContractTermItemUpdate
    ) -> SalesContractTermItemResponse:
        item = await SalesContractTermItem.get_or_none(
            tenant_id=tenant_id, id=item_id, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError("条款项不存在")
        if data.term_code is not None and data.term_code != item.term_code:
            dup = await SalesContractTermItem.filter(
                tenant_id=tenant_id, term_code=data.term_code, deleted_at__isnull=True
            ).exclude(id=item_id).exists()
            if dup:
                raise ValidationError(f"条款编码 {data.term_code} 已存在")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(item, k, v)
        await item.save()
        return self._item_to_response(item)

    async def delete_term_item(self, tenant_id: int, item_id: int) -> None:
        item = await SalesContractTermItem.get_or_none(
            tenant_id=tenant_id, id=item_id, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError("条款项不存在")
        in_group = await SalesContractTermGroupItem.filter(tenant_id=tenant_id, term_item_id=item_id).exists()
        if in_group:
            raise BusinessLogicError("该条款项已被条款组引用，请先从条款组中移除")
        item.deleted_at = datetime.now()
        await item.save(update_fields=["deleted_at"])

    async def list_term_groups(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
        include_items: bool = False,
    ) -> SalesContractTermGroupListResponse:
        qs = SalesContractTermGroup.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        if keyword:
            qs = qs.filter(
                Q(group_name__icontains=keyword)
                | Q(group_code__icontains=keyword)
                | Q(description__icontains=keyword)
            )
        total = await qs.count()
        rows = await qs.order_by("id").offset(skip).limit(limit)
        return SalesContractTermGroupListResponse(
            items=[await self._group_to_response(r, include_items=include_items) for r in rows],
            total=total,
        )

    async def get_term_group(
        self, tenant_id: int, group_id: int, include_items: bool = True
    ) -> SalesContractTermGroupResponse:
        group = await SalesContractTermGroup.get_or_none(
            tenant_id=tenant_id, id=group_id, deleted_at__isnull=True
        )
        if not group:
            raise NotFoundError("条款组不存在")
        return await self._group_to_response(group, include_items=include_items)

    async def _sync_group_items(
        self, tenant_id: int, group_id: int, items: List[SalesContractTermGroupItemRef]
    ) -> None:
        await SalesContractTermGroupItem.filter(tenant_id=tenant_id, group_id=group_id).delete()
        seen: set[int] = set()
        for idx, ref in enumerate(items):
            if ref.term_item_id in seen:
                continue
            seen.add(ref.term_item_id)
            exists = await SalesContractTermItem.filter(
                tenant_id=tenant_id, id=ref.term_item_id, deleted_at__isnull=True
            ).exists()
            if not exists:
                raise ValidationError(f"条款项 {ref.term_item_id} 不存在")
            await SalesContractTermGroupItem.create(
                tenant_id=tenant_id,
                group_id=group_id,
                term_item_id=ref.term_item_id,
                sort_order=ref.sort_order if ref.sort_order is not None else idx,
            )

    async def create_term_group(
        self, tenant_id: int, data: SalesContractTermGroupCreate
    ) -> SalesContractTermGroupResponse:
        if not (data.group_name or "").strip():
            raise ValidationError("条款组名称不能为空")
        if data.group_code:
            dup = await SalesContractTermGroup.filter(
                tenant_id=tenant_id, group_code=data.group_code, deleted_at__isnull=True
            ).exists()
            if dup:
                raise ValidationError(f"条款组编码 {data.group_code} 已存在")
        async with in_transaction():
            group = await SalesContractTermGroup.create(
                tenant_id=tenant_id,
                group_code=data.group_code,
                group_name=data.group_name.strip(),
                description=data.description,
                is_active=data.is_active,
            )
            if data.items:
                await self._sync_group_items(tenant_id, group.id, data.items)
        return await self.get_term_group(tenant_id, group.id)

    async def update_term_group(
        self, tenant_id: int, group_id: int, data: SalesContractTermGroupUpdate
    ) -> SalesContractTermGroupResponse:
        group = await SalesContractTermGroup.get_or_none(
            tenant_id=tenant_id, id=group_id, deleted_at__isnull=True
        )
        if not group:
            raise NotFoundError("条款组不存在")
        if data.group_code is not None and data.group_code != group.group_code:
            dup = await SalesContractTermGroup.filter(
                tenant_id=tenant_id, group_code=data.group_code, deleted_at__isnull=True
            ).exclude(id=group_id).exists()
            if dup:
                raise ValidationError(f"条款组编码 {data.group_code} 已存在")
        async with in_transaction():
            for k, v in data.model_dump(exclude_unset=True, exclude={"items"}).items():
                setattr(group, k, v)
            await group.save()
            if data.items is not None:
                await self._sync_group_items(tenant_id, group_id, data.items)
        return await self.get_term_group(tenant_id, group_id)

    async def delete_term_group(self, tenant_id: int, group_id: int) -> None:
        group = await SalesContractTermGroup.get_or_none(
            tenant_id=tenant_id, id=group_id, deleted_at__isnull=True
        )
        if not group:
            raise NotFoundError("条款组不存在")
        async with in_transaction():
            await SalesContractTermGroupItem.filter(tenant_id=tenant_id, group_id=group_id).delete()
            group.deleted_at = datetime.now()
            await group.save(update_fields=["deleted_at"])

    async def build_terms_snapshot(
        self, tenant_id: int, group_id: Optional[int]
    ) -> tuple[Optional[int], Optional[str], Optional[list]]:
        """根据条款组生成合同条款快照"""
        if not group_id:
            return None, None, None
        group = await SalesContractTermGroup.get_or_none(
            tenant_id=tenant_id, id=group_id, deleted_at__isnull=True, is_active=True
        )
        if not group:
            raise ValidationError("所选条款组不存在或已停用")
        details = await self._group_items_detail(tenant_id, group_id)
        if not details:
            raise ValidationError("所选条款组未包含任何条款项")
        snapshot = [
            {
                "term_item_id": d.term_item_id,
                "term_name": d.term_name,
                "content": d.content,
                "template_content": d.content,
                "sort_order": d.sort_order,
            }
            for d in details
        ]
        return group_id, group.group_name, snapshot
