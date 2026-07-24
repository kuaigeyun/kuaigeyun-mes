"""
工位终端服务：安灯联动、SOP 确认、工序暂停/恢复/结束、资质、交接班
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User
from apps.kuaizhizao.models.station_andon_call import StationAndonCall
from apps.kuaizhizao.models.station_sop_acknowledgment import StationSopAcknowledgment
from apps.kuaizhizao.models.station_operation_downtime import StationOperationDowntime
from apps.kuaizhizao.models.station_shift_handover import StationShiftHandover
from apps.kuaizhizao.models.operator_skill import OperatorSkillQualification
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.schemas.station import (
    StationAndonCreate,
    StationSopAckCreate,
    OperationPauseRequest,
    OperatorSkillCreate,
    ShiftHandoverCreate,
    StationDocFileItem,
    StationSopDocument,
    StationSopStep,
    StationOperationDocumentsResponse,
    StationWorkOrderDocumentFlags,
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

ANDON_TYPE_LABELS = {
    "quality": "质量求助",
    "material": "物料求助",
    "equipment": "设备故障",
    "supervisor": "班长呼叫",
}


def _station_file_preview_url(file_uuid: str) -> str:
    return f"/api/v1/core/files/{file_uuid}/preview"


def _attachment_uuids_from_node_data(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        return []
    out: List[str] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            uid = item.get("uuid") or item.get("uid") or item.get("file_uuid")
            if uid and str(uid).strip():
                out.append(str(uid).strip())
    # 保序去重
    seen: set[str] = set()
    uniq: List[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def _sop_flow_to_steps(flow_config: Optional[Dict[str, Any]]) -> List[StationSopStep]:
    """将 SOP 设计页 flow_config 展开为工位有序工步（跳过开始/结束）。"""
    if not isinstance(flow_config, dict):
        return []
    nodes = flow_config.get("nodes") or []
    edges = flow_config.get("edges") or []
    if not isinstance(nodes, list) or not nodes:
        return []
    if not isinstance(edges, list):
        edges = []

    node_by_id = {str(n.get("id")): n for n in nodes if isinstance(n, dict) and n.get("id")}

    def _node_type(n: dict) -> str:
        return str(n.get("type") or (n.get("data") or {}).get("type") or "step")

    def _to_step(n: dict) -> StationSopStep:
        data = n.get("data") if isinstance(n.get("data"), dict) else {}
        title = str(data.get("label") or n.get("id") or "")
        desc = data.get("description")
        key_points = data.get("keyPoints") or data.get("key_points")
        return StationSopStep(
            id=str(n.get("id")),
            type=_node_type(n),
            title=title,
            description=str(desc).strip() if desc else None,
            key_points=str(key_points).strip() if key_points else None,
            attachment_uuids=_attachment_uuids_from_node_data(data.get("attachments")),
        )

    steps: List[StationSopStep] = []
    visited: set[str] = set()

    start = next(
        (
            n
            for n in nodes
            if isinstance(n, dict)
            and (_node_type(n) == "start" or str(n.get("id")) == "start")
        ),
        None,
    )

    def _traverse(node_id: str) -> None:
        if not node_id or node_id in visited:
            return
        visited.add(node_id)
        n = node_by_id.get(node_id)
        if not n:
            return
        nt = _node_type(n)
        if nt not in ("start", "end"):
            steps.append(_to_step(n))
        for e in edges:
            if isinstance(e, dict) and str(e.get("source")) == node_id:
                _traverse(str(e.get("target") or ""))

    if start:
        _traverse(str(start.get("id")))

    # 未从开始可达的工步按原顺序补齐
    for n in nodes:
        if not isinstance(n, dict) or not n.get("id"):
            continue
        nid = str(n.get("id"))
        if nid in visited:
            continue
        if _node_type(n) in ("start", "end"):
            continue
        steps.append(_to_step(n))
        visited.add(nid)

    return steps


def _norm_uuid_list_local(value) -> List[str]:
    if not value or not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _normalize_attachment_list(raw) -> list:
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("files", "items", "attachments", "list"):
            val = raw.get(key)
            if isinstance(val, list):
                return val
        vals = list(raw.values())
        if vals and all(isinstance(v, (dict, str)) for v in vals):
            return vals
    return []


def _attachment_to_doc_item(file, index: int, source: str) -> Optional[StationDocFileItem]:
    if isinstance(file, str):
        uuid = file.strip()
        if not uuid:
            return None
        return StationDocFileItem(
            key=f"{source}-{uuid}",
            name=f"附件{index + 1}",
            file_uuid=uuid,
            url=_station_file_preview_url(uuid),
            source=source,
        )
    if not isinstance(file, dict):
        return None
    uuid = str(
        file.get("uid")
        or file.get("uuid")
        or file.get("file_uuid")
        or file.get("fileUuid")
        or ""
    ).strip()
    name = str(
        file.get("name")
        or file.get("original_name")
        or file.get("originalName")
        or file.get("file_name")
        or file.get("filename")
        or ""
    ).strip()
    url = str(file.get("url") or file.get("download_url") or file.get("downloadUrl") or "").strip()
    if not url and uuid:
        url = _station_file_preview_url(uuid)
    if not url:
        return None
    return StationDocFileItem(
        key=f"{source}-{uuid or name or index}",
        name=name or f"附件{index + 1}",
        file_uuid=uuid or None,
        url=url,
        source=source,
    )


class StationService(WorkOrderService):
    """工位终端专用服务"""

    async def _push_andon_event(self, tenant_id: int, event: str, record: StationAndonCall) -> None:
        try:
            from core.services.websocket.websocket_service import WebSocketService

            await WebSocketService.push_to_tenant(
                tenant_id,
                "andon",
                {
                    "event": event,
                    "andon_id": record.id,
                    "call_type": record.call_type,
                    "status": record.status,
                    "workstation_id": record.workstation_id,
                    "work_order_code": record.work_order_code,
                    "related_doc_type": record.related_doc_type,
                    "related_doc_code": record.related_doc_code,
                },
            )
        except Exception:
            # 推送失败不得阻断主业务；由调用方轮询降级
            pass

    async def _link_equipment_fault(
        self,
        tenant_id: int,
        data: StationAndonCreate,
        caller_id: int,
        caller_name: str,
        andon: StationAndonCall,
    ) -> None:
        if not data.equipment_uuid:
            raise BusinessLogicError("设备安灯须绑定设备（equipment_uuid）")
        from apps.kuaizhizao.schemas.equipment_fault import EquipmentFaultCreate
        from apps.kuaizhizao.services.equipment_fault_service import EquipmentFaultService

        level = data.fault_level or "一般"
        fault = await EquipmentFaultService.create_equipment_fault(
            tenant_id=tenant_id,
            data=EquipmentFaultCreate(
                equipment_uuid=data.equipment_uuid,
                fault_date=datetime.now(),
                fault_type="其他",
                fault_description=data.remarks or f"工位安灯：{andon.workstation_name or andon.workstation_id}",
                fault_level=level,
                reporter_id=caller_id,
                reporter_name=caller_name,
                source_type="station_andon",
                source_uuid=andon.uuid,
            ),
            created_by=caller_id,
        )
        andon.related_doc_type = "equipment_fault"
        andon.related_doc_uuid = fault.uuid
        andon.related_doc_code = fault.fault_no
        andon.equipment_uuid = data.equipment_uuid
        andon.fault_level = level
        await andon.save()

    async def _link_material_call(
        self,
        tenant_id: int,
        data: StationAndonCreate,
        caller: User,
        andon: StationAndonCall,
    ) -> None:
        if not data.work_order_id:
            raise BusinessLogicError("物料安灯须关联工单")
        from apps.kuaizhizao.services.material_call_service import MaterialCallService

        mode = (data.material_call_mode or "FULL_ORDER").upper()
        if mode != "FULL_ORDER":
            raise BusinessLogicError("当前仅支持整单齐套缺料叫料（FULL_ORDER）")
        result = await MaterialCallService().batch_create_from_work_order_kitting(
            tenant_id=tenant_id,
            work_order_id=data.work_order_id,
            user=caller,
        )
        andon.related_doc_type = "material_call"
        andon.related_doc_uuid = str(getattr(result, "uuid", None) or getattr(result, "id", ""))
        andon.related_doc_code = getattr(result, "code", None)
        andon.material_call_mode = mode
        await andon.save()

    async def _link_quality_inspection(
        self,
        tenant_id: int,
        data: StationAndonCreate,
        caller_id: int,
        andon: StationAndonCall,
    ) -> None:
        if not data.work_order_id or not data.operation_id:
            raise BusinessLogicError("质量安灯须关联工单与工序")
        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.services.quality_service import ProcessInspectionService

        master_op_id, _ = await self.resolve_master_operation_id(
            tenant_id, data.operation_id, data.work_order_id
        )
        existing = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id=data.work_order_id,
            operation_id=master_op_id,
            deleted_at__isnull=True,
            status="待检验",
        ).order_by("-created_at").first()
        if existing:
            andon.related_doc_type = "process_inspection"
            andon.related_doc_uuid = existing.uuid
            andon.related_doc_code = existing.inspection_code
            await andon.save()
            return

        insp = await ProcessInspectionService().create_inspection_from_work_order(
            tenant_id=tenant_id,
            work_order_id=data.work_order_id,
            operation_id=master_op_id,
            created_by=caller_id,
        )
        andon.related_doc_type = "process_inspection"
        andon.related_doc_uuid = insp.uuid
        andon.related_doc_code = insp.inspection_code
        await andon.save()

    async def _link_supervisor_message(
        self,
        tenant_id: int,
        data: StationAndonCreate,
        andon: StationAndonCall,
    ) -> None:
        if not data.supervisor_user_id:
            raise BusinessLogicError("班长安灯须指定通知用户（supervisor_user_id）")
        from core.schemas.message_template import SendMessageRequest
        from core.services.messaging.message_service import MessageService

        label = ANDON_TYPE_LABELS.get(andon.call_type, andon.call_type)
        subject = f"【安灯】{label}"
        content = (
            f"工位 {andon.workstation_name or andon.workstation_id or '-'} "
            f"发起{label}，工单 {andon.work_order_code or '-'}。"
            f"{('备注：' + andon.remarks) if andon.remarks else ''}"
        )
        resp = await MessageService.send_message(
            tenant_id,
            SendMessageRequest(
                type="internal",
                recipient=str(data.supervisor_user_id),
                subject=subject,
                content=content,
            ),
        )
        andon.related_doc_type = "message"
        andon.related_doc_uuid = str(resp.message_log_uuid) if resp.message_log_uuid else None
        andon.related_doc_code = subject
        andon.supervisor_user_id = data.supervisor_user_id
        await andon.save()

    async def create_andon_call(
        self,
        tenant_id: int,
        data: StationAndonCreate,
        caller_id: int,
        caller_name: str,
        caller: Optional[User] = None,
    ) -> StationAndonCall:
        valid_types = {"quality", "material", "equipment", "supervisor"}
        if data.call_type not in valid_types:
            raise BusinessLogicError(f"无效的安灯类型: {data.call_type}")

        async with in_transaction():
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
                equipment_uuid=data.equipment_uuid,
                fault_level=data.fault_level,
                material_call_mode=data.material_call_mode,
                supervisor_user_id=data.supervisor_user_id,
            )

            if data.call_type == "equipment":
                await self._link_equipment_fault(tenant_id, data, caller_id, caller_name, record)
            elif data.call_type == "material":
                if caller is None:
                    caller = await User.get(id=caller_id)
                await self._link_material_call(tenant_id, data, caller, record)
            elif data.call_type == "quality":
                await self._link_quality_inspection(tenant_id, data, caller_id, record)
            elif data.call_type == "supervisor":
                await self._link_supervisor_message(tenant_id, data, record)

        await self._push_andon_event(tenant_id, "created", record)
        return record

    async def list_andon_calls(
        self,
        tenant_id: int,
        workstation_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[StationAndonCall]:
        q = StationAndonCall.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if workstation_id is not None:
            q = q.filter(workstation_id=workstation_id)
        if status:
            q = q.filter(status=status)
        return await q.order_by("-created_at").limit(limit).all()

    async def list_open_andon_calls(
        self,
        tenant_id: int,
        workstation_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[StationAndonCall]:
        return await self.list_andon_calls(
            tenant_id=tenant_id,
            workstation_id=workstation_id,
            status="open",
            limit=limit,
        )

    async def acknowledge_andon(
        self,
        tenant_id: int,
        andon_id: int,
        user_id: int,
        user_name: str,
    ) -> StationAndonCall:
        record = await StationAndonCall.get_or_none(
            tenant_id=tenant_id, id=andon_id, deleted_at__isnull=True
        )
        if not record:
            raise NotFoundError("安灯记录不存在")
        if record.status != "open":
            raise BusinessLogicError(f"仅 open 状态可响应，当前：{record.status}")
        record.status = "acknowledged"
        record.acknowledged_at = datetime.now()
        record.acknowledged_by = user_id
        record.acknowledged_by_name = user_name
        await record.save()
        await self._push_andon_event(tenant_id, "acknowledged", record)
        return record

    async def close_andon(
        self,
        tenant_id: int,
        andon_id: int,
        user_id: int,
        user_name: str,
    ) -> StationAndonCall:
        record = await StationAndonCall.get_or_none(
            tenant_id=tenant_id, id=andon_id, deleted_at__isnull=True
        )
        if not record:
            raise NotFoundError("安灯记录不存在")
        if record.status not in ("open", "acknowledged"):
            raise BusinessLogicError(f"当前状态不可关闭：{record.status}")
        if record.status == "open":
            record.acknowledged_at = datetime.now()
            record.acknowledged_by = user_id
            record.acknowledged_by_name = user_name
        record.status = "closed"
        record.closed_at = datetime.now()
        await record.save()
        await self._push_andon_event(tenant_id, "closed", record)
        return record

    async def cancel_andon(
        self,
        tenant_id: int,
        andon_id: int,
        caller_id: int,
    ) -> StationAndonCall:
        record = await StationAndonCall.get_or_none(
            tenant_id=tenant_id, id=andon_id, deleted_at__isnull=True
        )
        if not record:
            raise NotFoundError("安灯记录不存在")
        if record.caller_id != caller_id:
            raise BusinessLogicError("仅发起人可撤销安灯")
        if record.status != "open":
            raise BusinessLogicError("仅未响应的安灯可撤销")
        record.status = "closed"
        record.closed_at = datetime.now()
        record.remarks = (record.remarks or "") + "\n[撤销]"
        await record.save()
        await self._push_andon_event(tenant_id, "cancelled", record)
        return record

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

    async def resolve_master_operation_id(
        self,
        tenant_id: int,
        operation_id: int,
        work_order_id: Optional[int] = None,
    ) -> tuple[int, Optional[str]]:
        """返回 (主数据工序ID, 工序名)"""
        if work_order_id:
            woo = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                id=operation_id,
                deleted_at__isnull=True,
            )
            if woo:
                return int(woo.operation_id), woo.operation_name
            woo2 = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                deleted_at__isnull=True,
            )
            if woo2:
                return int(woo2.operation_id), woo2.operation_name
        return operation_id, None

    async def get_operation_documents(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
    ) -> StationOperationDocumentsResponse:
        """
        工位工序文档聚合（唯一入口）：
        - ESOP：ProcessService.get_sop_for_reporting（物料(+可选工序) → 物料组(+可选工序) → 仅工序；未绑工序视为适用全部工序）
        - 图纸：已发布工程图纸（按物料，再按路线/工序收窄）+ 物料 images + 工单附件 + SOP 附件
        """
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.material import Material
        from apps.master_data.models.process import Operation, ProcessRoute
        from apps.master_data.services.process_service import ProcessService
        from apps.master_data.services.drawing_service import DrawingService

        woo = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            id=operation_id,
            deleted_at__isnull=True,
        )
        if not woo:
            woo = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                deleted_at__isnull=True,
            )
        if not woo:
            raise NotFoundError(f"工单工序不存在: work_order_id={work_order_id}, operation_id={operation_id}")

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        master_op_id = int(woo.operation_id) if woo.operation_id is not None else None
        master_op = None
        if master_op_id is not None:
            master_op = await Operation.get_or_none(
                tenant_id=tenant_id,
                id=master_op_id,
                deleted_at__isnull=True,
            )
        operation_uuid = str(master_op.uuid) if master_op else None

        material = await Material.filter(
            id=work_order.product_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        material_uuid = str(material.uuid) if material else None

        process_route_uuid = None
        route_id = getattr(work_order, "process_route_id", None)
        if route_id:
            route = await ProcessRoute.get_or_none(
                tenant_id=tenant_id,
                id=route_id,
                deleted_at__isnull=True,
            )
            if route:
                process_route_uuid = str(route.uuid)

        sop_doc: Optional[StationSopDocument] = None
        if master_op_id is not None:
            sop = await ProcessService.get_sop_for_reporting(
                tenant_id, work_order_id, master_op_id
            )
            if sop:
                sop_attachments_raw = _normalize_attachment_list(getattr(sop, "attachments", None))
                sop_att_items: List[StationDocFileItem] = []
                for i, f in enumerate(sop_attachments_raw):
                    item = _attachment_to_doc_item(f, i, "sop")
                    if item:
                        sop_att_items.append(item)

                # 直接读 ORM，避免 SOPResponse 字段别名导致 flow_config 丢失
                from apps.master_data.models.process import SOP as SopModel

                sop_row = await SopModel.filter(
                    tenant_id=tenant_id,
                    uuid=str(sop.uuid),
                    deleted_at__isnull=True,
                ).first()
                flow_config = (
                    getattr(sop_row, "flow_config", None)
                    if sop_row is not None
                    else getattr(sop, "flow_config", None)
                )
                if not isinstance(flow_config, dict):
                    flow_config = None

                sop_doc = StationSopDocument(
                    uuid=str(sop.uuid),
                    name=sop.name,
                    version=sop.version,
                    content=sop.content,
                    steps=_sop_flow_to_steps(flow_config),
                    flow_config=flow_config,
                    attachments=sop_att_items,
                )

        drawings: List[StationDocFileItem] = []
        seen_keys: set[str] = set()

        def _push(item: Optional[StationDocFileItem]) -> None:
            if not item:
                return
            dedupe = item.file_uuid or item.url or item.key
            if dedupe in seen_keys:
                return
            seen_keys.add(dedupe)
            drawings.append(item)

        # 1) 快研发 / 主数据工程图纸（已发布，按物料；路线/工序有绑定时再收窄）
        if material_uuid:
            eng_rows = await DrawingService.list_by_context(
                tenant_id, material_uuid=material_uuid
            )
            for d in eng_rows:
                op_uuids = list(getattr(d, "operation_uuids", None) or [])
                route_uuids = list(getattr(d, "process_route_uuids", None) or [])
                if op_uuids and operation_uuid and operation_uuid not in op_uuids:
                    continue
                if route_uuids and process_route_uuid and process_route_uuid not in route_uuids:
                    continue
                file_uuid = getattr(d, "file_uuid", None) or (
                    getattr(getattr(d, "file", None), "uuid", None)
                )
                file_brief = getattr(d, "file", None)
                name = (
                    (getattr(file_brief, "original_name", None) if file_brief else None)
                    or f"{d.code}-{d.name}"
                )
                preview = (
                    getattr(file_brief, "preview_url", None)
                    if file_brief
                    else None
                )
                if file_uuid:
                    _push(
                        StationDocFileItem(
                            key=f"engineering_drawing-{d.uuid}",
                            name=str(name),
                            file_uuid=str(file_uuid),
                            url=preview or _station_file_preview_url(str(file_uuid)),
                            source="engineering_drawing",
                            drawing_code=d.code,
                            drawing_revision=d.revision,
                        )
                    )
                for j, supp in enumerate(getattr(d, "supplementary_files", None) or []):
                    suuid = getattr(supp, "uuid", None)
                    if not suuid:
                        continue
                    _push(
                        StationDocFileItem(
                            key=f"engineering_drawing-{d.uuid}-supp-{j}",
                            name=str(getattr(supp, "original_name", None) or f"{d.code}-附加{j + 1}"),
                            file_uuid=str(suuid),
                            url=getattr(supp, "preview_url", None)
                            or _station_file_preview_url(str(suuid)),
                            source="engineering_drawing",
                            drawing_code=d.code,
                            drawing_revision=d.revision,
                        )
                    )

        # 2) 物料附件（Material.images：图片 / PDF / DWG 等）
        if material and getattr(material, "images", None):
            images = material.images if isinstance(material.images, list) else []
            for i, img in enumerate(images):
                if isinstance(img, str):
                    _push(_attachment_to_doc_item(img, i, "material"))
                elif isinstance(img, dict):
                    _push(_attachment_to_doc_item(img, i, "material"))

        # 3) 工单附件
        for i, f in enumerate(_normalize_attachment_list(getattr(work_order, "attachments", None))):
            _push(_attachment_to_doc_item(f, i, "work_order"))

        # 4) SOP 附件（图档也进图纸列表）
        if sop_doc:
            for item in sop_doc.attachments:
                _push(item)

        return StationOperationDocumentsResponse(
            work_order_id=work_order_id,
            operation_id=int(woo.id),
            master_operation_id=master_op_id,
            material_uuid=material_uuid,
            process_route_uuid=process_route_uuid,
            operation_uuid=operation_uuid,
            sop=sop_doc,
            drawings=drawings,
            esop_available=sop_doc is not None,
            drawings_available=len(drawings) > 0,
        )

    async def get_work_orders_document_flags(
        self,
        tenant_id: int,
        work_order_ids: List[int],
    ) -> List[StationWorkOrderDocumentFlags]:
        """工单列表：批量判断是否有 ESOP / 图纸（供附件角标）。"""
        from tortoise.expressions import Q

        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.drawing import EngineeringDrawing
        from apps.master_data.models.material import Material
        from apps.master_data.models.process import Operation
        from apps.master_data.services.process_service import ProcessService

        ids = sorted({int(i) for i in work_order_ids if i is not None})
        if not ids:
            return []

        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).all()
        wo_by_id = {int(w.id): w for w in work_orders}

        product_ids = {int(w.product_id) for w in work_orders if w.product_id is not None}
        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=list(product_ids),
            deleted_at__isnull=True,
        ).all() if product_ids else []
        material_by_product_id = {int(m.id): m for m in materials}
        material_uuids = [str(m.uuid) for m in materials if getattr(m, "uuid", None)]

        material_has_drawing: set[str] = set()
        if material_uuids:
            q = Q()
            for mu in material_uuids:
                q |= Q(material_uuids__contains=[mu])
            eng_rows = await EngineeringDrawing.filter(
                tenant_id=tenant_id,
                status="Released",
                deleted_at__isnull=True,
            ).filter(q).all()
            for row in eng_rows:
                for mu in _norm_uuid_list_local(getattr(row, "material_uuids", None)):
                    if mu in material_uuids:
                        material_has_drawing.add(mu)

        wo_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=ids,
            deleted_at__isnull=True,
        ).all()
        ops_by_wo: dict[int, list] = {}
        master_op_ids: set[int] = set()
        for op in wo_ops:
            ops_by_wo.setdefault(int(op.work_order_id), []).append(op)
            if op.operation_id is not None:
                master_op_ids.add(int(op.operation_id))

        master_ops = await Operation.filter(
            tenant_id=tenant_id,
            id__in=list(master_op_ids),
            deleted_at__isnull=True,
        ).all() if master_op_ids else []
        master_uuid_by_id = {int(o.id): str(o.uuid) for o in master_ops}

        sop_cache: dict[tuple[str, Optional[str]], bool] = {}

        async def _has_sop(material_uuid: Optional[str], operation_uuid: Optional[str]) -> bool:
            if not material_uuid and not operation_uuid:
                return False
            key = (material_uuid or "", operation_uuid)
            if key in sop_cache:
                return sop_cache[key]
            if material_uuid:
                sop = await ProcessService.get_sop_for_material(
                    tenant_id, material_uuid, operation_uuid=operation_uuid
                )
            else:
                sop = None
                if operation_uuid:
                    op = await Operation.filter(
                        tenant_id=tenant_id, uuid=operation_uuid, deleted_at__isnull=True
                    ).first()
                    if op:
                        from apps.master_data.models.process import SOP

                        sop_row = await SOP.filter(
                            tenant_id=tenant_id,
                            deleted_at__isnull=True,
                            is_active=True,
                            operation_id=op.id,
                        ).order_by("code").first()
                        sop = sop_row
            sop_cache[key] = sop is not None
            return sop_cache[key]

        result: List[StationWorkOrderDocumentFlags] = []
        for wo_id in ids:
            wo = wo_by_id.get(wo_id)
            if not wo:
                result.append(
                    StationWorkOrderDocumentFlags(
                        work_order_id=wo_id, has_esop=False, has_drawings=False, has_docs=False
                    )
                )
                continue

            material = material_by_product_id.get(int(wo.product_id)) if wo.product_id else None
            material_uuid = str(material.uuid) if material else None

            has_drawings = False
            if _normalize_attachment_list(getattr(wo, "attachments", None)):
                has_drawings = True
            if not has_drawings and material and getattr(material, "images", None):
                images = material.images if isinstance(material.images, list) else []
                if any(images):
                    has_drawings = True
            if not has_drawings and material_uuid and material_uuid in material_has_drawing:
                has_drawings = True

            has_esop = False
            for op in ops_by_wo.get(wo_id, []):
                op_uuid = master_uuid_by_id.get(int(op.operation_id)) if op.operation_id else None
                if await _has_sop(material_uuid, op_uuid):
                    has_esop = True
                    break

            result.append(
                StationWorkOrderDocumentFlags(
                    work_order_id=wo_id,
                    has_esop=has_esop,
                    has_drawings=has_drawings,
                    has_docs=has_esop or has_drawings,
                )
            )
        return result

    async def check_operator_skill(
        self,
        tenant_id: int,
        user_id: int,
        operation_id: int,
        work_order_id: Optional[int] = None,
    ) -> dict:
        master_op_id, op_name = await self.resolve_master_operation_id(
            tenant_id, operation_id, work_order_id
        )
        now = datetime.now()
        q = OperatorSkillQualification.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            operation_id=master_op_id,
            is_active=True,
            deleted_at__isnull=True,
        )
        records = await q.all()
        if not records:
            # 未配置资质时默认放行（避免空库阻断产线）；有任意资质记录则严格校验
            any_skill = await OperatorSkillQualification.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).exists()
            if not any_skill:
                return {
                    "qualified": True,
                    "user_id": user_id,
                    "operation_id": master_op_id,
                    "operation_name": op_name,
                    "message": "组织尚未配置上岗资质，默认放行",
                }
            return {
                "qualified": False,
                "user_id": user_id,
                "operation_id": master_op_id,
                "operation_name": op_name,
                "message": f"操作员不具备工序「{op_name or master_op_id}」上岗资质",
            }

        for r in records:
            if r.valid_from and r.valid_from > now:
                continue
            if r.valid_until and r.valid_until < now:
                continue
            return {
                "qualified": True,
                "user_id": user_id,
                "operation_id": master_op_id,
                "operation_name": r.operation_name or op_name,
                "message": "资质校验通过",
            }
        return {
            "qualified": False,
            "user_id": user_id,
            "operation_id": master_op_id,
            "operation_name": op_name,
            "message": "资质已过期或未生效",
        }

    async def create_operator_skill(
        self,
        tenant_id: int,
        data: OperatorSkillCreate,
    ) -> OperatorSkillQualification:
        existing = await OperatorSkillQualification.get_or_none(
            tenant_id=tenant_id,
            user_id=data.user_id,
            operation_id=data.operation_id,
            deleted_at__isnull=True,
            is_active=True,
        )
        if existing:
            existing.user_name = data.user_name or existing.user_name
            existing.operation_code = data.operation_code or existing.operation_code
            existing.operation_name = data.operation_name or existing.operation_name
            existing.skill_level = data.skill_level
            existing.remarks = data.remarks
            await existing.save()
            return existing
        return await OperatorSkillQualification.create(
            tenant_id=tenant_id,
            user_id=data.user_id,
            user_name=data.user_name,
            operation_id=data.operation_id,
            operation_code=data.operation_code,
            operation_name=data.operation_name,
            skill_level=data.skill_level,
            remarks=data.remarks,
        )

    async def list_operator_skills(
        self,
        tenant_id: int,
        user_id: Optional[int] = None,
        operation_id: Optional[int] = None,
    ) -> List[OperatorSkillQualification]:
        q = OperatorSkillQualification.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if user_id is not None:
            q = q.filter(user_id=user_id)
        if operation_id is not None:
            q = q.filter(operation_id=operation_id)
        return await q.order_by("-created_at").limit(200).all()

    async def get_shift_summary(
        self,
        tenant_id: int,
        shift_start: datetime,
        shift_end: Optional[datetime] = None,
        workstation_id: Optional[int] = None,
    ) -> dict:
        end = shift_end or datetime.now()
        report_q = ReportingRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            reported_at__gte=shift_start,
            reported_at__lte=end,
        )
        # workstation 过滤：报工记录若无工位字段则按安灯/停机侧统计为主
        reports = await report_q.all()
        completed = sum((Decimal(str(r.qualified_quantity or 0)) for r in reports), Decimal("0"))
        unqualified = sum((Decimal(str(r.unqualified_quantity or 0)) for r in reports), Decimal("0"))
        planned = sum((Decimal(str(r.reported_quantity or 0)) for r in reports), Decimal("0"))

        dt_q = StationOperationDowntime.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            started_at__gte=shift_start,
            started_at__lte=end,
        )
        downtimes = await dt_q.all()
        downtime_minutes = Decimal("0")
        for d in downtimes:
            ended = d.ended_at or end
            mins = Decimal(str(max(0, (ended - d.started_at).total_seconds() / 60.0)))
            downtime_minutes += mins

        andon_q = StationAndonCall.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            created_at__gte=shift_start,
            created_at__lte=end,
        )
        if workstation_id is not None:
            andon_q = andon_q.filter(workstation_id=workstation_id)
        andon_count = await andon_q.count()

        return {
            "workstation_id": workstation_id,
            "shift_start": shift_start,
            "shift_end": end,
            "planned_qty": planned,
            "completed_qty": completed,
            "unqualified_qty": unqualified,
            "downtime_minutes": downtime_minutes.quantize(Decimal("0.01")),
            "andon_count": andon_count,
            "reporting_count": len(reports),
        }

    async def confirm_shift_handover(
        self,
        tenant_id: int,
        data: ShiftHandoverCreate,
        operator_id: int,
        operator_name: str,
    ) -> StationShiftHandover:
        summary = await self.get_shift_summary(
            tenant_id=tenant_id,
            shift_start=data.shift_start,
            shift_end=data.shift_end,
            workstation_id=data.workstation_id,
        )
        return await StationShiftHandover.create(
            tenant_id=tenant_id,
            workstation_id=data.workstation_id,
            workstation_name=data.workstation_name,
            operator_id=operator_id,
            operator_name=operator_name,
            shift_start=summary["shift_start"],
            shift_end=summary["shift_end"],
            planned_qty=summary["planned_qty"],
            completed_qty=summary["completed_qty"],
            unqualified_qty=summary["unqualified_qty"],
            downtime_minutes=summary["downtime_minutes"],
            andon_count=summary["andon_count"],
            summary_json={"reporting_count": summary["reporting_count"]},
            remarks=data.remarks,
        )

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
