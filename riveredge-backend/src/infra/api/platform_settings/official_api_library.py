"""
官方接口库公开 API（固定托管于 kuaigeyun.com）

公开：
GET  /packs — 已发布目录
GET  /packs/{pack_id} — 包详情（含完整接口定义）
POST /submit — 社区提交接口包

平台超管（须本机为官方库真源）：
GET    /admin/meta — 官方库地址与可写状态
GET    /admin/packs — 全部接口包（含未发布）
GET    /admin/packs/{pack_id} — 包详情
PUT    /admin/packs/{pack_id} — 修正接口包
DELETE /admin/packs/{pack_id} — 删除接口包
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from infra.api.deps.deps import get_current_infra_superadmin
from infra.constants.official_registry import (
    DEFAULT_OFFICIAL_API_LIBRARY_HOST,
    OFFICIAL_API_LIBRARY_BASE_URL,
    base_url_for_official_api_library_host,
    can_manage_official_api_library,
    is_local_official_api_library_host,
    is_official_registry_host,
    normalize_official_api_library_host_input,
    resolve_official_api_library_host,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.models.platform_settings import PlatformSettings
from infra.services.official_api_library_service import OfficialApiLibraryService
from infra.utils.client_ip import get_client_ip
from core.utils.timezone_utils import now_utc

router = APIRouter(prefix="/official-api-library", tags=["Platform - Official API Library"])


def _assert_official_host(request: Request) -> None:
    """仅官方 SaaS 主机接受写入与本地目录服务。"""
    if is_local_official_api_library_host():
        return
    host = request.headers.get("host", "")
    if is_official_registry_host(host):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="official_api_library_host_not_allowed",
    )


async def _assert_can_manage(request: Request) -> None:
    if await can_manage_official_api_library(request_host=request.headers.get("host", "")):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="官方接口库内容管理仅在官方域名环境（默认 kuaigeyun.com）或开发环境可用",
    )


class OfficialApiLibraryItemIn(BaseModel):
    item_key: str = Field(..., description="包内唯一键")
    name: str = Field(..., description="接口名称")
    description: str = Field(default="", description="接口说明")
    path: str = Field(..., description="接口路径")
    method: str = Field(..., description="请求方法")
    request_headers: Optional[Dict[str, Any]] = None
    request_params: Optional[Dict[str, Any]] = None
    request_body: Optional[Any] = None
    response_format: Optional[Dict[str, Any]] = None
    response_example: Optional[Any] = None


class OfficialApiLibrarySubmitRequest(BaseModel):
    name: str = Field(..., description="接口包名称")
    description: str = Field(default="", description="接口包说明")
    connector_type: str = Field(..., description="所需连接器类型")
    category_name: str = Field(..., description="分类名称")
    category_code: Optional[str] = Field(default=None, description="分类代码")
    category_description: Optional[str] = Field(default=None, description="分类说明")
    items: List[OfficialApiLibraryItemIn] = Field(..., min_length=1, description="接口条目")
    submitter_hint: Optional[str] = Field(default=None, description="提交方提示")
    source_host_hint: Optional[str] = Field(default=None, description="来源主机提示")
    pack_id: Optional[str] = Field(default=None, description="可选自定义 pack_id")


class OfficialApiLibrarySubmitResponse(BaseModel):
    pack_id: str
    name: str
    api_count: int
    status: str


class OfficialApiLibraryPackUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="接口包名称")
    description: Optional[str] = Field(default=None, description="接口包说明")
    connector_type: Optional[str] = Field(default=None, description="所需连接器类型")
    category_name: Optional[str] = Field(default=None, description="分类名称")
    category_code: Optional[str] = Field(default=None, description="分类代码")
    category_description: Optional[str] = Field(default=None, description="分类说明")
    status: Optional[str] = Field(default=None, description="published / rejected")
    items: Optional[List[OfficialApiLibraryItemIn]] = Field(default=None, description="接口条目")


class OfficialApiLibraryAdminMetaUpdateRequest(BaseModel):
    host: str = Field(..., description="官方接口库域名，默认 kuaigeyun.com")


@router.get("/packs")
async def list_official_api_library_packs(request: Request):
    """公开：已发布官方接口库目录。"""
    _assert_official_host(request)
    try:
        return await OfficialApiLibraryService().list_published()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取官方接口库失败: {str(e)}",
        )


@router.get("/packs/{pack_id}")
async def get_official_api_library_pack(pack_id: str, request: Request):
    """公开：官方接口包详情（含完整定义）。"""
    _assert_official_host(request)
    try:
        return await OfficialApiLibraryService().get_published_pack(pack_id, full=True)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取官方接口包失败: {str(e)}",
        )


@router.post("/submit", response_model=OfficialApiLibrarySubmitResponse)
async def submit_official_api_library_pack(
    data: OfficialApiLibrarySubmitRequest,
    request: Request,
):
    """公开：向官方接口库提交接口包（写入仅发生在官方 SaaS）。"""
    _assert_official_host(request)
    try:
        result = await OfficialApiLibraryService().submit_pack(
            name=data.name,
            description=data.description,
            connector_type=data.connector_type,
            category_name=data.category_name,
            category_code=data.category_code,
            category_description=data.category_description,
            items=[item.model_dump() for item in data.items],
            submitter_hint=data.submitter_hint,
            source_host_hint=data.source_host_hint or get_client_ip(request),
            pack_id=data.pack_id,
        )
        return OfficialApiLibrarySubmitResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"提交官方接口库失败: {str(e)}",
        )


@router.get("/admin/meta")
async def get_official_api_library_admin_meta(
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """平台超管：官方库域名（默认 kuaigeyun.com）与是否可展示管理表。"""
    host = await resolve_official_api_library_host()
    base_url = base_url_for_official_api_library_host(host)
    manage_table_visible = await can_manage_official_api_library(
        request_host=request.headers.get("host", "")
    )
    return {
        "host": host,
        "default_host": DEFAULT_OFFICIAL_API_LIBRARY_HOST,
        "base_url": base_url,
        "default_base_url": OFFICIAL_API_LIBRARY_BASE_URL,
        "local_writable": is_local_official_api_library_host(),
        "manage_table_visible": manage_table_visible,
    }


@router.put("/admin/meta")
async def update_official_api_library_admin_meta(
    data: OfficialApiLibraryAdminMetaUpdateRequest,
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """平台超管：设置官方接口库域名。"""
    try:
        host = normalize_official_api_library_host_input(data.host)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    settings = await PlatformSettings.first()
    if not settings:
        settings = await PlatformSettings.create(
            platform_name="RiverEdge SaaS Framework",
            official_api_library_host=host,
        )
    else:
        settings.official_api_library_host = host
        settings.updated_at = now_utc()
        await settings.save(update_fields=["official_api_library_host", "updated_at"])

    manage_table_visible = await can_manage_official_api_library(
        request_host=request.headers.get("host", "")
    )
    return {
        "host": host,
        "default_host": DEFAULT_OFFICIAL_API_LIBRARY_HOST,
        "base_url": base_url_for_official_api_library_host(host),
        "default_base_url": OFFICIAL_API_LIBRARY_BASE_URL,
        "local_writable": is_local_official_api_library_host(),
        "manage_table_visible": manage_table_visible,
    }


@router.get("/admin/packs")
async def admin_list_official_api_library_packs(
    request: Request,
    status_filter: Optional[str] = None,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """平台超管：列出官方接口库全部包。"""
    await _assert_can_manage(request)
    try:
        return await OfficialApiLibraryService().list_all_for_admin(status=status_filter)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取官方接口库失败: {str(e)}",
        )


@router.get("/admin/packs/{pack_id}")
async def admin_get_official_api_library_pack(
    pack_id: str,
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """平台超管：接口包详情（含完整条目，便于修正）。"""
    await _assert_can_manage(request)
    try:
        return await OfficialApiLibraryService().get_pack_for_admin(pack_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取官方接口包失败: {str(e)}",
        )


@router.put("/admin/packs/{pack_id}")
async def admin_update_official_api_library_pack(
    pack_id: str,
    data: OfficialApiLibraryPackUpdateRequest,
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """平台超管：修正官方接口包（元数据 / 状态 / 条目）。"""
    await _assert_can_manage(request)
    try:
        return await OfficialApiLibraryService().update_pack(
            pack_id,
            name=data.name,
            description=data.description,
            connector_type=data.connector_type,
            category_name=data.category_name,
            category_code=data.category_code,
            category_description=data.category_description,
            status=data.status,
            items=[item.model_dump() for item in data.items] if data.items is not None else None,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新官方接口包失败: {str(e)}",
        )


@router.delete("/admin/packs/{pack_id}")
async def admin_delete_official_api_library_pack(
    pack_id: str,
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """平台超管：删除官方接口包。"""
    await _assert_can_manage(request)
    try:
        await OfficialApiLibraryService().delete_pack(pack_id)
        return {"success": True, "pack_id": pack_id}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除官方接口包失败: {str(e)}",
        )
