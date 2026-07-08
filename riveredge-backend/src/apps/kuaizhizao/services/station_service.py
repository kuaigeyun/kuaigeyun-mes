"""
工位终端服务：安灯、SOP 确认、工序暂停/恢复/结束
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from apps.kuaizhizao.models.station_andon_call import StationAndonCall
from apps.kuaizhizao.models.station_sop_acknowledgment import StationSopAcknowledgment
from apps.kuaizhizao.models.station_operation_downtime import StationOperationDowntime
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.station import (
    StationAndonCreate,
    StationSopAckCreate,
    OperationPauseRequest,
)
from apps.kuaizhizao.schemas.work_order import WorkOrderOperationResponse
from apps.kuaizhizao.services.work_order_service import WorkOrderService, _max_reportable_quantity_for_op
from apps.kuaizhizao.services.work_order_service import _batch_default_operators_snapshots_by_master_operation_id


DOWNTIME_REASON_LABELS = {
    "material_shortage": "缺料",
    "equipment_fault": "设备故障",
    "tool_change": "换刀/换模",
    "quality_issue": "质量异常",
    "break": "休息",
    "other": "其他",
}


class StationService(WorkOrderService):
    """工位终端专用服务（继承工单服务以复用用户信息等方法）"""

    async def create_andon_call(
        self,
        tenant_id: int,
        data: StationAndonCreate,
        caller_id: int,
        caller_name: str,
    ) -> StationAndonCall:
        valid_types = {"quality", "material", "equipment", "supervisor"}
        if data.call_type not in valid_types:
            raise BusinessLogicError(f"无效的安灯类型: {data.call_type}")

        record = await StationAndonCall.create(
            tenant_id=tenant_id,
            call_type=data.call_type,
            status="open",
            work_order_id=data.work_order_id,
            work_order_code=data.work_order_code,
            operation_id=data.operation_id,
            workstation_id=data.workstation_id,
            workstation_name=data.workstation_name,
            caller_id=caller_id,
            caller_name=caller_name,
            remarks=data.remarks,
        )
        return record

    async def list_open_andon_calls(
        self,
        tenant_id: int,
        workstation_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[StationAndonCall]:
        q = StationAndonCall.filter(tenant_id=tenant_id, status="open", deleted_at__isnull=True)
        if workstation_id is not None:
            q = q.filter(workstation_id=workstation_id)
        return await q.order_by("-created_at").limit(limit).all()

    async def acknowledge_sop(
        self,
        tenant_id: int,
        data: StationSopAckCreate,
        user_id: int,
        user_name: str,
    ) -> StationSopAcknowledgment:
        worker_id = data.worker_id or user_id
        worker_name = data.worker_name or user_name
        existing = await StationSopAcknowledgment.get_or_none(
            tenant_id=tenant_id,
            work_order_id=data.work_order_id,
            operation_id=data.operation_id,
            sop_uuid=data.sop_uuid,
            worker_id=worker_id,
            deleted_at__isnull=True,
        )
        if existing:
            return existing

        return await StationSopAcknowledgment.create(
            tenant_id=tenant_id,
            sop_uuid=data.sop_uuid,
            work_order_id=data.work_order_id,
            operation_id=data.operation_id,
            worker_id=worker_id,
            worker_name=worker_name,
            acknowledged_at=datetime.now(),
        )

    async def check_sop_acknowledged(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        sop_uuid: str,
        worker_id: Optional[int] = None,
    ) -> dict:
        q = StationSopAcknowledgment.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
            sop_uuid=sop_uuid,
            deleted_at__isnull=True,
        )
        if worker_id is not None:
            q = q.filter(worker_id=worker_id)
        record = await q.order_by("-acknowledged_at").first()
        if not record:
            return {"acknowledged": False}
        return {"acknowledged": True, "acknowledged_at": record.acknowledged_at}

    async def _get_operation_or_404(
        self, tenant_id: int, work_order_id: int, operation_id: int
    ) -> WorkOrderOperation:
        op = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            id=operation_id,
            deleted_at__isnull=True,
        )
        if not op:
            raise NotFoundError(f"工单工序不存在: 工单ID={work_order_id}, 工序ID={operation_id}")
        return op

    def _operation_response(self, work_order, work_order_operation) -> WorkOrderOperationResponse:
        op_payload = {
            f: getattr(work_order_operation, f, None)
            for f in WorkOrderOperationResponse.model_fields
            if hasattr(work_order_operation, f)
        }
        op_payload["max_reportable_quantity"] = _max_reportable_quantity_for_op(work_order, work_order_operation)
        return WorkOrderOperationResponse.model_validate(op_payload)

    async def pause_work_order_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        data: OperationPauseRequest,
        operator_id: int,
    ) -> dict:
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            op = await self._get_operation_or_404(tenant_id, work_order_id, operation_id)
            if op.status != "in_progress":
                raise BusinessLogicError(f"只能暂停进行中的工序，当前状态：{op.status}")

            open_dt = await StationOperationDowntime.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                ended_at__isnull=True,
                deleted_at__isnull=True,
            ).first()
            if open_dt:
                raise BusinessLogicError("工序已处于暂停状态")

            user_info = await self.get_user_info(operator_id)
            label = DOWNTIME_REASON_LABELS.get(data.reason_code, data.reason_code)
            record = await StationOperationDowntime.create(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                reason_code=data.reason_code,
                reason_label=label,
                started_at=datetime.now(),
                operator_id=operator_id,
                operator_name=user_info["name"],
                remarks=data.remarks,
            )
            return {"downtime_id": record.id, "paused": True, "reason_code": data.reason_code}

    async def resume_work_order_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        operator_id: int,
    ) -> dict:
        async with in_transaction():
            await self._get_operation_or_404(tenant_id, work_order_id, operation_id)
            open_dt = await StationOperationDowntime.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                ended_at__isnull=True,
                deleted_at__isnull=True,
            ).first()
            if not open_dt:
                raise BusinessLogicError("工序未处于暂停状态")
            open_dt.ended_at = datetime.now()
            await open_dt.save()
            return {"downtime_id": open_dt.id, "paused": False}

    async def complete_work_order_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        completed_by: int,
        remarks: Optional[str] = None,
    ) -> WorkOrderOperationResponse:
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            op = await self._get_operation_or_404(tenant_id, work_order_id, operation_id)
            if op.status not in ("in_progress", "pending"):
                raise BusinessLogicError(f"不能结束当前状态的工序：{op.status}")

            open_dt = await StationOperationDowntime.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                ended_at__isnull=True,
                deleted_at__isnull=True,
            ).first()
            if open_dt:
                open_dt.ended_at = datetime.now()
                await open_dt.save()

            user_info = await self.get_user_info(completed_by)
            if (op.reporting_type or "quantity") == "status":
                from apps.kuaizhizao.services.over_report_rules import status_reporting_target_quantity

                target_qty = status_reporting_target_quantity(work_order, op)
                op.completed_quantity = target_qty
                op.qualified_quantity = target_qty
                op.unqualified_quantity = Decimal("0")
            else:
                plan_qty = Decimal(str(work_order.quantity or 0))
                qualified = Decimal(str(op.qualified_quantity or 0))
                if plan_qty > 0 and qualified < plan_qty:
                    raise BusinessLogicError(
                        f"合格数量（{qualified}）未达计划数量（{plan_qty}），不能结束工序"
                    )
            op.status = "completed"
            op.actual_end_date = datetime.now()
            op.updated_by = completed_by
            op.updated_by_name = user_info["name"]
            if remarks:
                op.remarks = (op.remarks or "") + f"\n[结束] {remarks}"
            await op.save()

            from apps.kuaizhizao.services.reporting_service import ReportingService

            await ReportingService()._update_work_order_progress(tenant_id, work_order_id)

            dmap = await _batch_default_operators_snapshots_by_master_operation_id(
                tenant_id, [op.operation_id]
            )
            op_payload = {
                f: getattr(op, f, None)
                for f in WorkOrderOperationResponse.model_fields
                if hasattr(op, f)
            }
            op_payload["max_reportable_quantity"] = _max_reportable_quantity_for_op(work_order, op)
            op_payload["default_operators"] = dmap.get(op.operation_id, [])
            return WorkOrderOperationResponse.model_validate(op_payload)
