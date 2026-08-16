"""ISO 条款目录服务"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.qms_internal_audit import QmsInternalAudit
from apps.kuaizhizao.models.qms_iso_clause import QmsIsoClause
from apps.kuaizhizao.models.qms_system_document import QmsSystemDocument
from apps.kuaizhizao.schemas.quality_qms import (
    QmsInternalAuditResponse,
    QmsIsoClauseComplianceSummary,
    QmsIsoClauseCreate,
    QmsIsoClauseListResponse,
    QmsIsoClauseLoadPresetResult,
    QmsIsoClauseResponse,
    QmsIsoClauseTreeNode,
    QmsIsoClauseUpdate,
    QmsSystemDocumentResponse,
)
from apps.kuaizhizao.services.qms_iso_clause_preset import ISO9001_2015_PRESET, ISO9001_2015_STANDARD
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

COMPLETED_AUDIT_STATUSES = {"completed", "closed"}


class QmsIsoClauseService(AppBaseService[QmsIsoClause]):
    def __init__(self) -> None:
        super().__init__(QmsIsoClause)
        self.model = QmsIsoClause

    async def _get_row(self, tenant_id: int, clause_id: int) -> QmsIsoClause:
        row = await QmsIsoClause.filter(id=clause_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not row:
            raise NotFoundError("ISO条款不存在")
        return row

    async def _ensure_unique_code(
        self,
        tenant_id: int,
        standard_code: str,
        clause_code: str,
        *,
        exclude_id: Optional[int] = None,
    ) -> None:
        query = QmsIsoClause.filter(
            tenant_id=tenant_id,
            standard_code=standard_code.strip(),
            clause_code=clause_code.strip(),
            deleted_at__isnull=True,
        )
        if exclude_id is not None:
            query = query.exclude(id=exclude_id)
        if await query.exists():
            raise BusinessLogicError("同标准下条款号已存在")

    async def _validate_parent(
        self,
        tenant_id: int,
        standard_code: str,
        parent_id: Optional[int],
        *,
        self_id: Optional[int] = None,
    ) -> None:
        if parent_id is None:
            return
        if self_id is not None and parent_id == self_id:
            raise BusinessLogicError("父条款不能为自身")
        parent = await QmsIsoClause.filter(
            id=parent_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if not parent:
            raise BusinessLogicError("父条款不存在")
        if parent.standard_code != standard_code:
            raise BusinessLogicError("父条款标准不一致")

    async def create_clause(
        self, tenant_id: int, payload: QmsIsoClauseCreate, user: Optional[User] = None
    ) -> QmsIsoClauseResponse:
        data = payload.model_dump(exclude_unset=False)
        standard_code = str(data["standard_code"]).strip()
        clause_code = str(data["clause_code"]).strip()
        await self._ensure_unique_code(tenant_id, standard_code, clause_code)
        await self._validate_parent(tenant_id, standard_code, data.get("parent_id"))
        row = QmsIsoClause(
            tenant_id=tenant_id,
            standard_code=standard_code,
            clause_code=clause_code,
            title=data["title"].strip(),
            description=data.get("description"),
            parent_id=data.get("parent_id"),
            sort_order=int(data.get("sort_order") or 0),
            is_active=bool(data.get("is_active", True)),
        )
        apply_create_audit(row, user)
        await row.save()
        return QmsIsoClauseResponse.model_validate(row)

    async def list_clauses(
        self,
        tenant_id: int,
        *,
        standard_code: Optional[str] = None,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 500,
    ) -> QmsIsoClauseListResponse:
        query = QmsIsoClause.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if standard_code:
            query = query.filter(standard_code=standard_code.strip())
        if keyword:
            query = query.filter(title__icontains=keyword)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        total = await query.count()
        rows = await query.order_by("sort_order", "clause_code", "id").offset(skip).limit(limit)
        return QmsIsoClauseListResponse(
            items=[QmsIsoClauseResponse.model_validate(r) for r in rows],
            total=total,
        )

    async def get_clause(self, tenant_id: int, clause_id: int) -> QmsIsoClauseResponse:
        row = await self._get_row(tenant_id, clause_id)
        return QmsIsoClauseResponse.model_validate(row)

    async def update_clause(
        self,
        tenant_id: int,
        clause_id: int,
        payload: QmsIsoClauseUpdate,
        user: Optional[User] = None,
    ) -> QmsIsoClauseResponse:
        row = await self._get_row(tenant_id, clause_id)
        data = payload.model_dump(exclude_unset=True)
        standard_code = str(data.get("standard_code") or row.standard_code).strip()
        clause_code = str(data.get("clause_code") or row.clause_code).strip()
        if "standard_code" in data or "clause_code" in data:
            await self._ensure_unique_code(
                tenant_id, standard_code, clause_code, exclude_id=clause_id
            )
        parent_id = data.get("parent_id", row.parent_id)
        if "parent_id" in data:
            await self._validate_parent(tenant_id, standard_code, parent_id, self_id=clause_id)
        for key, value in data.items():
            if key in {"standard_code", "clause_code", "title"} and isinstance(value, str):
                setattr(row, key, value.strip())
            else:
                setattr(row, key, value)
        apply_update_audit(row, user)
        await row.save()
        return QmsIsoClauseResponse.model_validate(row)

    async def delete_clause(self, tenant_id: int, clause_id: int) -> None:
        row = await self._get_row(tenant_id, clause_id)
        child_exists = await QmsIsoClause.filter(
            tenant_id=tenant_id, parent_id=clause_id, deleted_at__isnull=True
        ).exists()
        if child_exists:
            raise BusinessLogicError("存在子条款，请先删除或移动子条款")
        doc_linked = await QmsSystemDocument.filter(
            tenant_id=tenant_id, iso_clause_id=clause_id, deleted_at__isnull=True
        ).exists()
        audit_linked = await QmsInternalAudit.filter(
            tenant_id=tenant_id, iso_clause_id=clause_id, deleted_at__isnull=True
        ).exists()
        if doc_linked or audit_linked:
            raise BusinessLogicError("条款已被体系文件或内审引用，无法删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()

    async def list_tree(
        self, tenant_id: int, *, standard_code: Optional[str] = None
    ) -> List[QmsIsoClauseTreeNode]:
        query = QmsIsoClause.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
        if standard_code:
            query = query.filter(standard_code=standard_code.strip())
        rows = await query.order_by("sort_order", "clause_code", "id")
        nodes: Dict[int, QmsIsoClauseTreeNode] = {}
        roots: List[QmsIsoClauseTreeNode] = []
        for row in rows:
            node = QmsIsoClauseTreeNode.model_validate(row)
            node.children = []
            nodes[row.id] = node
        for row in rows:
            node = nodes[row.id]
            if row.parent_id and row.parent_id in nodes:
                nodes[row.parent_id].children.append(node)
            else:
                roots.append(node)
        return roots

    async def load_preset(
        self, tenant_id: int, *, standard_code: str = ISO9001_2015_STANDARD, user: Optional[User] = None
    ) -> QmsIsoClauseLoadPresetResult:
        if standard_code != ISO9001_2015_STANDARD:
            raise BusinessLogicError(f"暂不支持预置标准: {standard_code}")
        existing = await QmsIsoClause.filter(
            tenant_id=tenant_id, standard_code=standard_code, deleted_at__isnull=True
        ).all()
        existing_codes = {r.clause_code for r in existing}
        code_to_id = {r.clause_code: r.id for r in existing}
        created = 0
        skipped = 0
        for item in ISO9001_2015_PRESET:
            if item["clause_code"] in existing_codes:
                skipped += 1
                continue
            parent_id = None
            parent_code = item.get("parent_code")
            if parent_code:
                parent_id = code_to_id.get(parent_code)
                if parent_id is None:
                    raise BusinessLogicError(f"预置数据缺少父条款: {parent_code}")
            row = QmsIsoClause(
                tenant_id=tenant_id,
                standard_code=standard_code,
                clause_code=item["clause_code"],
                title=item["title"],
                parent_id=parent_id,
                sort_order=item["sort_order"],
                is_active=True,
            )
            apply_create_audit(row, user)
            await row.save()
            code_to_id[item["clause_code"]] = row.id
            existing_codes.add(item["clause_code"])
            created += 1
        linked = await self._backfill_iso_clause_links(tenant_id)
        return QmsIsoClauseLoadPresetResult(created=created, skipped=skipped, linked=linked)

    async def _backfill_iso_clause_links(self, tenant_id: int) -> int:
        clauses = await QmsIsoClause.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
        code_to_id = {c.clause_code: c.id for c in clauses}
        linked = 0
        docs = await QmsSystemDocument.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            iso_clause_id__isnull=True,
        ).all()
        for doc in docs:
            raw = (doc.iso_clause or "").strip()
            if not raw:
                continue
            cid = code_to_id.get(raw)
            if cid:
                doc.iso_clause_id = cid
                await doc.save(update_fields=["iso_clause_id"])
                linked += 1
        audits = await QmsInternalAudit.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            iso_clause_id__isnull=True,
        ).all()
        for audit in audits:
            raw = (audit.iso_clause or "").strip()
            if not raw:
                continue
            cid = code_to_id.get(raw)
            if cid:
                audit.iso_clause_id = cid
                await audit.save(update_fields=["iso_clause_id"])
                linked += 1
        return linked

    async def _collect_descendant_ids(self, tenant_id: int, clause_id: int) -> List[int]:
        ids: List[int] = [clause_id]
        children = await QmsIsoClause.filter(
            tenant_id=tenant_id, parent_id=clause_id, deleted_at__isnull=True
        ).all()
        for child in children:
            ids.extend(await self._collect_descendant_ids(tenant_id, child.id))
        return ids

    async def _compute_compliance_for_ids(
        self, tenant_id: int, clause_ids: List[int]
    ) -> QmsIsoClauseComplianceSummary:
        now = resolve_business_datetime()
        effective_docs = await QmsSystemDocument.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="effective",
            iso_clause_id__in=clause_ids,
        ).all()
        effective_count = len(effective_docs)
        review_due_count = sum(
            1
            for d in effective_docs
            if d.next_review_at is not None and d.next_review_at <= now
        )
        audits = await QmsInternalAudit.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            iso_clause_id__in=clause_ids,
        ).all()
        internal_audit_count = len(audits)
        completed = [
            a for a in audits if a.status in COMPLETED_AUDIT_STATUSES and a.completed_date is not None
        ]
        last_audit_date = max((a.completed_date for a in completed), default=None)
        has_completed_audit = len(completed) > 0
        no_effective_document = effective_count == 0
        no_completed_audit = not has_completed_audit
        has_gap = no_effective_document or no_completed_audit
        compliance_status = "gap"
        if effective_count > 0:
            compliance_status = "review_due" if review_due_count > 0 else "covered"
        return QmsIsoClauseComplianceSummary(
            effective_document_count=effective_count,
            review_due_count=review_due_count,
            internal_audit_count=internal_audit_count,
            last_audit_date=last_audit_date,
            has_gap=has_gap,
            no_effective_document=no_effective_document,
            no_completed_audit=no_completed_audit,
            compliance_status=compliance_status,
        )

    async def get_compliance_summary(
        self, tenant_id: int, clause_id: int
    ) -> QmsIsoClauseComplianceSummary:
        await self._get_row(tenant_id, clause_id)
        ids = await self._collect_descendant_ids(tenant_id, clause_id)
        return await self._compute_compliance_for_ids(tenant_id, ids)

    async def list_related_documents(
        self, tenant_id: int, clause_id: int, *, limit: int = 50
    ) -> List[QmsSystemDocumentResponse]:
        ids = await self._collect_descendant_ids(tenant_id, clause_id)
        rows = (
            await QmsSystemDocument.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, iso_clause_id__in=ids
            )
            .order_by("-updated_at", "-id")
            .limit(limit)
        )
        return [QmsSystemDocumentResponse.model_validate(r) for r in rows]

    async def list_related_audits(
        self, tenant_id: int, clause_id: int, *, limit: int = 50
    ) -> List[QmsInternalAuditResponse]:
        ids = await self._collect_descendant_ids(tenant_id, clause_id)
        rows = (
            await QmsInternalAudit.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, iso_clause_id__in=ids
            )
            .order_by("-updated_at", "-id")
            .limit(limit)
        )
        return [QmsInternalAuditResponse.model_validate(r) for r in rows]

    async def resolve_clause_snapshot(
        self, tenant_id: int, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        if "iso_clause_id" not in data:
            return data
        iso_clause_id = data.get("iso_clause_id")
        if iso_clause_id is None:
            data["iso_clause"] = None
            return data
        clause = await QmsIsoClause.filter(
            id=iso_clause_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if not clause:
            raise BusinessLogicError("ISO条款不存在")
        data["iso_clause"] = clause.clause_code
        return data


iso_clause_service = QmsIsoClauseService()
