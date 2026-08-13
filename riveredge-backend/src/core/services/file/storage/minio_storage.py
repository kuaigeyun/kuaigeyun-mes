"""
MinIO（S3 兼容）文件存储适配器。

配置字段与应用连接器 minio 一致：endpoint / access_key / secret_key /
bucket / region / use_ssl / use_path_style。
"""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from core.services.file.storage.base import FileStorageBackend
from infra.exceptions.exceptions import NotFoundError, ValidationError


def _coerce_bool(value: Any, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in ("1", "true", "yes", "y", "on"):
        return True
    if text in ("0", "false", "no", "n", "off", ""):
        return False
    return default


def parse_minio_endpoint(config: Dict[str, Any]) -> tuple[str, bool]:
    """
    返回 (host_with_port, secure)。
    MinIO SDK 要求 endpoint 不含 scheme。
    """
    endpoint = str(config.get("endpoint") or "").strip().rstrip("/")
    use_ssl = _coerce_bool(config.get("use_ssl"), default=True)
    if not endpoint:
        raise ValidationError("MinIO 配置缺少 Endpoint")

    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        if use_ssl and parsed.scheme != "https":
            raise ValidationError(
                "已开启「使用 HTTPS」，Endpoint 必须为 https://。"
                "若 MinIO 仅提供 HTTP，请关闭该开关。"
            )
        if not use_ssl and parsed.scheme == "https":
            raise ValidationError(
                "已关闭「使用 HTTPS」，Endpoint 应为 http://。"
                "若 MinIO 已启用 TLS，请打开「使用 HTTPS」。"
            )
        path = (parsed.path or "").strip("/")
        bucket = str(config.get("bucket") or "").strip()
        if path and path != bucket:
            raise ValidationError(
                "MinIO Endpoint 请只填 API 地址（如 http://host:9000），不要带路径。"
            )
        host = parsed.netloc
        if not host:
            raise ValidationError("无法解析 MinIO Endpoint")
        return host, parsed.scheme == "https"

    return endpoint, use_ssl


class MinioStorage(FileStorageBackend):
    """MinIO：官方 minio SDK 签名与收发。"""

    backend_name = "minio"

    def __init__(self, config: Dict[str, Any], connection_uuid: Optional[str] = None):
        self.config = config
        self.connection_uuid = connection_uuid

        access_key = str(config.get("access_key") or "").strip()
        secret_key = str(config.get("secret_key") or "").strip()
        if not access_key or not secret_key or secret_key == "****":
            raise ValidationError("MinIO 配置缺少 Access Key / Secret Key")

        self.bucket = str(config.get("bucket") or "").strip()
        if not self.bucket:
            raise ValidationError("MinIO 配置缺少 Bucket")

        self.region = str(config.get("region") or "us-east-1").strip() or "us-east-1"
        host, secure = parse_minio_endpoint(config)
        self._endpoint_host = host
        self._secure = secure
        # 展示用根地址（不含 bucket）
        scheme = "https" if secure else "http"
        self.base_url = f"{scheme}://{host}"

        # MinIO 默认 path-style；SDK 对自定义域名会自动处理
        self._client = Minio(
            host,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
            region=self.region,
        )

    def _object_key(self, key: str) -> str:
        return str(key or "").lstrip("/")

    async def put(self, key: str, data: bytes, content_type: Optional[str] = None) -> None:
        from io import BytesIO

        object_key = self._object_key(key)
        body = BytesIO(data)
        length = len(data)
        ct = (content_type or "").strip() or "application/octet-stream"

        def _do_put() -> None:
            self._client.put_object(
                self.bucket,
                object_key,
                body,
                length,
                content_type=ct,
            )

        try:
            await asyncio.to_thread(_do_put)
        except S3Error as e:
            raise ValidationError(
                f"MinIO 上传失败 HTTP {e.status}: {e.code} {e.message}"
            ) from e
        except Exception as e:
            raise ValidationError(f"MinIO 上传失败: {e}") from e

    async def put_file(self, key: str, local_path: str, content_type: Optional[str] = None) -> None:
        object_key = self._object_key(key)
        if not os.path.isfile(local_path):
            raise ValidationError(f"本地文件不存在: {local_path}")
        ct = (content_type or "").strip() or None

        def _do_fput() -> None:
            self._client.fput_object(
                self.bucket,
                object_key,
                local_path,
                content_type=ct,
            )

        try:
            await asyncio.to_thread(_do_fput)
        except S3Error as e:
            raise ValidationError(
                f"MinIO 上传失败 HTTP {e.status}: {e.code} {e.message}"
            ) from e
        except Exception as e:
            raise ValidationError(f"MinIO 上传失败: {e}") from e

    async def get(self, key: str) -> bytes:
        object_key = self._object_key(key)

        def _do_get() -> bytes:
            resp = self._client.get_object(self.bucket, object_key)
            try:
                return resp.read()
            finally:
                resp.close()
                resp.release_conn()

        try:
            return await asyncio.to_thread(_do_get)
        except S3Error as e:
            if e.code in ("NoSuchKey", "NoSuchObject", "NoSuchBucket") or e.status == 404:
                raise NotFoundError("文件") from e
            raise ValidationError(
                f"MinIO 下载失败 HTTP {e.status}: {e.code} {e.message}"
            ) from e

    async def delete(self, key: str) -> bool:
        object_key = self._object_key(key)

        def _do_delete() -> None:
            self._client.remove_object(self.bucket, object_key)

        try:
            await asyncio.to_thread(_do_delete)
            return True
        except S3Error as e:
            if e.code in ("NoSuchKey", "NoSuchObject") or e.status == 404:
                return True
            return False
        except Exception:
            return False

    async def head_content_length(self, key: str) -> Optional[int]:
        object_key = self._object_key(key)

        def _do_stat() -> Optional[int]:
            try:
                st = self._client.stat_object(self.bucket, object_key)
                return int(st.size or 0)
            except S3Error as e:
                if e.code in ("NoSuchKey", "NoSuchObject", "NoSuchBucket") or e.status == 404:
                    return None
                raise

        try:
            return await asyncio.to_thread(_do_stat)
        except S3Error as e:
            raise ValidationError(
                f"MinIO HEAD 失败 HTTP {e.status}: {e.code} {e.message}"
            ) from e

    async def exists(self, key: str) -> bool:
        return (await self.head_content_length(key)) is not None
