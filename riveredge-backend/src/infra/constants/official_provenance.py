"""
官方构建来源常量

用于判断 git remote 是否指向快格云官方仓库，以及对外展示正版指引链接。
"""

from __future__ import annotations

from typing import FrozenSet

OFFICIAL_REPO_GITEE = "https://gitee.com/kuaigeyun/kuaigeyun"
OFFICIAL_REPO_GITHUB = "https://github.com/kuaigeyun/kuaigeyun"
OFFICIAL_SITE = "https://kuaigeyun.com"
OFFICIAL_GITEE_REPO_SLUG = "kuaigeyun/kuaigeyun"

TELEMETRY_DISCLOSURE_PATH = "docs/telemetry-disclosure.md"


def _normalize_git_remote(raw: str) -> str:
    """将 git remote URL 规范为可比较的 https 路径（小写、无 .git 后缀）。"""
    value = (raw or "").strip()
    if not value:
        return ""
    if value.lower().startswith("git@"):
        # git@host:owner/repo.git -> https://host/owner/repo
        host_path = value.split("@", 1)[1]
        if ":" in host_path:
            host, path = host_path.split(":", 1)
            value = f"https://{host}/{path}"
    value = value.rstrip("/")
    if value.lower().endswith(".git"):
        value = value[:-4]
    return value.lower()


# 规范化后的官方 remote 集合（小写、无尾部 .git、https 形式）
_OFFICIAL_CANONICAL: FrozenSet[str] = frozenset(
    {
        _normalize_git_remote(OFFICIAL_REPO_GITEE),
        _normalize_git_remote(OFFICIAL_REPO_GITHUB),
        _normalize_git_remote(f"{OFFICIAL_REPO_GITEE}.git"),
        _normalize_git_remote(f"{OFFICIAL_REPO_GITHUB}.git"),
        _normalize_git_remote("git@gitee.com:kuaigeyun/kuaigeyun.git"),
        _normalize_git_remote("git@github.com:kuaigeyun/kuaigeyun.git"),
    }
)


def normalize_git_remote(raw: str) -> str:
    """对外暴露的 remote 规范化入口。"""
    return _normalize_git_remote(raw)


def is_official_git_remote(raw: str) -> bool:
    """判断 remote 是否匹配官方 Gitee/GitHub 仓库。"""
    canonical = _normalize_git_remote(raw)
    return bool(canonical) and canonical in _OFFICIAL_CANONICAL


def official_repo_urls() -> list[str]:
    """对外展示的官方仓库链接列表。"""
    return [OFFICIAL_REPO_GITEE, OFFICIAL_REPO_GITHUB]
