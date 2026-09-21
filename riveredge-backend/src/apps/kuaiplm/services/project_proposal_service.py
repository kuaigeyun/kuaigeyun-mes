"""项目建议书服务（R-15 #68）"""

from __future__ import annotations

from typing import Any, List, Optional

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaiplm.constants.project_proposal_template import (
    CUSTOMER_MATERIAL_TYPES,
    DEV_REQ_TYPES,
    DEV_REQ_TYPES_NEED_SUPPLIER,
    PRODUCT_LINES,
    PROPOSING_DEPTS,
    SUPPLIER_ASSESSMENT_MATERIAL_KEYS,
    SUPPLIER_ASSESSMENT_MATERIALS,
)
from apps.kuaiplm.models.project_proposal import ProjectProposal
from apps.kuaiplm.models.rd_project import RdProject
from apps.kuaiplm.schemas.project_proposal import (
    ProjectProposalCreate,
    ProjectProposalListResponse,
    ProjectProposalResponse,
    ProjectProposalSupplierFill,
    ProjectProposalUpdate,
    SupplierAssessmentLine,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.services.approval.audit_binding_service import AuditBindingService
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

AUDIT_NODE = "project_proposal"
ALLOWED_STATUS = {"draft", "pending", "approved", "issued", "rejected"}


class ProjectProposalService(AppBaseService[ProjectProposal]):
    code_field = "proposal_code"
    rule_code = "KUAI_PLM_PROJECT_PROPOSAL_CODE"
    code_prefix = "XMJY"

    def __init__(self) -> None:
        super().__init__(ProjectProposal)
        self.model = ProjectProposal

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        return await self.generate_code(tenant_id, self.rule_code, prefix=self.code_prefix)

    async def _require_project(self, tenant_id: int, project_id: int) -> RdProject:
        project = await RdProject.filter(
            tenant_id=tenant_id, id=project_id, deleted_at__isnull=True
        ).first()
        if not project:
            raise ValidationError("研发项目不存在")
        return project

    async def _get_row(self, tenant_id: int, proposal_id: int) -> ProjectProposal:
        row = await ProjectProposal.filter(
            tenant_id=tenant_id, id=proposal_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("项目建议书不存在")
        return row

    def _normalize_str_list(self, raw: Optional[List[str]], allowed: frozenset[str], label: str) -> List[str]:
        if not raw:
            return []
        out: List[str] = []
        for item in raw:
            if label == "开发要求分类":
                key = str(item or "").strip().upper()
            else:
                key = str(item or "").strip().lower()
            if not key:
                continue
            if key not in allowed:
                raise ValidationError(f"非法{label}: {item}")
            if key not in out:
                out.append(key)
        return out

    def _normalize_optional_text(self, value: Optional[str], *, max_len: int) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        if len(text) > max_len:
            raise ValidationError(f"字段长度不能超过 {max_len}")
        return text

    def _default_supplier_lines(self) -> List[dict[str, Any]]:
        return [
            {"material_key": key, "suppliers_text": None}
            for key, _ in SUPPLIER_ASSESSMENT_MATERIALS
        ]

    def _normalize_supplier_lines(
        self, raw: Optional[List[SupplierAssessmentLine | dict[str, Any]]]
    ) -> List[dict[str, Any]]:
        if not raw:
            return self._default_supplier_lines()
        by_key: dict[str, str | None] = {}
        for item in raw:
            if isinstance(item, SupplierAssessmentLine):
                data = item.model_dump()
            elif isinstance(item, dict):
                data = item
            else:
                raise ValidationError("供应商评审行格式非法")
            key = str(data.get("material_key") or "").strip()
            if key not in SUPPLIER_ASSESSMENT_MATERIAL_KEYS:
                raise ValidationError(f"非法物料类型: {key}")
            text = self._normalize_optional_text(data.get("suppliers_text"), max_len=500)
            by_key[key] = text
        return [
            {"material_key": key, "suppliers_text": by_key.get(key)}
            for key, _ in SUPPLIER_ASSESSMENT_MATERIALS
        ]

    def _supplier_assessment_ready(self, lines: List[dict[str, Any]]) -> bool:
        for line in lines:
            text = str(line.get("suppliers_text") or "").strip()
            if not text:
                return False
        return True

    def _needs_supplier_assessment(self, dev_req_types: List[str]) -> bool:
        normalized = {str(x).strip().upper() for x in (dev_req_types or []) if str(x).strip()}
        return bool(normalized & DEV_REQ_TYPES_NEED_SUPPLIER)

    def _apply_sales_fields(self, row: ProjectProposal, payload: ProjectProposalCreate | ProjectProposalUpdate) -> None:
        data = payload.model_dump(exclude_unset=True)
        if "title" in data and data["title"] is not None:
            row.title = str(data["title"]).strip()
        for field in (
            "summary",
            "expected_date",
            "proposed_at",
            "sample_date",
            "mass_production_date",
            "cost_change_notes",
            "remarks",
        ):
            if field in data:
                setattr(row, field, data[field])
        text_fields = {
            "customer_name": 200,
            "proposer_name": 100,
            "sample_quantity": 80,
            "customer_code": 80,
            "contact_name": 100,
            "contact_phone": 50,
            "contact_email": 200,
            "customer_product_model": 200,
            "company_product_model": 200,
        }
        for field, max_len in text_fields.items():
            if field in data:
                setattr(row, field, self._normalize_optional_text(data[field], max_len=max_len))
        if "product_lines" in data and data["product_lines"] is not None:
            row.product_lines = self._normalize_str_list(data["product_lines"], PRODUCT_LINES, "产品类型")
        if "customer_material_types" in data and data["customer_material_types"] is not None:
            row.customer_material_types = self._normalize_str_list(
                data["customer_material_types"], CUSTOMER_MATERIAL_TYPES, "客户资料类型"
            )
        if "dev_req_types" in data and data["dev_req_types"] is not None:
            row.dev_req_types = self._normalize_str_list(data["dev_req_types"], DEV_REQ_TYPES, "开发要求分类")
        if "proposing_dept" in data:
            dept = self._normalize_optional_text(data.get("proposing_dept"), max_len=32)
            if dept and dept not in PROPOSING_DEPTS:
                raise ValidationError(f"非法提出部门: {dept}")
            row.proposing_dept = dept

    async def create(
        self, tenant_id: int, payload: ProjectProposalCreate, user: User
    ) -> ProjectProposalResponse:
        project = await self._require_project(tenant_id, payload.project_id)
        code = await self._ensure_code(tenant_id, payload.proposal_code)
        exists = await ProjectProposal.filter(
            tenant_id=tenant_id, proposal_code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError("建议书单号已存在")

        row = ProjectProposal(
            tenant_id=tenant_id,
            proposal_code=code,
            project_id=project.id,
            project_code=project.project_code,
            project_name=project.project_name,
            title=payload.title.strip(),
            status="draft",
            product_lines=[],
            customer_material_types=[],
            dev_req_types=[],
            supplier_assessment_lines=self._default_supplier_lines(),
        )
        self._apply_sales_fields(row, payload)
        apply_create_audit(row, user)
        await row.save()
        return ProjectProposalResponse.model_validate(row)

    async def list(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> ProjectProposalListResponse:
        query = ProjectProposal.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            query = query.filter(project_id=project_id)
        if status:
            if status not in ALLOWED_STATUS:
                raise ValidationError(f"非法状态: {status}")
            query = query.filter(status=status)
        if keyword:
            query = query.filter(title__icontains=keyword)
        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        return ProjectProposalListResponse(
            items=[ProjectProposalResponse.model_validate(r) for r in rows],
            total=total,
        )

    async def get(self, tenant_id: int, proposal_id: int) -> ProjectProposalResponse:
        row = await self._get_row(tenant_id, proposal_id)
        return ProjectProposalResponse.model_validate(row)

    async def update(
        self, tenant_id: int, proposal_id: int, payload: ProjectProposalUpdate, user: User
    ) -> ProjectProposalResponse:
        row = await self._get_row(tenant_id, proposal_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回可编辑")
        self._apply_sales_fields(row, payload)
        apply_update_audit(row, user)
        await row.save()
        return ProjectProposalResponse.model_validate(row)

    async def fill_supplier(
        self,
        tenant_id: int,
        proposal_id: int,
        payload: ProjectProposalSupplierFill,
        user: User,
    ) -> ProjectProposalResponse:
        """采购填写供应商（通用单供应商或定制评审表）。"""
        row = await self._get_row(tenant_id, proposal_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回可填写供应商")
        if payload.supplier_assessment_lines is not None:
            lines = self._normalize_supplier_lines(payload.supplier_assessment_lines)
            row.supplier_assessment_lines = lines
            row.procurement_reviewer_name = self._normalize_optional_text(
                payload.procurement_reviewer_name, max_len=100
            )
            row.supplier_remark = payload.supplier_remark
            first_supplier = next(
                (
                    str(line.get("suppliers_text") or "").strip()
                    for line in lines
                    if line.get("suppliers_text")
                ),
                "",
            )
            row.supplier_name = first_supplier or None
        else:
            name = self._normalize_optional_text(payload.supplier_name, max_len=200)
            if not name:
                raise ValidationError("供应商名称必填")
            row.supplier_id = payload.supplier_id
            row.supplier_code = self._normalize_optional_text(payload.supplier_code, max_len=80)
            row.supplier_name = name
            row.supplier_contact = self._normalize_optional_text(
                payload.supplier_contact, max_len=200
            )
            row.supplier_remark = payload.supplier_remark
        apply_update_audit(row, user)
        await row.save()
        return ProjectProposalResponse.model_validate(row)

    async def submit(
        self, tenant_id: int, proposal_id: int, user: User
    ) -> ProjectProposalResponse:
        row = await self._get_row(tenant_id, proposal_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回可提交审核")
        if self._needs_supplier_assessment(list(row.dev_req_types or [])):
            if not (row.summary and str(row.summary).strip()):
                raise ValidationError("请先填写开发要求概述")
            lines = self._normalize_supplier_lines(list(row.supplier_assessment_lines or []))
            if not self._supplier_assessment_ready(lines):
                raise ValidationError("开发要求为 D/E/F 类时，采购须完整填写供应商评审表")
        elif not (row.supplier_name or "").strip():
            raise ValidationError("提交前须由采购填写供应商")

        row.status = "pending"
        row.submitted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()

        approval_instance = None
        if await AuditBindingService.is_audit_enabled(tenant_id, AUDIT_NODE):
            approval_instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=user.id,
                node_key=AUDIT_NODE,
                entity_type="project_proposal",
                entity_id=row.id,
                entity_uuid=str(row.uuid),
                title=f"项目建议书 {row.proposal_code}",
                content=row.title,
                business_type="",
                send_notification=True,
            )
            if approval_instance is None:
                raise ValidationError(
                    f"审核已开启但未找到可用审批流程，请检查 {AUDIT_NODE} 绑定"
                )
        from apps.kuaiplm.services.plm_audit_flow_sync import submit_instance_auto_passed

        if submit_instance_auto_passed(approval_instance):
            return await self.approve(tenant_id, proposal_id, user)
        return ProjectProposalResponse.model_validate(row)

    async def approve(
        self, tenant_id: int, proposal_id: int, user: User
    ) -> ProjectProposalResponse:
        row = await self._get_row(tenant_id, proposal_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审单据可通过")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type="project_proposal",
            entity_id=proposal_id,
            doc_label="项目建议书",
            verb="审核",
        )
        row.status = "approved"
        row.approved_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        return ProjectProposalResponse.model_validate(row)

    async def reject(
        self, tenant_id: int, proposal_id: int, user: User
    ) -> ProjectProposalResponse:
        row = await self._get_row(tenant_id, proposal_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审单据可驳回")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type="project_proposal",
            entity_id=proposal_id,
            doc_label="项目建议书",
            verb="驳回",
        )
        row.status = "rejected"
        apply_update_audit(row, user)
        await row.save()
        return ProjectProposalResponse.model_validate(row)

    async def issue(
        self, tenant_id: int, proposal_id: int, user: User
    ) -> ProjectProposalResponse:
        """审批后下发研发。"""
        row = await self._get_row(tenant_id, proposal_id)
        if row.status != "approved":
            raise BusinessLogicError("仅已审核建议书可下发研发")
        row.status = "issued"
        row.issued_at = resolve_business_datetime()
        row.issued_by = user.id
        row.issued_by_name = getattr(user, "name", None) or getattr(user, "username", None)
        apply_update_audit(row, user)
        await row.save()
        return ProjectProposalResponse.model_validate(row)

    async def delete(self, tenant_id: int, proposal_id: int, user: User) -> None:
        row = await self._get_row(tenant_id, proposal_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回可删除")
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
