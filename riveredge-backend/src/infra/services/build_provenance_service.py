"""
构建来源判定服务

根据部署元数据与 Gitee commit API 返回构建来源状态（软标识，不阻断业务）。
"""

from __future__ import annotations

import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from loguru import logger

from infra.config.infra_config import infra_settings
from infra.constants.official_provenance import (
    OFFICIAL_GITEE_REPO_SLUG,
    OFFICIAL_SITE,
    TELEMETRY_DISCLOSURE_PATH,
    is_official_git_remote,
    normalize_git_remote,
    official_repo_urls,
)
from infra.infrastructure.http import get_http_client
from infra.models.install_registration import InstallRegistration

ProvenanceStatus = Literal[
    "official_self_hosted",
    "official_unknown_commit",
    "unverified_commit",
    "unverified_build",
    "unknown",
]

GITEE_COMMIT_API = f"https://gitee.com/api/v5/repos/{OFFICIAL_GITEE_REPO_SLUG}/commits"


def _normalize_to_iso_utc(raw: str) -> str:
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


def _try_git_short_sha_from_worktree() -> str:
    here = Path(__file__).resolve()
    for base in [here, *here.parents]:
        if not (base / ".git").exists():
            continue
        try:
            out = subprocess.run(
                ["git", "-C", str(base), "rev-parse", "--short", "HEAD"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if out.returncode == 0 and out.stdout:
                return out.stdout.strip()[:7]
        except (FileNotFoundError, OSError):
            break
        return ""
    return ""


def _try_git_remote_from_worktree() -> str:
    here = Path(__file__).resolve()
    for base in [here, *here.parents]:
        if not (base / ".git").exists():
            continue
        try:
            out = subprocess.run(
                ["git", "-C", str(base), "remote", "get-url", "origin"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if out.returncode == 0 and out.stdout:
                return out.stdout.strip()
        except (FileNotFoundError, OSError):
            break
        return ""
    return ""


def _try_git_branch_from_worktree() -> str:
    here = Path(__file__).resolve()
    for base in [here, *here.parents]:
        if not (base / ".git").exists():
            continue
        try:
            out = subprocess.run(
                ["git", "-C", str(base), "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if out.returncode == 0 and out.stdout:
                return out.stdout.strip()
        except (FileNotFoundError, OSError):
            break
        return ""
    return ""


def resolve_git_commit() -> str:
    raw = (
        infra_settings.GIT_SHA
        or os.environ.get("GIT_SHA")
        or os.environ.get("PLATFORM_GIT_SHA")
        or ""
    ).strip()
    if not raw:
        raw = _try_git_short_sha_from_worktree()
    if not raw or raw.lower().startswith("http"):
        return ""
    token = raw.split()[0]
    if len(token) > 7 and all(c in "0123456789abcdefABCDEF" for c in token):
        return token[:7].lower()
    return token[:7] if len(token) > 7 else token


def resolve_build_time() -> str:
    raw = (infra_settings.PLATFORM_BUILD_TIME or os.environ.get("PLATFORM_BUILD_TIME") or "").strip()
    return _normalize_to_iso_utc(raw) if raw else ""


def resolve_build_git_remote() -> str:
    raw = (infra_settings.BUILD_GIT_REMOTE or os.environ.get("BUILD_GIT_REMOTE") or "").strip()
    if not raw:
        raw = _try_git_remote_from_worktree()
    return raw


def resolve_build_git_branch() -> str:
    raw = (infra_settings.BUILD_GIT_BRANCH or os.environ.get("BUILD_GIT_BRANCH") or "").strip()
    if not raw:
        raw = _try_git_branch_from_worktree()
    return raw


def resolve_install_instance_id() -> str:
    return (infra_settings.INSTALL_INSTANCE_ID or os.environ.get("INSTALL_INSTANCE_ID") or "").strip()


async def _gitee_commit_exists(sha: str) -> Optional[bool]:
    """返回 True=存在，False=不存在，None=无法判定（超时/网络）。"""
    if not sha:
        return None
    url = f"{GITEE_COMMIT_API}/{sha}"
    try:
        resp = await get_http_client().get(url, timeout=5.0)
        if resp.status_code == 200:
            return True
        if resp.status_code == 404:
            return False
        logger.warning("Gitee commit 校验异常状态码: {} sha={}", resp.status_code, sha)
        return None
    except Exception as exc:
        logger.warning("Gitee commit 校验失败: {} sha={}", exc, sha)
        return None


async def resolve_provenance_status(*, git_commit: str) -> ProvenanceStatus:
    if not git_commit:
        return "unverified_build"
    if not infra_settings.OFFICIAL_PROVENANCE_ENABLED:
        return "unknown"
    exists = await _gitee_commit_exists(git_commit)
    if exists is True:
        return "official_self_hosted"
    if exists is False:
        return "unverified_commit"
    return "official_unknown_commit"


async def is_instance_registered(install_instance_id: str) -> bool:
    if not install_instance_id:
        return False
    return await InstallRegistration.filter(install_instance_id=install_instance_id).exists()


class BuildProvenanceService:
    """构建来源信息聚合。"""

    async def get_provenance(self) -> dict:
        git_commit = resolve_git_commit()
        build_time = resolve_build_time()
        build_git_remote = resolve_build_git_remote()
        build_git_branch = resolve_build_git_branch()
        install_instance_id = resolve_install_instance_id()
        remote_is_official = is_official_git_remote(build_git_remote)
        status = await resolve_provenance_status(git_commit=git_commit)
        registered = await is_instance_registered(install_instance_id)

        return {
            "status": status,
            "git_commit": git_commit,
            "build_time": build_time,
            "build_git_remote": build_git_remote,
            "build_git_branch": build_git_branch,
            "build_git_remote_is_official": remote_is_official,
            "official_repos": official_repo_urls(),
            "official_site": OFFICIAL_SITE,
            "install_instance_id": install_instance_id,
            "telemetry_enabled": infra_settings.INSTALL_TELEMETRY_ENABLED,
            "telemetry_disclosure_path": TELEMETRY_DISCLOSURE_PATH,
            "registered": registered,
        }


def is_valid_uuid_v4(value: str) -> bool:
    try:
        parsed = uuid.UUID(str(value))
        return parsed.version == 4
    except (ValueError, AttributeError, TypeError):
        return False
