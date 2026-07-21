"""
文件预览服务模块

通过带 JWT token 的下载 URL，由浏览器直接预览图片、PDF、音视频等；
不支持的可浏览类型由前端提示下载或使用原生打开。
"""

from jose import JWTError, jwt
from urllib.parse import urlparse
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from loguru import logger

from infra.config.infra_config import infra_settings as settings
from infra.infrastructure.cache.cache_manager import cache_manager


class FilePreviewService:
    """文件预览：生成鉴权下载链接供 iframe/img/video 等直接使用。"""

    @staticmethod
    def _browser_safe_public_base_url() -> str:
        """
        供浏览器 img/src 使用的站点根 URL。
        BASE_URL 若误配为 localhost（常见于生产 .env），浏览器会从用户本机拉资源导致预览失败；
        此类情况降级为空，使用相对路径（随当前页面 origin）加载。
        """
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

    TOKEN_SECRET = getattr(settings, "JWT_SECRET_KEY", getattr(settings, "SECRET_KEY", "your-secret-key"))
    TOKEN_EXPIRES_IN = 3600

    PREVIEW_URL_CACHE_TTL = 1800

    @staticmethod
    def _generate_preview_token(
        file_uuid: str,
        tenant_id: int,
        expires_in: int = 3600,
    ) -> str:
        now = datetime.utcnow()
        stable_now = now.replace(minute=0, second=0, microsecond=0)

        payload = {
            "file_uuid": file_uuid,
            "tenant_id": tenant_id,
            "exp": stable_now + timedelta(seconds=expires_in + 3600),
            "iat": stable_now,
        }

        token = jwt.encode(payload, FilePreviewService.TOKEN_SECRET, algorithm="HS256")
        return token

    @staticmethod
    def verify_preview_token(token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(
                token,
                FilePreviewService.TOKEN_SECRET,
                algorithms=["HS256"],
            )
            return payload
        except JWTError as e:
            error_msg = str(e).lower()
            if "expired" in error_msg or "exp" in error_msg:
                raise ValueError("预览token已过期")
            raise ValueError("预览token无效")

    _PREVIEW_EXTENSIONS = frozenset({
        "txt", "log", "md", "markdown", "csv", "json", "xml", "yaml", "yml",
        "ini", "cfg", "conf", "html", "htm", "sql", "xls", "xlsx", "ods",
        # CAD：浏览器端解析（STEP→occt / DWG→libredwg），预览 URL 仍走鉴权下载
        "step", "stp", "dwg", "dxf",
    })

    _SPREADSHEET_MIMES = frozenset({
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.oasis.opendocument.spreadsheet",
        "text/csv",
        "application/csv",
    })

    @staticmethod
    def _is_simple_preview_supported(
        file_type: Optional[str],
        file_extension: Optional[str] = None,
    ) -> bool:
        ext = (file_extension or "").strip().lower().lstrip(".")
        if ext in FilePreviewService._PREVIEW_EXTENSIONS:
            return True

        if not file_type:
            return False

        file_type_lower = file_type.lower()

        if file_type_lower == "application/pdf":
            return True
        if file_type_lower == "application/json":
            return True
        if file_type_lower in FilePreviewService._SPREADSHEET_MIMES:
            return True
        if file_type_lower.startswith("image/"):
            return True
        if file_type_lower.startswith("text/"):
            return True
        if file_type_lower.startswith("video/"):
            return True
        if file_type_lower.startswith("audio/"):
            return True
        if file_type_lower in ("model/step", "application/step", "application/sla"):
            return True
        if "step" in file_type_lower or "dwg" in file_type_lower or "dxf" in file_type_lower:
            return True

        return False

    @staticmethod
    async def generate_simple_preview_url(
        file_uuid: str,
        tenant_id: int,
        size: Optional[int] = None,
    ) -> str:
        base_url = FilePreviewService._browser_safe_public_base_url()
        token = FilePreviewService._generate_preview_token(file_uuid, tenant_id)
        path = f"/api/v1/core/files/{file_uuid}/download?token={token}"
        if size is not None:
            path += f"&size={size}"
        return f"{base_url}{path}" if base_url else path

    @staticmethod
    async def get_preview_info(
        file_uuid: str,
        tenant_id: int,
        force_simple_for_image: bool = False,
        thumbnail_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        from core.services.file.file_service import FileService

        file = await FileService.get_file_by_uuid(tenant_id, file_uuid)

        avatar_thumbnail_size = 128
        resolved_size = thumbnail_size
        if resolved_size is None and force_simple_for_image:
            resolved_size = avatar_thumbnail_size
        preview_url = await FilePreviewService.generate_simple_preview_url(
            file_uuid=file.uuid,
            tenant_id=file.tenant_id,
            size=resolved_size,
        )
        return {
            "preview_mode": "simple",
            "preview_url": preview_url,
            "file_type": file.file_type,
            "supported": FilePreviewService._is_simple_preview_supported(
                file.file_type,
                file.file_extension,
            ),
        }

    @staticmethod
    async def clear_preview_cache(tenant_id: int, file_uuid: Optional[str] = None) -> None:
        try:
            if file_uuid:
                cache_key = f"preview_url:{tenant_id}:{file_uuid}"
                await cache_manager.delete("file_preview", cache_key)
            else:
                logger.info(f"清除组织 {tenant_id} 的预览URL缓存（如需按前缀批量删除可扩展）")
        except Exception as e:
            logger.warning(f"清除预览URL缓存失败: {e}")
