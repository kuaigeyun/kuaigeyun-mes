"""视觉配置 API。"""

from fastapi import APIRouter, Depends

from apps.kuaivision.schemas.vision import SettingsResponse, SettingsUpdate
from apps.kuaivision.services.settings_service import SettingsService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/settings", tags=["App - KuaiVision - Settings"])


@router.get(
    "",
    response_model=SettingsResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:workspace:read"))],
)
async def get_settings(tenant_id: int = Depends(get_current_tenant)):
    return await SettingsService.get(tenant_id)


@router.put(
    "",
    response_model=SettingsResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:update"))],
)
async def update_settings(
    data: SettingsUpdate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    # P1：工作台读权限可改入站开关；后续可拆独立 settings:update
    return await SettingsService.update(tenant_id, data, user)
