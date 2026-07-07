"""
构建来源公开 API

GET /platform/provenance — 软标识信息，不阻断业务。
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from infra.constants.official_registry import is_registry_summary_admin_enabled
from infra.services.build_provenance_service import BuildProvenanceService

router = APIRouter(prefix="/platform", tags=["Platform · Provenance"])


class BuildProvenanceResponse(BaseModel):
    status: str = Field(description="构建来源状态")
    git_commit: str = Field(default="", description="短 commit")
    build_time: str = Field(default="", description="构建时间 ISO UTC")
    build_git_remote: str = Field(default="", description="来源 git remote")
    build_git_branch: str = Field(default="", description="来源 git 分支")
    build_git_remote_is_official: bool = Field(default=False, description="remote 是否官方")
    official_repos: list[str] = Field(default_factory=list, description="官方仓库链接")
    official_site: str = Field(default="", description="官方网站")
    install_instance_id: str = Field(default="", description="实例 UUID")
    telemetry_enabled: bool = Field(default=True, description="是否允许可选登记")
    telemetry_disclosure_path: str = Field(
        default="docs/telemetry-disclosure.md",
        description="遥测披露文档相对路径",
    )
    registered: bool = Field(default=False, description="是否已在官方库登记")
    registry_summary_admin_available: bool = Field(
        default=False,
        description="本部署是否开放构建来源汇总管理（仅官方 SaaS）",
    )


@router.get("/provenance", response_model=BuildProvenanceResponse)
async def get_build_provenance():
    """获取构建来源与可选统计配置（公开接口）。"""
    data = await BuildProvenanceService().get_provenance()
    data["registry_summary_admin_available"] = is_registry_summary_admin_enabled()
    return BuildProvenanceResponse(**data)
