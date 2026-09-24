"""轻办公配置类 API（消息预设等）。"""

from fastapi import APIRouter, Depends

from apps.kuaioa.services.kuaioa_form_notification_presets import (
    load_kuaioa_form_notification_rule_presets,
)
from apps.kuaioa.services.kuaioa_license_notification_presets import (
    load_kuaioa_license_notification_rule_presets,
)
from apps.kuaioa.services.kuaioa_training_notification_presets import (
    load_kuaioa_training_notification_rule_presets,
)
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant

router = APIRouter(prefix="/config", tags=["App - Kuaioa - Config"])


@router.post("/notification-rule-presets/training/load", summary="Load training notification presets")
async def load_training_notification_presets(
    _auth=Depends(require_permission_codes("kuaioa:workbench:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    result = await load_kuaioa_training_notification_rule_presets(tenant_id)
    return {"data": result, "success": True}


@router.post("/notification-rule-presets/license/load", summary="Load compliance license notification presets")
async def load_license_notification_presets(
    _auth=Depends(require_permission_codes("kuaioa:workbench:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    result = await load_kuaioa_license_notification_rule_presets(tenant_id)
    return {"data": result, "success": True}


@router.post(
    "/notification-rule-presets/form-request/load",
    summary="Load general signoff form request notification presets",
)
async def load_form_request_notification_presets(
    _auth=Depends(require_permission_codes("kuaioa:workbench:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    result = await load_kuaioa_form_notification_rule_presets(tenant_id)
    return {"data": result, "success": True}
