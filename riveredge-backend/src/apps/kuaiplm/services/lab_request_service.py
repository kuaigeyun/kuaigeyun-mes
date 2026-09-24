"""实验委托服务（R-02 快研发通用壳）。"""

from __future__ import annotations

from typing import Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaiplm.constants.lab_request_types import (
    LAB_REQUEST_PRIORITIES,
    LAB_REQUEST_STATUS_DRAFT,
    LAB_REQUEST_STATUS_PENDING,
    LAB_REQUEST_STATUS_PENDING_REVIEW,
    LAB_REQUEST_TYPE_DEFAULT,
    LAB_REQUEST_TYPES,
    LAB_REQUEST_TYPES_REQUIRE_MANAGER_REVIEW,
)
from apps.kuaiplm.models.lab_request import LabRequest, LabRequestMeasureItem
from apps.kuaiplm.schemas.lab_request import (
    LabRequestCompleteRequest,
    LabRequestCreate,
    LabRequestFillOutsourcePriceRequest,
    LabRequestLinkExceptionRequest,
    LabRequestListItem,
    LabRequestListResponse,
    LabRequestMeasureItemResponse,
    LabRequestMeasureOverrideRequest,
    LabRequestMeasurePlanItemInput,
    LabRequestMeasurePlanReplaceRequest,
    LabRequestMeasuresSaveRequest,
    LabRequestRejectRequest,
    LabRequestReportRejectRequest,
    LabRequestReportSaveRequest,
    LabRequestResponse,
    LabRequestRevokeRequest,
    LabRequestUpdate,
)
from apps.kuaiplm.services.lab_judgment_engine import (
    COMPARE_TYPES,
    JUDGMENTS,
    aggregate_header_judgment,
    evaluate_measure_judgment,
    resolve_final_judgment,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User


class LabRequestService(AppBaseService[LabRequest]):
    code_field = "code"
    rule_code = "KUAI_PLM_LAB_REQUEST_CODE"
    code_prefix = "SY"
    AUDIT_NODE = "lab_request"

    def __init__(self) -> None:
        super().__init__(LabRequest)
        self.model = LabRequest

    def _requires_manager_review(self, business_type: str) -> bool:
        return (business_type or "").strip().lower() in LAB_REQUEST_TYPES_REQUIRE_MANAGER_REVIEW

    async def _notify_lab_pending(
        self, tenant_id: int, row: LabRequest
    ) -> None:
        from apps.kuaiplm.services.kuaiplm_business_notification import (
            notify_lab_request_submitted,
        )

        await notify_lab_request_submitted(
            tenant_id,
            request_id=row.id,
            code=row.code,
            title=row.title or row.code,
            creator_user_id=row.created_by,
        )

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        return await self.generate_code(tenant_id, self.rule_code, prefix=self.code_prefix)

    def _validate_business_type(self, business_type: str) -> str:
        bt = (business_type or "").strip().lower() or LAB_REQUEST_TYPE_DEFAULT
        if bt not in LAB_REQUEST_TYPES:
            raise ValidationError(f"非法实验委托类型: {business_type}")
        return bt

    def _validate_priority(self, priority: Optional[str]) -> str:
        p = (priority or "normal").strip().lower() or "normal"
        if p not in LAB_REQUEST_PRIORITIES:
            raise ValidationError(f"非法优先级: {priority}")
        return p

    def _validate_judgment(self, judgment: Optional[str]) -> Optional[str]:
        if judgment is None or str(judgment).strip() == "":
            return None
        j = str(judgment).strip().lower()
        if j not in JUDGMENTS:
            raise ValidationError(f"非法判定结果: {judgment}")
        return j

    def _validate_compare_type(self, compare_type: Optional[str]) -> str:
        cmp = (compare_type or "range").strip().lower() or "range"
        if cmp not in COMPARE_TYPES:
            raise ValidationError(f"非法比较类型: {compare_type}")
        return cmp

    async def _get_row(self, tenant_id: int, request_id: int) -> LabRequest:
        row = await LabRequest.filter(
            tenant_id=tenant_id, id=request_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("实验委托单不存在")
        return row

    async def _list_measure_items(
        self, tenant_id: int, request_id: int
    ) -> list[LabRequestMeasureItem]:
        return (
            await LabRequestMeasureItem.filter(
                tenant_id=tenant_id,
                lab_request_id=request_id,
                deleted_at__isnull=True,
            )
            .order_by("line_no", "id")
            .all()
        )

    def _has_ng(self, items: list[LabRequestMeasureItem], header_judgment: Optional[str]) -> bool:
        if (header_judgment or "").strip().lower() in {"ng", "fail"}:
            return True
        for item in items:
            fj = (item.final_judgment or item.auto_judgment or "").strip().lower()
            if fj in {"ng", "fail"}:
                return True
        return False

    def _to_measure_response(self, item: LabRequestMeasureItem) -> LabRequestMeasureItemResponse:
        return LabRequestMeasureItemResponse.model_validate(item)

    async def _to_response(self, row: LabRequest) -> LabRequestResponse:
        items = await self._list_measure_items(row.tenant_id, row.id)
        payload = LabRequestResponse.model_validate(row)
        payload.measure_items = [self._to_measure_response(i) for i in items]
        payload.has_ng = self._has_ng(items, row.judgment)
        return payload

    async def _replace_measure_plan_rows(
        self,
        tenant_id: int,
        request_id: int,
        items: list[LabRequestMeasurePlanItemInput],
        current_user: User,
    ) -> None:
        from apps.kuaiplm.models.lab_judgment_rule import LabJudgmentRule

        now = resolve_business_datetime()
        existing = await LabRequestMeasureItem.filter(
            tenant_id=tenant_id, lab_request_id=request_id, deleted_at__isnull=True
        ).all()
        for old in existing:
            old.deleted_at = now
            await old.save()

        for idx, raw in enumerate(items or []):
            name = (raw.item_name or "").strip()
            cmp = self._validate_compare_type(raw.compare_type)
            rule_id = raw.judgment_rule_id
            rule_version = None
            standard_min = (raw.standard_min or "").strip() or None
            standard_max = (raw.standard_max or "").strip() or None
            standard_value = (raw.standard_value or "").strip() or None
            unit = (raw.unit or "").strip() or None
            item_code = (raw.item_code or "").strip() or None
            if rule_id is not None:
                rule = await LabJudgmentRule.filter(
                    tenant_id=tenant_id,
                    id=int(rule_id),
                    deleted_at__isnull=True,
                    is_active=True,
                ).first()
                if not rule:
                    raise ValidationError(f"判定规则不存在或未启用: {rule_id}")
                cmp = self._validate_compare_type(rule.compare_type)
                standard_min = (rule.standard_min or "").strip() or None
                standard_max = (rule.standard_max or "").strip() or None
                standard_value = (rule.standard_value or "").strip() or None
                unit = (rule.unit or "").strip() or None
                if not name:
                    name = (rule.item_name or "").strip() or (rule.rule_name or "").strip()
                if not item_code:
                    item_code = rule.rule_code
                rule_version = f"{rule.rule_code}@{rule.version}"
                rule_id = rule.id
            if not name:
                raise ValidationError("试验项名称不能为空")
            row = LabRequestMeasureItem(
                tenant_id=tenant_id,
                lab_request_id=request_id,
                line_no=raw.line_no or (idx + 1),
                item_code=item_code,
                item_name=name,
                unit=unit,
                compare_type=cmp,
                standard_min=standard_min,
                standard_max=standard_max,
                standard_value=standard_value,
                judgment_rule_id=rule_id,
                rule_version=rule_version,
                remarks=(raw.remarks or "").strip() or None,
            )
            await row.save()

    async def _refresh_header_judgment(
        self, row: LabRequest, current_user: User
    ) -> None:
        items = await self._list_measure_items(row.tenant_id, row.id)
        aggregated = aggregate_header_judgment([i.final_judgment for i in items])
        if aggregated is not None:
            row.judgment = aggregated
            apply_update_audit(row, current_user)
            await row.save()

    async def create(
        self, tenant_id: int, data: LabRequestCreate, current_user: User
    ) -> LabRequestResponse:
        payload = data.model_dump(exclude_unset=False, exclude={"measure_items"})
        payload["business_type"] = self._validate_business_type(payload.get("business_type") or "")
        payload["priority"] = self._validate_priority(payload.get("priority"))
        payload["judgment"] = self._validate_judgment(payload.get("judgment"))
        payload["code"] = await self._ensure_code(tenant_id, payload.get("code"))
        payload["status"] = "draft"
        clash = await LabRequest.filter(
            tenant_id=tenant_id, code=payload["code"], deleted_at__isnull=True
        ).exists()
        if clash:
            raise BusinessLogicError("委托单号已存在")
        row = LabRequest(tenant_id=tenant_id, **payload)
        apply_create_audit(row, current_user)
        await row.save()
        if data.measure_items:
            await self._replace_measure_plan_rows(
                tenant_id, row.id, data.measure_items, current_user
            )
        return await self._to_response(row)

    async def list(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        business_type: Optional[str] = None,
        priority: Optional[str] = None,
        board: bool = False,
        mine: bool = False,
        current_user: Optional[User] = None,
        order_by: str = "-created_at",
    ) -> LabRequestListResponse:
        query = LabRequest.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if board:
            query = query.filter(status__in=["pending", "in_lab"])
        if mine:
            if current_user is None or current_user.id is None:
                raise ValidationError("查询我的实验委托须登录用户")
            query = query.filter(created_by=current_user.id)
        if status:
            query = query.filter(status=status.strip().lower())
        if business_type:
            query = query.filter(business_type=self._validate_business_type(business_type))
        if priority:
            query = query.filter(priority=self._validate_priority(priority))
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(code__icontains=kw)
                    | Q(title__icontains=kw)
                    | Q(material_code__icontains=kw)
                    | Q(project_code__icontains=kw)
                )
        total = await query.count()
        if board:
            rows = (
                await query.order_by("-priority", "expected_complete_at", "-id")
                .offset(skip)
                .limit(limit)
            )
        else:
            order = (
                order_by
                if order_by.lstrip("-")
                in {
                    "created_at",
                    "updated_at",
                    "code",
                    "expected_complete_at",
                    "started_at",
                    "priority",
                }
                else "-created_at"
            )
            rows = await query.order_by(order).offset(skip).limit(limit)

        request_ids = [r.id for r in rows]
        ng_ids: set[int] = set()
        if request_ids:
            measure_rows = await LabRequestMeasureItem.filter(
                tenant_id=tenant_id,
                lab_request_id__in=request_ids,
                deleted_at__isnull=True,
            ).all()
            for m in measure_rows:
                fj = (m.final_judgment or m.auto_judgment or "").strip().lower()
                if fj in {"ng", "fail"}:
                    ng_ids.add(m.lab_request_id)

        items: list[LabRequestListItem] = []
        for r in rows:
            item = LabRequestListItem.model_validate(r)
            item.has_ng = r.id in ng_ids or (r.judgment or "").strip().lower() in {
                "ng",
                "fail",
            }
            items.append(item)

        if board:
            items.sort(key=lambda x: (0 if x.has_ng else 1, x.id * -1))

        return LabRequestListResponse(data=items, total=total)

    async def get(self, tenant_id: int, request_id: int) -> LabRequestResponse:
        return await self._to_response(await self._get_row(tenant_id, request_id))

    async def update(
        self, tenant_id: int, request_id: int, data: LabRequestUpdate, current_user: User
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in ("draft", "rejected"):
            raise BusinessLogicError("仅草稿或已驳回状态可编辑")
        payload = data.model_dump(exclude_unset=True, exclude={"measure_items"})
        if "business_type" in payload and payload["business_type"] is not None:
            payload["business_type"] = self._validate_business_type(payload["business_type"])
        if "priority" in payload and payload["priority"] is not None:
            payload["priority"] = self._validate_priority(payload["priority"])
        if "judgment" in payload:
            payload["judgment"] = self._validate_judgment(payload.get("judgment"))
        for key, value in payload.items():
            setattr(row, key, value)
        if row.status == "rejected":
            row.status = "draft"
            row.reject_reason = None
            row.rejected_at = None
        apply_update_audit(row, current_user)
        await row.save()
        if data.measure_items is not None:
            await self._replace_measure_plan_rows(
                tenant_id, row.id, data.measure_items, current_user
            )
        return await self._to_response(row)

    async def replace_measure_plan(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestMeasurePlanReplaceRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in ("draft", "rejected", "pending"):
            raise BusinessLogicError("仅草稿、已驳回或待受理状态可维护试验项标准")
        await self._replace_measure_plan_rows(tenant_id, row.id, data.items, current_user)
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def save_measures(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestMeasuresSaveRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status != "in_lab":
            raise BusinessLogicError("仅实验中状态可录入实测并判定")
        by_id = {item.id: item for item in data.items or []}
        lines = await self._list_measure_items(tenant_id, request_id)
        if not lines:
            raise ValidationError("请先维护试验项标准再录入实测")
        computed_at = resolve_business_datetime().isoformat()
        for line in lines:
            if line.id not in by_id:
                continue
            measured = by_id[line.id].measured_value
            measured_raw = None if measured is None else str(measured)
            auto, computed_rule_version, snapshot = evaluate_measure_judgment(
                compare_type=line.compare_type,
                measured_value=measured_raw,
                standard_min=line.standard_min,
                standard_max=line.standard_max,
                standard_value=line.standard_value,
                unit=line.unit,
            )
            snapshot["computed_at"] = computed_at
            if line.judgment_rule_id and line.rule_version:
                snapshot["engine_rule_version"] = computed_rule_version
                snapshot["master_rule_version"] = line.rule_version
                snapshot["judgment_rule_id"] = line.judgment_rule_id
                rule_version = line.rule_version
            else:
                rule_version = computed_rule_version
            line.measured_value = measured_raw
            line.auto_judgment = auto
            line.rule_version = rule_version
            line.judgment_snapshot = snapshot
            # 重新实测后清除人工复核，避免旧复核掩盖新结果
            line.manual_judgment = None
            line.manual_reason = None
            line.manual_by = None
            line.manual_by_name = None
            line.manual_at = None
            line.final_judgment = resolve_final_judgment(auto, None)
            await line.save()

        await self._refresh_header_judgment(row, current_user)
        return await self._to_response(row)

    async def override_measure_judgment(
        self,
        tenant_id: int,
        request_id: int,
        item_id: int,
        data: LabRequestMeasureOverrideRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in ("in_lab", "completed"):
            raise BusinessLogicError("仅实验中或已完成状态可人工复核判定")
        judgment = self._validate_judgment(data.judgment)
        if not judgment:
            raise ValidationError("复核判定不能为空")
        reason = (data.reason or "").strip()
        if not reason:
            raise ValidationError("人工复核必须填写原因")
        line = await LabRequestMeasureItem.filter(
            tenant_id=tenant_id,
            lab_request_id=request_id,
            id=item_id,
            deleted_at__isnull=True,
        ).first()
        if not line:
            raise NotFoundError("实测行不存在")
        line.manual_judgment = judgment
        line.manual_reason = reason
        line.manual_by = current_user.id
        line.manual_by_name = (
            getattr(current_user, "full_name", None)
            or getattr(current_user, "username", None)
            or str(current_user.id)
        )
        line.manual_at = resolve_business_datetime()
        line.final_judgment = resolve_final_judgment(line.auto_judgment, judgment)
        await line.save()
        await self._refresh_header_judgment(row, current_user)
        return await self._to_response(row)

    async def delete(self, tenant_id: int, request_id: int, current_user: User) -> None:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in ("draft", "rejected", "revoked"):
            raise BusinessLogicError("仅草稿、已驳回或已撤销状态可删除")
        now = resolve_business_datetime()
        row.deleted_at = now
        apply_update_audit(row, current_user)
        await row.save()
        items = await LabRequestMeasureItem.filter(
            tenant_id=tenant_id, lab_request_id=request_id, deleted_at__isnull=True
        ).all()
        for item in items:
            item.deleted_at = now
            await item.save()

    async def submit(
        self, tenant_id: int, request_id: int, current_user: User
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in ("draft", "rejected"):
            raise BusinessLogicError("仅草稿或已驳回状态可提交")
        if not (row.title or "").strip():
            raise ValidationError("试验名称不能为空")

        now = resolve_business_datetime()
        row.submitted_at = now
        row.reject_reason = None
        row.rejected_at = None
        apply_update_audit(row, current_user)

        if self._requires_manager_review(row.business_type):
            row.status = LAB_REQUEST_STATUS_PENDING_REVIEW
            await row.save()

            approval_instance = None
            from core.services.approval.approval_instance_service import (
                ApprovalInstanceService,
            )
            from core.services.approval.audit_binding_service import AuditBindingService

            if await AuditBindingService.is_audit_enabled(tenant_id, self.AUDIT_NODE):
                approval_instance = await ApprovalInstanceService.start_approval_for_node(
                    tenant_id=tenant_id,
                    user_id=current_user.id,
                    node_key=self.AUDIT_NODE,
                    entity_type="lab_request",
                    entity_id=row.id,
                    entity_uuid=str(row.uuid),
                    title=f"实验委托审核 {row.code}",
                    content=row.title,
                    business_type=row.business_type or "",
                    send_notification=True,
                )
                if approval_instance is None:
                    raise ValidationError(
                        f"审核已开启但未找到可用审批流程，请检查 {self.AUDIT_NODE} 绑定"
                    )

            from apps.kuaiplm.services.plm_audit_flow_sync import submit_instance_auto_passed

            if submit_instance_auto_passed(approval_instance):
                return await self.approve(tenant_id, request_id, current_user)
            return await self._to_response(row)

        row.status = LAB_REQUEST_STATUS_PENDING
        await row.save()
        await self._notify_lab_pending(tenant_id, row)
        return await self._to_response(row)

    async def approve(
        self, tenant_id: int, request_id: int, current_user: User
    ) -> LabRequestResponse:
        """研发经理审核通过：进入实验室待受理。"""
        row = await self._get_row(tenant_id, request_id)
        if row.status != LAB_REQUEST_STATUS_PENDING_REVIEW:
            raise BusinessLogicError("仅待经理审核状态可通过")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=self.AUDIT_NODE,
            entity_type="lab_request",
            entity_id=request_id,
            doc_label="实验委托",
            verb="审核",
        )
        row.status = LAB_REQUEST_STATUS_PENDING
        apply_update_audit(row, current_user)
        await row.save()
        await self._notify_lab_pending(tenant_id, row)
        return await self._to_response(row)

    async def fill_outsource_price(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestFillOutsourcePriceRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.business_type != "outsource":
            raise BusinessLogicError("仅委外试验申请可填写价格")
        if row.status != "pending":
            raise BusinessLogicError("仅待受理状态可填写委外价格")
        row.outsource_price = data.outsource_price
        row.price_filled_by = current_user.id
        row.price_filled_by_name = (
            getattr(current_user, "full_name", None)
            or getattr(current_user, "username", None)
            or str(current_user.id)
        )
        row.price_filled_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def accept(
        self, tenant_id: int, request_id: int, current_user: User
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待受理状态可由实验室受理")
        if row.business_type == "outsource" and row.outsource_price is None:
            raise ValidationError("委外试验须由采购填写价格后方可受理")
        row.status = "in_lab"
        row.accepted_at = resolve_business_datetime()
        row.started_at = row.started_at or resolve_business_datetime()
        if not row.lab_owner_name:
            row.lab_owner_name = (
                getattr(current_user, "full_name", None)
                or getattr(current_user, "username", None)
                or str(current_user.id)
            )
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def complete(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestCompleteRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status != "in_lab":
            raise BusinessLogicError("仅实验中状态可完成")
        items = await self._list_measure_items(tenant_id, request_id)
        if items:
            missing = [i for i in items if not (i.final_judgment or i.auto_judgment)]
            if missing:
                raise ValidationError("尚有试验项未完成实测判定，请先保存实测")
            await self._refresh_header_judgment(row, current_user)
            row = await self._get_row(tenant_id, request_id)
        if data.result_summary is not None:
            row.result_summary = data.result_summary
        if data.judgment is not None:
            row.judgment = self._validate_judgment(data.judgment)
        elif not row.judgment and items:
            row.judgment = aggregate_header_judgment([i.final_judgment for i in items])
        if data.report_file_uuid is not None:
            row.report_file_uuid = data.report_file_uuid
        if data.report_url is not None:
            row.report_url = data.report_url
        row.status = "completed"
        row.completed_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()
        from apps.kuaiplm.services.kuaiplm_business_notification import (
            notify_lab_request_completed,
        )

        await notify_lab_request_completed(
            tenant_id,
            request_id=row.id,
            code=row.code,
            title=row.title or row.code,
            creator_user_id=row.created_by,
            judgment=row.judgment,
        )
        return await self._to_response(row)

    async def reject(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestRejectRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in (
            LAB_REQUEST_STATUS_PENDING_REVIEW,
            "pending",
            "in_lab",
        ):
            raise BusinessLogicError("仅待经理审核、待受理或实验中状态可驳回")
        if row.status == LAB_REQUEST_STATUS_PENDING_REVIEW:
            from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

            await assert_plm_manual_approval_action(
                tenant_id,
                audit_node=self.AUDIT_NODE,
                entity_type="lab_request",
                entity_id=request_id,
                doc_label="实验委托",
                verb="驳回",
            )
        row.status = "rejected"
        row.rejected_at = resolve_business_datetime()
        row.reject_reason = (data.reason or "").strip() or None
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    def _user_display_name(self, user: User) -> str:
        return (
            getattr(user, "full_name", None)
            or getattr(user, "username", None)
            or str(user.id)
        )

    def _assert_report_editable(self, row: LabRequest) -> None:
        if row.status not in ("in_lab", "completed"):
            raise BusinessLogicError("仅实验中或已完成状态可编制实验报告")
        status = row.report_status or "none"
        if status == "pending":
            raise BusinessLogicError("报告审批中，请先驳回后再修改")
        if status == "approved":
            has_doc = bool(
                (row.report_url or "").strip() or (row.report_file_uuid or "").strip()
            )
            if has_doc:
                raise BusinessLogicError("报告已批准，不可再改")
            # 已批准但未上传报告文件：允许补传真实报告

    def _report_has_document(self, row: LabRequest) -> bool:
        return bool(
            (row.report_url or "").strip() or (row.report_file_uuid or "").strip()
        )

    async def save_report(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestReportSaveRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        self._assert_report_editable(row)
        if data.report_title is not None:
            row.report_title = (data.report_title or "").strip() or None
        if data.result_summary is not None:
            row.result_summary = data.result_summary
        if data.report_file_uuid is not None:
            row.report_file_uuid = (data.report_file_uuid or "").strip() or None
        if data.report_url is not None:
            row.report_url = (data.report_url or "").strip() or None
        if (row.report_status or "none") in ("none", "rejected", "draft"):
            row.report_status = "draft"
            row.report_reject_reason = None
            row.report_rejected_at = None
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def submit_report(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestReportSaveRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in ("in_lab", "completed"):
            raise BusinessLogicError("仅实验中或已完成状态可提交实验报告审批")
        if (row.report_status or "none") == "approved":
            raise BusinessLogicError("报告已批准")
        if (row.report_status or "none") == "pending":
            raise BusinessLogicError("报告已在审批中")
        # 允许提交时一并带上正文
        if data.report_title is not None:
            row.report_title = (data.report_title or "").strip() or None
        if data.result_summary is not None:
            row.result_summary = data.result_summary
        if data.report_file_uuid is not None:
            row.report_file_uuid = (data.report_file_uuid or "").strip() or None
        if data.report_url is not None:
            row.report_url = (data.report_url or "").strip() or None
        has_doc = self._report_has_document(row)
        if not has_doc:
            raise ValidationError("提交报告审批前须上传报告文件或填写报告链接")
        now = resolve_business_datetime()
        row.report_status = "pending"
        row.report_submitted_at = now
        row.report_submitted_by = current_user.id
        row.report_submitted_by_name = self._user_display_name(current_user)
        row.report_reject_reason = None
        row.report_rejected_at = None
        apply_update_audit(row, current_user)
        await row.save()
        from apps.kuaiplm.services.kuaiplm_business_notification import (
            notify_lab_report_submitted,
        )

        await notify_lab_report_submitted(
            tenant_id,
            request_id=row.id,
            code=row.code,
            title=row.title,
            report_title=row.report_title,
            creator_user_id=row.created_by,
            report_submitted_by=row.report_submitted_by,
        )
        return await self._to_response(row)

    async def approve_report(
        self, tenant_id: int, request_id: int, current_user: User
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if (row.report_status or "none") != "pending":
            raise BusinessLogicError("仅待审报告可批准")
        if not self._report_has_document(row):
            raise ValidationError("报告未上传文件也未填写链接，不能批准为正式报告")
        now = resolve_business_datetime()
        row.report_status = "approved"
        row.report_approved_at = now
        row.report_approved_by = current_user.id
        row.report_approved_by_name = self._user_display_name(current_user)
        row.report_reject_reason = None
        row.report_rejected_at = None
        apply_update_audit(row, current_user)
        await row.save()
        from apps.kuaiplm.services.kuaiplm_business_notification import (
            notify_lab_report_approved,
        )

        await notify_lab_report_approved(
            tenant_id,
            request_id=row.id,
            code=row.code,
            title=row.title,
            report_title=row.report_title,
            creator_user_id=row.created_by,
            report_submitted_by=row.report_submitted_by,
        )
        return await self._to_response(row)

    async def reject_report(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestReportRejectRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if (row.report_status or "none") != "pending":
            raise BusinessLogicError("仅待审报告可驳回")
        reason = (data.reason or "").strip()
        if not reason:
            raise ValidationError("报告驳回原因不能为空")
        row.report_status = "rejected"
        row.report_rejected_at = resolve_business_datetime()
        row.report_reject_reason = reason
        apply_update_audit(row, current_user)
        await row.save()
        from apps.kuaiplm.services.kuaiplm_business_notification import (
            notify_lab_report_rejected,
        )

        await notify_lab_report_rejected(
            tenant_id,
            request_id=row.id,
            code=row.code,
            title=row.title,
            report_title=row.report_title,
            reject_reason=reason,
            creator_user_id=row.created_by,
            report_submitted_by=row.report_submitted_by,
        )
        return await self._to_response(row)

    async def link_ng_exception(
        self,
        tenant_id: int,
        request_id: int,
        item_id: int,
        data: LabRequestLinkExceptionRequest,
        current_user: User,
    ) -> LabRequestResponse:
        row = await self._get_row(tenant_id, request_id)
        if row.status not in ("in_lab", "completed"):
            raise BusinessLogicError("仅实验中或已完成状态可为 NG 项关联异常")
        line = await LabRequestMeasureItem.filter(
            tenant_id=tenant_id,
            lab_request_id=request_id,
            id=item_id,
            deleted_at__isnull=True,
        ).first()
        if not line:
            raise NotFoundError("实测行不存在")
        fj = (line.final_judgment or line.auto_judgment or "").strip().lower()
        if fj not in {"ng", "fail"}:
            raise BusinessLogicError("仅不合格或 NG 试验项可关联质量异常")
        if line.quality_exception_id:
            raise BusinessLogicError("该试验项已关联质量异常，不可重复创建")

        from apps.kuaizhizao.services.exception_service import ExceptionService

        desc = (data.problem_description or "").strip() or (
            f"实验委托 {row.code} 试验项「{line.item_name}」判定 {fj}"
            + (f"，实测 {line.measured_value}" if line.measured_value else "")
        )
        severity = (data.severity or "major").strip().lower() or "major"
        if severity not in {"minor", "major", "critical"}:
            raise ValidationError("非法严重程度")
        exc = await ExceptionService().create_from_inspection(
            tenant_id=tenant_id,
            source_type="lab_request",
            source_id=row.id,
            created_by=current_user.id,
            problem_description=desc,
            severity=severity,
            remarks=(data.remarks or "").strip()
            or f"lab_request_id={row.id};measure_item_id={line.id}",
        )
        line.quality_exception_id = exc.id
        line.quality_exception_uuid = getattr(exc, "uuid", None)
        line.exception_linked_at = resolve_business_datetime()
        await line.save()
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def revoke(
        self,
        tenant_id: int,
        request_id: int,
        data: LabRequestRevokeRequest,
        current_user: User,
    ) -> LabRequestResponse:
        """撤销审核：回到草稿，须重新提交再审（与全站撤销审核契约一致）。"""
        row = await self._get_row(tenant_id, request_id)
        if row.status in ("completed", "draft"):
            raise BusinessLogicError("草稿或已完成单据不可撤销审核")
        if row.status == "revoked":
            raise BusinessLogicError("单据已是撤销终态，请直接编辑或删除")
        reason = (data.reason or "").strip()
        if not reason:
            raise ValidationError("撤销原因不能为空")

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        try:
            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type="lab_request",
                entity_id=request_id,
                operator_id=current_user.id,
            )
        except Exception:
            # 无待审实例或已结束：仍允许单据回草稿
            pass

        row.status = LAB_REQUEST_STATUS_DRAFT
        row.submitted_at = None
        row.accepted_at = None
        row.started_at = None
        row.completed_at = None
        row.rejected_at = None
        row.reject_reason = None
        row.lab_owner_name = None
        row.revoked_at = resolve_business_datetime()
        row.revoke_reason = reason
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)
