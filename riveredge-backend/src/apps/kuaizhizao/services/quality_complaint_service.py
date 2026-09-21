"""质量投诉服务（R-11 WP-11B 单头壳）。"""

from __future__ import annotations

from datetime import datetime, time
from typing import Any, Dict, List, Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants.quality_complaint_code_rules import (
    CUSTOMER_CONTAINMENT_HOUR,
    CUSTOMER_CORRECTIVE_SLA_WORKDAYS,
    resolve_complaint_code_prefix,
    resolve_complaint_rule_code,
)
from apps.kuaizhizao.constants.quality_complaint_types import (
    COMPLAINT_CUSTOMER,
    COMPLAINT_IQC_INCOMING,
    COMPLAINT_LINE_INCOMING,
    COMPLAINT_OQC,
    COMPLAINT_PQC,
    QUALITY_COMPLAINT_DEFAULT_SLA_WORKDAYS,
    QUALITY_COMPLAINT_DEFECT_CATEGORIES,
    QUALITY_COMPLAINT_TYPE_DEFAULT,
    QUALITY_COMPLAINT_TYPES,
)
from apps.kuaizhizao.models.quality_complaint import QualityComplaint
from apps.kuaizhizao.schemas.quality_complaint import (
    QualityComplaintCreate,
    QualityComplaintListItem,
    QualityComplaintListResponse,
    QualityComplaintResponse,
    QualityComplaintRevokeRequest,
    QualityComplaintSupplierResponseRequest,
    QualityComplaintUpdate,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.services.approval.audit_binding_service import AuditBindingService
from core.services.business.workday_service import shift_by_workdays, today_site_date
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

AUDIT_NODE = "quality_complaint"
QUALITY_COMPLAINT_AUDIT_NODE_BY_TYPE = {
    COMPLAINT_IQC_INCOMING: "quality_complaint_iqc_incoming",
    COMPLAINT_LINE_INCOMING: "quality_complaint_line_incoming",
    COMPLAINT_PQC: "quality_complaint_pqc",
    COMPLAINT_OQC: "quality_complaint_oqc",
    COMPLAINT_CUSTOMER: "quality_complaint_customer",
}
_COMPLAINT_EXTENSION_KEYS = frozenset(
    {
        "inspection_qty",
        "defect_qty",
        "defect_rate_pct",
        "used_qty",
        "root_cause_analysis",
        "corrective_action",
        "containment_action",
    }
)


def _normalize_complaint_extension(
    payload: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not payload or not isinstance(payload, dict):
        return None
    out: Dict[str, Any] = {}
    for key, value in payload.items():
        if key not in _COMPLAINT_EXTENSION_KEYS:
            continue
        if value is None or value == "":
            continue
        out[key] = value
    inspection_qty = out.get("inspection_qty")
    defect_qty = out.get("defect_qty")
    if inspection_qty is not None and defect_qty is not None:
        try:
            iq = float(inspection_qty)
            dq = float(defect_qty)
            if iq > 0:
                out["defect_rate_pct"] = round(dq / iq * 100, 4)
        except (TypeError, ValueError):
            pass
    return out or None


ALLOWED_STATUS = {
    "draft",
    "pending",
    "approved",
    "rejected",
    "processing",
    "closed",
    "revoked",
}


class QualityComplaintService(AppBaseService[QualityComplaint]):
    code_field = "code"
    rule_code = "QUALITY_COMPLAINT_CODE"
    code_prefix = "QC"

    def __init__(self) -> None:
        super().__init__(QualityComplaint)
        self.model = QualityComplaint

    async def _ensure_code(
        self, tenant_id: int, code: Optional[str], *, business_type: str
    ) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        rule_code = resolve_complaint_rule_code(business_type)
        prefix = resolve_complaint_code_prefix(business_type)
        return await self.generate_code(tenant_id, rule_code, prefix=prefix)

    def _validate_business_type(self, business_type: str) -> str:
        bt = (business_type or "").strip().lower()
        if bt not in QUALITY_COMPLAINT_TYPES:
            raise ValidationError(f"非法投诉业务类型: {business_type}")
        return bt

    def _resolve_audit_node_key(self, business_type: str) -> str:
        bt = self._validate_business_type(business_type)
        node_key = QUALITY_COMPLAINT_AUDIT_NODE_BY_TYPE.get(bt)
        if not node_key:
            raise ValidationError(f"未配置审批节点: quality_complaint / {bt}")
        return node_key

    def _validate_defect_category(self, defect_category: Optional[str]) -> Optional[str]:
        if defect_category is None or str(defect_category).strip() == "":
            return None
        cat = str(defect_category).strip().lower()
        if cat not in QUALITY_COMPLAINT_DEFECT_CATEGORIES:
            raise ValidationError(f"非法缺陷分类: {defect_category}")
        return cat

    async def _get_row(self, tenant_id: int, complaint_id: int) -> QualityComplaint:
        row = await QualityComplaint.filter(
            tenant_id=tenant_id, id=complaint_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("质量投诉单不存在")
        return row

    def _to_response(self, row: QualityComplaint) -> QualityComplaintResponse:
        return QualityComplaintResponse.model_validate(row)

    async def create(
        self, tenant_id: int, data: QualityComplaintCreate, user: User
    ) -> QualityComplaintResponse:
        bt = self._validate_business_type(data.business_type or QUALITY_COMPLAINT_TYPE_DEFAULT)
        code = await self._ensure_code(tenant_id, data.code, business_type=bt)
        exists = await QualityComplaint.filter(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"投诉单号已存在: {code}")
        row = QualityComplaint(
            tenant_id=tenant_id,
            code=code,
            title=data.title.strip(),
            business_type=bt,
            defect_category=self._validate_defect_category(data.defect_category),
            description=data.description,
            supplier_id=data.supplier_id,
            supplier_code=data.supplier_code,
            supplier_name=data.supplier_name,
            customer_id=data.customer_id,
            customer_code=data.customer_code,
            customer_name=data.customer_name,
            material_id=data.material_id,
            material_code=data.material_code,
            material_name=data.material_name,
            batch_no=data.batch_no,
            quantity=data.quantity,
            unit=data.unit,
            sla_workdays=data.sla_workdays or QUALITY_COMPLAINT_DEFAULT_SLA_WORKDAYS,
            attachments=data.attachments,
            eight_d_report_id=data.eight_d_report_id,
            source_inspection_type=data.source_inspection_type,
            source_inspection_id=data.source_inspection_id,
            remarks=data.remarks,
            extension_payload=_normalize_complaint_extension(data.extension_payload),
            status="draft",
        )
        apply_create_audit(row, user)
        await row.save()
        return self._to_response(row)

    async def update(
        self,
        tenant_id: int,
        complaint_id: int,
        data: QualityComplaintUpdate,
        user: User,
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status not in ("draft", "rejected", "processing"):
            raise BusinessLogicError("仅草稿、驳回或处理中的投诉可修改")
        payload = data.model_dump(exclude_unset=True)
        if "business_type" in payload and payload["business_type"] is not None:
            if row.status != "draft":
                raise BusinessLogicError("仅草稿可变更业务类型")
            payload["business_type"] = self._validate_business_type(str(payload["business_type"]))
        if "defect_category" in payload:
            payload["defect_category"] = self._validate_defect_category(payload.get("defect_category"))
        if "extension_payload" in payload:
            payload["extension_payload"] = _normalize_complaint_extension(
                payload.get("extension_payload")
            )
        if row.status == "processing":
            allowed = {
                "supplier_response",
                "supplier_response_attachments",
                "export_masked",
                "remarks",
                "attachments",
                "eight_d_report_id",
                "extension_payload",
            }
            payload = {k: v for k, v in payload.items() if k in allowed}
        for key, value in payload.items():
            setattr(row, key, value)
        apply_update_audit(row, user)
        await row.save()
        return self._to_response(row)

    async def get(self, tenant_id: int, complaint_id: int) -> QualityComplaintResponse:
        return self._to_response(await self._get_row(tenant_id, complaint_id))

    async def list(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        business_type: Optional[str] = None,
        defect_category: Optional[str] = None,
        include_export_masked: bool = True,
        order_by: str = "-created_at",
    ) -> QualityComplaintListResponse:
        query = QualityComplaint.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status.strip().lower())
        if business_type:
            query = query.filter(business_type=self._validate_business_type(business_type))
        if defect_category:
            cat = self._validate_defect_category(defect_category)
            if cat:
                query = query.filter(defect_category=cat)
        if not include_export_masked:
            query = query.filter(export_masked=False)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(code__icontains=kw)
                    | Q(title__icontains=kw)
                    | Q(material_code__icontains=kw)
                    | Q(supplier_name__icontains=kw)
                    | Q(customer_name__icontains=kw)
                    | Q(batch_no__icontains=kw)
                )
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by(order_by or "-created_at")
        return QualityComplaintListResponse(
            data=[QualityComplaintListItem.model_validate(r) for r in rows],
            total=total,
            success=True,
        )

    async def delete(self, tenant_id: int, complaint_id: int, user: User) -> bool:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status not in ("draft", "rejected", "revoked"):
            raise BusinessLogicError("仅草稿、驳回或已撤销的投诉可删除")
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        return True

    async def _compute_due_at(self, tenant_id: int, sla_workdays: int) -> datetime:
        due_day = await shift_by_workdays(tenant_id, today_site_date(), max(int(sla_workdays), 1))
        # 截止日站点墙钟 23:59:59 → UTC
        naive_end = datetime.combine(due_day, time(23, 59, 59))
        return resolve_business_datetime(naive_end)

    async def _compute_customer_dual_sla(
        self, tenant_id: int, row: QualityComplaint
    ) -> tuple[datetime, datetime]:
        """客诉双时效：围堵当日17:00 + 纠正措施工作日。"""
        site_day = today_site_date()
        naive_containment = datetime.combine(site_day, time(CUSTOMER_CONTAINMENT_HOUR, 0, 0))
        containment_due = resolve_business_datetime(naive_containment)
        corrective_days = int(
            row.corrective_sla_workdays or CUSTOMER_CORRECTIVE_SLA_WORKDAYS
        )
        corrective_due = await self._compute_due_at(tenant_id, corrective_days)
        return containment_due, corrective_due

    async def submit(
        self, tenant_id: int, complaint_id: int, user: User
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status not in ("draft", "rejected"):
            raise BusinessLogicError("仅草稿或驳回态可提交审核")
        now = resolve_business_datetime()
        row.status = "pending"
        row.submitted_at = now
        bt = row.business_type or QUALITY_COMPLAINT_TYPE_DEFAULT
        if bt == COMPLAINT_CUSTOMER:
            if row.corrective_sla_workdays is None:
                row.corrective_sla_workdays = CUSTOMER_CORRECTIVE_SLA_WORKDAYS
            containment_due, corrective_due = await self._compute_customer_dual_sla(
                tenant_id, row
            )
            row.containment_due_at = containment_due
            row.corrective_due_at = corrective_due
            row.due_at = corrective_due
        else:
            row.due_at = await self._compute_due_at(
                tenant_id, row.sla_workdays or QUALITY_COMPLAINT_DEFAULT_SLA_WORKDAYS
            )
        apply_update_audit(row, user)
        await row.save()

        audit_node_key = self._resolve_audit_node_key(
            row.business_type or QUALITY_COMPLAINT_TYPE_DEFAULT
        )
        approval_instance = None
        if await AuditBindingService.is_audit_enabled(tenant_id, audit_node_key):
            approval_instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=user.id,
                node_key=audit_node_key,
                entity_type=AUDIT_NODE,
                entity_id=row.id,
                entity_uuid=str(row.uuid),
                title=f"质量投诉 {row.code}",
                content=row.title or row.code,
                business_type=row.business_type,
                send_notification=True,
            )
            if approval_instance is None:
                raise ValidationError(
                    f"审核已开启但未找到可用审批流程，请检查 {audit_node_key} 绑定"
                )
        from apps.kuaizhizao.services.quality_complaint_reminder_service import (
            QualityComplaintReminderService,
        )

        await QualityComplaintReminderService.sync_after_submit(tenant_id, row)
        from core.services.approval.audit_flow_guard import approval_instance_finished_on_submit

        if approval_instance and approval_instance_finished_on_submit(approval_instance):
            return await self.approve(tenant_id, complaint_id, user)
        return self._to_response(row)

    async def approve(
        self, tenant_id: int, complaint_id: int, user: User
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审投诉可通过")
        audit_node_key = self._resolve_audit_node_key(
            row.business_type or QUALITY_COMPLAINT_TYPE_DEFAULT
        )
        if await AuditBindingService.is_audit_enabled(tenant_id, audit_node_key):
            from core.services.approval.audit_flow_guard import (
                assert_manual_approval_action_allowed,
                get_approval_gate_status,
            )

            gate = await get_approval_gate_status(
                tenant_id=tenant_id,
                entity_type=AUDIT_NODE,
                entity_id=complaint_id,
            )
            assert_manual_approval_action_allowed(
                gate,
                doc_label="质量投诉",
                verb="审核",
            )
        row.status = "processing"
        row.approved_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        from apps.kuaizhizao.services.quality_complaint_reminder_service import (
            QualityComplaintReminderService,
        )

        await QualityComplaintReminderService.sync_after_approve(tenant_id, row)
        return self._to_response(row)

    async def reject(
        self, tenant_id: int, complaint_id: int, user: User
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审投诉可驳回")
        audit_node_key = self._resolve_audit_node_key(
            row.business_type or QUALITY_COMPLAINT_TYPE_DEFAULT
        )
        if await AuditBindingService.is_audit_enabled(tenant_id, audit_node_key):
            from core.services.approval.audit_flow_guard import (
                assert_manual_approval_action_allowed,
                get_approval_gate_status,
            )

            gate = await get_approval_gate_status(
                tenant_id=tenant_id,
                entity_type=AUDIT_NODE,
                entity_id=complaint_id,
            )
            assert_manual_approval_action_allowed(
                gate,
                doc_label="质量投诉",
                verb="驳回",
            )
        row.status = "rejected"
        apply_update_audit(row, user)
        await row.save()
        from apps.kuaizhizao.services.quality_complaint_reminder_service import (
            QualityComplaintReminderService,
        )

        await QualityComplaintReminderService.sync_after_terminal(
            tenant_id, row.id, reason="审核驳回"
        )
        return self._to_response(row)

    async def save_supplier_response(
        self,
        tenant_id: int,
        complaint_id: int,
        data: QualityComplaintSupplierResponseRequest,
        user: User,
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status != "processing":
            raise BusinessLogicError("仅处理中投诉可填写供方整改")
        row.supplier_response = data.supplier_response
        row.supplier_response_attachments = data.supplier_response_attachments
        apply_update_audit(row, user)
        await row.save()
        return self._to_response(row)

    async def close(
        self, tenant_id: int, complaint_id: int, user: User
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status != "processing":
            raise BusinessLogicError("仅处理中投诉可关闭")
        if not (row.supplier_response or "").strip():
            raise ValidationError("关闭前须填写供方整改说明")
        now = resolve_business_datetime()
        row.status = "closed"
        row.closed_at = now
        row.closed_by = user.id
        row.closed_by_name = getattr(user, "name", None) or getattr(user, "username", None)
        apply_update_audit(row, user)
        await row.save()
        from apps.kuaizhizao.services.quality_complaint_reminder_service import (
            QualityComplaintReminderService,
        )

        await QualityComplaintReminderService.sync_after_terminal(
            tenant_id, row.id, reason="业务关闭"
        )
        return self._to_response(row)

    async def revoke(
        self,
        tenant_id: int,
        complaint_id: int,
        data: QualityComplaintRevokeRequest,
        user: User,
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        if row.status not in ("pending", "processing", "approved"):
            raise BusinessLogicError("仅待审或处理中的投诉可撤销")
        reason = (data.reason or "").strip()
        if not reason:
            raise ValidationError("撤销必须填写原因")
        now = resolve_business_datetime()
        row.status = "revoked"
        row.revoked_at = now
        row.revoked_by = user.id
        row.revoked_by_name = getattr(user, "name", None) or getattr(user, "username", None)
        row.revoke_reason = reason
        apply_update_audit(row, user)
        await row.save()
        from apps.kuaizhizao.services.quality_complaint_reminder_service import (
            QualityComplaintReminderService,
        )

        await QualityComplaintReminderService.sync_after_terminal(
            tenant_id, row.id, reason="撤销"
        )
        return self._to_response(row)

    async def set_export_masked(
        self, tenant_id: int, complaint_id: int, masked: bool, user: User
    ) -> QualityComplaintResponse:
        row = await self._get_row(tenant_id, complaint_id)
        row.export_masked = bool(masked)
        apply_update_audit(row, user)
        await row.save()
        return self._to_response(row)
