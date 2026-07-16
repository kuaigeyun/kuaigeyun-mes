"""快制造 — 业务单据打印 API。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from apps.kuaizhizao.services.print_template_presets import load_kuaizhizao_print_template_presets
from core.api.deps.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.models.user import User

router = APIRouter(
    prefix="/print",
    tags=["App - Kuaige Zhizao - 打印"],
)


@router.post(
    "/load-presets",
    summary="Load kuaizhizao print template presets",
    dependencies=[Depends(require_permission_codes("system:print-template:create"))],
)
async def load_kuaizhizao_print_presets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _user: Annotated[User, Depends(get_current_user)],
):
    created = await load_kuaizhizao_print_template_presets(tenant_id)
    return {"success": True, "created": created, "message": f"已加载 {created} 个快制造打印模板预设"}
