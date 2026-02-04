"""
数据源管理 API 路由（兼容层）

统一后委托 IntegrationConfig 实现，仅处理 type 为 postgresql、mysql、mongodb、api 的记录。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from uuid import UUID

from core.schemas.data_source import (
    DataSourceCreate,
    DataSourceUpdate,
    DataSourceResponse,
    TestConnectionResponse,
)
from core.services.integration.integration_config_service import IntegrationConfigService
from core.schemas.integration_config import IntegrationConfigCreate, IntegrationConfigUpdate
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/data-sources", tags=["DataSources"])

DATA_SOURCE_TYPES = ("postgresql", "mysql", "mongodb", "api")


def _ic_to_ds_response(ic) -> DataSourceResponse:
    """IntegrationConfig -> DataSourceResponse（兼容）"""
    return DataSourceResponse(
        uuid=UUID(str(ic.uuid)),
        tenant_id=ic.tenant_id,
        name=ic.name,
        code=ic.code,
        description=ic.description,
        type=ic.type,
        config=ic.config or {},
        is_active=ic.is_active,
        is_connected=ic.is_connected,
        last_connected_at=ic.last_connected_at,
        last_error=ic.last_error,
        created_at=ic.created_at,
        updated_at=ic.updated_at,
    )


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    data: DataSourceCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建数据源（写入 IntegrationConfig，仅允许数据源类型）"""
    if data.type not in DATA_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"数据源类型必须是 {list(DATA_SOURCE_TYPES)} 之一",
        )
    try:
        create_data = IntegrationConfigCreate(
            name=data.name,
            code=data.code,
            type=data.type,
            description=data.description,
            config=data.config,
            is_active=data.is_active,
        )
        ic = await IntegrationConfigService.create_integration(tenant_id=tenant_id, data=create_data)
        return _ic_to_ds_response(ic)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建数据源失败: {str(e)}",
        )


@router.get("", response_model=dict)
async def list_data_sources(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（名称、代码）"),
    type: Optional[str] = Query(None, description="数据源类型筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """列表仅返回 type 为数据源类型的 IntegrationConfig"""
    try:
        if type is not None and type not in DATA_SOURCE_TYPES:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        skip = (page - 1) * page_size
        items = await IntegrationConfigService.list_integrations(
            tenant_id=tenant_id,
            skip=skip,
            limit=page_size,
            type=type,
            is_active=is_active,
        )
        items = [i for i in items if i.type in DATA_SOURCE_TYPES]
        if search:
            search_lower = search.lower()
            items = [i for i in items if (search_lower in (i.name or "").lower() or search_lower in (i.code or "").lower())]
        total = len(items)
        if not search and (type is None or type in DATA_SOURCE_TYPES):
            all_list = await IntegrationConfigService.list_integrations(
                tenant_id=tenant_id, skip=0, limit=10000, type=type, is_active=is_active
            )
            total = sum(1 for i in all_list if i.type in DATA_SOURCE_TYPES)
            if search:
                search_lower = search.lower()
                total = sum(1 for i in all_list if i.type in DATA_SOURCE_TYPES and (search_lower in (i.name or "").lower() or search_lower in (i.code or "").lower()))
        return {
            "items": [_ic_to_ds_response(i) for i in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据源列表失败: {str(e)}",
        )


@router.get("/{data_source_uuid}", response_model=DataSourceResponse)
async def get_data_source(
    data_source_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取详情（仅数据源类型）"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(data_source_uuid))
        if ic.type not in DATA_SOURCE_TYPES:
            raise NotFoundError("数据源不存在")
        return _ic_to_ds_response(ic)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据源详情失败: {str(e)}",
        )


@router.put("/{data_source_uuid}", response_model=DataSourceResponse)
async def update_data_source(
    data_source_uuid: UUID,
    data: DataSourceUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新数据源"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(data_source_uuid))
        if ic.type not in DATA_SOURCE_TYPES:
            raise NotFoundError("数据源不存在")
        update_data = IntegrationConfigUpdate(
            name=data.name,
            description=data.description,
            config=data.config,
            is_active=data.is_active,
        )
        updated = await IntegrationConfigService.update_integration(
            tenant_id=tenant_id, uuid=str(data_source_uuid), data=update_data
        )
        return _ic_to_ds_response(updated)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新数据源失败: {str(e)}",
        )


@router.delete("/{data_source_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    data_source_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除数据源（软删除）"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(data_source_uuid))
        if ic.type not in DATA_SOURCE_TYPES:
            raise NotFoundError("数据源不存在")
        await IntegrationConfigService.delete_integration(tenant_id=tenant_id, uuid=str(data_source_uuid))
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除数据源失败: {str(e)}",
        )


@router.post("/{data_source_uuid}/test", response_model=TestConnectionResponse)
async def test_data_source_connection(
    data_source_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """测试数据源连接"""
    try:
        ic = await IntegrationConfigService.get_integration_by_uuid(tenant_id=tenant_id, uuid=str(data_source_uuid))
        if ic.type not in DATA_SOURCE_TYPES:
            raise NotFoundError("数据源不存在")
        result = await IntegrationConfigService.test_connection(tenant_id=tenant_id, uuid=str(data_source_uuid))
        data = result.get("data") or {}
        return TestConnectionResponse(
            success=result.get("success", False),
            message=result.get("message", ""),
            elapsed_time=data.get("elapsed_time", 0.0),
        )
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试数据源连接失败: {str(e)}",
        )
