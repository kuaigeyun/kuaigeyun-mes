from __future__ import annotations

import hashlib
import hmac
import re
import time
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote, urlparse

from core.services.file.storage.base import FileStorageBackend
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.http import get_http_client

_COS_HOST_RE = re.compile(
    r"host=([a-z0-9][a-z0-9.-]*\.cos(?:-internal)?\.[a-z0-9-]+\.myqcloud\.com)",
    re.IGNORECASE,
)
_COS_REGION_IN_HOST_RE = re.compile(
    r"\.cos(?:-internal)?\.([a-z0-9-]+)\.myqcloud\.com$",
    re.IGNORECASE,
)


def _extract_region_from_host(host: str) -> str:
    m = _COS_REGION_IN_HOST_RE.search((host or "").strip().lower())
    return m.group(1) if m else ""


def build_cos_bucket_base_url(config: Dict[str, Any]) -> str:
    """
    构造桶虚拟主机域名。
    优先使用 endpoint 里已带的桶域名/地域；避免 Region 填错（如桶在上海却填广州）导致签名 Host 与验签 Host 不一致。
    """
    endpoint = str(config.get("endpoint") or "").strip().rstrip("/")
    bucket = str(config.get("bucket") or "").strip()
    region = str(config.get("region") or "").strip()
    if not bucket:
        raise ValidationError("COS 配置缺少 Bucket")

    if endpoint:
        raw = endpoint if endpoint.startswith("http") else f"https://{endpoint}"
        host = (urlparse(raw).netloc or "").lower()
        if host.startswith(f"{bucket.lower()}."):
            # endpoint 已是桶域名：以其地域为准（可纠正配置里错误的 region）
            return f"https://{host}"
        if "myqcloud.com" in host and not host.startswith(f"{bucket.lower()}."):
            # endpoint 为 cos.ap-xxx.myqcloud.com → 拼成桶域名
            return f"https://{bucket}.{host}"
        if host:
            return f"https://{host}"

    if not region:
        raise ValidationError("COS 配置缺少 Region（或在 Endpoint 中填写完整桶域名）")
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
    """
    腾讯云 COS 请求签名（文档：HttpMethod\\nUriPath\\nHttpParameters\\nHttpHeaders\\n）。

    HttpHeaders 必须为 key1=urlencode(v1)&key2=urlencode(v2)（按 key 字典序）。
    """
    now = int(time.time())
    key_time = f"{now};{now + 600}"
    sign_key = hmac.new(
        secret_key.encode("utf-8"),
        key_time.encode("utf-8"),
        hashlib.sha1,
    ).hexdigest()

    host_value = (host or "").strip().lower()
    if not host_value:
        raise ValidationError("COS 签名缺少 Host")

    signed_headers = {"host": host_value}
    if headers_to_sign:
        for k, v in headers_to_sign.items():
            signed_headers[k.lower().strip()] = str(v).strip()
    header_list = sorted(signed_headers.keys())
    http_headers = "&".join(
        f"{k}={quote(signed_headers[k], safe='-_.~')}" for k in header_list
    )
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


def _parse_cos_error_host(error_body: str) -> str:
    """从 SignatureDoesNotMatch 的 FormatString 中提取服务端用于验签的 Host。"""
    if not error_body:
        return ""
    m = _COS_HOST_RE.search(error_body)
    return (m.group(1) if m else "").lower()


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
        self.host = urlparse(self.base_url).netloc.lower()
        if not self.host:
            raise ValidationError("无法解析 COS Endpoint")

    def _apply_host(self, host: str) -> None:
        host = (host or "").strip().lower()
        if not host:
            return
        self.host = host
        self.base_url = f"https://{host}"
        # 回写 region，避免后续仍用错误地域拼域名
        region = _extract_region_from_host(host)
        if region:
            self.config = {**dict(self.config or {}), "region": region}

    def _object_url(self, key: str) -> Tuple[str, str]:
        path = _cos_uri_path(key)
        return f"{self.base_url}{path}", path

    async def _request(
        self,
        method: str,
        key: str,
        *,
        content: Optional[bytes] = None,
        content_type: Optional[str] = None,
        timeout: float = 60.0,
    ):
        url, path = self._object_url(key)
        # Host 只来自最终 URL，保证签名 Host 与请求 Host 一致
        host = urlparse(url).netloc.lower()
        auth = cos_authorization(self.secret_id, self.secret_key, method, host, path)
        headers = {"Authorization": auth}
        if content is not None:
            ct = (content_type or "application/octet-stream").strip()
            headers["Content-Type"] = ct
        # 禁止跟随重定向：301/302 后 Host 变化但签名仍是旧 Host → SignatureDoesNotMatch
        return await get_http_client().request(
            method.upper(),
            url,
            content=content,
            headers=headers,
            timeout=timeout,
            follow_redirects=False,
        )

    def _raise_upload_error(self, status_code: int, body: str) -> None:
        detail = (body or "")[:800]
        expected = _parse_cos_error_host(body)
        hint = ""
        if "SignatureDoesNotMatch" in (body or "") and expected and expected != self.host:
            region = _extract_region_from_host(expected) or "?"
            hint = (
                f" 签名 Host 与桶真实地域不一致：当前={self.host}，服务端验签={expected}。"
                f"请在应用连接器将 Region 改为 {region}，或 Endpoint 填完整桶域名 https://{expected}"
            )
        elif "SignatureDoesNotMatch" in (body or ""):
            hint = (
                f" 当前请求 Host={self.host}。"
                "请确认应用连接器 Region 与桶实际地域一致（控制台桶概览可见）。"
            )
        raise ValidationError(
            f"COS 上传失败 HTTP {status_code}: {detail or '未知错误'}{hint}"
        )

    async def put(self, key: str, data: bytes, content_type: Optional[str] = None) -> None:
        # 只签 Host；Content-Type 不进签名
        resp = await self._request("PUT", key, content=data, content_type=content_type, timeout=120.0)
        if resp.status_code in (200, 201):
            return

        body = resp.text or ""
        # Region 配错时，按服务端 FormatString 中的 Host 纠正一次再重试
        if resp.status_code == 403 and "SignatureDoesNotMatch" in body:
            expected_host = _parse_cos_error_host(body)
            if expected_host and expected_host != self.host:
                self._apply_host(expected_host)
                resp2 = await self._request(
                    "PUT", key, content=data, content_type=content_type, timeout=120.0
                )
                if resp2.status_code in (200, 201):
                    return
                self._raise_upload_error(resp2.status_code, resp2.text or "")

        self._raise_upload_error(resp.status_code, body)

    async def get(self, key: str) -> bytes:
        resp = await self._request("GET", key, timeout=120.0)
        if resp.status_code == 404:
            raise NotFoundError("文件")
        if resp.status_code >= 400:
            detail = (resp.text or "")[:800]
            raise ValidationError(f"COS 下载失败 HTTP {resp.status_code}: {detail or '未知错误'}")
        return resp.content

    async def delete(self, key: str) -> bool:
        resp = await self._request("DELETE", key, timeout=60.0)
        return resp.status_code in (200, 204, 404)

    async def exists(self, key: str) -> bool:
        resp = await self._request("HEAD", key, timeout=30.0)
        return resp.status_code in (200, 204)
