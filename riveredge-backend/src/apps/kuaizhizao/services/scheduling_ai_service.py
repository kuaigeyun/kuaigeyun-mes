"""
可视排产 AI 助手

复用站点 DeepSeek 集成；结合 board-scan / 工单上下文生成解读、排序与改期提案。
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.scheduling_ai import (
    SchedulingAiExplainResponse,
    SchedulingAiPriorityResponse,
    SchedulingAiProposal,
    SchedulingAiSuggestAdjustmentsResponse,
    SchedulingAiValidationPreview,
    SchedulingAiWorkOrderAdjustment,
    SchedulingAiOperationAdjustment,
)
from apps.kuaizhizao.services.sales_order_ocr_service import SalesOrderOcrService
from core.utils.deepseek_vision_client import extract_json_object, message_text
from apps.kuaizhizao.services.visual_scheduling_service import VisualSchedulingService
from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from apps.master_data.models.factory import Workstation
from infra.exceptions.exceptions import ValidationError

_EXPLAIN_SYSTEM = (
    "你是制造 ERP 可视排产助手。"
    "根据提供的工单列表、board-scan 诊断与排产约束，用简洁中文回答计划员问题。"
    "只基于上下文事实，不得编造工单号、工位或日期。"
    "若上下文不足，明确说明缺少什么数据。"
    "输出 JSON：{\"answer\": \"...\"}，answer 可用 Markdown 列表。"
)

_PRIORITY_SYSTEM = (
    "你是制造排产优先级助手。"
    "根据工单交期、超期状态、scheduling_score、readiness、board-scan 冲突与超载，"
    "给出待排工单的建议执行顺序（work_order_id 数组）。"
    "只能使用上下文中出现的 work_order_id，不得编造。"
    "输出 JSON：{\"suggestedPoolOrder\": [id,...], \"rationale\": \"...\", \"confidenceNotes\": \"...\"}"
)

_ADJUST_SYSTEM = (
    "你是制造排产改期助手。"
    "根据用户自然语言指令与上下文，生成改期提案 JSON。"
    "不得编造不存在的 work_order_id、operation_id、assigned_station_id。"
    "时间用 ISO8601（含时区或本地无时区均可）。"
    "无法确定则留空并在 warnings 说明。"
    "输出 JSON（camelCase）："
    "summary, confidenceNotes, warnings[], "
    "workOrderAdjustments[{workOrderId, plannedStartDate, plannedEndDate}], "
    "operationAdjustments[{operationId, plannedStartDate, plannedEndDate, assignedStationId}], "
    "poolReorder[]"
)

_DISPATCH_OCR_PROMPT = (
    "请完整识别这张派工单/生产调度单图片中的文字与表格，"
    "保留工单号、日期、工位、数量、备注等全部信息，不要总结。"
)


def _parse_plan_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    text = str(raw).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _dt_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _is_overdue(wo: WorkOrder, now: datetime) -> bool:
    end = wo.planned_end_date
    if not end:
        return False
    if wo.status in ("completed", "cancelled"):
        return False
    cmp_end = end.replace(tzinfo=None) if end.tzinfo else end
    cmp_now = now.replace(tzinfo=None) if now.tzinfo else now
    return cmp_end < cmp_now


class SchedulingAiService:
    def __init__(self) -> None:
        self._scan_service = VisualSchedulingService()
        self._score_service = WorkOrderScoreService()

    async def _chat_json(
        self,
        tenant_id: int,
        *,
        system: str,
        user_content: str,
        error_prefix: str,
    ) -> Dict[str, Any]:
        config = await SalesOrderOcrService._get_runtime_config(tenant_id)
        payload = {
            "model": config["chat_model"],
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "stream": False,
            "temperature": 0.2,
        }
        body = await SalesOrderOcrService._post_chat_completions(
            tenant_id=tenant_id,
            base_url=config["chat_base_url"],
            api_key=config["chat_api_key"],
            payload=payload,
            error_prefix=error_prefix,
        )
        choice = (body.get("choices") or [{}])[0]
        text = message_text(choice.get("message") or {})
        return extract_json_object(text)

    async def _load_work_orders(
        self,
        tenant_id: int,
        work_order_ids: Optional[List[int]],
        plan_date: Optional[date],
    ) -> List[WorkOrder]:
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=["draft", "released", "in_progress"],
            deleted_at__isnull=True,
        )
        if work_order_ids:
            query = query.filter(id__in=work_order_ids)
        if plan_date:
            day_start, day_end = VisualSchedulingService._plan_day_bounds(plan_date)
            query = query.filter(
                planned_start_date__gte=day_start,
                planned_start_date__lte=day_end,
            )
        rows = await query.order_by("-created_at").limit(200)
        return list(rows)

    async def _build_context_payload(
        self,
        tenant_id: int,
        *,
        work_order_ids: Optional[List[int]],
        plan_date: Optional[str],
        selected_work_order_ids: Optional[List[int]],
    ) -> Tuple[Dict[str, Any], Set[int], Dict[int, WorkOrder]]:
        plan_d = _parse_plan_date(plan_date)
        work_orders = await self._load_work_orders(tenant_id, work_order_ids, plan_d)
        wo_by_id = {int(wo.id): wo for wo in work_orders}
        allowed_ids = set(wo_by_id.keys())

        score_map = await self._score_service.batch_ensure_scores(
            tenant_id,
            list(allowed_ids),
            "scheduling",
            include_kitting=False,
        )

        now = datetime.now(timezone.utc)
        wo_briefs: List[Dict[str, Any]] = []
        for wo in work_orders[:80]:
            cached = score_map.get(wo.id)
            wo_briefs.append(
                {
                    "workOrderId": wo.id,
                    "code": wo.code,
                    "status": wo.status,
                    "productCode": wo.product_code,
                    "plannedStartDate": _dt_iso(wo.planned_start_date),
                    "plannedEndDate": _dt_iso(wo.planned_end_date),
                    "isFrozen": bool(wo.is_frozen),
                    "readinessRate": float(wo.readiness_rate) if wo.readiness_rate is not None else None,
                    "schedulingScore": float(cached.composite_score) if cached and cached.composite_score else None,
                    "overdue": _is_overdue(wo, now),
                }
            )

        stations = await Workstation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).order_by("code").limit(100)
        station_briefs = [
            {"stationId": s.id, "code": s.code, "name": s.name} for s in stations
        ]

        scan_raw = await self._scan_service.scan_board(
            tenant_id,
            work_order_ids=list(allowed_ids) if allowed_ids else work_order_ids,
            plan_date=plan_d,
            horizon_days=14,
        )
        constraints = await self._scan_service._load_constraints(tenant_id)

        scan_summary = {
            "conflictCount": scan_raw.get("conflict_count", 0),
            "unscheduledCount": scan_raw.get("unscheduled_count", 0),
            "materialIssueCount": scan_raw.get("material_issue_count", 0),
            "overloadedStationCount": scan_raw.get("overloaded_station_count", 0),
            "conflicts": (scan_raw.get("conflicts") or [])[:15],
            "materialIssues": (scan_raw.get("material_issues") or [])[:10],
            "overloadedStations": [
                row
                for row in (scan_raw.get("load_by_station") or [])
                if row.get("overloaded")
            ][:10],
        }

        payload = {
            "planDate": plan_date,
            "selectedWorkOrderIds": selected_work_order_ids or [],
            "constraints": {
                "freezeHorizonDays": constraints.get("freeze_horizon_days"),
                "rollingHorizonDays": constraints.get("rolling_horizon_days"),
            },
            "workOrders": wo_briefs,
            "stations": station_briefs,
            "boardScan": scan_summary,
        }
        return payload, allowed_ids, wo_by_id

    def _filter_ids(self, ids: List[Any], allowed: Set[int]) -> List[int]:
        out: List[int] = []
        for raw in ids:
            try:
                val = int(raw)
            except (TypeError, ValueError):
                continue
            if val in allowed:
                out.append(val)
        return out

    async def explain(
        self,
        tenant_id: int,
        *,
        text: str,
        work_order_ids: Optional[List[int]] = None,
        plan_date: Optional[str] = None,
        selected_work_order_ids: Optional[List[int]] = None,
    ) -> SchedulingAiExplainResponse:
        user_text = (text or "").strip()
        if not user_text:
            raise ValidationError("请输入问题")

        ctx, _, _ = await self._build_context_payload(
            tenant_id,
            work_order_ids=work_order_ids,
            plan_date=plan_date,
            selected_work_order_ids=selected_work_order_ids,
        )
        user_content = (
            f"排产上下文（JSON）：\n{json.dumps(ctx, ensure_ascii=False)}\n\n"
            f"用户问题：\n{user_text}"
        )
        data = await self._chat_json(
            tenant_id,
            system=_EXPLAIN_SYSTEM,
            user_content=user_content,
            error_prefix="排产 AI 解读失败",
        )
        answer = str(data.get("answer") or "").strip()
        if not answer:
            raise ValidationError("AI 未返回有效回答")
        return SchedulingAiExplainResponse(answer=answer)

    async def suggest_priority(
        self,
        tenant_id: int,
        *,
        text: Optional[str] = None,
        work_order_ids: Optional[List[int]] = None,
        plan_date: Optional[str] = None,
        selected_work_order_ids: Optional[List[int]] = None,
    ) -> SchedulingAiPriorityResponse:
        ctx, allowed_ids, _ = await self._build_context_payload(
            tenant_id,
            work_order_ids=work_order_ids,
            plan_date=plan_date,
            selected_work_order_ids=selected_work_order_ids,
        )
        hint = (text or "").strip() or "按交期优先、超期优先、齐套率与 scheduling_score 综合排序"
        user_content = (
            f"排产上下文（JSON）：\n{json.dumps(ctx, ensure_ascii=False)}\n\n"
            f"排序偏好：\n{hint}"
        )
        data = await self._chat_json(
            tenant_id,
            system=_PRIORITY_SYSTEM,
            user_content=user_content,
            error_prefix="排产排序建议失败",
        )
        raw_order = data.get("suggestedPoolOrder") or data.get("suggested_pool_order") or []
        if not isinstance(raw_order, list):
            raw_order = []
        order = self._filter_ids(raw_order, allowed_ids)
        if selected_work_order_ids:
            sel = set(selected_work_order_ids)
            order = [i for i in order if i in sel]
        # append any missing allowed ids at end (stable fallback)
        seen = set(order)
        for wid in allowed_ids:
            if wid not in seen:
                order.append(wid)
        rationale = str(data.get("rationale") or data.get("rationale") or "").strip()
        if not rationale:
            rationale = "已根据交期、超期与评分生成建议顺序"
        confidence = data.get("confidenceNotes") or data.get("confidence_notes")
        return SchedulingAiPriorityResponse(
            suggested_pool_order=order,
            rationale=rationale,
            confidence_notes=str(confidence).strip() if confidence else None,
        )

    def _parse_proposal_data(
        self,
        data: Dict[str, Any],
        allowed_ids: Set[int],
        allowed_op_ids: Set[int],
        allowed_station_ids: Set[int],
    ) -> SchedulingAiProposal:
        warnings_raw = data.get("warnings") or []
        warnings = [str(w) for w in warnings_raw if w] if isinstance(warnings_raw, list) else []

        wo_adj: List[SchedulingAiWorkOrderAdjustment] = []
        for row in data.get("workOrderAdjustments") or data.get("work_order_adjustments") or []:
            if not isinstance(row, dict):
                continue
            wid = row.get("workOrderId") or row.get("work_order_id")
            try:
                wid_int = int(wid)
            except (TypeError, ValueError):
                continue
            if wid_int not in allowed_ids:
                warnings.append(f"忽略未知工单 ID: {wid_int}")
                continue
            start = row.get("plannedStartDate") or row.get("planned_start_date")
            end = row.get("plannedEndDate") or row.get("planned_end_date")
            if not start or not end:
                warnings.append(f"工单 {wid_int} 改期缺少起止时间")
                continue
            wo_adj.append(
                SchedulingAiWorkOrderAdjustment(
                    work_order_id=wid_int,
                    planned_start_date=str(start),
                    planned_end_date=str(end),
                )
            )

        op_adj: List[SchedulingAiOperationAdjustment] = []
        for row in data.get("operationAdjustments") or data.get("operation_adjustments") or []:
            if not isinstance(row, dict):
                continue
            oid = row.get("operationId") or row.get("operation_id")
            try:
                oid_int = int(oid)
            except (TypeError, ValueError):
                continue
            if oid_int not in allowed_op_ids:
                warnings.append(f"忽略未知工序 ID: {oid_int}")
                continue
            sid = row.get("assignedStationId") or row.get("assigned_station_id")
            sid_int = None
            if sid is not None:
                try:
                    sid_int = int(sid)
                    if sid_int not in allowed_station_ids:
                        warnings.append(f"忽略未知工位 ID: {sid_int}")
                        sid_int = None
                except (TypeError, ValueError):
                    sid_int = None
            op_adj.append(
                SchedulingAiOperationAdjustment(
                    operation_id=oid_int,
                    planned_start_date=row.get("plannedStartDate") or row.get("planned_start_date"),
                    planned_end_date=row.get("plannedEndDate") or row.get("planned_end_date"),
                    assigned_station_id=sid_int,
                )
            )

        pool_raw = data.get("poolReorder") or data.get("pool_reorder") or []
        pool_reorder = self._filter_ids(pool_raw if isinstance(pool_raw, list) else [], allowed_ids)

        return SchedulingAiProposal(
            summary=data.get("summary"),
            confidence_notes=data.get("confidenceNotes") or data.get("confidence_notes"),
            warnings=warnings,
            work_order_adjustments=wo_adj,
            operation_adjustments=op_adj,
            pool_reorder=pool_reorder,
        )

    async def _prevalidate_proposal(
        self,
        tenant_id: int,
        proposal: SchedulingAiProposal,
    ) -> SchedulingAiProposal:
        wo_updates = [
            {
                "work_order_id": a.work_order_id,
                "planned_start_date": a.planned_start_date,
                "planned_end_date": a.planned_end_date,
            }
            for a in proposal.work_order_adjustments
        ]
        op_updates = [
            {
                "operation_id": a.operation_id,
                "planned_start_date": a.planned_start_date,
                "planned_end_date": a.planned_end_date,
            }
            for a in proposal.operation_adjustments
            if a.planned_start_date and a.planned_end_date
        ]
        station_updates = [
            {
                "operation_id": a.operation_id,
                "assigned_station_id": a.assigned_station_id,
            }
            for a in proposal.operation_adjustments
            if a.assigned_station_id
        ]
        if not wo_updates and not op_updates and not station_updates:
            return proposal

        raw = await self._scan_service.validate_adjustments(
            tenant_id,
            work_order_updates=wo_updates,
            operation_updates=op_updates,
            operation_station_updates=station_updates,
        )
        preview = SchedulingAiValidationPreview(
            valid=bool(raw.get("valid")),
            conflict_count=int(raw.get("conflict_count") or 0),
        )
        proposal.validation_preview = preview
        if not preview.valid:
            for c in (raw.get("conflicts") or [])[:5]:
                msg = c.get("message") if isinstance(c, dict) else str(c)
                if msg:
                    proposal.warnings.append(f"校验：{msg}")
        return proposal

    async def suggest_adjustments(
        self,
        tenant_id: int,
        *,
        text: str,
        work_order_ids: Optional[List[int]] = None,
        plan_date: Optional[str] = None,
        selected_work_order_ids: Optional[List[int]] = None,
        context: Optional[SchedulingAiProposal] = None,
    ) -> SchedulingAiSuggestAdjustmentsResponse:
        user_text = (text or "").strip()
        if not user_text:
            raise ValidationError("请输入改期指令")

        ctx, allowed_ids, _ = await self._build_context_payload(
            tenant_id,
            work_order_ids=work_order_ids,
            plan_date=plan_date,
            selected_work_order_ids=selected_work_order_ids,
        )

        wo_ids_list = list(allowed_ids)
        ops: List[WorkOrderOperation] = []
        if wo_ids_list:
            ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id__in=wo_ids_list,
                deleted_at__isnull=True,
            ).order_by("work_order_id", "sequence")
        allowed_op_ids = {int(op.id) for op in ops}
        op_briefs = [
            {
                "operationId": op.id,
                "workOrderId": op.work_order_id,
                "code": op.operation_code,
                "name": op.operation_name,
                "sequence": op.sequence,
                "assignedStationId": op.assigned_station_id,
                "plannedStartDate": _dt_iso(op.planned_start_date),
                "plannedEndDate": _dt_iso(op.planned_end_date),
            }
            for op in ops[:120]
        ]
        ctx["operations"] = op_briefs

        stations = ctx.get("stations") or []
        allowed_station_ids = {
            int(s["stationId"]) for s in stations if s.get("stationId") is not None
        }

        if context is not None:
            draft_json = context.model_dump(by_alias=True, exclude_none=True)
            user_content = (
                "当前改期提案草稿（JSON，请在其基础上按用户说明修订）：\n"
                f"{json.dumps(draft_json, ensure_ascii=False)}\n\n"
                f"排产上下文（JSON）：\n{json.dumps(ctx, ensure_ascii=False)}\n\n"
                f"用户改期指令：\n{user_text}"
            )
        else:
            user_content = (
                f"排产上下文（JSON）：\n{json.dumps(ctx, ensure_ascii=False)}\n\n"
                f"用户改期指令：\n{user_text}"
            )

        data = await self._chat_json(
            tenant_id,
            system=_ADJUST_SYSTEM,
            user_content=user_content,
            error_prefix="排产改期提案失败",
        )
        proposal = self._parse_proposal_data(
            data, allowed_ids, allowed_op_ids, allowed_station_ids
        )
        proposal = await self._prevalidate_proposal(tenant_id, proposal)
        return SchedulingAiSuggestAdjustmentsResponse(proposal=proposal)

    async def parse_dispatch_image_and_suggest(
        self,
        tenant_id: int,
        *,
        image_bytes: bytes,
        content_type: Optional[str],
        work_order_ids: Optional[List[int]] = None,
        plan_date: Optional[str] = None,
        selected_work_order_ids: Optional[List[int]] = None,
    ) -> SchedulingAiSuggestAdjustmentsResponse:
        """Phase 3：派工单图片 OCR → 改期提案。"""
        from apps.kuaizhizao.services.sales_order_ocr_service import _guess_image_mime
        import base64

        if not image_bytes:
            raise ValidationError("请上传图片")
        if len(image_bytes) > 12 * 1024 * 1024:
            raise ValidationError("图片大小不能超过 12MB")

        mime = _guess_image_mime(image_bytes, content_type)
        config = await SalesOrderOcrService._get_runtime_config(tenant_id)
        b64 = base64.b64encode(image_bytes).decode("ascii")
        ocr_text = await SalesOrderOcrService._extract_text_from_image(
            tenant_id=tenant_id,
            config=config,
            mime=mime,
            b64=b64,
        )
        logger.info(
            "scheduling dispatch OCR tenant_id={} text_len={}",
            tenant_id,
            len(ocr_text),
        )
        combined_text = f"根据以下派工单 OCR 文本生成改期提案：\n{ocr_text}"
        return await self.suggest_adjustments(
            tenant_id,
            text=combined_text,
            work_order_ids=work_order_ids,
            plan_date=plan_date,
            selected_work_order_ids=selected_work_order_ids,
        )
