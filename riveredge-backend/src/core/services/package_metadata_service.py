"""从安装包文件读取版本元数据（APK 等）。"""

from __future__ import annotations

import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

from infra.exceptions.exceptions import ValidationError

_FILENAME_VERSION_RE = re.compile(
    r"(?:^|[/\\])(?:[\w.-]+-)?(\d+\.\d+\.\d+)-build(\d+)(?:-[\w.-]+)?\.apk$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class PackageMetadata:
    platform: str
    app_version: str
    version_code: int
    package_name: str | None = None


def _parse_apk_bytes(content: bytes) -> PackageMetadata:
    from pyaxmlparser import APK

    fd, tmp_path = tempfile.mkstemp(suffix=".apk")
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(content)
        apk = APK(tmp_path)
        version_name = (apk.version_name or "").strip()
        version_code = int(apk.version_code or 0)
        if not version_name or version_code <= 0:
            raise ValidationError("无法从 APK 读取 versionName / versionCode")
        return PackageMetadata(
            platform="android",
            app_version=version_name,
            version_code=version_code,
            package_name=(apk.packagename or "").strip() or None,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_version_from_filename(filename: str) -> PackageMetadata | None:
    name = Path(filename).name
    match = _FILENAME_VERSION_RE.search(name)
    if not match:
        return None
    version_code = int(match.group(2))
    if version_code <= 0:
        return None
    return PackageMetadata(
        platform="android",
        app_version=match.group(1),
        version_code=version_code,
        package_name=None,
    )


def inspect_package_bytes(*, content: bytes, filename: str, platform: str) -> PackageMetadata:
    ext = Path(filename or "").suffix.lower()
    if platform == "android":
        if ext != ".apk":
            raise ValidationError("Android 平台请上传 .apk 文件")
        try:
            return _parse_apk_bytes(content)
        except ValidationError:
            raise
        except Exception as exc:
            fallback = parse_version_from_filename(filename)
            if fallback:
                return fallback
            raise ValidationError(f"无法解析 APK 版本信息: {exc}") from exc
    raise ValidationError(f"暂不支持自动识别 {platform} 安装包版本，请手动填写")


def assert_release_matches_package(
    *,
    platform: str,
    app_version: str,
    version_code: int,
    content: bytes,
    filename: str,
) -> PackageMetadata:
    """上传安装包时校验包内版本与发布记录一致。"""
    meta = inspect_package_bytes(content=content, filename=filename, platform=platform)
    expected_version = (app_version or "").strip()
    if meta.app_version != expected_version or meta.version_code != version_code:
        raise ValidationError(
            "安装包内版本为 "
            f"{meta.app_version}（versionCode {meta.version_code}），"
            f"与发布记录 {expected_version}（versionCode {version_code}）不一致。"
            "请重新上传匹配的 APK，或按安装包实际版本创建发布记录。"
        )
    return meta
