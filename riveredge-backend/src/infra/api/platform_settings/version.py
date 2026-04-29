"""
平台版本与迭代信息 API

提供系统构建时间、代码仓库最新提交时间等，用于右下角悬浮按钮展示。
公开接口，无需认证。
时间统一以 ISO 8601 UTC 格式返回，前端按系统时区格式化显示。
"""

import os
from datetime import datetime, timezone
from core.timezone_utils import now_utc
from fastapi import APIRouter
from pydantic import BaseModel, Field
from loguru import logger

from infra.infrastructure.http import get_http_client

router = APIRouter(prefix="/platform", tags=["Platform Version"])

GITEE_REPO = "kuaigeyun/kuaigeyun"
GITEE_API_URL = f"https://gitee.com/api/v5/repos/{GITEE_REPO}/commits?per_page=1"
GIT_REPO_URL = "https://gitee.com/kuaigeyun/kuaigeyun"


class PlatformVersionResponse(BaseModel):
    """平台版本信息响应"""
    build_time: str = Field(description="当前部署版本构建时间（ISO 8601 UTC）")
    git_commit: str = Field(
        default="",
        description="当前运行代码的 Git 短 commit（由部署环境 GIT_SHA 等注入，未设置则为空）",
    )
    git_latest_commit_time: str = Field(description="代码仓库最新提交时间（ISO 8601 UTC，或 暂无）")
    git_repo_url: str = Field(default=GIT_REPO_URL, description="代码仓库地址")
    iteration_notice: str = Field(
        default="本系统持续迭代优化中，如有意见或需求反馈，欢迎通过下方入口联系。",
        description="迭代提示文案"
    )


def _normalize_to_iso_utc(raw: str) -> str:
    """将时间字符串规范为 ISO 8601 UTC 格式。支持 YYYY-MM-DD HH:MM、YYYY-MM-DDTHH:MM 等。"""
    raw = (raw or "").strip()
    if not raw:
        return raw
    s = raw[:19].replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            parse_len = 19 if ":%S" in fmt else 16
            part = s[:parse_len]
            if fmt == "%Y-%m-%d %H:%M" and len(part) < 16:
                part = (part + "00:00")[:16]
            dt = datetime.strptime(part, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except (ValueError, TypeError):
            continue
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return raw


@router.get("/version", response_model=PlatformVersionResponse)
async def get_platform_version():
    """
    获取平台版本与迭代信息（公开接口）

    返回当前部署构建时间、代码仓库最新提交时间，均为 ISO 8601 UTC 格式。
    前端按系统设置的时区统一格式化显示。
    """
    # 构建时间：优先从环境变量读取（部署时注入），否则使用当前 UTC 时间
    raw_build = os.environ.get("PLATFORM_BUILD_TIME")
    if raw_build:
        build_time = _normalize_to_iso_utc(raw_build)
    else:
        build_time = now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")

    git_latest = "暂无"

    try:
        resp = await get_http_client().get(GITEE_API_URL, timeout=5.0)
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
                        # Gitee 返回的时间已带时区（如 +08:00），需转为 UTC 再输出
                        dt_utc = dt.astimezone(timezone.utc)
                        git_latest = dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
                    except Exception:
                        git_latest = _normalize_to_iso_utc(raw_date[:19]) if len(raw_date) >= 16 else raw_date
    except Exception as e:
        logger.warning(f"获取 Gitee 最新提交时间失败: {e}")

    def _display_git_commit() -> str:
        raw = (os.environ.get("GIT_SHA") or os.environ.get("PLATFORM_GIT_SHA") or "").strip()
        if not raw or raw.lower().startswith("http"):
            return ""
        token = raw.split()[0]
        if len(token) > 7 and all(c in "0123456789abcdefABCDEF" for c in token):
            return token[:7].lower()
        return token[:7] if len(token) > 7 else token

    return PlatformVersionResponse(
        build_time=build_time,
        git_commit=_display_git_commit(),
        git_latest_commit_time=git_latest,
        git_repo_url=GIT_REPO_URL,
    )
