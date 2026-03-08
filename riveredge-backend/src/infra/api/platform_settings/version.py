"""
平台版本与迭代信息 API

提供系统构建时间、代码仓库最新提交时间等，用于右下角悬浮按钮展示。
公开接口，无需认证。
"""

import os
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel, Field
from loguru import logger
import httpx

router = APIRouter(prefix="/platform", tags=["Platform Version"])

GITEE_REPO = "kuaigeyun/kuaigeyun"
GITEE_API_URL = f"https://gitee.com/api/v5/repos/{GITEE_REPO}/commits?per_page=1"
GIT_REPO_URL = "https://gitee.com/kuaigeyun/kuaigeyun"


class PlatformVersionResponse(BaseModel):
    """平台版本信息响应"""
    build_time: str = Field(description="当前部署版本构建时间")
    git_latest_commit_time: str = Field(description="代码仓库最新提交时间")
    git_repo_url: str = Field(default=GIT_REPO_URL, description="代码仓库地址")
    iteration_notice: str = Field(
        default="本系统持续迭代优化中，如有意见或需求反馈，欢迎通过下方入口联系。",
        description="迭代提示文案"
    )


@router.get("/version", response_model=PlatformVersionResponse)
async def get_platform_version():
    """
    获取平台版本与迭代信息（公开接口）

    返回当前部署构建时间、代码仓库最新提交时间，用于右下角悬浮按钮展示。
    """
    # 构建时间：优先从环境变量读取（部署时注入），否则使用当前时间作为占位
    build_time = os.environ.get("PLATFORM_BUILD_TIME") or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    git_latest = "暂无"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(GITEE_API_URL)
            if resp.status_code == 200:
                data = resp.json()
                if data and isinstance(data, list) and len(data) > 0:
                    commit = data[0]
                    commit_info = commit.get("commit") or {}
                    author = commit_info.get("author") or {}
                    raw_date = author.get("date")
                    if raw_date:
                        try:
                            dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                            git_latest = dt.strftime("%Y-%m-%d %H:%M")
                        except Exception:
                            git_latest = raw_date[:16] if len(raw_date) >= 16 else raw_date
    except Exception as e:
        logger.warning(f"获取 Gitee 最新提交时间失败: {e}")

    return PlatformVersionResponse(
        build_time=build_time,
        git_latest_commit_time=git_latest,
        git_repo_url=GIT_REPO_URL,
    )
