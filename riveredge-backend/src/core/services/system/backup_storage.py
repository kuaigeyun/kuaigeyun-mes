"""
数据备份文件目录与路径解析

备份 zip 存于本机磁盘，路径解析不依赖进程 cwd，避免 API / Worker 工作目录不一致导致「文件已丢失」。
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from infra.config.infra_config import infra_settings


def _default_backup_dir() -> str:
    workdir = (os.environ.get("WORKDIR") or "").strip()
    if workdir:
        return os.path.join(os.path.abspath(workdir), "backups")
    backend_root = Path(__file__).resolve().parents[4]
    return str(backend_root / "backups")


def resolve_data_backup_dir() -> str:
    configured = (getattr(infra_settings, "DATA_BACKUP_DIR", "") or "").strip()
    path = os.path.abspath(configured) if configured else os.path.abspath(_default_backup_dir())
    os.makedirs(path, exist_ok=True)
    return path


def _is_under_dir(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([os.path.realpath(root), os.path.realpath(path)]) == os.path.realpath(root)
    except ValueError:
        return False


def store_backup_file_path(abs_path: str) -> str:
    """写入 DB：优先仅存文件名，便于同机部署目录变更后仍可解析。"""
    resolved = os.path.abspath(abs_path)
    backup_dir = resolve_data_backup_dir()
    if _is_under_dir(resolved, backup_dir):
        return os.path.basename(resolved)
    return resolved


def resolve_backup_file_path(stored: str | None, *, must_exist: bool = True) -> Optional[str]:
    if not stored or not str(stored).strip():
        return None

    stored_text = str(stored).strip()
    backup_dir = resolve_data_backup_dir()
    candidates: list[str] = []

    if os.path.isabs(stored_text):
        candidates.append(os.path.abspath(stored_text))
    else:
        candidates.append(os.path.join(backup_dir, stored_text))

    basename = os.path.basename(stored_text)
    by_name = os.path.join(backup_dir, basename)
    if by_name not in candidates:
        candidates.append(by_name)

    seen: set[str] = set()
    for candidate in candidates:
        key = os.path.normcase(os.path.abspath(candidate))
        if key in seen:
            continue
        seen.add(key)
        if must_exist:
            if os.path.isfile(candidate):
                return os.path.abspath(candidate)
        else:
            return os.path.abspath(candidate)
    return None
