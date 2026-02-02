"""
物料倒冲业务服务模块

提供报工时的物料自动消耗（倒冲）逻辑，支持从线边仓按FIFO扣减库存。

Author: RiverEdge Team
Date: 2026-02-02
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.backflush_record import BackflushRecord
from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.master_data.models.warehouse import Warehouse
from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class BackflushService(AppBaseService[BackflushRecord]):
    """
    物料倒冲服务类

    处理报工触发的物料自动消耗，从线边仓按FIFO扣减库存。
    """

    def __init__(self):
        super().__init__(BackflushRecord)

    async def calculate_consumption(
        self,
        tenant_id: int,
        product_id: int,
        report_quantity: float
    ) -> List[Dict[str, Any]]:
        """
        根据BOM计算物料消耗量

        Args:
            tenant_id: 组织ID
            product_id: 产品（成品）物料ID
            report_quantity: 报工数量

        Returns:
            物料消耗列表，每项包含 component_id, component_code, component_name,
            bom_quantity, required_quantity, unit
        """
        try:
            requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=product_id,
                required_quantity=report_quantity,
                only_approved=True
            )
        except NotFoundError:
            logger.debug(f"产品 {product_id} 无BOM或BOM未审核，跳过倒冲")
            return []

        consumption_list = []
        for req in requirements:
            consumption_list.append({
                "component_id": req.component_id,
                "component_code": req.component_code,
                "component_name": req.component_name,
                "component_type": req.component_type,
                "bom_quantity": float(req.gross_requirement) / report_quantity if report_quantity else 0,
                "required_quantity": float(req.gross_requirement),
                "unit": req.unit or "件",
            })
        return consumption_list

    async def _get_line_side_warehouses_for_work_order(
        self,
        tenant_id: int,
        work_order: WorkOrder
    ) -> List[Warehouse]:
        """
        获取工单关联车间对应的线边仓列表

        优先匹配 work_center_id，其次 workshop_id。
        """
        query = Warehouse.filter(
            tenant_id=tenant_id,
            warehouse_type="line_side",
            deleted_at__isnull=True
        )
        # 优先匹配工作中心
        if work_order.work_center_id:
            line_side_whs = await query.filter(
                work_center_id=work_order.work_center_id
            ).all()
            if line_side_whs:
                return line_side_whs
        # 其次匹配车间
        if work_order.workshop_id:
            return await query.filter(
                workshop_id=work_order.workshop_id
            ).all()
        # 无关联时返回所有线边仓
        return await query.all()

    async def auto_pick_batches(
        self,
        tenant_id: int,
        material_id: int,
        warehouse_ids: List[int],
        required_quantity: Decimal,
        work_order_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        按FIFO自动选择批次

        优先从指定工单预留的库存中选择，否则按 production_date ASC, created_at ASC 选择。

        Returns:
            批次分配列表，每项包含 inventory_id, warehouse_id, warehouse_name,
            batch_no, pick_quantity, material_code, material_name, material_unit
        """
        if not warehouse_ids or required_quantity <= 0:
            return []

        # 查询可用库存：status=available 且 (work_order_id 匹配或为空)
        pick_list = []
        remaining = required_quantity

        # 先尝试工单预留的库存
        if work_order_id:
            reserved_inv = await LineSideInventory.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id__in=warehouse_ids,
                work_order_id=work_order_id,
                status="available",
                deleted_at__isnull=True
            ).order_by("production_date", "created_at").all()

            for inv in reserved_inv:
                if remaining <= 0:
                    break
                available = inv.quantity - inv.reserved_quantity
                if available <= 0:
                    continue
                pick_qty = min(remaining, available)
                pick_list.append({
                    "inventory_id": inv.id,
                    "warehouse_id": inv.warehouse_id,
                    "warehouse_name": inv.warehouse_name,
                    "batch_no": inv.batch_no,
                    "pick_quantity": pick_qty,
                    "material_code": inv.material_code,
                    "material_name": inv.material_name,
                    "material_unit": inv.material_unit or "件",
                })
                remaining -= pick_qty

                # 再从非预留的可用库存中选择（FIFO）
        if remaining > 0:
            available_inv = await LineSideInventory.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id__in=warehouse_ids,
                status="available",
                work_order_id__isnull=True,
                deleted_at__isnull=True
            ).order_by("production_date", "created_at").all()

            for inv in available_inv:
                if remaining <= 0:
                    break
                available = inv.quantity - inv.reserved_quantity
                if available <= 0:
                    continue
                pick_qty = min(remaining, available)
                pick_list.append({
                    "inventory_id": inv.id,
                    "warehouse_id": inv.warehouse_id,
                    "warehouse_name": inv.warehouse_name,
                    "batch_no": inv.batch_no,
                    "pick_quantity": pick_qty,
                    "material_code": inv.material_code,
                    "material_name": inv.material_name,
                    "material_unit": inv.material_unit or "件",
                })
                remaining -= pick_qty

        # 若预留库存不足，再查所有可用库存（含其他工单预留的，按FIFO）
        if remaining > 0:
            all_inv = await LineSideInventory.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id__in=warehouse_ids,
                status="available",
                deleted_at__isnull=True
            ).order_by("production_date", "created_at").all()

            for inv in all_inv:
                if remaining <= 0:
                    break
                available = inv.quantity - inv.reserved_quantity
                if available <= 0:
                    continue
                # 跳过已在 pick_list 中的
                if any(p["inventory_id"] == inv.id for p in pick_list):
                    continue
                pick_qty = min(remaining, available)
                pick_list.append({
                    "inventory_id": inv.id,
                    "warehouse_id": inv.warehouse_id,
                    "warehouse_name": inv.warehouse_name,
                    "batch_no": inv.batch_no,
                    "pick_quantity": pick_qty,
                    "material_code": inv.material_code,
                    "material_name": inv.material_name,
                    "material_unit": inv.material_unit or "件",
                })
                remaining -= pick_qty

        return pick_list

    async def backflush_materials(
        self,
        tenant_id: int,
        work_order_id: int,
        report_id: int,
        report_quantity: float,
        operation_id: Optional[int] = None,
        operation_code: Optional[str] = None,
        processed_by: Optional[int] = None
    ) -> List[BackflushRecord]:
        """
        根据报工触发物料倒冲

        流程：
        1. 获取工单及产品BOM
        2. 计算物料消耗量
        3. 获取工单关联的线边仓
        4. 按FIFO选择批次并扣减库存
        5. 创建倒冲记录

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            report_id: 报工记录ID
            report_quantity: 报工数量
            operation_id: 工序单ID（可选）
            operation_code: 工序编码（可选）
            processed_by: 处理人ID（可选）

        Returns:
            创建的倒冲记录列表
        """
        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        consumption_list = await self.calculate_consumption(
            tenant_id=tenant_id,
            product_id=work_order.product_id,
            report_quantity=report_quantity
        )
        if not consumption_list:
            logger.info(f"工单 {work_order.code} 报工无BOM物料消耗，跳过倒冲")
            return []

        line_side_warehouses = await self._get_line_side_warehouses_for_work_order(
            tenant_id=tenant_id,
            work_order=work_order
        )
        if not line_side_warehouses:
            logger.warning(f"工单 {work_order.code} 未关联线边仓，跳过倒冲")
            return []

        warehouse_ids = [w.id for w in line_side_warehouses]
        warehouse_map = {w.id: w for w in line_side_warehouses}

        records = []
        async with in_transaction():
            for cons in consumption_list:
                required = Decimal(str(cons["required_quantity"]))
                pick_list = await self.auto_pick_batches(
                    tenant_id=tenant_id,
                    material_id=cons["component_id"],
                    warehouse_ids=warehouse_ids,
                    required_quantity=required,
                    work_order_id=work_order_id
                )

                total_picked = sum(p["pick_quantity"] for p in pick_list)
                if total_picked < required:
                    # 库存不足，创建失败记录
                    record = await BackflushRecord.create(
                        tenant_id=tenant_id,
                        uuid=self._generate_uuid(),
                        work_order_id=work_order_id,
                        work_order_code=work_order.code,
                        operation_id=operation_id,
                        operation_code=operation_code or "",
                        report_id=report_id,
                        report_quantity=Decimal(str(report_quantity)),
                        material_id=cons["component_id"],
                        material_code=cons["component_code"],
                        material_name=cons["component_name"],
                        material_unit=cons.get("unit") or "件",
                        batch_no=None,
                        warehouse_id=warehouse_ids[0] if warehouse_ids else 0,
                        warehouse_name=warehouse_map[warehouse_ids[0]].name if warehouse_ids and warehouse_ids[0] in warehouse_map else "",
                        warehouse_type="line_side",
                        bom_quantity=Decimal(str(cons["bom_quantity"])),
                        backflush_quantity=required,
                        status="failed",
                        error_message=f"线边仓库存不足，需 {required}，可用 {total_picked}",
                        processed_at=datetime.utcnow(),
                        processed_by=processed_by,
                    )
                    records.append(record)
                    logger.warning(
                        f"倒冲失败：物料 {cons['component_code']} 库存不足，需 {required}，可用 {total_picked}"
                    )
                    continue

                # 扣减库存并创建成功记录
                for pick in pick_list:
                    inv = await LineSideInventory.get(id=pick["inventory_id"])
                    inv.quantity = inv.quantity - pick["pick_quantity"]
                    if inv.quantity <= 0:
                        inv.status = "consumed"
                    await inv.save()

                    wh = warehouse_map.get(pick["warehouse_id"])
                    record = await BackflushRecord.create(
                        tenant_id=tenant_id,
                        uuid=self._generate_uuid(),
                        work_order_id=work_order_id,
                        work_order_code=work_order.code,
                        operation_id=operation_id,
                        operation_code=operation_code or "",
                        report_id=report_id,
                        report_quantity=Decimal(str(report_quantity)),
                        material_id=cons["component_id"],
                        material_code=pick["material_code"],
                        material_name=pick["material_name"],
                        material_unit=pick["material_unit"],
                        batch_no=pick["batch_no"],
                        warehouse_id=pick["warehouse_id"],
                        warehouse_name=pick["warehouse_name"] or (wh.name if wh else ""),
                        warehouse_type="line_side",
                        bom_quantity=Decimal(str(cons["bom_quantity"])),
                        backflush_quantity=pick["pick_quantity"],
                        status="completed",
                        processed_at=datetime.utcnow(),
                        processed_by=processed_by,
                    )
                    records.append(record)

        logger.info(
            f"报工倒冲完成：工单 {work_order.code}，报工数量 {report_quantity}，"
            f"创建 {len(records)} 条倒冲记录"
        )
        return records

    async def retry_failed_backflush(
        self,
        tenant_id: int,
        failed_record_id: int,
        processed_by: Optional[int] = None
    ) -> Optional[BackflushRecord]:
        """
        重试单条失败的倒冲记录

        仅针对该物料从线边仓扣减，不重复处理已成功的其他物料。

        Returns:
            新创建的倒冲记录（成功时），或 None（仍失败时）
        """
        failed = await BackflushRecord.get_or_none(
            id=failed_record_id,
            tenant_id=tenant_id,
            status="failed",
            deleted_at__isnull=True,
        )
        if not failed:
            raise NotFoundError(f"失败的倒冲记录不存在: {failed_record_id}")

        work_order = await WorkOrder.get_or_none(
            id=failed.work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {failed.work_order_id}")

        line_side_warehouses = await self._get_line_side_warehouses_for_work_order(
            tenant_id=tenant_id,
            work_order=work_order
        )
        if not line_side_warehouses:
            raise BusinessLogicError("工单未关联线边仓")

        warehouse_ids = [w.id for w in line_side_warehouses]
        warehouse_map = {w.id: w for w in line_side_warehouses}

        required = failed.backflush_quantity
        pick_list = await self.auto_pick_batches(
            tenant_id=tenant_id,
            material_id=failed.material_id,
            warehouse_ids=warehouse_ids,
            required_quantity=required,
            work_order_id=work_order.id
        )

        total_picked = sum(p["pick_quantity"] for p in pick_list)
        if total_picked < required:
            failed.error_message = f"重试仍失败：库存不足，需 {required}，可用 {total_picked}"
            await failed.save()
            return None

        record = None
        async with in_transaction():
            for pick in pick_list:
                inv = await LineSideInventory.get(id=pick["inventory_id"])
                inv.quantity = inv.quantity - pick["pick_quantity"]
                if inv.quantity <= 0:
                    inv.status = "consumed"
                await inv.save()

                wh = warehouse_map.get(pick["warehouse_id"])
                rec = await BackflushRecord.create(
                    tenant_id=tenant_id,
                    uuid=self._generate_uuid(),
                    work_order_id=failed.work_order_id,
                    work_order_code=failed.work_order_code,
                    operation_id=failed.operation_id,
                    operation_code=failed.operation_code or "",
                    report_id=failed.report_id,
                    report_quantity=failed.report_quantity,
                    material_id=failed.material_id,
                    material_code=pick["material_code"],
                    material_name=pick["material_name"],
                    material_unit=pick["material_unit"],
                    batch_no=pick["batch_no"],
                    warehouse_id=pick["warehouse_id"],
                    warehouse_name=pick["warehouse_name"] or (wh.name if wh else ""),
                    warehouse_type="line_side",
                    bom_quantity=failed.bom_quantity,
                    backflush_quantity=pick["pick_quantity"],
                    status="completed",
                    processed_at=datetime.utcnow(),
                    processed_by=processed_by,
                )
                if record is None:
                    record = rec

            failed.status = "cancelled"
            failed.error_message = "已通过重试完成"
            await failed.save()

            return record

    def _generate_uuid(self) -> str:
        import uuid
        return str(uuid.uuid4())
