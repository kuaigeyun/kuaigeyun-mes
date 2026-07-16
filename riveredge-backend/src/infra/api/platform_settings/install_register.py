"""
实例安装登记 API

POST /install/register — 公开、可选遥测
GET /install/repo-summary — 平台超管只读汇总
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from infra.constants.official_registry import (
    is_official_registry_host,
    is_registry_summary_admin_enabled,
)
from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.services.install_registration_service import InstallRegistrationService
from infra.utils.client_ip import get_client_ip

router = APIRouter(prefix="/install", tags=["Platform - Install Registration"])


def _assert_registry_summary_admin_access(request: Request) -> None:
    if not is_registry_summary_admin_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": "registry_summary_admin_disabled"},
        )
    host = request.headers.get("host", "")
    if not is_official_registry_host(host):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": "registry_summary_host_not_allowed"},
        )


class InstallRegisterRequest(BaseModel):
    install_instance_id: str = Field(description="实例 UUID v4")
    git_commit: Optional[str] = Field(default=None, description="短 commit")
    build_time: Optional[str] = Field(default=None, description="构建时间")
    provenance_status: Optional[str] = Field(default=None, description="来源状态")
    app_version: Optional[str] = Field(default=None, description="应用版本")
    build_git_remote: Optional[str] = Field(default=None, description="来源 remote（服务端以 .env 为准）")
    build_git_branch: Optional[str] = Field(default=None, description="来源分支")
    host_hint: Optional[str] = Field(default=None, description="可选主机提示")


class InstallRegisterResponse(BaseModel):
    registered: bool
    reason: Optional[str] = None
    official_repos: Optional[list[str]] = None
    official_site: Optional[str] = None
    message: Optional[str] = None


class RepoSummaryItem(BaseModel):
    build_git_remote: str
    instance_count: int
    last_seen_at: Optional[str] = None


class RepoSummaryResponse(BaseModel):
    non_official_remotes: list[RepoSummaryItem]
    official_remote_count: int
    disclaimer: str


@router.post("/register", response_model=InstallRegisterResponse)
async def register_install_instance(data: InstallRegisterRequest, request: Request):
    """可选实例登记（公开接口，telemetry 关闭时不写入库）。"""
    result: dict[str, Any] = await InstallRegistrationService().register(
        payload=data.model_dump(),
        client_ip=get_client_ip(request),
    )
    return InstallRegisterResponse(**result)


@router.get("/repo-summary", response_model=RepoSummaryResponse)
async def get_install_repo_summary(
    request: Request,
    _current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """非官方 git remote 聚合（仅 kuaigeyun.com 官方 SaaS + 平台超管）。"""
    _assert_registry_summary_admin_access(request)
    data = await InstallRegistrationService().repo_summary()
    return RepoSummaryResponse(**data)
