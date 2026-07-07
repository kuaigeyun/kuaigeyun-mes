"""
实例安装登记服务

可选遥测：记录构建来源元数据，失败或关闭不影响业务。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from infra.config.infra_config import infra_settings
from infra.constants.official_provenance import (
    OFFICIAL_SITE,
    is_official_git_remote,
    official_repo_urls,
)
from infra.models.install_registration import InstallRegistration
from infra.services.build_provenance_service import (
    is_valid_uuid_v4,
    resolve_build_git_branch,
    resolve_build_git_remote,
    resolve_git_commit,
    resolve_install_instance_id,
)
from infra.utils.simple_rate_limit import SlidingWindowRateLimiter

_REGISTER_LIMITER = SlidingWindowRateLimiter(max_calls=10, window_seconds=60)

REGISTER_SUCCESS_MESSAGE = (
    "已记录构建来源信息，用于官方统计与安全公告；不含业务数据。"
)
REMOTE_DISCLAIMER = "remote 为实例自述，可能被伪造，仅作调查线索。"


class InstallRegistrationService:
    async def register(
        self,
        *,
        payload: dict[str, Any],
        client_ip: str,
    ) -> dict[str, Any]:
        if not infra_settings.INSTALL_TELEMETRY_ENABLED:
            return {"registered": False, "reason": "telemetry_disabled"}

        configured_id = resolve_install_instance_id()
        if not configured_id:
            return {"registered": False, "reason": "install_id_not_configured"}

        request_id = str(payload.get("install_instance_id") or "").strip()
        if request_id != configured_id:
            return {"registered": False, "reason": "install_id_mismatch"}

        if not is_valid_uuid_v4(request_id):
            return {"registered": False, "reason": "invalid_install_id"}

        if not _REGISTER_LIMITER.allow(client_ip):
            return {"registered": False, "reason": "rate_limited"}

        git_commit = resolve_git_commit() or str(payload.get("git_commit") or "").strip()
        build_time = str(payload.get("build_time") or "").strip()
        provenance_status = str(payload.get("provenance_status") or "unknown").strip()
        app_version = str(payload.get("app_version") or infra_settings.APP_VERSION or "").strip()
        build_git_remote = resolve_build_git_remote()
        build_git_branch = resolve_build_git_branch() or str(payload.get("build_git_branch") or "").strip()
        host_hint = str(payload.get("host_hint") or "").strip() or None
        remote_is_official = is_official_git_remote(build_git_remote)

        now = datetime.now(timezone.utc)
        existing = await InstallRegistration.get_or_none(install_instance_id=request_id)
        if existing:
            existing.git_commit = git_commit or existing.git_commit
            existing.build_time = build_time or existing.build_time
            existing.provenance_status = provenance_status or existing.provenance_status
            existing.app_version = app_version or existing.app_version
            existing.build_git_remote = build_git_remote or existing.build_git_remote
            existing.build_git_branch = build_git_branch or existing.build_git_branch
            existing.build_git_remote_is_official = remote_is_official
            existing.host_hint = host_hint or existing.host_hint
            existing.last_seen_at = now
            existing.register_count = (existing.register_count or 0) + 1
            existing.last_register_ip = client_ip
            await existing.save()
        else:
            await InstallRegistration.create(
                tenant_id=None,
                install_instance_id=request_id,
                git_commit=git_commit or None,
                build_time=build_time or None,
                provenance_status=provenance_status or "unknown",
                app_version=app_version or None,
                build_git_remote=build_git_remote or None,
                build_git_branch=build_git_branch or None,
                build_git_remote_is_official=remote_is_official,
                host_hint=host_hint,
                first_seen_at=now,
                last_seen_at=now,
                register_count=1,
                last_register_ip=client_ip,
            )

        return {
            "registered": True,
            "official_repos": official_repo_urls(),
            "official_site": OFFICIAL_SITE,
            "message": REGISTER_SUCCESS_MESSAGE,
        }

    async def repo_summary(self) -> dict[str, Any]:
        rows = await InstallRegistration.all().values(
            "build_git_remote",
            "build_git_remote_is_official",
            "last_seen_at",
        )
        official_count = 0
        remote_buckets: dict[str, dict[str, Any]] = {}

        for row in rows:
            if row.get("build_git_remote_is_official"):
                official_count += 1
                continue
            remote = (row.get("build_git_remote") or "").strip()
            if not remote:
                remote = "(empty)"
            bucket = remote_buckets.setdefault(
                remote,
                {"build_git_remote": remote, "instance_count": 0, "last_seen_at": None},
            )
            bucket["instance_count"] += 1
            seen = row.get("last_seen_at")
            if seen and (
                bucket["last_seen_at"] is None or seen > bucket["last_seen_at"]
            ):
                bucket["last_seen_at"] = seen

        non_official = sorted(
            remote_buckets.values(),
            key=lambda item: item.get("instance_count", 0),
            reverse=True,
        )
        for item in non_official:
            seen = item.get("last_seen_at")
            if isinstance(seen, datetime):
                item["last_seen_at"] = seen.strftime("%Y-%m-%dT%H:%M:%SZ")

        return {
            "non_official_remotes": non_official,
            "official_remote_count": official_count,
            "disclaimer": REMOTE_DISCLAIMER,
        }
