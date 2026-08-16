"""
应用连接管理 API 路由

仅处理 type 为预置应用连接器类型的 IntegrationConfig 记录。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from uuid import UUID

from core.schemas.integration_config import (
    IntegrationConfigCreate,
    IntegrationConfigUpdate,
    IntegrationConfigResponse,
    TestConfigRequest,
    TestConnectionResponse,
    SyncContactsResponse,
)
from core.services.integration.integration_config_service import (
    IntegrationConfigService,
    build_integration_response,
)
from core.services.integration.wecom_contact_sync_service import WeComContactSyncService
from core.config.integration_type_spec import APPLICATION_CONNECTOR_TYPES
from core.api.deps.deps import get_current_tenant
from core.api.deps.access import require_permission_codes
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/application-connections", tags=["Core - Application Connections"])

APPLICATION_TYPES = APPLICATION_CONNECTOR_TYPES


def _to_response(ic) -> IntegrationConfigResponse:
    """IntegrationConfig -> IntegrationConfigResponse（config 脱敏）"""
    return IntegrationConfigResponse.model_validate(build_integration_response(ic))


@router.post("", response_model=IntegrationConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_application_connection(
    data: IntegrationConfigCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建应用连接（仅允许预置应用连接器类型）"""
    if data.type not in APPLICATION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"应用连接类型必须是 {list(APPLICATION_TYPES)} 之一",
        )
    try:
        ic = await IntegrationConfigService.create_integration(tenant_id=tenant_id, data=data)
        return _to_response(ic)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建应用连接失败: {str(e)}",
        )


@router.get("", response_model=dict)
async def list_application_connections(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（名称、代码）"),
    type: Optional[str] = Query(None, description="类型筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """列表仅返回应用连接类型的 IntegrationConfig"""
    try:
        if type is not None and type not in APPLICATION_TYPES:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        type_scope = [type] if type is not None else list(APPLICATION_TYPES)
        items, total = await IntegrationConfigService.list_integrations(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            types=type_scope,
            is_active=is_active,
            search=search,
        )
        return {
            "items": [_to_response(i) for i in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取应用连接列表失败: {str(e)}",
        )


@router.get("/{uuid}", response_model=IntegrationConfigResponse)
async def get_application_connection(
    uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取应用连接详情"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(uuid))
        if ic.type not in APPLICATION_TYPES:
            raise NotFoundError("应用连接不存在")
        return _to_response(ic)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应用连接不存在")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取应用连接详情失败: {str(e)}",
        )


@router.put("/{uuid}", response_model=IntegrationConfigResponse)
async def update_application_connection(
    uuid: UUID,
    data: IntegrationConfigUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新应用连接"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(uuid))
        if ic.type not in APPLICATION_TYPES:
            raise NotFoundError("应用连接不存在")
        updated = await IntegrationConfigService.update_integration(
            tenant_id=tenant_id, uuid=str(uuid), data=data
        )
        return _to_response(updated)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应用连接不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新应用连接失败: {str(e)}",
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application_connection(
    uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除应用连接（软删除）"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(uuid))
        if ic.type not in APPLICATION_TYPES:
            raise NotFoundError("应用连接不存在")
        await IntegrationConfigService.delete_integration(tenant_id=tenant_id, uuid=str(uuid))
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应用连接不存在")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除应用连接失败: {str(e)}",
        )


@router.post("/{uuid}/test", response_model=TestConnectionResponse)
async def test_application_connection(
    uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """测试应用连接"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(uuid))
        if ic.type not in APPLICATION_TYPES:
            raise NotFoundError("应用连接不存在")
        result = await IntegrationConfigService.test_connection(tenant_id=tenant_id, uuid=str(uuid))
        return TestConnectionResponse(
            success=result.get("success", False),
            message=result.get("message", ""),
            data=result.get("data"),
            error=result.get("error"),
        )
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应用连接不存在")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试应用连接失败: {str(e)}",
        )


@router.post("/test-config", response_model=TestConnectionResponse)
async def test_application_connection_config(
    data: TestConfigRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """保存前测试连接配置（不落库）"""
    if data.type not in APPLICATION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"应用连接类型必须是 {list(APPLICATION_TYPES)} 之一",
        )
    result = await IntegrationConfigService.test_config(type_=data.type, config=data.config)
    return TestConnectionResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        data=result.get("data"),
        error=result.get("error"),
    )


@router.post(
    "/{uuid}/sync-contacts",
    response_model=SyncContactsResponse,
    dependencies=[Depends(require_permission_codes("system:application-connection:execute"))],
)
async def sync_application_connection_contacts(
    uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """同步企业微信通讯录（部门树 + 成员）到本系统组织架构与用户。"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(
            tenant_id=tenant_id, uuid=str(uuid)
        )
        if ic.type != "wecom":
            raise ValidationError("仅企业微信连接器支持通讯录同步")
        result = await WeComContactSyncService.sync_contacts(
            tenant_id=tenant_id,
            integration_uuid=str(uuid),
        )
        dept = result.get("departments") or {}
        users = result.get("users") or {}
        message = (
            f"同步完成：部门新增 {dept.get('created', 0)}、更新 {dept.get('updated', 0)}；"
            f"成员新增 {users.get('created', 0)}、更新 {users.get('updated', 0)}、"
            f"绑定 {users.get('bound', 0)}、跳过 {users.get('skipped', 0)}"
        )
        return SyncContactsResponse(
            success=True,
            message=message,
            departments=dept,
            users=users,
            synced_at=result.get("synced_at"),
        )
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应用连接不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"同步通讯录失败: {str(e)}",
        )
