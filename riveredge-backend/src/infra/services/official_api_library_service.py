"""
官方接口库服务

- 官方 SaaS（INSTALL_REPO_SUMMARY_ADMIN_ENABLED）：直接读写本地表
- 其它部署：经固定地址 https://kuaigeyun.com 拉取/提交
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from infra.constants.official_registry import (
    OFFICIAL_API_LIBRARY_API_PREFIX,
    OFFICIAL_API_LIBRARY_BASE_URL,
    is_local_official_api_library_host,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.http import get_http_client
from infra.models.official_api_library import OfficialApiLibraryPack

_PACK_ID_SAFE = re.compile(r"[^a-z0-9_]+")
_SENSITIVE_HEADER_KEYS = frozenset(
    {
        "authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
        "api-key",
        "apikey",
        "token",
        "access-token",
        "x-access-token",
    }
)


def _slugify_pack_id(name: str) -> str:
    base = (name or "").strip().lower()
    base = base.replace("-", "_").replace(" ", "_")
    # 非 ascii 名称用短 uuid
    ascii_part = _PACK_ID_SAFE.sub("_", base).strip("_")
    if not ascii_part or not re.search(r"[a-z]", ascii_part):
        ascii_part = "pack"
    suffix = uuid.uuid4().hex[:8]
    return f"{ascii_part[:48]}_{suffix}"


def _strip_sensitive_headers(headers: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not headers or not isinstance(headers, dict):
        return headers
    cleaned: Dict[str, Any] = {}
    for key, value in headers.items():
        if str(key).strip().lower() in _SENSITIVE_HEADER_KEYS:
            continue
        cleaned[str(key)] = value
    return cleaned or None


def normalize_official_api_item(raw: Dict[str, Any]) -> Dict[str, Any]:
    item_key = str(raw.get("item_key") or raw.get("code_suffix") or raw.get("code") or "").strip()
    name = str(raw.get("name") or "").strip()
    path = str(raw.get("path") or "").strip()
    method = str(raw.get("method") or "GET").strip().upper()
    if not item_key:
        raise ValidationError("接口条目缺少 item_key")
    if not name:
        raise ValidationError(f"接口条目「{item_key}」缺少名称")
    if not path:
        raise ValidationError(f"接口条目「{item_key}」缺少路径")
    if method not in {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}:
        raise ValidationError(f"接口条目「{item_key}」请求方法无效")

    description = str(raw.get("description") or "").strip()
    return {
        "item_key": item_key,
        "name": name,
        "description": description,
        "path": path,
        "method": method,
        "request_headers": _strip_sensitive_headers(raw.get("request_headers")),
        "request_params": raw.get("request_params") if isinstance(raw.get("request_params"), dict) else None,
        "request_body": raw.get("request_body") if isinstance(raw.get("request_body"), (dict, list)) else None,
        "response_format": raw.get("response_format") if isinstance(raw.get("response_format"), dict) else None,
        "response_example": raw.get("response_example")
        if isinstance(raw.get("response_example"), (dict, list))
        else None,
    }


def pack_to_preview(pack: OfficialApiLibraryPack, *, include_full_items: bool = False) -> Dict[str, Any]:
    raw_items = pack.items if isinstance(pack.items, list) else []
    if include_full_items:
        items = [normalize_official_api_item(item) for item in raw_items if isinstance(item, dict)]
    else:
        items = [
            {
                "item_key": str(item.get("item_key") or ""),
                "name": str(item.get("name") or ""),
                "description": str(item.get("description") or ""),
            }
            for item in raw_items
            if isinstance(item, dict)
        ]
    return {
        "pack_id": pack.pack_id,
        "name": pack.name,
        "description": pack.description or "",
        "connector_type": pack.connector_type,
        "category_name": pack.category_name,
        "category_code": pack.category_code,
        "category_description": pack.category_description or "",
        "api_count": len(items),
        "items": items,
        "source": "official",
    }


class OfficialApiLibraryService:
    """官方 SaaS 本地表读写。"""

    async def list_published(self) -> Dict[str, Any]:
        rows = (
            await OfficialApiLibraryPack.filter(status="published", tenant_id__isnull=True)
            .order_by("-created_at")
            .all()
        )
        return {"items": [pack_to_preview(row) for row in rows]}

    async def get_published_pack(self, pack_id: str, *, full: bool = True) -> Dict[str, Any]:
        normalized = str(pack_id or "").strip()
        if not normalized:
            raise ValidationError("接口包 ID 无效")
        pack = await OfficialApiLibraryPack.filter(
            pack_id=normalized,
            status="published",
            tenant_id__isnull=True,
        ).first()
        if not pack:
            raise NotFoundError(f"官方接口包不存在: {normalized}")
        return pack_to_preview(pack, include_full_items=full)

    async def submit_pack(
        self,
        *,
        name: str,
        description: str,
        connector_type: str,
        category_name: str,
        category_code: Optional[str],
        category_description: Optional[str],
        items: List[Dict[str, Any]],
        submitter_hint: Optional[str] = None,
        source_host_hint: Optional[str] = None,
        pack_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        pack_name = str(name or "").strip()
        conn_type = str(connector_type or "").strip()
        cat_name = str(category_name or "").strip()
        if not pack_name:
            raise ValidationError("请填写接口包名称")
        if not conn_type:
            raise ValidationError("请填写连接器类型")
        if not cat_name:
            raise ValidationError("请填写分类名称")
        if not items:
            raise ValidationError("请至少提交一个接口")

        normalized_items = [normalize_official_api_item(item) for item in items]
        keys = [item["item_key"] for item in normalized_items]
        if len(keys) != len(set(keys)):
            raise ValidationError("接口条目 item_key 不可重复")

        resolved_pack_id = str(pack_id or "").strip() or _slugify_pack_id(pack_name)
        existing = await OfficialApiLibraryPack.filter(pack_id=resolved_pack_id).first()
        if existing:
            raise ValidationError(f"接口包 ID 已存在: {resolved_pack_id}")

        cat_code = str(category_code or "").strip() or _PACK_ID_SAFE.sub("_", cat_name.lower()).strip("_") or "custom"
        pack = await OfficialApiLibraryPack.create(
            tenant_id=None,
            pack_id=resolved_pack_id,
            name=pack_name,
            description=str(description or "").strip() or None,
            connector_type=conn_type,
            category_name=cat_name,
            category_code=cat_code[:50],
            category_description=(str(category_description or "").strip() or None),
            status="published",
            items=normalized_items,
            submitter_hint=(str(submitter_hint or "").strip() or None),
            source_host_hint=(str(source_host_hint or "").strip() or None),
        )
        return {
            "pack_id": pack.pack_id,
            "name": pack.name,
            "api_count": len(normalized_items),
            "status": pack.status,
        }


class OfficialApiLibraryClient:
    """私有部署 → 固定官方站点 HTTP 客户端。"""

    def __init__(self, base_url: str = OFFICIAL_API_LIBRARY_BASE_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_prefix = OFFICIAL_API_LIBRARY_API_PREFIX

    def _url(self, path: str) -> str:
        return f"{self.base_url}{self.api_prefix}{path}"

    async def list_catalog(self) -> Dict[str, Any]:
        client = get_http_client()
        try:
            resp = await client.get(self._url("/packs"), timeout=15.0)
        except httpx.HTTPError as exc:
            logger.warning("官方接口库目录请求失败 err={}", exc)
            raise ValidationError("无法连接官方接口库（kuaigeyun.com），请检查网络后重试") from exc
        if resp.status_code == 404:
            raise ValidationError("官方接口库服务尚未在 kuaigeyun.com 开通，请稍后再试")
        return self._parse_json(resp, "获取官方接口库失败")

    async def get_pack(self, pack_id: str) -> Dict[str, Any]:
        client = get_http_client()
        try:
            resp = await client.get(self._url(f"/packs/{pack_id}"), timeout=15.0)
        except httpx.HTTPError as exc:
            logger.warning("官方接口包详情请求失败 pack_id={} err={}", pack_id, exc)
            raise ValidationError("无法连接官方接口库（kuaigeyun.com），请检查网络后重试") from exc
        if resp.status_code == 404:
            raise NotFoundError(f"官方接口包不存在: {pack_id}")
        return self._parse_json(resp, "获取官方接口包失败")

    async def submit_pack(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        client = get_http_client()
        try:
            resp = await client.post(self._url("/submit"), json=payload, timeout=30.0)
        except httpx.HTTPError as exc:
            logger.warning("提交官方接口库失败 err={}", exc)
            raise ValidationError("无法连接官方接口库（kuaigeyun.com），请检查网络后重试") from exc
        if resp.status_code == 404:
            raise ValidationError("官方接口库服务尚未在 kuaigeyun.com 开通，请稍后再试")
        return self._parse_json(resp, "提交到官方接口库失败")

    @staticmethod
    def _parse_json(resp: httpx.Response, default_error: str) -> Dict[str, Any]:
        try:
            payload = resp.json()
        except Exception as exc:
            raise ValidationError(default_error) from exc
        if resp.status_code >= 400:
            detail = ""
            if isinstance(payload, dict):
                raw = payload.get("detail") or payload.get("message") or ""
                if isinstance(raw, dict):
                    detail = str(raw.get("message") or raw)
                else:
                    detail = str(raw)
            raise ValidationError(detail or default_error)
        if not isinstance(payload, dict):
            raise ValidationError(default_error)
        return payload


async def list_official_api_library() -> Dict[str, Any]:
    if is_local_official_api_library_host():
        return await OfficialApiLibraryService().list_published()
    return await OfficialApiLibraryClient().list_catalog()


async def get_official_api_library_pack(pack_id: str) -> Dict[str, Any]:
    if is_local_official_api_library_host():
        return await OfficialApiLibraryService().get_published_pack(pack_id, full=True)
    return await OfficialApiLibraryClient().get_pack(pack_id)


async def submit_official_api_library_pack(payload: Dict[str, Any]) -> Dict[str, Any]:
    if is_local_official_api_library_host():
        return await OfficialApiLibraryService().submit_pack(
            name=payload.get("name") or "",
            description=payload.get("description") or "",
            connector_type=payload.get("connector_type") or "",
            category_name=payload.get("category_name") or "",
            category_code=payload.get("category_code"),
            category_description=payload.get("category_description"),
            items=payload.get("items") or [],
            submitter_hint=payload.get("submitter_hint"),
            source_host_hint=payload.get("source_host_hint"),
            pack_id=payload.get("pack_id"),
        )
    return await OfficialApiLibraryClient().submit_pack(payload)
