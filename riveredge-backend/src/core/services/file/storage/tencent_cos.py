from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any, Dict, Optional
from urllib.parse import quote, urlparse

from core.services.file.storage.base import FileStorageBackend
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.http import get_http_client


def build_cos_bucket_base_url(config: Dict[str, Any]) -> str:
    endpoint = str(config.get("endpoint") or "").strip().rstrip("/")
    bucket = str(config.get("bucket") or "").strip()
    region = str(config.get("region") or "").strip()
    if not bucket:
        raise ValidationError("COS 配置缺少 Bucket")
    if not region:
        raise ValidationError("COS 配置缺少 Region")
    if endpoint:
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            host = urlparse(endpoint).netloc or endpoint.replace("https://", "").replace("http://", "")
            if host.startswith(f"{bucket}."):
                return f"https://{host}"
            if "myqcloud.com" in host and not host.startswith(f"{bucket}."):
                return f"https://{bucket}.{host}"
            return endpoint if endpoint.startswith("http") else f"https://{endpoint}"
        return f"https://{endpoint}"
    return f"https://{bucket}.cos.{region}.myqcloud.com"


def _cos_uri_path(key: str) -> str:
    # COS 签名与请求路径：/key，分段编码但保留 /
    parts = [quote(p, safe="") for p in key.lstrip("/").split("/")]
    return "/" + "/".join(parts)


def cos_authorization(
    secret_id: str,
    secret_key: str,
    method: str,
    host: str,
    path: str,
    *,
    headers_to_sign: Optional[Dict[str, str]] = None,
) -> str:
    now = int(time.time())
    key_time = f"{now};{now + 600}"
    sign_key = hmac.new(
        secret_key.encode("utf-8"),
        key_time.encode("utf-8"),
        hashlib.sha1,
    ).hexdigest()

    signed_headers = {"host": host.lower()}
    if headers_to_sign:
        for k, v in headers_to_sign.items():
            signed_headers[k.lower()] = v.strip()
    header_list = sorted(signed_headers.keys())
    http_headers = "".join(f"{k}={quote(signed_headers[k], safe='-_.~')}\n" for k in header_list)
    http_string = f"{method.lower()}\n{path}\n\n{http_headers}\n"
    sha1_http = hashlib.sha1(http_string.encode("utf-8")).hexdigest()
    string_to_sign = f"sha1\n{key_time}\n{sha1_http}\n"
    signature = hmac.new(
        sign_key.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha1,
    ).hexdigest()
    return (
        f"q-sign-algorithm=sha1&q-ak={secret_id}"
        f"&q-sign-time={key_time}&q-key-time={key_time}"
        f"&q-header-list={';'.join(header_list)}&q-url-param-list=&q-signature={signature}"
    )


class TencentCosStorage(FileStorageBackend):
    backend_name = "tencent_cos"

    def __init__(self, config: Dict[str, Any], connection_uuid: Optional[str] = None):
        self.config = config
        self.connection_uuid = connection_uuid
        self.secret_id = str(config.get("secret_id") or "").strip()
        self.secret_key = str(config.get("secret_key") or "").strip()
        if not self.secret_id or not self.secret_key or self.secret_key == "****":
            raise ValidationError("COS 配置缺少 SecretId / SecretKey")
        self.base_url = build_cos_bucket_base_url(config).rstrip("/")
        self.host = urlparse(self.base_url).netloc
        if not self.host:
            raise ValidationError("无法解析 COS Endpoint")

    def _object_url(self, key: str) -> tuple[str, str]:
        path = _cos_uri_path(key)
        return f"{self.base_url}{path}", path

    async def put(self, key: str, data: bytes, content_type: Optional[str] = None) -> None:
        url, path = self._object_url(key)
        ct = (content_type or "application/octet-stream").strip()
        auth = cos_authorization(
            self.secret_id,
            self.secret_key,
            "PUT",
            self.host,
            path,
            headers_to_sign={"content-type": ct},
        )
        resp = await get_http_client().request(
            "PUT",
            url,
            content=data,
            headers={
                "Host": self.host,
                "Authorization": auth,
                "Content-Type": ct,
                "Content-Length": str(len(data)),
            },
            timeout=120.0,
        )
        if resp.status_code not in (200, 201):
            detail = (resp.text or "")[:300]
            raise ValidationError(f"COS 上传失败 HTTP {resp.status_code}: {detail or '未知错误'}")

    async def get(self, key: str) -> bytes:
        url, path = self._object_url(key)
        auth = cos_authorization(self.secret_id, self.secret_key, "GET", self.host, path)
        resp = await get_http_client().request(
            "GET",
            url,
            headers={"Host": self.host, "Authorization": auth},
            timeout=120.0,
        )
        if resp.status_code == 404:
            raise NotFoundError("文件")
        if resp.status_code >= 400:
            detail = (resp.text or "")[:300]
            raise ValidationError(f"COS 下载失败 HTTP {resp.status_code}: {detail or '未知错误'}")
        return resp.content

    async def delete(self, key: str) -> bool:
        url, path = self._object_url(key)
        auth = cos_authorization(self.secret_id, self.secret_key, "DELETE", self.host, path)
        resp = await get_http_client().request(
            "DELETE",
            url,
            headers={"Host": self.host, "Authorization": auth},
            timeout=60.0,
        )
        return resp.status_code in (200, 204, 404)

    async def exists(self, key: str) -> bool:
        url, path = self._object_url(key)
        auth = cos_authorization(self.secret_id, self.secret_key, "HEAD", self.host, path)
        resp = await get_http_client().request(
            "HEAD",
            url,
            headers={"Host": self.host, "Authorization": auth},
            timeout=30.0,
        )
        return resp.status_code in (200, 204)
