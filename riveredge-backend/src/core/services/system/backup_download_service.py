"""
备份下载鉴权服务

与文件预览一致：先通过带 Authorization 的 API 换取短效 download_token，
再由浏览器 / 下载管理器直接流式拉取 zip，避免 JWT 出现在 URL 或 JS blob 缓冲。
"""

from datetime import datetime, timedelta
import os
from typing import Any, Dict
from urllib.parse import urlparse

from jose import JWTError, jwt
from loguru import logger

from core.services.system.backup_storage import (
    _is_under_dir,
    resolve_backup_file_path,
    resolve_data_backup_dir,
)
from infra.config.infra_config import infra_settings as settings
from core.utils.timezone_utils import now_utc


class BackupDownloadService:
    TOKEN_SECRET = getattr(settings, "JWT_SECRET_KEY", getattr(settings, "SECRET_KEY", "your-secret-key"))
    TOKEN_EXPIRES_IN = 3600

    @staticmethod
    def _browser_safe_public_base_url() -> str:
        raw = (settings.BASE_URL or "").strip().rstrip("/")
        if not raw:
            return ""
        try:
            host = (urlparse(raw).hostname or "").lower()
            if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
                return ""
        except Exception:
            return ""
        return raw

    @staticmethod
    def generate_download_token(backup_uuid: str, tenant_id: int) -> str:
        now = now_utc()
        payload = {
            "backup_uuid": backup_uuid,
            "tenant_id": tenant_id,
            "exp": now + timedelta(seconds=BackupDownloadService.TOKEN_EXPIRES_IN),
            "iat": now,
        }
        return jwt.encode(payload, BackupDownloadService.TOKEN_SECRET, algorithm="HS256")

    @staticmethod
    def verify_download_token(token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(
                token,
                BackupDownloadService.TOKEN_SECRET,
                algorithms=["HS256"],
            )
            return payload
        except JWTError as exc:
            message = str(exc).lower()
            if "expired" in message or "exp" in message:
                raise ValueError("下载链接已过期，请重新点击下载") from exc
            raise ValueError("下载链接无效") from exc

    @staticmethod
    def build_download_url(backup_uuid: str, tenant_id: int) -> str:
        download_token = BackupDownloadService.generate_download_token(backup_uuid, tenant_id)
        base_url = BackupDownloadService._browser_safe_public_base_url()
        path = f"/api/v1/core/data-backups/{backup_uuid}/download?download_token={download_token}"
        return f"{base_url}{path}" if base_url else path

    @staticmethod
    def resolve_backup_file(backup_uuid: str, tenant_id: int, file_path: str | None) -> tuple[str, str]:
        if not file_path:
            raise ValueError("备份文件不存在")

        abs_path = resolve_backup_file_path(file_path)
        if not abs_path:
            logger.error(
                "备份文件已丢失: backup_uuid={}, stored_path={}",
                backup_uuid,
                file_path,
            )
            raise ValueError("备份文件已丢失")

        backups_dir = resolve_data_backup_dir()
        if not _is_under_dir(abs_path, backups_dir):
            logger.error("备份路径越界: file_path={}, backups_dir={}", abs_path, backups_dir)
            raise ValueError("无效的备份路径")

        filename = os.path.basename(abs_path)
        return abs_path, filename
