"""
快研发二期服务：需求 / 设计评审 / FMEA

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import datetime
from typing import List, Optional, Tuple

from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaiplm.models import RdDesignReview, RdFmeaRecord, RdRequirement
from apps.kuaiplm.schemas.phase2 import (
    RdDesignReviewCreate,
    RdDesignReviewResponse,
    RdDesignReviewUpdate,
    RdFmeaRecordCreate,
    RdFmeaRecordResponse,
    RdFmeaRecordUpdate,
    RdRequirementCreate,
    RdRequirementResponse,
    RdRequirementUpdate,
)
from infra.exceptions.exceptions import NotFoundError
from apps.kuaiplm.services.plm_list_core import (
    PHASE2_DESIGN_REVIEW_SORT_DB_COLS,
    PHASE2_FMEA_SORT_DB_COLS,
    PHASE2_REQUIREMENT_SORT_DB_COLS,
    apply_plm_list_filters,
)


class Phase2Service(AppBaseService[RdRequirement]):
    def __init__(self):
        super().__init__(RdRequirement)

    # ---------- Requirements ----------

    async def list_requirements(
        self,
        tenant_id: int,
        project_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        requirement_code: Optional[str] = None,
        title: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[RdRequirementResponse], int]:
        qs = RdRequirement.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if status:
            qs = qs.filter(status=status)
        exact_fields = None
        if not (keyword or "").strip():
            exact_fields = {
                "requirement_code": requirement_code,
                "title": title,
            }
        qs, order_expr = apply_plm_list_filters(
            qs,
            keyword=keyword,
            keyword_fields=["requirement_code", "title"],
            exact_fields=exact_fields,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_field,
            sort_order=sort_order,
            allowed_sort_cols=PHASE2_REQUIREMENT_SORT_DB_COLS,
            default_sort_col="created_at",
        )
        total = await qs.count()
        rows = await qs.order_by(order_expr).offset(skip).limit(limit).all()
        return [RdRequirementResponse.model_validate(r) for r in rows], total

    async def create_requirement(
        self, tenant_id: int, data: RdRequirementCreate, created_by: int
    ) -> RdRequirementResponse:
        user_info = await self.get_user_info(created_by)
        row = await RdRequirement.create(
            tenant_id=tenant_id,
            project_id=data.project_id,
            requirement_code=data.requirement_code,
            title=data.title,
            description=data.description,
            priority=data.priority,
            status=data.status,
            source_type=data.source_type,
            source_id=data.source_id,
            created_by=created_by,
            created_by_name=user_info["name"],
            updated_by=created_by,
            updated_by_name=user_info["name"],
        )
        return RdRequirementResponse.model_validate(row)

    async def update_requirement(
        self, tenant_id: int, requirement_id: int, data: RdRequirementUpdate, updated_by: int
    ) -> RdRequirementResponse:
        row = await RdRequirement.get_or_none(
            tenant_id=tenant_id, id=requirement_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"需求不存在: {requirement_id}")
        user_info = await self.get_user_info(updated_by)
        update_fields = {
            "updated_by": updated_by,
            "updated_by_name": user_info["name"],
        }
        for field in (
            "project_id", "title", "description", "priority", "status", "source_type", "source_id",
        ):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        await row.update_from_dict(update_fields).save()
        return RdRequirementResponse.model_validate(row)

    async def delete_requirement(self, tenant_id: int, requirement_id: int, deleted_by: int) -> None:
        row = await RdRequirement.get_or_none(
            tenant_id=tenant_id, id=requirement_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"需求不存在: {requirement_id}")
        user_info = await self.get_user_info(deleted_by)
        await row.update_from_dict({
            "deleted_at": datetime.now(),
            "updated_by": deleted_by,
            "updated_by_name": user_info["name"],
        }).save()

    # ---------- Design Reviews ----------

    async def list_design_reviews(
        self,
        tenant_id: int,
        project_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        review_code: Optional[str] = None,
        title: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[RdDesignReviewResponse], int]:
        qs = RdDesignReview.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if status:
            qs = qs.filter(status=status)
        exact_fields = None
        if not (keyword or "").strip():
            exact_fields = {
                "review_code": review_code,
                "title": title,
            }
        qs, order_expr = apply_plm_list_filters(
            qs,
            keyword=keyword,
            keyword_fields=["review_code", "title", "reviewer_name", "material_name"],
            exact_fields=exact_fields,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_field,
            sort_order=sort_order,
            allowed_sort_cols=PHASE2_DESIGN_REVIEW_SORT_DB_COLS,
            default_sort_col="created_at",
        )
        total = await qs.count()
        rows = await qs.order_by(order_expr).offset(skip).limit(limit).all()
        return [RdDesignReviewResponse.model_validate(r) for r in rows], total

    async def create_design_review(
        self, tenant_id: int, data: RdDesignReviewCreate, created_by: int
    ) -> RdDesignReviewResponse:
        user_info = await self.get_user_info(created_by)
        row = await RdDesignReview.create(
            tenant_id=tenant_id,
            project_id=data.project_id,
            review_code=data.review_code,
            title=data.title,
            review_type=data.review_type,
            status=data.status,
            material_id=data.material_id,
            material_code=data.material_code,
            material_name=data.material_name,
            reviewer_id=data.reviewer_id,
            reviewer_name=data.reviewer_name,
            review_date=data.review_date,
            review_notes=data.review_notes,
            created_by=created_by,
            created_by_name=user_info["name"],
            updated_by=created_by,
            updated_by_name=user_info["name"],
        )
        return RdDesignReviewResponse.model_validate(row)

    async def update_design_review(
        self, tenant_id: int, review_id: int, data: RdDesignReviewUpdate, updated_by: int
    ) -> RdDesignReviewResponse:
        row = await RdDesignReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"设计评审不存在: {review_id}")
        user_info = await self.get_user_info(updated_by)
        update_fields = {
            "updated_by": updated_by,
            "updated_by_name": user_info["name"],
        }
        for field in (
            "project_id", "title", "review_type", "status", "material_id", "material_code",
            "material_name", "reviewer_id", "reviewer_name", "review_date", "review_notes",
        ):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        await row.update_from_dict(update_fields).save()
        return RdDesignReviewResponse.model_validate(row)

    async def delete_design_review(self, tenant_id: int, review_id: int, deleted_by: int) -> None:
        row = await RdDesignReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"设计评审不存在: {review_id}")
        user_info = await self.get_user_info(deleted_by)
        await row.update_from_dict({
            "deleted_at": datetime.now(),
            "updated_by": deleted_by,
            "updated_by_name": user_info["name"],
        }).save()

    # ---------- FMEA ----------

    async def list_fmea_records(
        self,
        tenant_id: int,
        project_id: Optional[int] = None,
        fmea_type: Optional[str] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        fmea_code: Optional[str] = None,
        title: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[RdFmeaRecordResponse], int]:
        qs = RdFmeaRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if fmea_type:
            qs = qs.filter(fmea_type=fmea_type)
        if status:
            qs = qs.filter(status=status)
        exact_fields = None
        if not (keyword or "").strip():
            exact_fields = {
                "fmea_code": fmea_code,
                "title": title,
            }
        qs, order_expr = apply_plm_list_filters(
            qs,
            keyword=keyword,
            keyword_fields=["fmea_code", "title", "material_name"],
            exact_fields=exact_fields,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_field,
            sort_order=sort_order,
            allowed_sort_cols=PHASE2_FMEA_SORT_DB_COLS,
            default_sort_col="created_at",
        )
        total = await qs.count()
        rows = await qs.order_by(order_expr).offset(skip).limit(limit).all()
        return [RdFmeaRecordResponse.model_validate(r) for r in rows], total

    async def create_fmea_record(
        self, tenant_id: int, data: RdFmeaRecordCreate, created_by: int
    ) -> RdFmeaRecordResponse:
        user_info = await self.get_user_info(created_by)
        row = await RdFmeaRecord.create(
            tenant_id=tenant_id,
            project_id=data.project_id,
            fmea_code=data.fmea_code,
            title=data.title,
            fmea_type=data.fmea_type,
            status=data.status,
            material_id=data.material_id,
            material_code=data.material_code,
            material_name=data.material_name,
            risk_items=data.risk_items,
            created_by=created_by,
            created_by_name=user_info["name"],
            updated_by=created_by,
            updated_by_name=user_info["name"],
        )
        return RdFmeaRecordResponse.model_validate(row)

    async def update_fmea_record(
        self, tenant_id: int, fmea_id: int, data: RdFmeaRecordUpdate, updated_by: int
    ) -> RdFmeaRecordResponse:
        row = await RdFmeaRecord.get_or_none(
            tenant_id=tenant_id, id=fmea_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"FMEA 记录不存在: {fmea_id}")
        user_info = await self.get_user_info(updated_by)
        update_fields = {
            "updated_by": updated_by,
            "updated_by_name": user_info["name"],
        }
        for field in (
            "project_id", "title", "fmea_type", "status", "material_id",
            "material_code", "material_name", "risk_items",
        ):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        await row.update_from_dict(update_fields).save()
        return RdFmeaRecordResponse.model_validate(row)

    async def delete_fmea_record(self, tenant_id: int, fmea_id: int, deleted_by: int) -> None:
        row = await RdFmeaRecord.get_or_none(
            tenant_id=tenant_id, id=fmea_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"FMEA 记录不存在: {fmea_id}")
        user_info = await self.get_user_info(deleted_by)
        await row.update_from_dict({
            "deleted_at": datetime.now(),
            "updated_by": deleted_by,
            "updated_by_name": user_info["name"],
        }).save()
