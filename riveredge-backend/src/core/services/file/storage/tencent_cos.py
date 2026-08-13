from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from qcloud_cos import CosConfig, CosS3Client
from qcloud_cos.cos_exception import CosServiceError

from core.services.file.storage.base import FileStorageBackend
from infra.exceptions.exceptions import NotFoundError, ValidationError


def build_cos_bucket_base_url(config: Dict[str, Any]) -> str:
    """构造桶虚拟主机域名（展示 / 探测用）。"""
    endpoint = str(config.get("endpoint") or "").strip().rstrip("/")
    bucket = str(config.get("bucket") or "").strip()
    region = str(config.get("region") or "").strip()
    if not bucket:
        raise ValidationError("COS 配置缺少 Bucket")

    if endpoint:
        raw = endpoint if endpoint.startswith("http") else f"https://{endpoint}"
        host = (urlparse(raw).netloc or "").lower()
        if host.startswith(f"{bucket.lower()}."):
            return f"https://{host}"
        if "myqcloud.com" in host and not host.startswith(f"{bucket.lower()}."):
            return f"https://{bucket}.{host}"
        if host:
            return f"https://{host}"

    if not region:
        raise ValidationError("COS 配置缺少 Region（或在 Endpoint 中填写完整桶域名）")
    return f"https://{bucket}.cos.{region}.myqcloud.com"


def _resolve_region(config: Dict[str, Any], host: str) -> str:
    region = str(config.get("region") or "").strip()
    if region:
        return region
    # 从桶域名解析 ap-xxx
    marker = ".cos."
    h = (host or "").lower()
    if marker in h and h.endswith(".myqcloud.com"):
        mid = h.split(marker, 1)[1]
        return mid.split(".myqcloud.com", 1)[0].replace("-internal", "")
    raise ValidationError("COS 配置缺少 Region")


def _read_cos_object_body(body: Any) -> bytes:
    """
    读完 COS get_object 的 Body。

    qcloud_cos StreamBody.read() 默认 chunk_size=1024，只返回第一块，不是整文件。
    必须用 get_stream 迭代，否则 STEP/图片/PDF 都会被截成 1KB。
    """
    if body is None or not hasattr(body, "get_stream"):
        raise ValidationError("COS 下载失败：响应 Body 不是可流式读取的对象")
    chunks = []
    for chunk in body.get_stream(1024 * 1024):
        if not isinstance(chunk, (bytes, bytearray)):
            raise ValidationError("COS 下载失败：对象流返回了非字节内容")
        chunks.append(bytes(chunk))
    data = b"".join(chunks)
    expected = int(len(body))
    if expected > 0 and len(data) != expected:
        raise ValidationError(
            f"COS 下载不完整：期望 {expected} 字节，实际 {len(data)} 字节"
        )
    return data


class TencentCosStorage(FileStorageBackend):
    """
    腾讯云 COS：使用官方 cos-python-sdk-v5 签名与收发。
    手写 Authorization 易与 SDK/服务端对 Content-Type、Host 等头的处理不一致。
    """

    backend_name = "tencent_cos"

    def __init__(self, config: Dict[str, Any], connection_uuid: Optional[str] = None):
        self.config = config
        self.connection_uuid = connection_uuid
        self.secret_id = str(config.get("secret_id") or "").strip()
        self.secret_key = str(config.get("secret_key") or "").strip()
        if not self.secret_id or not self.secret_key or self.secret_key == "****":
            raise ValidationError("COS 配置缺少 SecretId / SecretKey")

        self.bucket = str(config.get("bucket") or "").strip()
        if not self.bucket:
            raise ValidationError("COS 配置缺少 Bucket")

        self.base_url = build_cos_bucket_base_url(config).rstrip("/")
        self.host = urlparse(self.base_url).netloc.lower()
        if not self.host:
            raise ValidationError("无法解析 COS Endpoint")

        self.region = _resolve_region(config, self.host)
        cos_conf = CosConfig(
            Region=self.region,
            SecretId=self.secret_id,
            SecretKey=self.secret_key,
            Scheme="https",
        )
        self._client = CosS3Client(cos_conf)

    def _object_key(self, key: str) -> str:
        return str(key or "").lstrip("/")

    async def put(self, key: str, data: bytes, content_type: Optional[str] = None) -> None:
        object_key = self._object_key(key)
        kwargs: Dict[str, Any] = {
            "Bucket": self.bucket,
            "Body": data,
            "Key": object_key,
        }
        ct = (content_type or "").strip()
        if ct:
            kwargs["ContentType"] = ct
        try:
            await asyncio.to_thread(self._client.put_object, **kwargs)
        except CosServiceError as e:
            raise ValidationError(
                f"COS 上传失败 HTTP {e.get_status_code()}: {e.get_error_code()} {e.get_error_msg()}"
            ) from e
        except Exception as e:
            raise ValidationError(f"COS 上传失败: {e}") from e

    async def put_file(self, key: str, local_path: str, content_type: Optional[str] = None) -> None:
        """分片上传本地文件，不按大小截断，也不整文件读入内存。"""
        object_key = self._object_key(key)
        if not os.path.isfile(local_path):
            raise ValidationError(f"本地文件不存在: {local_path}")
        kwargs: Dict[str, Any] = {
            "Bucket": self.bucket,
            "LocalFilePath": local_path,
            "Key": object_key,
            "PartSize": 8,
            "MAXThread": 4,
        }
        ct = (content_type or "").strip()
        if ct:
            kwargs["ContentType"] = ct
        try:
            await asyncio.to_thread(self._client.upload_file, **kwargs)
        except CosServiceError as e:
            raise ValidationError(
                f"COS 上传失败 HTTP {e.get_status_code()}: {e.get_error_code()} {e.get_error_msg()}"
            ) from e
        except Exception as e:
            raise ValidationError(f"COS 上传失败: {e}") from e

    async def get(self, key: str) -> bytes:
        object_key = self._object_key(key)
        try:
            resp = await asyncio.to_thread(
                self._client.get_object,
                Bucket=self.bucket,
                Key=object_key,
            )
            body = resp["Body"]
            return await asyncio.to_thread(_read_cos_object_body, body)
        except CosServiceError as e:
            if e.get_status_code() == 404 or e.get_error_code() in ("NoSuchKey", "NoSuchResource"):
                raise NotFoundError("文件") from e
            raise ValidationError(
                f"COS 下载失败 HTTP {e.get_status_code()}: {e.get_error_code()} {e.get_error_msg()}"
            ) from e

    async def delete(self, key: str) -> bool:
        object_key = self._object_key(key)
        try:
            await asyncio.to_thread(
                self._client.delete_object,
                Bucket=self.bucket,
                Key=object_key,
            )
            return True
        except CosServiceError as e:
            if e.get_status_code() == 404 or e.get_error_code() in ("NoSuchKey", "NoSuchResource"):
                return True
            return False
        except Exception:
            return False

    async def head_content_length(self, key: str) -> Optional[int]:
        """HEAD 对象大小；不存在返回 None。"""
        object_key = self._object_key(key)
        try:
            resp = await asyncio.to_thread(
                self._client.head_object,
                Bucket=self.bucket,
                Key=object_key,
            )
            return int(resp.get("Content-Length") or 0)
        except CosServiceError as e:
            if e.get_status_code() == 404 or e.get_error_code() in ("NoSuchKey", "NoSuchResource"):
                return None
            raise ValidationError(
                f"COS HEAD 失败 HTTP {e.get_status_code()}: {e.get_error_code()} {e.get_error_msg()}"
            ) from e

    async def exists(self, key: str) -> bool:
        return (await self.head_content_length(key)) is not None
