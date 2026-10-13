"""
委外检验服务

对标来料/出货检验：以委外收货为来源取单/建单，执行与审核复用质量检验公共能力。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.expressions import Q

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_inspection import OutsourceInspection
from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialReceipt, OutsourceWorkOrder
from apps.kuaizhizao.schemas.outsource_inspection import (
    OutsourceInspectionConduct,
    OutsourceInspectionCreate,
    OutsourceInspectionResponse,
    OutsourceInspectionUpdate,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_quality_inspection_capabilities_on_response,
    enrich_quality_inspection_list_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
    assert_quality_inspection_capability,
)
from apps.kuaizhizao.services.inspection_policy_service import (
    get_quality_effective_config,
    resolve_inspection_policy,
)
from core.services.approval.audit_record_enricher import enrich_items_payload
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OutsourceInspectionService(AppBaseService[OutsourceInspection]):
    def __init__(self) -> None:
        super().__init__(OutsourceInspection)

    async def _allocate_code(self, tenant_id: int) -> str:
        today = today_site_str()
        return await self.generate_code(tenant_id, "OUTSOURCE_INSPECTION_CODE", prefix=f"OSQC{today}")

    async def _ensure_module_enabled(self, tenant_id: int) -> None:
        cfg = await get_quality_effective_config(tenant_id)
        if not (cfg["stage_enabled"].get("osqc") and cfg["module_enabled"].get("outsource")):
            raise ValidationError("组织未启用委外检验")

    def _to_response(self, row: OutsourceInspection) -> OutsourceInspectionResponse:
        return enrich_quality_inspection_capabilities_on_response(
            row,
            OutsourceInspectionResponse.model_validate(row),
        )

    async def create(
        self, tenant_id: int, user_id: int, payload: OutsourceInspectionCreate
    ) -> OutsourceInspectionResponse:
        from apps.kuaizhizao.services.quality_service import (
            _ensure_inspection_material_unit,
            _quality_inspection_initial_review_fields,
            _resolve_inspection_template_fields,
        )

        await self._ensure_module_enabled(tenant_id)
        inspection_code = payload.inspection_code or await self._allocate_code(tenant_id)
        create_fields = payload.model_dump(exclude={"inspection_code"})
        create_fields.update(
            await _quality_inspection_initial_review_fields(tenant_id, "outsource_inspection")
        )
        await _ensure_inspection_material_unit(tenant_id, create_fields)
        template = await _resolve_inspection_template_fields(
            tenant_id,
            int(create_fields["material_id"]),
            "osqc",
        )
        if template.get("inspection_standard") is not None:
            create_fields["inspection_standard"] = template["inspection_standard"]
        if template.get("other_checks") is not None:
            create_fields["other_checks"] = template["other_checks"]
        user_info = await self.get_user_info(user_id)
        create_fields["created_by"] = user_id
        create_fields["created_by_name"] = user_info["name"]
        create_fields["updated_by"] = user_id
        create_fields["updated_by_name"] = user_info["name"]
        row = await OutsourceInspection.create(
            tenant_id=tenant_id,
            inspection_code=inspection_code,
            status="待检验",
            **create_fields,
        )
        return self._to_response(row)

    async def get_by_id(self, tenant_id: int, inspection_id: int) -> OutsourceInspectionResponse:
        row = await OutsourceInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("委外检验单不存在")
        return self._to_response(row)

    async def list(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        inspection_start_date: Optional[str] = None,
        inspection_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.quality_service import (
            _apply_quality_inspection_list_filters,
            _resolve_quality_list_order_by,
        )

        query = OutsourceInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        query = _apply_quality_inspection_list_filters(
            query,
            {
                "keyword": keyword,
                "inspection_start_date": inspection_start_date,
                "inspection_end_date": inspection_end_date,
                "created_start_date": created_start_date,
                "created_end_date": created_end_date,
            },
            keyword_fields=[
                "inspection_code",
                "supplier_name",
                "material_code",
                "material_name",
                "outsource_receipt_code",
                "outsource_work_order_code",
            ],
        )
        total = await query.count()
        order_clause = _resolve_quality_list_order_by(
            order_by,
            {
                "created_at",
                "inspection_code",
                "inspection_time",
                "status",
                "quality_status",
                "material_code",
            },
            "-created_at",
        )
        rows = await query.order_by(order_clause).offset(skip).limit(limit)
        responses = enrich_quality_inspection_list_capabilities(
            list(rows),
            [OutsourceInspectionResponse.model_validate(row) for row in rows],
        )
        payload = {
            "data": responses,
            "items": responses,
            "total": total,
            "success": True,
        }
        return await enrich_items_payload(tenant_id, "outsource_inspection", payload)

    async def update(
        self,
        tenant_id: int,
        inspection_id: int,
        user_id: int,
        payload: OutsourceInspectionUpdate,
    ) -> OutsourceInspectionResponse:
        row = await OutsourceInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("委外检验单不存在")
        assert_quality_inspection_capability(row, "update")
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return self._to_response(row)
        user_info = await self.get_user_info(user_id)
        data["updated_by"] = user_id
        data["updated_by_name"] = user_info["name"]
        await OutsourceInspection.filter(id=inspection_id).update(**data)
        await row.refresh_from_db()
        return self._to_response(row)

    async def delete(self, tenant_id: int, inspection_id: int, user_id: int) -> None:
        row = await OutsourceInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("委外检验单不存在")
        assert_quality_inspection_capability(row, "delete")
        user_info = await self.get_user_info(user_id)
        await OutsourceInspection.filter(id=inspection_id).update(
            deleted_at=resolve_business_datetime(),
            updated_by=user_id,
            updated_by_name=user_info["name"],
        )

    async def conduct(
        self,
        tenant_id: int,
        inspection_id: int,
        user_id: int,
        payload: OutsourceInspectionConduct,
    ) -> OutsourceInspectionResponse:
        from apps.kuaizhizao.services.inspection_quantity_utils import assert_inspection_quantities_balanced
        from apps.kuaizhizao.services.quality_service import (
            _apply_template_conduct_to_payload,
            _assert_unqualified_qty_when_steps_fail,
            _maybe_create_quality_exception_from_inspection,
            _quality_inspection_conduct_finalize_fields,
            _resolve_conduct_inspector_id,
            _start_quality_inspection_approval_after_conduct,
        )
        from infra.services.business_config_service import BusinessConfigService

        row = await OutsourceInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("委外检验单不存在")
        assert_quality_inspection_capability(row, "conduct")

        user_info = await self.get_user_info(user_id)
        conduct_data = payload.model_dump(exclude_unset=True)
        quantity_decimal_places = await BusinessConfigService().get_quantity_decimal_places(tenant_id)
        qualified_quantity, unqualified_quantity = assert_inspection_quantities_balanced(
            payload.qualified_quantity,
            payload.unqualified_quantity,
            row.inspection_quantity,
            decimal_places=quantity_decimal_places,
        )
        _assert_unqualified_qty_when_steps_fail(
            row, "other_checks", conduct_data, unqualified_quantity
        )
        inspector_id = await _resolve_conduct_inspector_id(tenant_id, conduct_data, user_id)
        inspector_info = await self.get_user_info(inspector_id) if inspector_id != user_id else user_info
        conduct_extra = _apply_template_conduct_to_payload(row, "other_checks", conduct_data)

        row.inspection_result = payload.inspection_result
        row.quality_status = payload.quality_status
        row.qualified_quantity = qualified_quantity
        row.unqualified_quantity = unqualified_quantity
        row.notes = payload.notes
        row.nonconformance_reason = payload.nonconformance_reason
        row.disposition = payload.disposition
        row.corrective_action = payload.corrective_action
        if conduct_extra.get("other_checks") is not None:
            row.other_checks = conduct_extra["other_checks"]
        if conduct_extra.get("attachments") is not None:
            row.attachments = conduct_extra["attachments"]
        elif payload.attachments is not None:
            row.attachments = payload.attachments

        finalize_fields = await _quality_inspection_conduct_finalize_fields(
            tenant_id,
            "outsource_inspection",
            quality_status=payload.quality_status,
            inspected_by=inspector_id,
            inspector_name=inspector_info["name"],
        )
        row.status = finalize_fields.get("status", "已检验")
        if finalize_fields.get("review_status") is not None:
            row.review_status = finalize_fields["review_status"]
        if finalize_fields.get("reviewer_id") is not None:
            row.reviewer_id = finalize_fields["reviewer_id"]
            row.reviewer_name = finalize_fields["reviewer_name"]
            row.review_time = finalize_fields["review_time"]
        row.inspector_id = inspector_id
        row.inspector_name = inspector_info["name"]
        row.inspection_time = resolve_business_datetime()
        row.updated_by = user_id
        row.updated_by_name = user_info["name"]
        await row.save()

        approval_instance = await _start_quality_inspection_approval_after_conduct(
            tenant_id=tenant_id,
            user_id=user_id,
            stage_code="outsource_inspection",
            inspection=row,
            doc_label="委外检验",
        )

        if row.quality_status == "不合格" or payload.inspection_result == "不合格":
            await _maybe_create_quality_exception_from_inspection(
                tenant_id=tenant_id,
                source_type="outsource_inspection",
                source_id=inspection_id,
                inspected_by=user_id,
                problem_description=payload.notes or f"委外检验不合格：{row.inspection_code}",
            )
        if getattr(approval_instance, "status", None) == "approved":
            return await self.approve(
                tenant_id, inspection_id, user_id, approve=True, is_auto_approve=True
            )
        return self._to_response(row)

    async def approve(
        self,
        tenant_id: int,
        inspection_id: int,
        user_id: int,
        approve: bool,
        *,
        is_auto_approve: bool = False,
        remarks: Optional[str] = None,
    ) -> OutsourceInspectionResponse:
        from apps.kuaizhizao.services.quality_service import (
            _assert_quality_inspection_pending_approval,
        )

        row = await OutsourceInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("委外检验单不存在")
        if is_auto_approve and str(getattr(row, "status", "") or "").strip() == "已审核":
            return self._to_response(row)
        assert_quality_inspection_capability(row, "approve" if approve else "reject")
        await _assert_quality_inspection_pending_approval(
            tenant_id=tenant_id,
            stage_code="outsource_inspection",
            inspection_id=inspection_id,
            doc_label="委外检验",
            verb="审核" if approve else "驳回",
            is_auto_approve=is_auto_approve,
        )
        user_info = await self.get_user_info(user_id)
        row.review_status = "已审核" if approve else "已驳回"
        row.status = "已审核" if approve else "已驳回"
        row.reviewer_id = user_id
        row.reviewer_name = user_info["name"]
        row.review_time = resolve_business_datetime()
        row.review_remarks = remarks
        row.updated_by = user_id
        row.updated_by_name = user_info["name"]
        await row.save()
        return self._to_response(row)

    async def revoke_conduct(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> OutsourceInspectionResponse:
        from apps.kuaizhizao.services.quality_inspection_lifecycle import (
            assert_revoke_conduct_no_downstream,
            build_quality_inspection_revoke_conduct_fields,
        )

        row = await OutsourceInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("委外检验单不存在")
        assert_quality_inspection_capability(row, "revoke_conduct")
        await assert_revoke_conduct_no_downstream(
            tenant_id,
            entity_type="outsource_inspection",
            source_id=inspection_id,
        )
        user_info = await self.get_user_info(user_id)
        await OutsourceInspection.filter(id=inspection_id, tenant_id=tenant_id).update(
            **build_quality_inspection_revoke_conduct_fields(
                entity_type="outsource_inspection",
                updated_by=user_id,
                updated_by_name=user_info["name"],
                inspection=row,
            )
        )
        await row.refresh_from_db()
        return self._to_response(row)

    async def apply_plan(
        self, tenant_id: int, inspection_id: int, user_id: int, plan_id: int
    ) -> OutsourceInspectionResponse:
        from apps.kuaizhizao.services.quality_service import (
            _apply_explicit_inspection_plan_to_inspection_row,
        )

        row = await OutsourceInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("委外检验单不存在")
        assert_quality_inspection_capability(row, "apply_plan")
        user_info = await self.get_user_info(user_id)
        await _apply_explicit_inspection_plan_to_inspection_row(
            tenant_id,
            row,
            int(plan_id),
            "osqc",
            updated_by=user_id,
            updated_by_name=user_info["name"],
        )
        await row.refresh_from_db()
        return self._to_response(row)

    async def _existing_by_receipt(
        self, tenant_id: int, receipt_ids: List[int]
    ) -> Dict[int, OutsourceInspection]:
        ids = sorted({int(x) for x in receipt_ids if x})
        if not ids:
            return {}
        rows = await OutsourceInspection.filter(
            tenant_id=tenant_id,
            outsource_receipt_id__in=ids,
            deleted_at__isnull=True,
        ).order_by("id")
        out: Dict[int, OutsourceInspection] = {}
        for row in rows:
            rid = int(row.outsource_receipt_id or 0)
            if rid and rid not in out:
                out[rid] = row
        return out

    async def list_receipt_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        receipt_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        await self._ensure_module_enabled(tenant_id)
        query = OutsourceMaterialReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if receipt_code:
            query = query.filter(code__icontains=receipt_code.strip())
        if keyword:
            kw = keyword.strip()
            owo_ids = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).filter(
                Q(code__icontains=kw)
                | Q(product_code__icontains=kw)
                | Q(product_name__icontains=kw)
                | Q(supplier_name__icontains=kw)
            ).values_list("id", flat=True)
            query = query.filter(
                Q(code__icontains=kw)
                | Q(outsource_work_order_code__icontains=kw)
                | Q(outsource_work_order_id__in=list(owo_ids))
            )
        total = await query.count()
        rows = await query.order_by("-created_at").offset(skip).limit(limit)
        existing = await self._existing_by_receipt(tenant_id, [int(r.id) for r in rows])
        owo_ids = sorted({int(r.outsource_work_order_id) for r in rows if r.outsource_work_order_id})
        owos = {
            int(o.id): o
            for o in await OutsourceWorkOrder.filter(
                tenant_id=tenant_id, id__in=owo_ids, deleted_at__isnull=True
            )
        }
        items: List[Dict[str, Any]] = []
        for receipt in rows:
            owo = owos.get(int(receipt.outsource_work_order_id))
            material_id = int(owo.product_id) if owo else None
            already = int(receipt.id) in existing
            mode = "none"
            if material_id:
                mode, _, _ = await resolve_inspection_policy(
                    tenant_id, "osqc", material_id=material_id
                )
            requires = mode != "none"
            can_pull = (not already) and requires and str(receipt.status or "") != "cancelled"
            reason = None
            if already:
                reason = "outsource_inspection.pull_from_receipt.already_pulled"
            elif not requires:
                reason = "outsource_inspection.pull_from_receipt.no_inspection_required"
            elif str(receipt.status or "") == "cancelled":
                reason = "outsource_inspection.pull_from_receipt.not_allowed"
            items.append(
                {
                    "id": int(receipt.id),
                    "code": receipt.code,
                    "outsource_work_order_id": int(receipt.outsource_work_order_id)
                    if receipt.outsource_work_order_id
                    else None,
                    "outsource_work_order_code": receipt.outsource_work_order_code,
                    "supplier_id": int(owo.supplier_id) if owo else None,
                    "supplier_name": owo.supplier_name if owo else None,
                    "material_id": material_id,
                    "material_code": owo.product_code if owo else None,
                    "material_name": owo.product_name if owo else None,
                    "quantity": float(receipt.quantity or 0),
                    "unit": receipt.unit,
                    "batch_number": receipt.batch_number,
                    "status": receipt.status,
                    "can_pull": can_pull,
                    "pull_reason": reason,
                    "already_pulled": already,
                    "pushable_lines": 1 if can_pull else 0,
                }
            )
        return {"data": items, "items": items, "total": total, "success": True}

    async def create_from_receipt(
        self, tenant_id: int, receipt_id: int, user_id: int
    ) -> List[OutsourceInspectionResponse]:
        await self._ensure_module_enabled(tenant_id)
        receipt = await OutsourceMaterialReceipt.get_or_none(
            id=receipt_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not receipt:
            raise NotFoundError("委外收货单不存在")
        if str(receipt.status or "") == "cancelled":
            raise ValidationError("已取消的委外收货单不可加载委外检验")

        existing = await self._existing_by_receipt(tenant_id, [int(receipt.id)])
        if int(receipt.id) in existing:
            return [self._to_response(existing[int(receipt.id)])]

        owo = await OutsourceWorkOrder.get_or_none(
            id=receipt.outsource_work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not owo:
            raise ValidationError("委外收货单未关联有效委外工单")

        mode, _, _ = await resolve_inspection_policy(
            tenant_id, "osqc", material_id=int(owo.product_id)
        )
        if mode == "none":
            raise ValidationError("物料未配置委外检验，无需加载")

        qty = Decimal(str(receipt.quantity or 0))
        if qty <= 0:
            raise ValidationError("委外收货数量为 0，无法创建检验单")

        created = await self.create(
            tenant_id,
            user_id,
            OutsourceInspectionCreate(
                source_type="outsource_receipt",
                outsource_receipt_id=int(receipt.id),
                outsource_receipt_code=receipt.code,
                outsource_work_order_id=int(owo.id),
                outsource_work_order_code=owo.code,
                supplier_id=int(owo.supplier_id) if owo.supplier_id else None,
                supplier_name=owo.supplier_name,
                material_id=int(owo.product_id),
                material_code=owo.product_code,
                material_name=owo.product_name,
                material_unit=receipt.unit,
                batch_number=receipt.batch_number,
                inspection_quantity=float(qty),
            ),
        )
        return [created]
