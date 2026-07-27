"""
库存调拨业务服务模块

提供库存调拨单相关的业务逻辑处理，包括调拨单创建、执行、库存更新等。

Author: Luigi Lu
Date: 2026-01-15
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from tortoise.expressions import F

from apps.kuaizhizao.models.inventory_transfer import InventoryTransfer, InventoryTransferItem
from apps.kuaizhizao.schemas.inventory_transfer import (
    InventoryTransferCreate,
    InventoryTransferCreateWithItems,
    InventoryTransferUpdate,
    InventoryTransferResponse,
    InventoryTransferListResponse,
    InventoryTransferItemCreate,
    InventoryTransferItemInput,
    InventoryTransferItemUpdate,
    InventoryTransferItemResponse,
    InventoryTransferWithItemsResponse,
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str


class InventoryTransferService(AppBaseService[InventoryTransfer]):
    """
    库存调拨服务类

    处理库存调拨单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(InventoryTransfer)
        self.business_config_service = BusinessConfigService()

    @staticmethod
    def _infer_transfer_mode(transfer: InventoryTransfer) -> str:
        return "bin_relocation" if transfer.from_warehouse_id == transfer.to_warehouse_id else "transfer"

    def _to_transfer_response(self, transfer: InventoryTransfer) -> InventoryTransferResponse:
        from apps.kuaizhizao.services.document_lifecycle_service import get_inventory_transfer_lifecycle

        resp = InventoryTransferResponse.model_validate(transfer)
        resp.transfer_mode = self._infer_transfer_mode(transfer)
        resp.lifecycle = get_inventory_transfer_lifecycle(transfer, milestones=[])
        return resp

    @staticmethod
    def _validate_transfer_item(
        transfer: InventoryTransfer,
        *,
        from_storage_area_id: Optional[int],
        from_location_id: Optional[int],
        to_storage_area_id: Optional[int],
        to_location_id: Optional[int],
    ) -> None:
        mode = InventoryTransferService._infer_transfer_mode(transfer)
        if mode != "bin_relocation":
            return
        if not from_storage_area_id or not from_location_id:
            raise ValidationError("库内移位必须填写调出库区/库位")
        if not to_storage_area_id or not to_location_id:
            raise ValidationError("库内移位必须填写调入库区/库位")
        if from_location_id == to_location_id:
            raise ValidationError("库内移位时调出库位和调入库位不能相同")

    async def _create_transfer_item_record(
        self,
        tenant_id: int,
        transfer: InventoryTransfer,
        item_data: InventoryTransferItemInput | InventoryTransferItemCreate,
        *,
        transfer_id: Optional[int] = None,
    ) -> InventoryTransferItem:
        from_wh = getattr(item_data, "from_warehouse_id", None) or transfer.from_warehouse_id
        to_wh = getattr(item_data, "to_warehouse_id", None) or transfer.to_warehouse_id

        self._validate_transfer_item(
            transfer,
            from_storage_area_id=getattr(item_data, "from_storage_area_id", None),
            from_location_id=getattr(item_data, "from_location_id", None),
            to_storage_area_id=getattr(item_data, "to_storage_area_id", None),
            to_location_id=getattr(item_data, "to_location_id", None),
        )

        amount = item_data.quantity * item_data.unit_price
        return await InventoryTransferItem.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            transfer_id=transfer_id or transfer.id,
            material_id=item_data.material_id,
            material_code=item_data.material_code,
            material_name=item_data.material_name,
            from_warehouse_id=from_wh,
            from_storage_area_id=getattr(item_data, "from_storage_area_id", None),
            from_storage_area_code=getattr(item_data, "from_storage_area_code", None),
            from_location_id=getattr(item_data, "from_location_id", None),
            from_location_code=getattr(item_data, "from_location_code", None),
            to_warehouse_id=to_wh,
            to_storage_area_id=getattr(item_data, "to_storage_area_id", None),
            to_storage_area_code=getattr(item_data, "to_storage_area_code", None),
            to_location_id=getattr(item_data, "to_location_id", None),
            to_location_code=getattr(item_data, "to_location_code", None),
            batch_no=getattr(item_data, "batch_no", None),
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            amount=amount,
            status="pending",
            remarks=getattr(item_data, "remarks", None),
        )

    async def create_inventory_transfer(
        self,
        tenant_id: int,
        transfer_data: InventoryTransferCreate | InventoryTransferCreateWithItems,
        created_by: int,
        items: Optional[List[InventoryTransferItemInput]] = None,
    ) -> InventoryTransferResponse:
        """
        创建库存调拨单

        Args:
            tenant_id: 组织ID
            transfer_data: 调拨单创建数据
            created_by: 创建人ID

        Returns:
            InventoryTransferResponse: 创建的调拨单信息

        Raises:
            ValidationError: 数据验证失败
        """
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "inventory_transfer")
        if not is_enabled:
            raise BusinessLogicError("调拨单节点未启用，无法创建调拨单")
        async with in_transaction():
            # 验证调出和调入仓库不能相同
            allow_same = bool(getattr(transfer_data, "allow_same_warehouse", False))
            if transfer_data.from_warehouse_id == transfer_data.to_warehouse_id and not allow_same:
                raise ValidationError("调出仓库和调入仓库不能相同")

            # 生成调拨单号
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="INVENTORY_TRANSFER_CODE",
                prefix=f"TR{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建调拨单
            transfer = await InventoryTransfer.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                from_warehouse_id=transfer_data.from_warehouse_id,
                from_warehouse_name=transfer_data.from_warehouse_name,
                to_warehouse_id=transfer_data.to_warehouse_id,
                to_warehouse_name=transfer_data.to_warehouse_name,
                transfer_date=transfer_data.transfer_date,
                status="draft",
                total_items=0,
                total_quantity=Decimal("0"),
                total_amount=Decimal("0"),
                transfer_reason=transfer_data.transfer_reason,
                remarks=transfer_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            line_items = items
            if line_items is None and isinstance(transfer_data, InventoryTransferCreateWithItems):
                line_items = transfer_data.items
            if line_items:
                for item_data in line_items:
                    await self._create_transfer_item_record(
                        tenant_id, transfer, item_data
                    )
                await self._update_transfer_statistics(tenant_id, transfer.id)

            return self._to_transfer_response(transfer)

    async def get_inventory_transfer_by_id(
        self,
        tenant_id: int,
        transfer_id: int
    ) -> InventoryTransferWithItemsResponse:
        """
        根据ID获取库存调拨单详情（包含明细）

        Args:
            tenant_id: 组织ID
            transfer_id: 调拨单ID

        Returns:
            InventoryTransferWithItemsResponse: 调拨单详情（包含明细）

        Raises:
            NotFoundError: 调拨单不存在
        """
        transfer = await InventoryTransfer.get_or_none(
            id=transfer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not transfer:
            raise NotFoundError(f"调拨单不存在: {transfer_id}")

        # 获取调拨明细
        items = await InventoryTransferItem.filter(
            transfer_id=transfer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by('id')

        # 构建响应
        from apps.kuaizhizao.services.document_lifecycle_service import get_inventory_transfer_lifecycle, get_document_milestones
        milestones = await get_document_milestones(transfer.tenant_id, "inventory_transfer", transfer.id)

        response = InventoryTransferWithItemsResponse.model_validate(transfer)
        response.transfer_mode = self._infer_transfer_mode(transfer)
        response.items = [InventoryTransferItemResponse.model_validate(item) for item in items]
        response.lifecycle = get_inventory_transfer_lifecycle(transfer, milestones=milestones)

        return response

    async def delete_inventory_transfer(self, tenant_id: int, transfer_id: int) -> bool:
        """删除调拨单（软删除，仅草稿可删）"""
        transfer = await InventoryTransfer.get_or_none(
            id=transfer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not transfer:
            raise NotFoundError(f"调拨单不存在: {transfer_id}")
        if transfer.status != "draft":
            raise BusinessLogicError("只有草稿状态的调拨单才能删除")
        await InventoryTransfer.filter(id=transfer_id, tenant_id=tenant_id).update(
            deleted_at=resolve_business_datetime()
        )
        return True

    async def update_inventory_transfer(
        self,
        tenant_id: int,
        transfer_id: int,
        transfer_data: InventoryTransferUpdate,
        updated_by: int
    ) -> InventoryTransferResponse:
        """
        更新库存调拨单

        Args:
            tenant_id: 组织ID
            transfer_id: 调拨单ID
            transfer_data: 调拨单更新数据
            updated_by: 更新人ID

        Returns:
            InventoryTransferResponse: 更新后的调拨单信息

        Raises:
            NotFoundError: 调拨单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取调拨单
            transfer = await InventoryTransfer.get_or_none(
                id=transfer_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not transfer:
                raise NotFoundError(f"调拨单不存在: {transfer_id}")

            # 检查调拨单状态
            if transfer.status not in ['draft']:
                raise ValidationError(f"调拨单状态为{transfer.status}，不能修改")

            # 验证调出和调入仓库不能相同
            from_warehouse_id = transfer_data.from_warehouse_id if transfer_data.from_warehouse_id is not None else transfer.from_warehouse_id
            to_warehouse_id = transfer_data.to_warehouse_id if transfer_data.to_warehouse_id is not None else transfer.to_warehouse_id
            allow_same = bool(getattr(transfer_data, "allow_same_warehouse", False))
            if from_warehouse_id == to_warehouse_id and not allow_same:
                raise ValidationError("调出仓库和调入仓库不能相同")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新调拨单字段
            if transfer_data.from_warehouse_id is not None:
                transfer.from_warehouse_id = transfer_data.from_warehouse_id
            if transfer_data.from_warehouse_name is not None:
                transfer.from_warehouse_name = transfer_data.from_warehouse_name
            if transfer_data.to_warehouse_id is not None:
                transfer.to_warehouse_id = transfer_data.to_warehouse_id
            if transfer_data.to_warehouse_name is not None:
                transfer.to_warehouse_name = transfer_data.to_warehouse_name
            if transfer_data.transfer_date is not None:
                transfer.transfer_date = transfer_data.transfer_date
            if transfer_data.transfer_reason is not None:
                transfer.transfer_reason = transfer_data.transfer_reason
            if transfer_data.remarks is not None:
                transfer.remarks = transfer_data.remarks

            transfer.updated_by = updated_by
            transfer.updated_by_name = user_info["name"]

            await transfer.save()

            return self._to_transfer_response(transfer)

    async def list_inventory_transfers(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        from_warehouse_id: Optional[int] = None,
        to_warehouse_id: Optional[int] = None,
        status: Optional[str] = None,
        transfer_mode: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        transfer_date_start: Optional[str] = None,
        transfer_date_end: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> InventoryTransferListResponse:
        """
        获取库存调拨单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 调拨单号（模糊搜索）
            from_warehouse_id: 调出仓库ID
            to_warehouse_id: 调入仓库ID
            status: 状态

        Returns:
            InventoryTransferListResponse: 调拨单列表
        """
        query = InventoryTransfer.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        from apps.kuaizhizao.services.equipment_list_core import pick_search_keyword
        from apps.kuaizhizao.services.warehouse_list_core import (
            INVENTORY_TRANSFER_KEYWORD_FIELDS,
            INVENTORY_TRANSFER_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        if from_warehouse_id:
            query = query.filter(from_warehouse_id=from_warehouse_id)
        if to_warehouse_id:
            query = query.filter(to_warehouse_id=to_warehouse_id)
        if status:
            query = query.filter(status=status)

        if transfer_mode == "bin_relocation":
            query = query.filter(from_warehouse_id=F("to_warehouse_id"))
        elif transfer_mode == "transfer":
            query = query.exclude(from_warehouse_id=F("to_warehouse_id"))

        merged_keyword = pick_search_keyword(keyword, search) or (code.strip() if code and code.strip() else None)
        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=merged_keyword,
            order_by=order_by,
            allowed_fields=INVENTORY_TRANSFER_SORTABLE_FIELDS,
            default_order="-updated_at",
            keyword_fields=INVENTORY_TRANSFER_KEYWORD_FIELDS,
            doc_date_field="transfer_date",
            doc_start_date=transfer_date_start,
            doc_end_date=transfer_date_end,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )

        total = await query.count()
        transfers = await query.order_by(order_clause).offset(skip).limit(limit)

        # 返回分页响应
        return InventoryTransferListResponse(
            items=[self._to_transfer_response(t) for t in transfers],
            total=total
        )

    async def create_inventory_transfer_item(
        self,
        tenant_id: int,
        transfer_id: int,
        item_data: InventoryTransferItemCreate,
        created_by: int
    ) -> InventoryTransferItemResponse:
        """
        创建调拨明细

        Args:
            tenant_id: 组织ID
            transfer_id: 调拨单ID
            item_data: 调拨明细创建数据
            created_by: 创建人ID

        Returns:
            InventoryTransferItemResponse: 创建的调拨明细信息

        Raises:
            NotFoundError: 调拨单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 检查调拨单是否存在
            transfer = await InventoryTransfer.get_or_none(
                id=transfer_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not transfer:
                raise NotFoundError(f"调拨单不存在: {transfer_id}")

            # 检查调拨单状态
            if transfer.status not in ['draft', 'in_progress']:
                raise ValidationError(f"调拨单状态为{transfer.status}，不能添加明细")

            item = await self._create_transfer_item_record(
                tenant_id, transfer, item_data, transfer_id=transfer_id
            )

            await self._update_transfer_statistics(tenant_id, transfer_id)

            return InventoryTransferItemResponse.model_validate(item)

    async def update_inventory_transfer_item(
        self,
        tenant_id: int,
        item_id: int,
        item_data: InventoryTransferItemUpdate,
        updated_by: int
    ) -> InventoryTransferItemResponse:
        """
        更新调拨明细

        Args:
            tenant_id: 组织ID
            item_id: 调拨明细ID
            item_data: 调拨明细更新数据
            updated_by: 更新人ID

        Returns:
            InventoryTransferItemResponse: 更新后的调拨明细信息

        Raises:
            NotFoundError: 调拨明细不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取调拨明细
            item = await InventoryTransferItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not item:
                raise NotFoundError(f"调拨明细不存在: {item_id}")

            # 检查调拨明细状态
            if item.status != 'pending':
                raise ValidationError(f"调拨明细状态为{item.status}，不能修改")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            if item_data.quantity is not None:
                item.quantity = item_data.quantity
            if item_data.unit_price is not None:
                item.unit_price = item_data.unit_price
            if item_data.from_storage_area_id is not None:
                item.from_storage_area_id = item_data.from_storage_area_id
            if item_data.from_storage_area_code is not None:
                item.from_storage_area_code = item_data.from_storage_area_code
            if item_data.from_location_id is not None:
                item.from_location_id = item_data.from_location_id
            if item_data.from_location_code is not None:
                item.from_location_code = item_data.from_location_code
            if item_data.to_storage_area_id is not None:
                item.to_storage_area_id = item_data.to_storage_area_id
            if item_data.to_storage_area_code is not None:
                item.to_storage_area_code = item_data.to_storage_area_code
            if item_data.to_location_id is not None:
                item.to_location_id = item_data.to_location_id
            if item_data.to_location_code is not None:
                item.to_location_code = item_data.to_location_code
            if item_data.remarks is not None:
                item.remarks = item_data.remarks

            transfer = await InventoryTransfer.get_or_none(
                id=item.transfer_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if transfer:
                self._validate_transfer_item(
                    transfer,
                    from_storage_area_id=item.from_storage_area_id,
                    from_location_id=item.from_location_id,
                    to_storage_area_id=item.to_storage_area_id,
                    to_location_id=item.to_location_id,
                )

            # 重新计算金额
            item.amount = item.quantity * item.unit_price

            item.updated_by = updated_by
            item.updated_by_name = user_info["name"]

            await item.save()

            # 更新调拨单统计信息
            await self._update_transfer_statistics(tenant_id, item.transfer_id)

            return InventoryTransferItemResponse.model_validate(item)

    async def execute_inventory_transfer(
        self,
        tenant_id: int,
        transfer_id: int,
        executed_by: int
    ) -> InventoryTransferResponse:
        """
        执行调拨（更新库存）

        Args:
            tenant_id: 组织ID
            transfer_id: 调拨单ID
            executed_by: 执行人ID

        Returns:
            InventoryTransferResponse: 更新后的调拨单信息

        Raises:
            NotFoundError: 调拨单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取调拨单
            transfer = await InventoryTransfer.get_or_none(
                id=transfer_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not transfer:
                raise NotFoundError(f"调拨单不存在: {transfer_id}")

            if transfer.status != 'draft':
                raise ValidationError(f"调拨单状态为{transfer.status}，不能执行调拨")

            # 获取所有待调拨的明细
            items = await InventoryTransferItem.filter(
                transfer_id=transfer_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status='pending'
            )

            if not items:
                raise ValidationError("调拨单没有待调拨的明细")

            for item in items:
                self._validate_transfer_item(
                    transfer,
                    from_storage_area_id=item.from_storage_area_id,
                    from_location_id=item.from_location_id,
                    to_storage_area_id=item.to_storage_area_id,
                    to_location_id=item.to_location_id,
                )

            # 调用统一库存服务：从调出仓库扣减，向调入仓库增加
            from apps.kuaizhizao.services.inventory_service import InventoryService

            for item in items:
                await InventoryService.decrease_stock(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=item.quantity,
                    warehouse_id=item.from_warehouse_id,
                    batch_no=getattr(item, "batch_no", None),
                    source_type="inventory_transfer",
                    source_doc_id=transfer_id,
                    source_doc_code=transfer.code,
                    movement_type="transfer",
                    from_warehouse_id=item.from_warehouse_id,
                    to_warehouse_id=item.to_warehouse_id,
                    idempotency_key=f"inventory_transfer:{transfer_id}:dec:{item.id}",
                )
                await InventoryService.increase_stock(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=item.quantity,
                    warehouse_id=item.to_warehouse_id,
                    batch_no=getattr(item, "batch_no", None),
                    source_type="inventory_transfer",
                    source_doc_id=transfer_id,
                    source_doc_code=transfer.code,
                    movement_type="transfer",
                    from_warehouse_id=item.from_warehouse_id,
                    to_warehouse_id=item.to_warehouse_id,
                    idempotency_key=f"inventory_transfer:{transfer_id}:inc:{item.id}",
                )
                item.status = "transferred"
                await item.save()

            # 获取执行人信息
            user_info = await self.get_user_info(executed_by)

            # 更新调拨单状态为已完成
            transfer.status = "completed"
            transfer.executed_by = executed_by
            transfer.executed_by_name = user_info["name"]
            transfer.executed_at = resolve_business_datetime()
            transfer.updated_by = executed_by
            transfer.updated_by_name = user_info["name"]

            await transfer.save()

            return self._to_transfer_response(transfer)

    async def _update_transfer_statistics(
        self,
        tenant_id: int,
        transfer_id: int
    ) -> None:
        """
        更新调拨单统计信息

        Args:
            tenant_id: 组织ID
            transfer_id: 调拨单ID
        """
        # 获取所有明细
        items = await InventoryTransferItem.filter(
            transfer_id=transfer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 计算统计信息
        total_items = len(items)
        total_quantity = sum(item.quantity for item in items)
        total_amount = sum(item.amount for item in items)

        # 更新调拨单
        transfer = await InventoryTransfer.get(id=transfer_id)
        transfer.total_items = total_items
        transfer.total_quantity = total_quantity
        transfer.total_amount = total_amount
        await transfer.save()
