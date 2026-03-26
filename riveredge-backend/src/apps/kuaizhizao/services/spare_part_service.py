"""
备品备件业务服务模块

处理备件出入库、库存预警以及与维修保养流程的联动。

Author: Antigravity (RiverEdge Agent)
Date: 2026-03-26
"""

from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from apps.kuaizhizao.models.spare_part import SparePart, SparePartInventory, SparePartStockRecord
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SparePartService:
    """
    备品备件服务类
    """
    async def adjust_stock(
        self,
        tenant_id: int,
        spare_part_id: int,
        quantity: int,
        operation_type: str,
        warehouse_location: str = "默认仓库",
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
            record_no=f"STK-{datetime.now().strftime('%Y%m%d%06d')}",
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

    async def get_safety_stock_alerts(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        获取库存低于安全库存的备件列表
        """
        # 这里需要做聚合查询
        # 为了简化演示，使用内存过滤或原生 SQL
        all_parts = await SparePart.filter(tenant_id=tenant_id, is_active=True).all()
        alerts = []
        for part in all_parts:
            # 简单累计该租户下所有库位的此备件库存
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
