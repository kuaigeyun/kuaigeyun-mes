"""
官方接口库公开 API（固定托管于 kuaigeyun.com）

GET  /packs — 已发布目录
GET  /packs/{pack_id} — 包详情（含完整接口定义）
POST /submit — 社区提交接口包
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from infra.constants.official_registry import is_local_official_api_library_host, is_official_registry_host
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.services.official_api_library_service import OfficialApiLibraryService
from infra.utils.client_ip import get_client_ip

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
