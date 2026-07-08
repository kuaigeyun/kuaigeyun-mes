"""
备品备件业务服务模块

处理备件出入库、库存预警以及与维修保养流程的联动。

Author: Antigravity (RiverEdge Agent)
Date: 2026-03-26
"""

from typing import List, Optional, Dict, Any
from datetime import datetime

from tortoise.expressions import Q

from apps.kuaizhizao.models.spare_part import SparePart, SparePartInventory, SparePartStockRecord
from apps.kuaizhizao.schemas.equipment_extra import SparePartCreate, SparePartUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SparePartService:
    """
    备品备件服务类
    """

    async def list_spare_parts(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[SparePart], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            SPARE_PART_MASTER_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        qs = SparePart.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        qs = apply_equipment_keyword_filter(
            qs,
            pick_search_keyword(keyword, search),
            ["part_no", "part_name", "category", "brand"],
        )
        qs = apply_equipment_created_date_range(
            qs,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        qs = apply_equipment_updated_date_range(
            qs,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )
        total = await qs.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            SPARE_PART_MASTER_SORTABLE_FIELDS,
            "-updated_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def get_spare_part(self, tenant_id: int, spare_part_id: int) -> SparePart:
        part = await SparePart.filter(
            tenant_id=tenant_id,
            id=spare_part_id,
            deleted_at__isnull=True,
        ).first()
        if not part:
            raise NotFoundError(f"备件不存在: {spare_part_id}")
        return part

    async def create_spare_part(self, tenant_id: int, data: SparePartCreate) -> SparePart:
        existing = await SparePart.filter(
            tenant_id=tenant_id,
            part_no=data.part_no,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise ValidationError(f"备件编号已存在: {data.part_no}")
        return await SparePart.create(tenant_id=tenant_id, **data.model_dump())

    async def update_spare_part(
        self,
        tenant_id: int,
        spare_part_id: int,
        data: SparePartUpdate,
    ) -> SparePart:
        part = await self.get_spare_part(tenant_id, spare_part_id)
        update_data = data.model_dump(exclude_unset=True)
        if "part_no" in update_data and update_data["part_no"] != part.part_no:
            dup = await SparePart.filter(
                tenant_id=tenant_id,
                part_no=update_data["part_no"],
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"备件编号已存在: {update_data['part_no']}")
        for k, v in update_data.items():
            setattr(part, k, v)
        await part.save()
        return part

    async def delete_spare_part(self, tenant_id: int, spare_part_id: int) -> None:
        part = await self.get_spare_part(tenant_id, spare_part_id)
        part.deleted_at = datetime.now()
        part.is_active = False
        await part.save()

    async def adjust_stock(
        self,
        tenant_id: int,
        spare_part_id: int,
        quantity: int,
        operation_type: str,
        warehouse_location: Optional[str] = None,
        rel_type: Optional[str] = None,
        rel_id: Optional[int] = None,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        remark: Optional[str] = None
    ) -> SparePartInventory:
        """
        调整备件库存并记录流水
        """
        spare_part = await SparePart.filter(id=spare_part_id, tenant_id=tenant_id).first()
        if not spare_part:
            raise NotFoundError(f"备件不存在: {spare_part_id}")
        warehouse_location = str(warehouse_location or "").strip()
        if not warehouse_location:
            raise ValidationError("仓库位置不能为空，请传入实际仓库/库位名称")

        inventory, created = await SparePartInventory.get_or_create(
            tenant_id=tenant_id,
            spare_part_id=spare_part_id,
            warehouse_location=warehouse_location,
            defaults={"spare_part_uuid": spare_part.uuid}
        )

        old_quantity = inventory.stock_quantity
        new_quantity = old_quantity + quantity
        if new_quantity < 0:
            raise ValidationError(f"库存不足，当前库存: {old_quantity}")

        inventory.stock_quantity = new_quantity
        await inventory.save()

        # 记录流水
        await SparePartStockRecord.create(
            tenant_id=tenant_id,
            record_no=f"STK-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            spare_part_id=spare_part_id,
            spare_part_uuid=spare_part.uuid,
            operation_type=operation_type,
            quantity=quantity,
            after_quantity=new_quantity,
            rel_type=rel_type,
            rel_id=rel_id,
            operator_id=operator_id,
            operator_name=operator_name,
            remark=remark
        )

        return inventory

    async def apply_parts_usage(
        self,
        tenant_id: int,
        parts_data: Any,
        *,
        rel_type: str,
        rel_id: int,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> None:
        """从维修/保养 JSON 备件列表出库。"""
        if not parts_data:
            return
        items = parts_data if isinstance(parts_data, list) else parts_data.get("items") if isinstance(parts_data, dict) else []
        if not isinstance(items, list):
            return
        for item in items:
            if not isinstance(item, dict):
                continue
            part_id = item.get("spare_part_id") or item.get("part_id")
            qty = item.get("quantity") or item.get("qty")
            location = item.get("warehouse_location") or item.get("location") or "默认库位"
            if not part_id or not qty:
                continue
            await self.adjust_stock(
                tenant_id=tenant_id,
                spare_part_id=int(part_id),
                quantity=-abs(int(qty)),
                operation_type="出库",
                warehouse_location=str(location),
                rel_type=rel_type,
                rel_id=rel_id,
                operator_id=operator_id,
                operator_name=operator_name,
                remark=item.get("remark"),
            )

    async def get_safety_stock_alerts(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        获取库存低于安全库存的备件列表
        """
        all_parts = await SparePart.filter(tenant_id=tenant_id, is_active=True, deleted_at__isnull=True).all()
        alerts = []
        for part in all_parts:
            total_stock = await SparePartInventory.filter(tenant_id=tenant_id, spare_part_id=part.id).all()
            total_qty = sum([inv.stock_quantity for inv in total_stock])
            if total_qty < part.safety_stock:
                alerts.append({
                    "part_no": part.part_no,
                    "part_name": part.part_name,
                    "current_stock": total_qty,
                    "safety_stock": part.safety_stock
                })
        return alerts
