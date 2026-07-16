"""可视排产 AI 助手 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile

from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from apps.kuaizhizao.schemas.scheduling_ai import (
    SchedulingAiExplainRequest,
    SchedulingAiExplainResponse,
    SchedulingAiPriorityRequest,
    SchedulingAiPriorityResponse,
    SchedulingAiSuggestAdjustmentsRequest,
    SchedulingAiSuggestAdjustmentsResponse,
)
from apps.kuaizhizao.services.scheduling_ai_service import SchedulingAiService

router = APIRouter(prefix="/ai-assist", tags=["App - Kuaige Zhizao - Scheduling AI"])

_service = SchedulingAiService()


def _parse_id_list(raw: Optional[str]) -> Optional[list[int]]:
    if not raw:
        return None
    ids = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            val = int(part)
            if val > 0:
                ids.append(val)
        except ValueError:
            continue
    return ids or None


@router.post(
    "/explain",
    response_model=SchedulingAiExplainResponse,
    response_model_by_alias=True,
    summary="AI explain scheduling board",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:read"))],
)
async def scheduling_ai_explain(
    body: SchedulingAiExplainRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> SchedulingAiExplainResponse:
    del current_user
    return await _service.explain(
        tenant_id,
        text=body.text,
        work_order_ids=body.work_order_ids,
        plan_date=body.plan_date,
        selected_work_order_ids=body.selected_work_order_ids,
    )


@router.post(
    "/suggest-priority",
    response_model=SchedulingAiPriorityResponse,
    response_model_by_alias=True,
    summary="AI suggest work order pool priority",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:read"))],
)
async def scheduling_ai_suggest_priority(
    body: SchedulingAiPriorityRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> SchedulingAiPriorityResponse:
    del current_user
    return await _service.suggest_priority(
        tenant_id,
        text=body.text,
        work_order_ids=body.work_order_ids,
        plan_date=body.plan_date,
        selected_work_order_ids=body.selected_work_order_ids,
    )


@router.post(
    "/suggest-adjustments",
    response_model=SchedulingAiSuggestAdjustmentsResponse,
    response_model_by_alias=True,
    summary="AI suggest schedule adjustments (draft proposal)",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def scheduling_ai_suggest_adjustments(
    body: SchedulingAiSuggestAdjustmentsRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> SchedulingAiSuggestAdjustmentsResponse:
    del current_user
    return await _service.suggest_adjustments(
        tenant_id,
        text=body.text,
        work_order_ids=body.work_order_ids,
        plan_date=body.plan_date,
        selected_work_order_ids=body.selected_work_order_ids,
        context=body.context,
    )


@router.post(
    "/parse-dispatch-image",
    response_model=SchedulingAiSuggestAdjustmentsResponse,
    response_model_by_alias=True,
    summary="OCR dispatch sheet image and suggest adjustments",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def scheduling_ai_parse_dispatch_image(
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    work_order_ids: Optional[str] = Form(None),
    plan_date: Optional[str] = Form(None),
    selected_work_order_ids: Optional[str] = Form(None),
) -> SchedulingAiSuggestAdjustmentsResponse:
    del current_user
    image_bytes = await file.read()
    return await _service.parse_dispatch_image_and_suggest(
        tenant_id,
        image_bytes=image_bytes,
        content_type=file.content_type,
        work_order_ids=_parse_id_list(work_order_ids),
        plan_date=plan_date,
        selected_work_order_ids=_parse_id_list(selected_work_order_ids),
    )
