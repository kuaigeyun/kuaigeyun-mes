"""
工单批号/序列号追踪服务

追踪模式由物料主数据 batch_managed / serial_managed 驱动；
工单层负责计划值（开单/下达占号）与确认值（完工可改）。
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.master_data.models.material import Material
from apps.master_data.models.material_serial import MaterialSerial
from apps.master_data.services.material_batch_service import MaterialBatchService
from apps.master_data.services.material_serial_service import MaterialSerialService
from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from loguru import logger

if TYPE_CHECKING:
    from apps.kuaizhizao.schemas.work_order import WorkOrderCreate

TRACKING_NONE = "none"
TRACKING_BATCH = "batch"
TRACKING_SERIAL = "serial"
TRACKING_BOTH = "both"


class WorkOrderTrackingService:
    """工单批号/序列号追踪"""

    @staticmethod
    def resolve_tracking_mode(material: Material) -> str:
        batch = bool(getattr(material, "batch_managed", False))
        serial = bool(getattr(material, "serial_managed", False))
        if batch and serial:
            return TRACKING_BOTH
        if serial:
            return TRACKING_SERIAL
        if batch:
            return TRACKING_BATCH
        return TRACKING_NONE

    @staticmethod
    def effective_batch_no(work_order: WorkOrder) -> Optional[str]:
        confirmed = getattr(work_order, "confirmed_batch_no", None)
        if confirmed and str(confirmed).strip():
            return str(confirmed).strip()
        planned = getattr(work_order, "planned_batch_no", None)
        if planned and str(planned).strip():
            return str(planned).strip()
        return None

    @staticmethod
    def effective_serial_no(work_order: WorkOrder) -> Optional[str]:
        confirmed = getattr(work_order, "confirmed_serial_no", None)
        if confirmed and str(confirmed).strip():
            return str(confirmed).strip()
        planned = getattr(work_order, "planned_serial_no", None)
        if planned and str(planned).strip():
            return str(planned).strip()
        return None

    @staticmethod
    def tracking_fields_for_response(work_order: WorkOrder) -> Dict[str, Any]:
        return {
            "tracking_mode": getattr(work_order, "tracking_mode", None) or TRACKING_NONE,
            "planned_batch_no": getattr(work_order, "planned_batch_no", None),
            "confirmed_batch_no": getattr(work_order, "confirmed_batch_no", None),
            "planned_serial_no": getattr(work_order, "planned_serial_no", None),
            "confirmed_serial_no": getattr(work_order, "confirmed_serial_no", None),
            "batch_rule_id": getattr(work_order, "batch_rule_id", None),
            "serial_rule_id": getattr(work_order, "serial_rule_id", None),
            "effective_batch_no": WorkOrderTrackingService.effective_batch_no(work_order),
            "effective_serial_no": WorkOrderTrackingService.effective_serial_no(work_order),
        }

    @staticmethod
    def extract_create_tracking_input(work_order_data: WorkOrderCreate) -> Dict[str, Any]:
        return {
            "enable_production_tracking": getattr(
                work_order_data, "enable_production_tracking", None
            ),
            "tracking_assign_mode": getattr(work_order_data, "tracking_assign_mode", None),
            "planned_batch_no": getattr(work_order_data, "planned_batch_no", None),
            "planned_serial_nos": getattr(work_order_data, "planned_serial_nos", None) or [],
            "batch_rule_id": getattr(work_order_data, "batch_rule_id", None),
            "serial_rule_id": getattr(work_order_data, "serial_rule_id", None),
        }

    @staticmethod
    def validate_create_tracking(
        material: Material,
        quantity: Decimal,
        tracking_input: Dict[str, Any],
    ) -> str:
        """校验开单追踪输入，返回 tracking_mode。"""
        mode = WorkOrderTrackingService.resolve_tracking_mode(material)
        enable = tracking_input.get("enable_production_tracking")
        planned_batch = (tracking_input.get("planned_batch_no") or "").strip() or None
        planned_serial_nos = tracking_input.get("planned_serial_nos") or []
        batch_rule_id = tracking_input.get("batch_rule_id")
        serial_rule_id = tracking_input.get("serial_rule_id")
        has_values = any(
            [
                planned_batch,
                planned_serial_nos,
                batch_rule_id is not None,
                serial_rule_id is not None,
            ]
        )

        if mode == TRACKING_NONE:
            if any([planned_batch, planned_serial_nos, batch_rule_id, serial_rule_id]):
                raise ValidationError("该物料未启用批号/序列号管理，无需填写追踪信息")
            return mode

        if not enable and not has_values:
            return TRACKING_NONE

        assign_mode = (tracking_input.get("tracking_assign_mode") or "").strip() or None
        if assign_mode:
            if assign_mode not in (TRACKING_BATCH, TRACKING_SERIAL, TRACKING_BOTH):
                raise ValidationError("投产方式无效，仅支持 batch、serial、both")
            if assign_mode == TRACKING_BATCH:
                if not material.batch_managed:
                    raise ValidationError("该物料未启用批号管理，不能按批号投产")
                mode = TRACKING_BATCH
            elif assign_mode == TRACKING_SERIAL:
                if not material.serial_managed:
                    raise ValidationError("该物料未启用序列号管理，不能按序列号投产")
                mode = TRACKING_SERIAL
            else:
                if not (material.batch_managed and material.serial_managed):
                    raise ValidationError("该物料未同时启用批号与序列号管理，不能选择批号+序列号")
                mode = TRACKING_BOTH

        if planned_batch and not material.batch_managed:
            raise ValidationError("该物料未启用批号管理，不能指定批号")

        if planned_serial_nos and not material.serial_managed:
            raise ValidationError("该物料未启用序列号管理，不能指定序列号")

        if mode in (TRACKING_SERIAL, TRACKING_BOTH):
            qty_int = int(quantity)
            if Decimal(qty_int) != quantity:
                raise ValidationError("序列号管理物料的计划数量必须为整数")
            if qty_int < 1:
                raise ValidationError("序列号管理物料的计划数量必须大于0")
            if planned_serial_nos:
                if len(planned_serial_nos) != qty_int:
                    raise ValidationError(
                        f"手工序列号数量（{len(planned_serial_nos)}）须与计划数量（{qty_int}）一致"
                    )
                if len(set(planned_serial_nos)) != len(planned_serial_nos):
                    raise ValidationError("手工序列号列表存在重复")

        return mode

    @staticmethod
    async def validate_serial_no_available(
        tenant_id: int,
        serial_no: str,
        *,
        exclude_work_order_id: Optional[int] = None,
    ) -> None:
        sn = (serial_no or "").strip()
        if not sn:
            raise ValidationError("序列号不能为空")
        existing_serial = await MaterialSerial.filter(
            tenant_id=tenant_id,
            serial_no=sn,
            deleted_at__isnull=True,
        ).first()
        if existing_serial:
            raise ValidationError(f"序列号 {sn} 已存在于物料档案")

        for field in ("planned_serial_no", "confirmed_serial_no"):
            filters: Dict[str, Any] = {
                "tenant_id": tenant_id,
                "deleted_at__isnull": True,
                f"{field}": sn,
            }
            if exclude_work_order_id:
                filters["id__not"] = exclude_work_order_id
            row = await WorkOrder.filter(**filters).first()
            if row:
                raise ValidationError(f"序列号 {sn} 已被工单 {row.code} 占用")

    @staticmethod
    async def preview_tracking_numbers(
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        *,
        batch_rule_id: Optional[int] = None,
        serial_rule_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        mode = WorkOrderTrackingService.resolve_tracking_mode(material)
        qty_int = max(1, int(quantity))
        result: Dict[str, Any] = {
            "tracking_mode": mode,
            "planned_batch_no": None,
            "planned_serial_nos": [],
        }
        material_uuid = str(material.uuid)
        if getattr(material, "default_batch_rule_id", None) and not hasattr(material, "default_batch_rule"):
            await material.fetch_related("default_batch_rule")

        if mode in (TRACKING_BATCH, TRACKING_BOTH):
            batch_no = await MaterialBatchService.generate_batch_no(
                tenant_id=tenant_id,
                material_uuid=material_uuid,
                rule_id=batch_rule_id,
                preview=True,
            )
            result["planned_batch_no"] = batch_no

        if mode in (TRACKING_SERIAL, TRACKING_BOTH):
            serials = await MaterialSerialService.generate_serial_no(
                tenant_id=tenant_id,
                material_uuid=material_uuid,
                count=qty_int,
                rule_id=serial_rule_id,
            )
            result["planned_serial_nos"] = serials

        return result

    @staticmethod
    async def allocate_batch_no(
        tenant_id: int,
        material: Material,
        *,
        batch_rule_id: Optional[int] = None,
    ) -> str:
        batch_no = await MaterialBatchService.generate_batch_no(
            tenant_id=tenant_id,
            material_uuid=str(material.uuid),
            rule_id=batch_rule_id,
        )
        if not batch_no:
            raise BusinessLogicError("批号生成失败，请检查批号规则配置")
        return batch_no

    @staticmethod
    async def allocate_serial_nos(
        tenant_id: int,
        material: Material,
        count: int,
        *,
        serial_rule_id: Optional[int] = None,
    ) -> List[str]:
        serials = await MaterialSerialService.generate_serial_no(
            tenant_id=tenant_id,
            material_uuid=str(material.uuid),
            count=count,
            rule_id=serial_rule_id,
        )
        if not serials or len(serials) < count:
            raise BusinessLogicError("序列号生成失败，请检查序列号规则配置")
        return serials

    @staticmethod
    def build_tracking_create_kwargs(
        tracking_mode: str,
        tracking_input: Dict[str, Any],
    ) -> Dict[str, Any]:
        planned_batch = (tracking_input.get("planned_batch_no") or "").strip() or None
        return {
            "tracking_mode": tracking_mode,
            "planned_batch_no": planned_batch,
            "batch_rule_id": tracking_input.get("batch_rule_id"),
            "serial_rule_id": tracking_input.get("serial_rule_id"),
        }

    async def apply_serial_split_after_create(
        self,
        tenant_id: int,
        parent_work_order: WorkOrder,
        material: Material,
        *,
        tracking_input: Dict[str, Any],
        created_by: int,
        created_by_name: str,
        work_order_service: Any,
    ) -> List[WorkOrder]:
        """序列号物料开单后自动拆分为父单 + qty=1 子单。"""
        from datetime import datetime

        qty_int = int(parent_work_order.quantity)
        if qty_int < 1:
            return []

        planned_serial_nos: List[str] = list(tracking_input.get("planned_serial_nos") or [])
        parent_batch = (tracking_input.get("planned_batch_no") or parent_work_order.planned_batch_no or "").strip() or None
        tracking_mode = getattr(parent_work_order, "tracking_mode", TRACKING_SERIAL)

        if not planned_serial_nos and tracking_mode in (TRACKING_SERIAL, TRACKING_BOTH):
            # 开单时仅选手工批号/规则，序列号留待下达占号
            pass
        elif len(planned_serial_nos) < qty_int:
            raise ValidationError("序列号子工单数量与计划数量不一致")

        next_idx = await work_order_service._next_split_child_sequence(
            tenant_id, parent_work_order.id, parent_work_order.code
        )
        children: List[WorkOrder] = []
        for offset in range(qty_int):
            idx = next_idx + offset
            split_code = f"{parent_work_order.code}-{idx:03d}"
            serial_no = planned_serial_nos[offset] if offset < len(planned_serial_nos) else None
            if serial_no:
                await self.validate_serial_no_available(
                    tenant_id, serial_no, exclude_work_order_id=None
                )

            child = await WorkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=split_code,
                name=f"{parent_work_order.name or parent_work_order.code}-序列{idx:03d}",
                parent_work_order_id=parent_work_order.id,
                product_id=parent_work_order.product_id,
                product_code=parent_work_order.product_code,
                product_name=parent_work_order.product_name,
                quantity=Decimal("1"),
                production_mode=parent_work_order.production_mode,
                sales_order_id=parent_work_order.sales_order_id,
                sales_order_code=parent_work_order.sales_order_code,
                sales_order_name=parent_work_order.sales_order_name,
                workshop_id=parent_work_order.workshop_id,
                workshop_name=parent_work_order.workshop_name,
                work_center_id=parent_work_order.work_center_id,
                work_center_name=parent_work_order.work_center_name,
                status=parent_work_order.status,
                priority=parent_work_order.priority,
                planned_start_date=parent_work_order.planned_start_date,
                planned_end_date=parent_work_order.planned_end_date,
                allow_operation_jump=parent_work_order.allow_operation_jump,
                process_route_id=parent_work_order.process_route_id,
                over_report_mode=parent_work_order.over_report_mode,
                over_report_value=parent_work_order.over_report_value,
                variant_attributes=parent_work_order.variant_attributes,
                configurable_selections=parent_work_order.configurable_selections,
                remarks=f"从工单{parent_work_order.code}按序列号自动拆分",
                tracking_mode=tracking_mode,
                planned_batch_no=parent_batch,
                planned_serial_no=serial_no,
                batch_rule_id=parent_work_order.batch_rule_id,
                serial_rule_id=parent_work_order.serial_rule_id,
                created_by=created_by,
                created_by_name=created_by_name,
            )
            children.append(child)

        await work_order_service._provision_split_work_order_operations(
            tenant_id,
            parent_work_order=parent_work_order,
            split_work_orders=children,
            is_follow_up_split=False,
            created_by=created_by,
            created_by_name=created_by_name,
        )

        parent_work_order.status = "split"
        await parent_work_order.save(update_fields=["status", "updated_at"])

        logger.info(
            "工单 %s 按序列号自动拆分为 %s 个子工单",
            parent_work_order.code,
            len(children),
        )
        return children

    async def allocate_on_release(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        material: Material,
    ) -> WorkOrder:
        """下达时占号：计划值为空且配置了规则时生成批号/序列号。"""
        updates: Dict[str, Any] = {}
        mode = getattr(work_order, "tracking_mode", TRACKING_NONE) or TRACKING_NONE

        if mode in (TRACKING_BATCH, TRACKING_BOTH) and not (work_order.planned_batch_no or "").strip():
            batch_no = await self.allocate_batch_no(
                tenant_id,
                material,
                batch_rule_id=work_order.batch_rule_id,
            )
            updates["planned_batch_no"] = batch_no

        if mode in (TRACKING_SERIAL, TRACKING_BOTH) and not (work_order.planned_serial_no or "").strip():
            serials = await self.allocate_serial_nos(
                tenant_id,
                material,
                count=1,
                serial_rule_id=work_order.serial_rule_id,
            )
            await self.validate_serial_no_available(tenant_id, serials[0], exclude_work_order_id=work_order.id)
            updates["planned_serial_no"] = serials[0]

        if updates:
            for k, v in updates.items():
                setattr(work_order, k, v)
            await work_order.save(update_fields=list(updates.keys()) + ["updated_at"])
        return work_order

    async def confirm_tracking(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        material: Material,
        *,
        confirmed_batch_no: Optional[str] = None,
        confirmed_serial_no: Optional[str] = None,
        allow_generate: bool = True,
    ) -> WorkOrder:
        """完工确认追踪号：未传则沿用计划值；可在此按规则补生成。"""
        mode = getattr(work_order, "tracking_mode", TRACKING_NONE) or TRACKING_NONE
        updates: Dict[str, Any] = {}

        batch_val = (confirmed_batch_no or "").strip() or None
        serial_val = (confirmed_serial_no or "").strip() or None

        if mode in (TRACKING_BATCH, TRACKING_BOTH):
            if batch_val:
                updates["confirmed_batch_no"] = batch_val
            elif not self.effective_batch_no(work_order) and allow_generate:
                planned = work_order.planned_batch_no
                if not (planned or "").strip():
                    planned = await self.allocate_batch_no(
                        tenant_id, material, batch_rule_id=work_order.batch_rule_id
                    )
                    updates["planned_batch_no"] = planned
                updates["confirmed_batch_no"] = planned

        if mode in (TRACKING_SERIAL, TRACKING_BOTH):
            if serial_val:
                await self.validate_serial_no_available(
                    tenant_id, serial_val, exclude_work_order_id=work_order.id
                )
                updates["confirmed_serial_no"] = serial_val
            elif not self.effective_serial_no(work_order) and allow_generate:
                planned = work_order.planned_serial_no
                if not (planned or "").strip():
                    serials = await self.allocate_serial_nos(
                        tenant_id, material, count=1, serial_rule_id=work_order.serial_rule_id
                    )
                    planned = serials[0]
                    updates["planned_serial_no"] = planned
                updates["confirmed_serial_no"] = planned

        if updates:
            for k, v in updates.items():
                setattr(work_order, k, v)
            await work_order.save(update_fields=list(updates.keys()) + ["updated_at"])
        return work_order

    async def apply_manual_tracking_update(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        material: Material,
        patch: Dict[str, Any],
    ) -> None:
        """编辑工单时手工维护计划/确认批号与序列号。"""
        mode = getattr(work_order, "tracking_mode", None) or self.resolve_tracking_mode(material)
        if mode == TRACKING_NONE:
            if any((str(v).strip() if v is not None else "") for v in patch.values()):
                raise ValidationError("该物料未启用批号/序列号管理，不能填写追踪信息")
            return

        if work_order.status in ("cancelled", "split"):
            raise ValidationError("已取消或已拆分的工单不能修改批号/序列号")

        batch_fields = ("planned_batch_no", "confirmed_batch_no")
        serial_fields = ("planned_serial_no", "confirmed_serial_no")
        serial_touched = False
        updates: Dict[str, Optional[str]] = {}

        for field, raw in patch.items():
            if field not in batch_fields + serial_fields:
                continue
            normalized = (str(raw).strip() if raw is not None else "") or None
            current = getattr(work_order, field, None)
            current_norm = (str(current).strip() if current is not None else "") or None
            if normalized == current_norm:
                continue
            if field in batch_fields:
                if mode not in (TRACKING_BATCH, TRACKING_BOTH):
                    raise ValidationError("该物料未启用批号管理")
                updates[field] = normalized
            else:
                if mode not in (TRACKING_SERIAL, TRACKING_BOTH):
                    raise ValidationError("该物料未启用序列号管理")
                serial_touched = True
                if normalized:
                    await self.validate_serial_no_available(
                        tenant_id, normalized, exclude_work_order_id=work_order.id
                    )
                updates[field] = normalized

        if serial_touched:
            await self.check_serial_modification_allowed(tenant_id, work_order.id)

        if not updates:
            return

        for key, val in updates.items():
            setattr(work_order, key, val)
        await work_order.save(update_fields=list(updates.keys()) + ["updated_at"])

    async def check_serial_modification_allowed(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> None:
        """序列号修改约束：已入库后禁止修改。"""
        from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt

        receipt = await FinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status__in=["已入库", "completed", "已完成"],
        ).first()
        if receipt:
            raise BusinessLogicError("工单已产生成品入库记录，禁止修改序列号")
