"""同步 sources 解析与外推 targets 读写（运行时只读 JSON 真源）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar

from infra.exceptions.exceptions import ValidationError

from core.schemas.sync_binding_contract import (
    DocumentPushBindingState,
    DocumentPushTargetItem,
    SyncSourceItem,
)

TBinding = TypeVar("TBinding")


def _coerce_mapping(raw: Any) -> Dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items() if str(k).strip() and str(v).strip()}


def legacy_row_to_sources(row: Any) -> List[Dict[str, Any]]:
    """迁移脚本与一次性回填：旧单列 → sources 一条。"""
    if row is None:
        return []
    existing = getattr(row, "sources", None)
    if isinstance(existing, list) and existing:
        return normalize_sources_json(existing)
    source_type = str(getattr(row, "source_type", None) or "").strip().lower()
    if source_type not in ("api", "dataset"):
        return []
    mapping = _coerce_mapping(getattr(row, "field_mapping", None))
    if not mapping:
        return []
    item: Dict[str, Any] = {
        "kind": source_type,
        "field_mapping": mapping,
    }
    if source_type == "api":
        api_uuid = str(getattr(row, "api_uuid", None) or "").strip()
        if not api_uuid:
            return []
        item["api_uuid"] = api_uuid
    else:
        dataset_uuid = str(getattr(row, "dataset_uuid", None) or "").strip()
        if not dataset_uuid:
            return []
        item["dataset_uuid"] = dataset_uuid
    return [item]


def normalize_sources_json(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        parsed = SyncSourceItem.model_validate(entry)
        out.append(parsed.model_dump(mode="json"))
    return out


def sources_from_row(row: Optional[Any]) -> List[Dict[str, Any]]:
    if not row:
        return []
    return normalize_sources_json(getattr(row, "sources", None))


def validate_sources_for_match_key(sources: List[Dict[str, Any]], match_key: str) -> None:
    if not sources:
        raise ValidationError("请配置至少一个同步来源")
    key = str(match_key or "").strip()
    if not key:
        raise ValidationError("匹配键不能为空")
    for idx, src in enumerate(sources):
        mapping = _coerce_mapping(src.get("field_mapping"))
        if not mapping:
            raise ValidationError(f"来源 {idx + 1} 须配置字段映射")
        if key not in mapping.values():
            raise ValidationError(f"来源 {idx + 1} 的字段映射须包含匹配键 {key}")
        kind = str(src.get("kind") or "").strip()
        if kind == "api" and not str(src.get("api_uuid") or "").strip():
            raise ValidationError(f"来源 {idx + 1} 须选择数据接口")
        if kind == "dataset" and not str(src.get("dataset_uuid") or "").strip():
            raise ValidationError(f"来源 {idx + 1} 须选择数据集")


def resolve_sources_from_request(
    binding: Optional[Any],
    request: Optional[Any],
) -> List[Dict[str, Any]]:
    req_sources = getattr(request, "sources", None) if request else None
    if isinstance(req_sources, list) and req_sources:
        serialized: List[Any] = []
        for item in req_sources:
            if hasattr(item, "model_dump"):
                serialized.append(item.model_dump(mode="json"))
            elif isinstance(item, dict):
                serialized.append(item)
        return normalize_sources_json(serialized)
    return sources_from_row(binding)


def source_display_label(source: Dict[str, Any], index: int) -> str:
    label = str(source.get("label") or "").strip()
    if label:
        return label
    kind = str(source.get("kind") or "")
    if kind == "api":
        uuid = str(source.get("api_uuid") or "").strip()
        return f"接口 {uuid[:8]}…" if uuid else f"来源 {index + 1}"
    uuid = str(source.get("dataset_uuid") or "").strip()
    return f"数据集 {uuid[:8]}…" if uuid else f"来源 {index + 1}"


async def fetch_mapped_rows_from_sources(
    tenant_id: int,
    sources: List[Dict[str, Any]],
    *,
    since: Optional[Any] = None,
    active_only: bool = True,
    transform_raw_rows: Optional[Any] = None,
) -> Tuple[List[Dict[str, Any]], List[str], int]:
    """按源拉取并映射；单源失败记入 errors，其余继续。"""
    from apps.master_data.services.master_data_sync_common import fetch_sync_rows, map_sync_rows

    mapped_all: List[Dict[str, Any]] = []
    errors: List[str] = []
    fetched_total = 0
    for idx, src in enumerate(sources):
        label = source_display_label(src, idx)
        kind = str(src.get("kind") or "").strip()
        mapping = _coerce_mapping(src.get("field_mapping"))
        try:
            raw_rows = await fetch_sync_rows(
                tenant_id,
                source_type=kind,
                api_uuid=str(src.get("api_uuid") or "").strip() or None,
                dataset_uuid=str(src.get("dataset_uuid") or "").strip() or None,
                since=since,
                active_only=active_only,
            )
            if transform_raw_rows is not None:
                raw_rows = transform_raw_rows(raw_rows)
            fetched_total += len(raw_rows)
            mapped_all.extend(map_sync_rows(raw_rows, mapping))
        except Exception as exc:
            errors.append(f"{label}：{exc}")
    return mapped_all, errors, fetched_total


def legacy_push_row_to_targets(row: Any) -> List[Dict[str, Any]]:
    if row is None:
        return []
    existing = getattr(row, "push_targets", None)
    if isinstance(existing, list) and existing:
        return normalize_push_targets_json(existing)
    conn = str(getattr(row, "push_connection_code", None) or "").strip()
    api = str(getattr(row, "push_save_api_uuid", None) or "").strip()
    profile = str(getattr(row, "push_default_profile", None) or "").strip()
    if not profile:
        profile = "kingdee_prd_mo"
    if conn or api:
        return [
            {
                "connection_code": conn or None,
                "save_api_uuid": api or None,
                "target_profile": profile,
            }
        ]
    return []


def normalize_push_targets_json(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        parsed = DocumentPushTargetItem.model_validate(entry)
        out.append(parsed.model_dump(mode="json"))
    return out


def push_targets_from_row(row: Optional[Any]) -> List[Dict[str, Any]]:
    if not row:
        return []
    return normalize_push_targets_json(getattr(row, "push_targets", None))


def trigger_actions_from_row(row: Optional[Any]) -> List[str]:
    if not row:
        return []
    raw = getattr(row, "trigger_actions", None)
    if not isinstance(raw, list):
        return []
    return [str(x).strip().lower() for x in raw if str(x or "").strip()]


def serialize_push_binding_state(row: Optional[Any]) -> DocumentPushBindingState:
    if not row:
        return DocumentPushBindingState()
    targets_raw = push_targets_from_row(row)
    targets = [DocumentPushTargetItem.model_validate(t) for t in targets_raw]
    actions = trigger_actions_from_row(row)
    sync_mode = str(getattr(row, "push_sync_mode", None) or "manual_full").strip() or "manual_full"
    interval = int(getattr(row, "push_schedule_interval_minutes", None) or 15)
    return DocumentPushBindingState(
        targets=targets,
        trigger_actions=actions,
        sync_mode=sync_mode,
        schedule_interval_minutes=interval,
    )
