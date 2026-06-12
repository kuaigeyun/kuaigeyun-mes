"""平台级客户端发布：APK / Windows 安装包 / OTA。"""

from __future__ import annotations

import hashlib
import json
import shutil
import socket
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from packaging.version import InvalidVersion, Version

from core.config.client_product_registry import DEFAULT_CLIENT_PRODUCTS
from core.models.client_product import CoreClientProduct
from core.models.client_release import CoreClientRelease
from infra.config.infra_config import infra_settings
from infra.domain.timezone_utils import now
from infra.exceptions.exceptions import NotFoundError, ValidationError

PACKAGE_MAX_BYTES = 500 * 1024 * 1024
VALID_PLATFORMS = frozenset({"android", "ios", "windows"})
VALID_UPDATE_TYPES = frozenset({"package", "ota", "both"})
PACKAGE_EXTENSIONS = {
    "android": (".apk",),
    "ios": (".ipa",),
    "windows": (".exe", ".msi", ".zip"),
}


def client_release_root() -> Path:
    base = Path(getattr(infra_settings, "CLIENT_RELEASE_DIR", "") or infra_settings.FILE_UPLOAD_DIR)
    root = base / "clients"
    root.mkdir(parents=True, exist_ok=True)
    return root


def packages_dir(client_key: str) -> Path:
    path = client_release_root() / client_key / "packages"
    path.mkdir(parents=True, exist_ok=True)
    return path


def updates_dir(client_key: str) -> Path:
    path = client_release_root() / client_key / "updates"
    path.mkdir(parents=True, exist_ok=True)
    return path


def detect_lan_ipv4() -> str | None:
    """本机对外通信网卡的 IPv4（用于开发扫码下载，避免 127.0.0.1）。"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    return None


def resolve_qr_download_origin(*, request_scheme: str, frontend_port: int | None) -> str | None:
    """
    生成手机扫码可访问的站点 origin（安装包 /static/client-* 由后端直出）。
    优先 BASE_URL；否则 LAN IP + 端口：
    - Vite 开发入口（FRONTEND_PORT，默认 8100）→ 后端 PORT（默认 8200）
    - Caddy/生产统一入口（8080 等）→ 保持浏览器端口
    """
    configured = (infra_settings.BASE_URL or "").strip().rstrip("/")
    if configured:
        return configured
    lan = detect_lan_ipv4()
    if not lan:
        return None
    scheme = request_scheme or "http"
    port = frontend_port
    if port == infra_settings.FRONTEND_PORT:
        port = infra_settings.PORT
    if port in (None, 0, 80) and scheme == "http":
        return f"http://{lan}"
    if port in (None, 0, 443) and scheme == "https":
        return f"https://{lan}"
    if port:
        return f"{scheme}://{lan}:{port}"
    return f"{scheme}://{lan}"


def build_public_origin(request_base_url: str | None) -> str:
    configured = (infra_settings.BASE_URL or "").strip().rstrip("/")
    if configured:
        return configured
    if request_base_url:
        parsed = request_base_url.rstrip("/")
        if parsed.endswith("/api/v1"):
            return parsed[: -len("/api/v1")]
        return parsed
    return ""


def resolve_request_public_origin(
    *,
    base_url: str,
    host: str | None = None,
    scheme: str | None = None,
    port: int | None = None,
) -> str:
    """移动端版本检查/安装包 URL 的 origin；开发环境 localhost 时回落 LAN IP。"""
    configured = (infra_settings.BASE_URL or "").strip().rstrip("/")
    if configured:
        return configured

    hostname = (host or "").split(":")[0].strip().lower()
    if hostname in ("127.0.0.1", "localhost", "::1"):
        lan = detect_lan_ipv4()
        if lan:
            eff_scheme = scheme or "http"
            eff_port = port if port is not None else infra_settings.PORT
            if eff_port in (None, 0, 80) and eff_scheme == "http":
                return f"http://{lan}"
            if eff_port in (None, 0, 443) and eff_scheme == "https":
                return f"https://{lan}"
            if eff_port:
                return f"{eff_scheme}://{lan}:{eff_port}"
            return f"{eff_scheme}://{lan}"

    return build_public_origin(base_url)


def package_public_url(origin: str, client_key: str, filename: str) -> str:
    path = f"/static/client-packages/{client_key}/packages/{filename}"
    if not origin:
        return path
    return f"{origin.rstrip('/')}{path}"


def ota_public_base(origin: str, client_key: str, relative_path: str) -> str:
    rel = relative_path.strip("/")
    return f"{origin.rstrip('/')}/static/client-updates/{client_key}/{rel}"


def _parse_version(raw: str) -> Version | None:
    s = (raw or "").strip()
    if not s:
        return None
    try:
        return Version(s)
    except InvalidVersion:
        return None


def _semver_eq(current: str, latest: str) -> bool:
    left, right = _parse_version(current), _parse_version(latest)
    if left is not None and right is not None:
        return left == right
    return (current or "").strip() == (latest or "").strip()


def _semver_lt(current: str, latest: str) -> bool:
    if _semver_eq(current, latest):
        return False
    left, right = _parse_version(current), _parse_version(latest)
    if left is not None and right is not None:
        return left < right
    return (current or "").strip() != (latest or "").strip()


def _no_update_payload(
    *,
    latest_payload: dict[str, Any],
    ota_info: dict[str, Any] | None,
    client_key: str,
) -> dict[str, Any]:
    return {
        "update_type": "none",
        "force": False,
        "latest": latest_payload,
        "ota": ota_info,
        "client_key": client_key,
    }


def _package_payload(row: CoreClientRelease, origin: str) -> dict[str, Any] | None:
    if not row.artifact_filename:
        return None
    return {
        "url": package_public_url(origin, row.client_key, row.artifact_filename),
        "sha256": row.artifact_sha256,
        "size_bytes": row.artifact_size_bytes,
        "filename": row.artifact_filename,
    }


def _release_to_dict(row: CoreClientRelease, origin: str) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": row.id,
        "uuid": row.uuid,
        "client_key": row.client_key,
        "platform": row.platform,
        "app_version": row.app_version,
        "version_code": row.version_code,
        "runtime_version": row.runtime_version,
        "update_type": row.update_type,
        "requires_native": row.requires_native,
        "force_update": row.force_update,
        "min_version_code": row.min_version_code,
        "release_notes": row.release_notes,
        "bundle_id": row.bundle_id,
        "is_active": row.is_active,
        "rollout_percent": row.rollout_percent,
        "artifact_ext": row.artifact_ext,
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    pkg = _package_payload(row, origin)
    if pkg:
        out["package"] = pkg
        if row.platform == "android":
            out["apk"] = pkg
    if row.ota_relative_path:
        out["ota"] = {
            "updates_url": ota_public_base(origin, row.client_key, row.ota_relative_path),
            "relative_path": row.ota_relative_path,
        }
    return out


async def ensure_default_products() -> None:
    for spec in DEFAULT_CLIENT_PRODUCTS:
        existing = await CoreClientProduct.get_or_none(client_key=spec.client_key)
        if existing:
            continue
        await CoreClientProduct.create(
            uuid=str(uuid.uuid4()),
            client_key=spec.client_key,
            display_name=spec.display_name,
            app_code=spec.app_code,
            client_kind=spec.client_kind,
            platform_target=spec.platform_target,
            supports_ota=spec.supports_ota,
            login_tile_slot=spec.login_tile_slot,
            sort_order=spec.sort_order,
            is_active=True,
        )


async def get_product(client_key: str) -> CoreClientProduct:
    row = await CoreClientProduct.get_or_none(client_key=client_key, is_active=True)
    if not row:
        raise NotFoundError(f"未知客户端产品: {client_key}")
    return row


async def list_products(app_code: str | None = None) -> list[CoreClientProduct]:
    q = CoreClientProduct.filter(is_active=True)
    if app_code:
        q = q.filter(app_code=app_code)
    return await q.order_by("sort_order", "client_key")


async def get_active_release(client_key: str, platform: str) -> CoreClientRelease | None:
    return (
        await CoreClientRelease.filter(client_key=client_key, platform=platform, is_active=True)
        .order_by("-version_code", "-id")
        .first()
    )


async def list_releases(
    client_key: str | None = None,
    platform: str | None = None,
    limit: int = 50,
) -> list[CoreClientRelease]:
    q = CoreClientRelease.all()
    if client_key:
        q = q.filter(client_key=client_key)
    if platform:
        q = q.filter(platform=platform)
    return await q.order_by("-version_code", "-id").limit(limit)


async def check_release(
    *,
    client_key: str,
    platform: str,
    app_version: str,
    version_code: int,
    runtime_version: str | None,
    bundle_id: str | None,
    origin: str,
    device_id: str | None = None,
) -> dict[str, Any]:
    if platform not in VALID_PLATFORMS:
        raise ValidationError(f"不支持的 platform: {platform}")

    await get_product(client_key)
    active = await get_active_release(client_key, platform)
    if not active:
        return {"update_type": "none", "force": False, "latest": None, "ota": None, "client_key": client_key}

    if active.rollout_percent < 100 and device_id:
        bucket = int(hashlib.sha256(device_id.encode()).hexdigest()[:8], 16) % 100
        if bucket >= active.rollout_percent:
            return {"update_type": "none", "force": False, "latest": None, "ota": None, "client_key": client_key}

    client_bundle = (bundle_id or "").strip()
    latest_payload = {
        "app_version": active.app_version,
        "version_code": active.version_code,
        "runtime_version": active.runtime_version or active.app_version,
        "release_notes": active.release_notes,
        "bundle_id": active.bundle_id,
    }
    ota_info = None
    if active.ota_relative_path:
        ota_info = {"updates_url": ota_public_base(origin, client_key, active.ota_relative_path)}

    pkg = _package_payload(active, origin)

    if platform == "windows":
        if _semver_lt(app_version, active.app_version) or (
            active.min_version_code and version_code < active.min_version_code
        ):
            return {
                "update_type": "package",
                "force": active.force_update,
                "latest": {**latest_payload, "package": pkg, "apk": pkg},
                "ota": None,
                "client_key": client_key,
            }
        return {"update_type": "none", "force": False, "latest": latest_payload, "ota": None, "client_key": client_key}

    if version_code < active.min_version_code:
        return {
            "update_type": "package",
            "force": active.force_update,
            "latest": {**latest_payload, "package": pkg, "apk": pkg},
            "ota": ota_info,
            "client_key": client_key,
        }

    if version_code < active.version_code:
        force = active.force_update
        update_type = "package" if active.requires_native or pkg else "ota"
        if update_type == "package" and not pkg:
            return {"update_type": "none", "force": False, "latest": None, "ota": ota_info, "client_key": client_key}
        return {
            "update_type": "ota" if update_type == "ota" else "package",
            "force": force,
            "latest": {**latest_payload, "package": pkg, "apk": pkg} if pkg else latest_payload,
            "ota": ota_info,
            "client_key": client_key,
        }

    # version_code >= active.version_code：Android 以 versionCode 为准，避免 1.0.8 / 1.08 等字符串误判
    if version_code > active.version_code:
        return _no_update_payload(latest_payload=latest_payload, ota_info=ota_info, client_key=client_key)

    rv = runtime_version or app_version
    active_rv = active.runtime_version or active.app_version

    if (
        active.ota_relative_path
        and client_bundle
        and active.bundle_id
        and client_bundle != active.bundle_id
    ):
        return {
            "update_type": "ota",
            "force": False,
            "latest": latest_payload,
            "ota": ota_info,
            "client_key": client_key,
        }

    if active.ota_relative_path and not _semver_eq(rv, active_rv) and _semver_lt(rv, active_rv):
        return {
            "update_type": "ota",
            "force": False,
            "latest": latest_payload,
            "ota": ota_info,
            "client_key": client_key,
        }

    return _no_update_payload(latest_payload=latest_payload, ota_info=ota_info, client_key=client_key)


async def create_release(
    *,
    client_key: str,
    platform: str,
    app_version: str,
    version_code: int,
    runtime_version: str | None,
    update_type: str,
    requires_native: bool,
    force_update: bool,
    min_version_code: int,
    release_notes: str,
    bundle_id: str | None,
    ota_relative_path: str | None,
    created_by: str | None,
    rollout_percent: int = 100,
    activate: bool = False,
) -> CoreClientRelease:
    await get_product(client_key)
    if platform not in VALID_PLATFORMS:
        raise ValidationError(f"不支持的 platform: {platform}")
    if update_type not in VALID_UPDATE_TYPES:
        raise ValidationError(f"不支持的 update_type: {update_type}")

    row = await CoreClientRelease.create(
        uuid=str(uuid.uuid4()),
        client_key=client_key,
        platform=platform,
        app_version=app_version,
        version_code=version_code,
        runtime_version=runtime_version or app_version,
        update_type=update_type,
        requires_native=requires_native,
        force_update=force_update,
        min_version_code=min_version_code,
        release_notes=release_notes or "",
        bundle_id=bundle_id,
        ota_relative_path=ota_relative_path,
        rollout_percent=rollout_percent,
        published_at=now(),
        created_by=created_by,
    )
    if activate:
        await activate_release(row.id)
        row = await CoreClientRelease.get(id=row.id)
    return row


async def register_package_file(
    release_id: int,
    filename: str,
    content: bytes,
) -> CoreClientRelease:
    if len(content) > PACKAGE_MAX_BYTES:
        raise ValidationError(f"安装包超过大小限制（最大 {PACKAGE_MAX_BYTES // 1024 // 1024}MB）")

    row = await CoreClientRelease.get_or_none(id=release_id)
    if not row:
        raise NotFoundError("发布记录不存在")

    safe_name = Path(filename).name
    ext = Path(safe_name).suffix.lower()
    allowed = PACKAGE_EXTENSIONS.get(row.platform, ())
    if allowed and ext not in allowed:
        raise ValidationError(f"不支持的文件类型 {ext}，允许: {', '.join(allowed)}")

    from core.services.package_metadata_service import assert_release_matches_package

    if row.platform == "android" and ext == ".apk":
        assert_release_matches_package(
            platform=row.platform,
            app_version=row.app_version,
            version_code=row.version_code,
            content=content,
            filename=safe_name,
        )

    dest = packages_dir(row.client_key) / safe_name
    dest.write_bytes(content)
    sha = hashlib.sha256(content).hexdigest()

    row.artifact_filename = safe_name
    row.artifact_sha256 = sha
    row.artifact_size_bytes = len(content)
    row.artifact_ext = ext.lstrip(".")
    if row.update_type == "ota":
        row.update_type = "both"
    elif row.update_type not in ("both", "package"):
        row.update_type = "package"
    await row.save()
    return row


async def activate_release(release_id: int) -> CoreClientRelease:
    row = await CoreClientRelease.get_or_none(id=release_id)
    if not row:
        raise NotFoundError("发布记录不存在")

    await CoreClientRelease.filter(
        client_key=row.client_key,
        platform=row.platform,
        is_active=True,
    ).update(is_active=False)
    row.is_active = True
    if not row.published_at:
        row.published_at = now()
    await row.save()
    return row


async def get_release(release_id: int) -> CoreClientRelease:
    row = await CoreClientRelease.get_or_none(id=release_id)
    if not row:
        raise NotFoundError("发布记录不存在")
    return row


def _unlink_package_file(client_key: str, filename: str) -> None:
    path = packages_dir(client_key) / filename
    if path.is_file():
        path.unlink()


def _remove_ota_tree(client_key: str, relative_path: str) -> None:
    path = updates_dir(client_key) / relative_path.strip("/")
    if path.is_dir():
        shutil.rmtree(path)
    elif path.is_file():
        path.unlink()


async def delete_release(release_id: int) -> None:
    """删除历史发布记录，并清理未被其它记录引用的安装包 / OTA 文件。"""
    row = await CoreClientRelease.get_or_none(id=release_id)
    if not row:
        raise NotFoundError("发布记录不存在")

    # 允许删除当前生效版本：自动切换到同端最新的其它版本，避免“删除功能看似可用但实际删不掉”。
    if row.is_active:
        replacement = (
            await CoreClientRelease.filter(client_key=row.client_key, platform=row.platform)
            .exclude(id=row.id)
            .order_by("-version_code", "-id")
            .first()
        )
        if not replacement:
            raise ValidationError("当前生效版本是唯一版本，请先创建并激活新版本后再删除")

        await CoreClientRelease.filter(
            client_key=row.client_key,
            platform=row.platform,
            is_active=True,
        ).update(is_active=False)
        replacement.is_active = True
        if not replacement.published_at:
            replacement.published_at = now()
        await replacement.save()

    artifact_filename = (row.artifact_filename or "").strip()
    ota_relative_path = (row.ota_relative_path or "").strip()

    await row.delete()

    if artifact_filename:
        still_used = await CoreClientRelease.filter(
            client_key=row.client_key,
            artifact_filename=artifact_filename,
        ).exists()
        if not still_used:
            _unlink_package_file(row.client_key, artifact_filename)

    if ota_relative_path:
        still_used = await CoreClientRelease.filter(
            client_key=row.client_key,
            ota_relative_path=ota_relative_path,
        ).exists()
        if not still_used:
            _remove_ota_tree(row.client_key, ota_relative_path)


def serialize_release(row: CoreClientRelease, origin: str) -> dict[str, Any]:
    return _release_to_dict(row, origin)


def read_ota_metadata(client_key: str, relative_path: str) -> dict[str, Any] | None:
    base = updates_dir(client_key) / relative_path.strip("/")
    meta_path = base / "metadata.json"
    if not meta_path.is_file():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _static_asset_url(origin: str, client_key: str, relative_path: str, file_path: str) -> str:
    rel = relative_path.strip("/")
    fp = file_path.lstrip("/")
    return f"{origin.rstrip('/')}/static/client-updates/{client_key}/{rel}/{fp}"


def build_expo_updates_manifest(row: CoreClientRelease, origin: str) -> dict[str, Any] | None:
    if not row.ota_relative_path:
        return None
    meta = read_ota_metadata(row.client_key, row.ota_relative_path)
    if not meta:
        return None

    rel = row.ota_relative_path.strip("/")
    created_at = (
        row.published_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        if row.published_at
        else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    )

    file_metadata = meta.get("fileMetadata") or {}
    platform_key = row.platform if row.platform in file_metadata else "android"
    platform_meta = file_metadata.get(platform_key) or {}

    launch_bundle = platform_meta.get("bundle") or meta.get("bundle") or "index.js"
    launch_path = launch_bundle
    if not launch_path.startswith("_expo") and platform_meta.get("bundle"):
        launch_path = f"_expo/static/js/{row.platform}/{platform_meta['bundle']}"

    assets: list[dict[str, Any]] = []
    for asset in platform_meta.get("assets") or meta.get("assets") or []:
        path = asset.get("path") or asset.get("filePath") or ""
        if not path:
            continue
        assets.append(
            {
                "hash": asset.get("hash") or asset.get("md5") or "",
                "key": path,
                "contentType": asset.get("contentType") or "application/octet-stream",
                "url": _static_asset_url(origin, row.client_key, rel, path),
            }
        )

    manifest_id = row.bundle_id or str(row.uuid)
    rv = row.runtime_version or row.app_version
    return {
        "id": manifest_id,
        "createdAt": created_at,
        "runtimeVersion": rv,
        "launchAsset": {
            "hash": platform_meta.get("hash") or "",
            "key": launch_path,
            "contentType": "application/javascript",
            "url": _static_asset_url(origin, row.client_key, rel, launch_path),
        },
        "assets": assets,
        "metadata": {"version": row.app_version, "bundleId": row.bundle_id},
        "extra": {"expoClient": {"runtimeVersion": rv, "version": row.app_version}},
    }


async def resolve_tenant_downloads(tenant_id: int, origin: str) -> list[dict[str, Any]]:
    """当前租户已安装应用关联、且平台已发布安装包的客户端下载列表。"""
    from core.services.application.application_dedicated_binding_service import (
        ApplicationDedicatedBindingService,
    )
    from core.services.system.installed_feature_scope import get_installed_application_codes

    installed = await get_installed_application_codes(tenant_id)
    bound = await ApplicationDedicatedBindingService.fetch_bound_codes_for_tenant(tenant_id)
    eligible_apps = installed | set(bound)
    if not eligible_apps:
        return []

    await ensure_default_products()
    out: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    products = await CoreClientProduct.filter(is_active=True).order_by("sort_order")
    for product in products:
        if product.app_code and product.app_code not in eligible_apps:
            continue
        active = await get_active_release(product.client_key, product.platform_target)
        if not active or not active.artifact_filename:
            continue
        pkg = _package_payload(active, origin)
        if not pkg:
            continue
        if product.client_key in seen_keys:
            continue
        seen_keys.add(product.client_key)
        out.append(
            {
                "client_key": product.client_key,
                "display_name": product.display_name,
                "platform": product.platform_target,
                "app_version": active.app_version,
                "release_notes": active.release_notes,
                **pkg,
            }
        )
    return out


async def resolve_login_downloads(origin: str, *, win_enabled: bool, android_enabled: bool) -> dict[str, Any]:
    await ensure_default_products()
    out: dict[str, Any] = {}
    products = await CoreClientProduct.filter(is_active=True).order_by("sort_order")
    for product in products:
        if product.login_tile_slot == "windows" and not win_enabled:
            continue
        if product.login_tile_slot == "android" and not android_enabled:
            continue
        if product.login_tile_slot == "none":
            continue
        active = await get_active_release(product.client_key, product.platform_target)
        if not active or not active.artifact_filename:
            continue
        pkg = _package_payload(active, origin)
        if not pkg:
            continue
        slot = "windows" if product.login_tile_slot == "windows" else "android_pda"
        out[slot] = {
            "client_key": product.client_key,
            "display_name": product.display_name,
            "app_version": active.app_version,
            "release_notes": active.release_notes,
            **pkg,
        }
    return out
