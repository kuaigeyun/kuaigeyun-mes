"""审核能力单一注册表。

「单据是否可审核」的唯一声明源是各 app 的 `manifest.json` 顶层 `audit` 数组，
每条形如：``{ node_key, entity_type, resource, name, template, config_category? }``，
``template`` ∈ ``simple`` | ``sme``；``config_category`` 用于配置中心侧边栏分组（默认 ``common``）。

本模块在进程内扫描一次（manifest 仅随部署/重启变化），聚合为单一注册表，供下列
全部从此派生，消除并行硬编码表：

- ``AUDIT_NODE_KEYS``（``infra.services.business_config_service``）
- ``PRESET_APPROVAL_PROCESSES``（``core.services.approval.approval_process_service``）
- ``KUAIZHIZAO_APPROVAL_PROCESS_CODES``（``core.services.system.installed_feature_scope``）
- 配置中心审核开关项 / 统一执行入口 / ``record.audit`` 派生

声明缺失或字段非法时**显式报错**（在首次访问注册表时抛出），不做兜底/兼容。
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

VALID_TEMPLATES = {"simple", "sme"}


VALID_CONFIG_CATEGORIES = frozenset({
    "common",
    "sales",
    "planning",
    "procurement",
    "production",
    "quality",
    "equipment",
    "warehouse",
    "finance",
})


@dataclass(frozen=True)
class AuditEntry:
    """单条可审核单据声明（来自 manifest.audit）。"""

    app: str
    node_key: str
    entity_type: str
    resource: str
    name: str
    template: str
    config_category: str


def _apps_dir() -> Path:
    """应用 manifest 目录（与 ApplicationService._get_plugins_directory 同一来源）。"""
    env_dir = os.getenv("APPS_MANIFEST_DIR")
    if env_dir and os.path.isdir(env_dir):
        return Path(env_dir)
    # 本文件位于 src/core/config/audit_registry.py -> parents[2] == src
    return Path(__file__).resolve().parents[2] / "apps"


@lru_cache(maxsize=1)
def _load_entries() -> Tuple[AuditEntry, ...]:
    apps_dir = _apps_dir()
    if not apps_dir.exists():
        raise FileNotFoundError(f"应用 manifest 目录不存在: {apps_dir}")

    entries: List[AuditEntry] = []
    seen_node_keys: Dict[str, str] = {}
    seen_entity_types: Dict[str, str] = {}

    for plugin_dir in sorted(apps_dir.iterdir(), key=lambda p: p.name):
        if not plugin_dir.is_dir():
            continue
        manifest_file = plugin_dir / "manifest.json"
        if not manifest_file.exists():
            continue
        with open(manifest_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        app_code = str(data.get("code") or plugin_dir.name).strip()
        audit_block = data.get("audit")
        if audit_block is None:
            continue
        if not isinstance(audit_block, list):
            raise ValueError(f"manifest[{app_code}].audit 必须是数组")

        for raw in audit_block:
            if not isinstance(raw, dict):
                raise ValueError(f"manifest[{app_code}].audit 项必须是对象: {raw!r}")
            node_key = str(raw.get("node_key") or "").strip()
            entity_type = str(raw.get("entity_type") or "").strip()
            resource = str(raw.get("resource") or "").strip()
            name = str(raw.get("name") or "").strip()
            template = str(raw.get("template") or "").strip()
            config_category = str(raw.get("config_category") or "common").strip() or "common"
            if not (node_key and entity_type and resource and name and template):
                raise ValueError(
                    f"manifest[{app_code}].audit 项字段缺失（node_key/entity_type/resource/name/template 均必填）: {raw!r}"
                )
            if template not in VALID_TEMPLATES:
                raise ValueError(
                    f"manifest[{app_code}].audit[{node_key}].template 非法: {template!r}，仅支持 {sorted(VALID_TEMPLATES)}"
                )
            if config_category not in VALID_CONFIG_CATEGORIES:
                raise ValueError(
                    f"manifest[{app_code}].audit[{node_key}].config_category 非法: {config_category!r}，"
                    f"仅支持 {sorted(VALID_CONFIG_CATEGORIES)}"
                )
            if node_key in seen_node_keys:
                raise ValueError(
                    f"audit node_key 重复声明: {node_key}（{seen_node_keys[node_key]} 与 {app_code}）"
                )
            if entity_type in seen_entity_types:
                raise ValueError(
                    f"audit entity_type 重复声明: {entity_type}（{seen_entity_types[entity_type]} 与 {app_code}）"
                )
            seen_node_keys[node_key] = app_code
            seen_entity_types[entity_type] = app_code
            entries.append(
                AuditEntry(
                    app=app_code,
                    node_key=node_key,
                    entity_type=entity_type,
                    resource=resource,
                    name=name,
                    template=template,
                    config_category=config_category,
                )
            )

    return tuple(entries)


def all_entries() -> List[AuditEntry]:
    """全部可审核声明（按 app 名 + manifest 声明顺序）。"""
    return list(_load_entries())


def audit_node_keys() -> List[str]:
    """全部可审核 node_key（= ApprovalProcess.code）。"""
    return [e.node_key for e in _load_entries()]


@lru_cache(maxsize=1)
def _node_key_index() -> Dict[str, AuditEntry]:
    return {e.node_key: e for e in _load_entries()}


@lru_cache(maxsize=1)
def _entity_type_index() -> Dict[str, AuditEntry]:
    return {e.entity_type: e for e in _load_entries()}


def entry_by_node_key(node_key: str) -> Optional[AuditEntry]:
    return _node_key_index().get(str(node_key or "").strip())


def entry_by_entity_type(entity_type: str) -> Optional[AuditEntry]:
    return _entity_type_index().get(str(entity_type or "").strip())


def node_keys_for_app(app: str) -> List[str]:
    target = str(app or "").strip()
    return [e.node_key for e in _load_entries() if e.app == target]


def is_auditable_node_key(node_key: str) -> bool:
    return str(node_key or "").strip() in _node_key_index()


def entries_grouped_by_app() -> Dict[str, List[AuditEntry]]:
    grouped: Dict[str, List[AuditEntry]] = {}
    for e in _load_entries():
        grouped.setdefault(e.app, []).append(e)
    return grouped
