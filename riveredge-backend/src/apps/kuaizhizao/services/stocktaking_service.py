"""
库存盘点业务服务模块

提供库存盘点单相关的业务逻辑处理，包括盘点单创建、执行、差异处理等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.stocktaking import Stocktaking, StocktakingItem
from apps.kuaizhizao.schemas.stocktaking import (
    StocktakingCreate,
    StocktakingUpdate,
    StocktakingResponse,
    StocktakingListResponse,
    StocktakingItemCreate,
    StocktakingItemUpdate,
    StocktakingItemResponse,
    StocktakingWithItemsResponse,
    StartStocktakingRequest,
)

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.services.warehouse_service import _resolve_warehouse_name_by_id
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class StocktakingService(AppBaseService[Stocktaking]):
    """
    库存盘点服务类

    处理库存盘点单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(Stocktaking)
        self.business_config_service = BusinessConfigService()

    @staticmethod
    async def _fill_missing_warehouse_names(
        tenant_id: int,
        stocktakings: List[Stocktaking],
    ) -> None:
        """补齐冗余 warehouse_name（创建时未写入的历史数据）。"""
        need = [
            s for s in stocktakings
            if s.warehouse_id and not str(s.warehouse_name or "").strip()
        ]
        if not need:
            return
        from apps.master_data.models.warehouse import Warehouse

        ids = list({int(s.warehouse_id) for s in need})
        rows = await Warehouse.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).values("id", "name")
        name_map = {int(r["id"]): str(r.get("name") or "").strip() for r in rows}
        dirty: List[Stocktaking] = []
        for s in need:
            name = name_map.get(int(s.warehouse_id), "")
            if not name:
                continue
            s.warehouse_name = name
            dirty.append(s)
        if dirty:
            await Stocktaking.bulk_update(dirty, fields=["warehouse_name"])

    async def create_stocktaking(
        self,
        tenant_id: int,
        stocktaking_data: StocktakingCreate,
        created_by: int
    ) -> StocktakingResponse:
        """
        创建库存盘点单

        Args:
            tenant_id: 组织ID
            stocktaking_data: 盘点单创建数据
            created_by: 创建人ID

        Returns:
            StocktakingResponse: 创建的盘点单信息

        Raises:
            ValidationError: 数据验证失败
        """
        # 0. 检查节点是否启用
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "stocktaking")
        if not is_enabled:
            raise BusinessLogicError("盘点单节点未启用，无法创建盘点单")

        warehouse_name = await _resolve_warehouse_name_by_id(
            tenant_id,
            stocktaking_data.warehouse_id,
            stocktaking_data.warehouse_name,
        )

        async with in_transaction():
            # 生成盘点单号
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="STOCKTAKING_CODE",
                prefix=f"ST{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建盘点单
            stocktaking = await Stocktaking.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=stocktaking_data.warehouse_id,
                warehouse_name=warehouse_name,
                stocktaking_date=stocktaking_data.stocktaking_date,
                stocktaking_type=stocktaking_data.stocktaking_type,
                line_granularity=stocktaking_data.line_granularity,
                include_zero_stock=stocktaking_data.include_zero_stock,
                status="draft",
                total_items=0,
                counted_items=0,
                total_differences=0,
                total_difference_amount=Decimal("0"),
                remarks=stocktaking_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            return StocktakingResponse.model_validate(stocktaking)

    async def get_stocktaking_by_id(
        self,
        tenant_id: int,
        stocktaking_id: int
    ) -> StocktakingWithItemsResponse:
        """
        根据ID获取库存盘点单详情（包含明细）

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID

        Returns:
            StocktakingWithItemsResponse: 盘点单详情（包含明细）

        Raises:
            NotFoundError: 盘点单不存在
        """
        stocktaking = await Stocktaking.get_or_none(
            id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not stocktaking:
            raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

        await self._fill_missing_warehouse_names(tenant_id, [stocktaking])

        # 获取盘点明细
        items = await StocktakingItem.filter(
            stocktaking_id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by('id')

        # 构建响应
        from apps.kuaizhizao.services.document_lifecycle_service import get_stocktaking_lifecycle, get_document_milestones
        milestones = await get_document_milestones(stocktaking.tenant_id, "stocktaking", stocktaking.id)
        
        response = StocktakingWithItemsResponse.model_validate(stocktaking)
        response.items = [StocktakingItemResponse.model_validate(item) for item in items]
        response.lifecycle = get_stocktaking_lifecycle(stocktaking, milestones=milestones)

        return response

    async def delete_stocktaking(self, tenant_id: int, stocktaking_id: int) -> bool:
        """删除盘点单（软删除，仅草稿可删）"""
        stocktaking = await Stocktaking.get_or_none(
            id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not stocktaking:
            raise NotFoundError(f"盘点单不存在: {stocktaking_id}")
        if stocktaking.status != "draft":
            raise BusinessLogicError("只有草稿状态的盘点单才能删除")
        await Stocktaking.filter(id=stocktaking_id, tenant_id=tenant_id).update(
            deleted_at=datetime.now()
        )
        return True

    async def update_stocktaking(
        self,
        tenant_id: int,
        stocktaking_id: int,
        stocktaking_data: StocktakingUpdate,
        updated_by: int
    ) -> StocktakingResponse:
        """
        更新库存盘点单

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
            stocktaking_data: 盘点单更新数据
            updated_by: 更新人ID

        Returns:
            StocktakingResponse: 更新后的盘点单信息

        Raises:
            NotFoundError: 盘点单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点单
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            # 检查盘点单状态
            if stocktaking.status not in ['draft']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能修改")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新盘点单字段
            if stocktaking_data.warehouse_id is not None:
                stocktaking.warehouse_id = stocktaking_data.warehouse_id
            if (
                stocktaking_data.warehouse_id is not None
                or stocktaking_data.warehouse_name is not None
                or not str(stocktaking.warehouse_name or "").strip()
            ):
                stocktaking.warehouse_name = await _resolve_warehouse_name_by_id(
                    tenant_id,
                    stocktaking.warehouse_id,
                    stocktaking_data.warehouse_name
                    if stocktaking_data.warehouse_name is not None
                    else stocktaking.warehouse_name,
                )
            if stocktaking_data.stocktaking_date is not None:
                stocktaking.stocktaking_date = stocktaking_data.stocktaking_date
            if stocktaking_data.stocktaking_type is not None:
                stocktaking.stocktaking_type = stocktaking_data.stocktaking_type
            if stocktaking_data.line_granularity is not None:
                stocktaking.line_granularity = stocktaking_data.line_granularity
            if stocktaking_data.include_zero_stock is not None:
                stocktaking.include_zero_stock = stocktaking_data.include_zero_stock
            if stocktaking_data.remarks is not None:
                stocktaking.remarks = stocktaking_data.remarks

            stocktaking.updated_by = updated_by
            stocktaking.updated_by_name = user_info["name"]

            await stocktaking.save()

            return StocktakingResponse.model_validate(stocktaking)

    async def start_stocktaking(
        self,
        tenant_id: int,
        stocktaking_id: int,
        started_by: int,
        start_request: Optional[StartStocktakingRequest] = None,
    ) -> StocktakingResponse:
        """
        开始盘点（将状态从draft改为in_progress）

        全盘且无明细时自动快照仓库账面库存生成盘点行。
        """
        # 0. 检查节点是否启用
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "stocktaking")
        if not is_enabled:
            raise BusinessLogicError("盘点单节点未启用，无法开始盘点")

        async with in_transaction():
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            if stocktaking.status != 'draft':
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能开始盘点")

            existing_count = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).count()

            if start_request and existing_count == 0:
                if start_request.line_granularity is not None:
                    stocktaking.line_granularity = start_request.line_granularity
                if start_request.include_zero_stock is not None:
                    stocktaking.include_zero_stock = start_request.include_zero_stock

            if stocktaking.stocktaking_type == "full" and existing_count == 0:
                from apps.kuaizhizao.services.stocktaking_inventory_snapshot import build_inventory_snapshot

                snapshot_lines = await build_inventory_snapshot(
                    tenant_id=tenant_id,
                    warehouse_id=stocktaking.warehouse_id,
                    granularity=stocktaking.line_granularity or "batch",
                    include_zero_stock=bool(stocktaking.include_zero_stock),
                )
                if not snapshot_lines:
                    raise ValidationError("该仓库无可盘点库存，无法开始全盘")

                bulk_items = [
                    StocktakingItemCreate(
                        stocktaking_id=stocktaking_id,
                        material_id=line.material_id,
                        material_code=line.material_code,
                        material_name=line.material_name,
                        warehouse_id=line.warehouse_id,
                        location_code=line.location_code,
                        batch_no=line.batch_no,
                        book_quantity=line.book_quantity,
                        unit_price=line.unit_price,
                    )
                    for line in snapshot_lines
                ]
                await self._create_stocktaking_items_internal(
                    tenant_id=tenant_id,
                    stocktaking=stocktaking,
                    items=bulk_items,
                    created_by=started_by,
                )
                stocktaking.total_items = await StocktakingItem.filter(
                    stocktaking_id=stocktaking_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).count()

            user_info = await self.get_user_info(started_by)

            stocktaking.status = 'in_progress'
            stocktaking.updated_by = started_by
            stocktaking.updated_by_name = user_info["name"]

            await stocktaking.save()

            return StocktakingResponse.model_validate(stocktaking)

    async def create_stocktaking_item(
        self,
        tenant_id: int,
        stocktaking_id: int,
        item_data: StocktakingItemCreate,
        created_by: int
    ) -> StocktakingItemResponse:
        """
        创建盘点明细

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
            item_data: 盘点明细创建数据
            created_by: 创建人ID

        Returns:
            StocktakingItemResponse: 创建的盘点明细信息

        Raises:
            NotFoundError: 盘点单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 检查盘点单是否存在
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            # 检查盘点单状态
            if stocktaking.status not in ['draft', 'in_progress']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能添加明细")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            item = await self._create_single_item_record(
                tenant_id=tenant_id,
                stocktaking=stocktaking,
                item_data=item_data,
                created_by=created_by,
                user_name=user_info["name"],
            )

            # 更新盘点单的物料总数
            stocktaking.total_items = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).count()

            await stocktaking.save()

            return StocktakingItemResponse.model_validate(item)

    async def update_stocktaking_item(
        self,
        tenant_id: int,
        item_id: int,
        item_data: StocktakingItemUpdate,
        updated_by: int
    ) -> StocktakingItemResponse:
        """
        更新盘点明细（主要用于更新实际数量）

        Args:
            tenant_id: 组织ID
            item_id: 盘点明细ID
            item_data: 盘点明细更新数据
            updated_by: 更新人ID

        Returns:
            StocktakingItemResponse: 更新后的盘点明细信息

        Raises:
            NotFoundError: 盘点明细不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点明细
            item = await StocktakingItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not item:
                raise NotFoundError(f"盘点明细不存在: {item_id}")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            if item_data.actual_quantity is not None:
                item.actual_quantity = item_data.actual_quantity
                # 重新计算差异数量
                item.difference_quantity = item.actual_quantity - item.book_quantity
                # 重新计算差异金额
                item.difference_amount = item.difference_quantity * item.unit_price
            if item_data.remarks is not None:
                item.remarks = item_data.remarks

            item.updated_by = updated_by
            item.updated_by_name = user_info["name"]

            await item.save()

            # 更新盘点单统计信息
            await self._update_stocktaking_statistics(tenant_id, item.stocktaking_id)

            return StocktakingItemResponse.model_validate(item)

    async def list_stocktakings(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        warehouse_id: Optional[int] = None,
        status: Optional[str] = None,
        stocktaking_type: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        stocktaking_date_start: Optional[str] = None,
        stocktaking_date_end: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> StocktakingListResponse:
        """
        获取库存盘点单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            warehouse_id: 仓库ID（可选）
            status: 状态（可选）
            stocktaking_date_start: 盘点开始日期（可选）
            stocktaking_date_end: 盘点结束日期（可选）

        Returns:
            List[StocktakingListResponse]: 盘点单列表
        """
        query = Stocktaking.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        from apps.kuaizhizao.services.equipment_list_core import pick_search_keyword
        from apps.kuaizhizao.services.warehouse_list_core import (
            STOCKTAKING_KEYWORD_FIELDS,
            STOCKTAKING_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if status:
            query = query.filter(status=status)
        if stocktaking_type:
            query = query.filter(stocktaking_type=stocktaking_type)

        merged_keyword = pick_search_keyword(keyword, search) or (code.strip() if code and code.strip() else None)
        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=merged_keyword,
            order_by=order_by,
            allowed_fields=STOCKTAKING_SORTABLE_FIELDS,
            default_order="-updated_at",
            keyword_fields=STOCKTAKING_KEYWORD_FIELDS,
            doc_date_field="stocktaking_date",
            doc_start_date=stocktaking_date_start,
            doc_end_date=stocktaking_date_end,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )

        total = await query.count()
        stocktakings = await query.order_by(order_clause).offset(skip).limit(limit)
        await self._fill_missing_warehouse_names(tenant_id, list(stocktakings))

        from apps.kuaizhizao.services.document_lifecycle_service import get_stocktaking_lifecycle

        items: list[StocktakingResponse] = []
        for stocktaking in stocktakings:
            resp = StocktakingResponse.model_validate(stocktaking)
            resp.lifecycle = get_stocktaking_lifecycle(stocktaking, milestones=[])
            items.append(resp)
        return StocktakingListResponse(items=items, total=total)

    async def add_stocktaking_items(
        self,
        tenant_id: int,
        stocktaking_id: int,
        items: List[StocktakingItemCreate],
        created_by: int
    ) -> List[StocktakingItemResponse]:
        """批量添加盘点明细"""
        async with in_transaction():
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            if stocktaking.status not in ['draft', 'in_progress']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能添加明细")

            created_items = await self._create_stocktaking_items_internal(
                tenant_id=tenant_id,
                stocktaking=stocktaking,
                items=items,
                created_by=created_by,
            )

            stocktaking.total_items = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).count()
            await stocktaking.save()

            return [StocktakingItemResponse.model_validate(item) for item in created_items]

    async def execute_stocktaking_item(
        self,
        tenant_id: int,
        item_id: int,
        actual_quantity: Decimal,
        counted_by: int,
        remarks: Optional[str] = None
    ) -> StocktakingItemResponse:
        """
        执行盘点明细（更新实际数量）

        Args:
            tenant_id: 组织ID
            item_id: 盘点明细ID
            actual_quantity: 实际数量
            counted_by: 盘点人ID
            remarks: 备注（可选）

        Returns:
            StocktakingItemResponse: 更新后的盘点明细信息

        Raises:
            NotFoundError: 盘点明细不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点明细
            item = await StocktakingItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not item:
                raise NotFoundError(f"盘点明细不存在: {item_id}")

            # 检查盘点单状态
            stocktaking = await Stocktaking.get_or_none(
                id=item.stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {item.stocktaking_id}")

            if stocktaking.status not in ['draft', 'in_progress']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能执行盘点")

            # 获取盘点人信息
            user_info = await self.get_user_info(counted_by)

            # 计算差异
            difference_quantity = actual_quantity - item.book_quantity
            difference_amount = difference_quantity * item.unit_price

            # 更新盘点明细
            item.actual_quantity = actual_quantity
            item.difference_quantity = difference_quantity
            item.difference_amount = difference_amount
            item.counted_by = counted_by
            item.counted_by_name = user_info["name"]
            item.counted_at = datetime.now()
            item.status = "counted"
            if remarks:
                item.remarks = remarks
            item.updated_by = counted_by
            item.updated_by_name = user_info["name"]

            await item.save()

            # 更新盘点单统计信息
            await self._update_stocktaking_statistics(tenant_id, item.stocktaking_id)

            return StocktakingItemResponse.model_validate(item)

    async def adjust_stocktaking_differences(
        self,
        tenant_id: int,
        stocktaking_id: int,
        adjusted_by: int
    ) -> StocktakingResponse:
        """处理盘点差异（调整库存），兼容旧接口，委托 complete_stocktaking"""
        return await self.complete_stocktaking(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            completed_by=adjusted_by,
        )

    async def complete_stocktaking(
        self,
        tenant_id: int,
        stocktaking_id: int,
        completed_by: int,
    ) -> StocktakingResponse:
        """完成盘点：校验全部已盘点，有差异则调库存，无差异直接结案"""
        async with in_transaction():
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            if stocktaking.status != 'in_progress':
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能完成盘点")

            all_items = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )

            if not all_items:
                raise ValidationError("盘点单无明细，不能完成盘点")

            pending = [i for i in all_items if i.status != "counted"]
            if pending:
                raise ValidationError(f"尚有 {len(pending)} 条明细未盘点，请先录入实盘数量")

            diff_items = [i for i in all_items if i.difference_quantity != Decimal("0")]

            from apps.kuaizhizao.services.inventory_service import InventoryService

            for item in diff_items:
                await InventoryService.adjust_inventory(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=item.actual_quantity,
                    warehouse_id=item.warehouse_id,
                    batch_no=item.batch_no,
                    reason="stocktaking",
                )

            try:
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                cost_svc = InventoryCostService()
                for item in diff_items:
                    if Decimal(str(item.difference_quantity or 0)) <= 0:
                        continue
                    await cost_svc.on_stocktaking_difference_adjusted(
                        tenant_id,
                        material_id=int(item.material_id),
                        difference_quantity=item.difference_quantity,
                        unit_price=item.unit_price,
                    )
            except Exception as cost_e:
                import logging
                logging.getLogger(__name__).warning("盘点差异成本回写失败: %s", cost_e)

            for item in all_items:
                item.status = "adjusted"
                await item.save()

            user_info = await self.get_user_info(completed_by)

            stocktaking.status = "completed"
            stocktaking.completed_by = completed_by
            stocktaking.completed_by_name = user_info["name"]
            stocktaking.completed_at = datetime.now()
            stocktaking.updated_by = completed_by
            stocktaking.updated_by_name = user_info["name"]

            await stocktaking.save()

            return StocktakingResponse.model_validate(stocktaking)

    async def withdraw_stocktaking(
        self,
        tenant_id: int,
        stocktaking_id: int,
        withdrawn_by: int,
    ) -> StocktakingResponse:
        """
        撤回盘点（盘点中 -> 草稿）。

        未录入实盘数量时可撤回并清空明细，以便删除误开始的盘点单。
        """
        async with in_transaction():
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")
            if stocktaking.status != "in_progress":
                raise BusinessLogicError("只有盘点中状态的盘点单才能撤回")

            counted = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status__in=["counted", "adjusted"],
            ).count()
            if counted > 0:
                raise BusinessLogicError("已有盘点录入，不能撤回")

            now = datetime.now()
            await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).update(deleted_at=now)

            user_info = await self.get_user_info(withdrawn_by)
            stocktaking.status = "draft"
            stocktaking.total_items = 0
            stocktaking.counted_items = 0
            stocktaking.total_differences = 0
            stocktaking.total_difference_amount = Decimal("0")
            stocktaking.updated_by = withdrawn_by
            stocktaking.updated_by_name = user_info["name"]
            await stocktaking.save()

            return StocktakingResponse.model_validate(stocktaking)

    async def _resolve_book_quantity(
        self,
        tenant_id: int,
        material_id: int,
        warehouse_id: int,
        batch_no: Optional[str],
        book_quantity: Optional[Decimal],
    ) -> Decimal:
        if book_quantity is not None:
            return book_quantity
        from apps.kuaizhizao.services.inventory_service import InventoryService
        return await InventoryService.get_quantity(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            batch_no=batch_no,
        ) or Decimal("0")

    async def _create_single_item_record(
        self,
        tenant_id: int,
        stocktaking: Stocktaking,
        item_data: StocktakingItemCreate,
        created_by: int,
        user_name: str,
    ) -> StocktakingItem:
        warehouse_id = item_data.warehouse_id or stocktaking.warehouse_id
        book_quantity = await self._resolve_book_quantity(
            tenant_id=tenant_id,
            material_id=item_data.material_id,
            warehouse_id=warehouse_id,
            batch_no=item_data.batch_no,
            book_quantity=item_data.book_quantity,
        )
        return await StocktakingItem.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            stocktaking_id=stocktaking.id,
            material_id=item_data.material_id,
            material_code=item_data.material_code,
            material_name=item_data.material_name,
            warehouse_id=warehouse_id,
            location_id=item_data.location_id,
            location_code=item_data.location_code,
            batch_no=item_data.batch_no,
            book_quantity=book_quantity,
            actual_quantity=item_data.actual_quantity,
            difference_quantity=Decimal("0"),
            unit_price=item_data.unit_price or Decimal("0"),
            difference_amount=Decimal("0"),
            status="pending",
            remarks=item_data.remarks,
            created_by=created_by,
            created_by_name=user_name,
            updated_by=created_by,
            updated_by_name=user_name,
        )

    async def _create_stocktaking_items_internal(
        self,
        tenant_id: int,
        stocktaking: Stocktaking,
        items: List[StocktakingItemCreate],
        created_by: int,
    ) -> List[StocktakingItem]:
        user_info = await self.get_user_info(created_by)
        created_items: List[StocktakingItem] = []
        for item_data in items:
            item_data.stocktaking_id = stocktaking.id
            created_items.append(
                await self._create_single_item_record(
                    tenant_id=tenant_id,
                    stocktaking=stocktaking,
                    item_data=item_data,
                    created_by=created_by,
                    user_name=user_info["name"],
                )
            )
        return created_items

    async def _update_stocktaking_statistics(
        self,
        tenant_id: int,
        stocktaking_id: int
    ) -> None:
        """
        更新盘点单统计信息
        """
        # 获取所有明细
        items = await StocktakingItem.filter(
            stocktaking_id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 统计信息
        total_items = len(items)
        counted_items = sum(1 for item in items if item.status == "counted")
        total_differences = sum(1 for item in items if item.difference_quantity != Decimal("0"))
        total_difference_amount = sum(item.difference_amount for item in items)

        # 更新盘点单
        stocktaking = await Stocktaking.get_or_none(
            id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if stocktaking:
            stocktaking.total_items = total_items
            stocktaking.counted_items = counted_items
            stocktaking.total_differences = total_differences
            stocktaking.total_difference_amount = total_difference_amount

            # 如果所有明细都已盘点，更新状态为in_progress
            if counted_items == total_items and total_items > 0:
                if stocktaking.status == "draft":
                    stocktaking.status = "in_progress"

            await stocktaking.save()

