from fastapi import APIRouter, Depends, Body
from loguru import logger
from core.models.user import User
from core.services.authorization.auth_service import get_current_user, get_current_tenant
from apps.kuaizhizao.services.reset_data_service import ResetDataService

router = APIRouter(prefix="/management", tags=["App Management"])

@router.post("/reset-data", summary="重置应用数据（快制造专用）")
async def reset_app_data(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    重置快制造模块的所有业务数据。
    
    安全机制：
    1. 必须登录且属于对应租户。
    2. 自动触发一重全量备份。
    3. 物理删除所有业务表。
    """
    try:
        # TODO: 可以在此处增加更高权限的分支校验 (e.g. is_superadmin)
        result = await ResetDataService.reset_kuaizhizao_data(tenant_id, current_user.id)
        return result
    except Exception as e:
        logger.exception(f"重置快制造数据失败: {e}")
        return {"success": False, "message": str(e)}
