"""
工装管理 API 路由

提供工装台账 CRUD API 端点。领用/归还/保养/校验等运营单据见 tool_ops。

Author: Antigravity
Date: 2026-02-02
"""

import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, status, Query
from loguru import logger

from apps.kuaizhizao.schemas.tool import (
    ToolCreate, ToolUpdate, ToolResponse, ToolListResponse,
)
from apps.kuaizhizao.services.tool_service import ToolService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/tools",
    tags=["App · Kuaige Zhizao · Tools"],
)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/tools",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_tools_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


@router.post(
    "",
    response_model=ToolResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-tool-ledger:create"))],
)
async def create_tool(
    data: ToolCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        tool = await ToolService.create_tool(tenant_id, data, current_user=current_user)
        return ToolResponse.model_validate(tool)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get(
    "",
    response_model=ToolListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-tool-ledger:read"))],
)
async def list_tools(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await ToolService.list_tools(tenant_id, skip, limit, type, status, search)
    return ToolListResponse(items=[ToolResponse.model_validate(i) for i in items], total=total)


@router.get(
    "/{uuid}",
    response_model=ToolResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-tool-ledger:read"))],
)
async def get_tool(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    try:
        tool = await ToolService.get_tool_by_uuid(tenant_id, uuid)
        return ToolResponse.model_validate(tool)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/{uuid}",
    response_model=ToolResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-tool-ledger:update"))],
)
async def update_tool(
    uuid: str,
    data: ToolUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        tool = await ToolService.update_tool(tenant_id, uuid, data)
        return ToolResponse.model_validate(tool)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-tool-ledger:delete"))],
)
async def delete_tool(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await ToolService.delete_tool(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
