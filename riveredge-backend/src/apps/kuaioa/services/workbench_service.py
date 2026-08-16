"""办公工作台聚合。"""

from __future__ import annotations

from typing import Any

from apps.kuaioa.models.asset import KuaioaAssetPurchase
from apps.kuaioa.models.collaboration import (
    KuaioaConcessionRequest,
    KuaioaProcessDeviation,
    KuaioaSpecialPriceRequest,
)
from apps.kuaioa.models.form_request import KuaioaFormRequest
from apps.kuaioa.models.leave import KuaioaLeaveRequest
from apps.kuaioa.models.seal import KuaioaSealRequest
from apps.kuaioa.services.announcement_service import AnnouncementService
from apps.kuaioa.services.kuaioa_list_core import model_to_dict
from apps.kuaioa.services.license_service import LicenseRegistryService
from apps.kuaioa.services.training_service import WorkLicenseService
from core.services.user.user_task_service import UserTaskService

KUAIOA_ENTITY_TYPES = frozenset(
    {
        "kuaioa_form_request",
        "kuaioa_asset_purchase",
        "kuaioa_leave",
        "kuaioa_seal",
        "kuaioa_special_price",
        "kuaioa_concession",
        "kuaioa_process_deviation",
    }
)

DOC_MODEL_BY_ENTITY: dict[str, Any] = {
    "kuaioa_form_request": KuaioaFormRequest,
    "kuaioa_asset_purchase": KuaioaAssetPurchase,
    "kuaioa_leave": KuaioaLeaveRequest,
    "kuaioa_seal": KuaioaSealRequest,
    "kuaioa_special_price": KuaioaSpecialPriceRequest,
    "kuaioa_concession": KuaioaConcessionRequest,
    "kuaioa_process_deviation": KuaioaProcessDeviation,
}


class WorkbenchService:
    async def get_summary(self, tenant_id: int, user_id: int) -> dict[str, Any]:
        pending_tasks = await UserTaskService.get_user_tasks(
            tenant_id, user_id, page=1, page_size=10, task_type="pending", status="pending"
        )
        kuaioa_pending = [
            item.model_dump()
            for item in pending_tasks.items
            if (item.data or {}).get("entity_type") in KUAIOA_ENTITY_TYPES
        ]

        announcements = await AnnouncementService().list_announcements(
            tenant_id, published_only=True, active_only=True
        )
        pinned = [a for a in announcements if a.get("is_pinned")][:5]
        recent = announcements[:8]

        my_submitted = await self._list_my_pending_docs(tenant_id, user_id, limit=10)
        expiring_licenses = await LicenseRegistryService().list_expiring(tenant_id, within_days=30)
        expiring_work_licenses = await WorkLicenseService().list_expiring(tenant_id, within_days=30)

        return {
            "pending_approvals": kuaioa_pending,
            "pending_approval_total": pending_tasks.total,
            "kuaioa_pending_approval_total": len(kuaioa_pending),
            "pinned_announcements": pinned,
            "recent_announcements": recent,
            "my_submitted_pending": my_submitted,
            "expiring_licenses": expiring_licenses[:8],
            "expiring_work_licenses": expiring_work_licenses[:8],
            "expiring_license_total": len(expiring_licenses),
            "expiring_work_license_total": len(expiring_work_licenses),
        }

    async def _list_my_pending_docs(
        self, tenant_id: int, user_id: int, *, limit: int
    ) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for entity_type, model in DOC_MODEL_BY_ENTITY.items():
            rows = await model.filter(
                tenant_id=tenant_id,
                applicant_id=user_id,
                status="pending",
                deleted_at__isnull=True,
            ).order_by("-submitted_at").limit(limit)
            for row in rows:
                item = model_to_dict(row)
                item["entity_type"] = entity_type
                if entity_type == "kuaioa_asset_purchase":
                    item["doc_code"] = getattr(row, "purchase_code", None)
                else:
                    item["doc_code"] = getattr(row, "request_code", None)
                result.append(item)
        result.sort(key=lambda x: x.get("submitted_at") or "", reverse=True)
        return result[:limit]
