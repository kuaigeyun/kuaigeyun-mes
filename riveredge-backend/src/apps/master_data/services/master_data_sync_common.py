"""主数据同步：绑定解析与行映射。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Type, TypeVar

from infra.exceptions.exceptions import ValidationError

from apps.master_data.schemas.master_data_sync import VALID_SYNC_MODES
from core.services.data.sync_from_source_fetch import fetch_rows_from_api, fetch_rows_from_dataset
from core.utils.timezone_utils import resolve_business_datetime

TBinding = TypeVar("TBinding")

DEFAULT_SCHEDULE_INTERVAL_MINUTES = 15


def normalize_sync_mode(value: Optional[str]) -> str:
    mode = (value or "manual_full").strip() or "manual_full"
    if mode not in VALID_SYNC_MODES:
        raise ValidationError(
            "同步模式须为 manual_full、scheduled_full 或 scheduled_incremental"
        )
    return mode


def normalize_schedule_interval(value: Optional[int]) -> int:
    if value is None:
        return DEFAULT_SCHEDULE_INTERVAL_MINUTES
    try:
        minutes = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("定时同步间隔须为正整数分钟") from exc
    if minutes < 5 or minutes > 24 * 60:
        raise ValidationError("定时同步间隔须在 5～1440 分钟之间")
    return minutes


def serialize_binding_row(
    row: Optional[Any],
    *,
    default_match_key: str,
) -> Dict[str, Any]:
    if not row:
        return {
            "source_type": None,
            "api_uuid": None,
            "dataset_uuid": None,
            "field_mapping": {},
            "match_key_field": default_match_key,
            "sync_mode": "manual_full",
            "schedule_interval_minutes": DEFAULT_SCHEDULE_INTERVAL_MINUTES,
            "last_success_at": None,
            "last_attempt_at": None,
            "last_error": None,
        }
    mapping = row.field_mapping if isinstance(row.field_mapping, dict) else {}
    return {
        "source_type": row.source_type,
        "api_uuid": row.api_uuid,
        "dataset_uuid": row.dataset_uuid,
        "field_mapping": {str(k): str(v) for k, v in mapping.items()},
        "match_key_field": row.match_key_field or default_match_key,
        "sync_mode": row.sync_mode or "manual_full",
        "schedule_interval_minutes": int(
            getattr(row, "schedule_interval_minutes", None) or DEFAULT_SCHEDULE_INTERVAL_MINUTES
        ),
        "last_success_at": getattr(row, "last_success_at", None),
        "last_attempt_at": getattr(row, "last_attempt_at", None),
        "last_error": getattr(row, "last_error", None),
    }


async def upsert_sync_binding(
    binding_model: Type[TBinding],
    tenant_id: int,
    *,
    source_type: str,
    api_uuid: Optional[str],
    dataset_uuid: Optional[str],
    field_mapping: Dict[str, str],
    match_key_field: str,
    sync_mode: str = "manual_full",
    schedule_interval_minutes: Optional[int] = None,
) -> TBinding:
    if source_type not in ("api", "dataset"):
        raise ValidationError("来源类型须为 api 或 dataset")
    if source_type == "api" and not api_uuid:
        raise ValidationError("已选择数据接口时须指定接口")
    if source_type == "dataset" and not dataset_uuid:
        raise ValidationError("已选择数据集时须指定数据集")
    if not field_mapping:
        raise ValidationError("请配置字段映射")
    if match_key_field not in field_mapping.values():
        raise ValidationError(f"字段映射须包含匹配键 {match_key_field}")

    mode = normalize_sync_mode(sync_mode)
    interval = normalize_schedule_interval(schedule_interval_minutes)

    existing = await binding_model.filter(tenant_id=tenant_id).first()
    preserve = {
        "last_success_at": getattr(existing, "last_success_at", None) if existing else None,
        "last_attempt_at": getattr(existing, "last_attempt_at", None) if existing else None,
        "last_error": getattr(existing, "last_error", None) if existing else None,
    }
    await binding_model.filter(tenant_id=tenant_id).delete()
    return await binding_model.create(
        tenant_id=tenant_id,
        source_type=source_type,
        api_uuid=api_uuid if source_type == "api" else None,
        dataset_uuid=dataset_uuid if source_type == "dataset" else None,
        field_mapping=field_mapping,
        match_key_field=match_key_field,
        sync_mode=mode,
        schedule_interval_minutes=interval,
        **preserve,
    )


async def resolve_sync_config(
    binding_model: Type[TBinding],
    tenant_id: int,
    request: Optional[Any],
    *,
    default_match_key: str,
) -> tuple[str, Optional[str], Optional[str], Dict[str, str], str]:
    binding = await binding_model.filter(tenant_id=tenant_id).first()
    source_type = (getattr(request, "source_type", None) or (binding.source_type if binding else "") or "").strip()
    api_uuid = (
        (getattr(request, "api_uuid", None) or (binding.api_uuid if binding else "") or "").strip() or None
    )
    dataset_uuid = (
        (getattr(request, "dataset_uuid", None) or (binding.dataset_uuid if binding else "") or "").strip() or None
    )
    field_mapping = getattr(request, "field_mapping", None)
    if not isinstance(field_mapping, dict) and binding and isinstance(binding.field_mapping, dict):
        field_mapping = binding.field_mapping
    if not isinstance(field_mapping, dict):
        field_mapping = {}
    match_key = ((binding.match_key_field if binding else None) or default_match_key).strip() or default_match_key
    return source_type, api_uuid, dataset_uuid, field_mapping, match_key


def resolve_incremental_since(
    binding: Optional[Any],
    *,
    sync_mode: str,
    request_incremental: Optional[bool] = None,
) -> Optional[datetime]:
    """定时增量或请求显式 incremental=True 时，用 last_success_at 作为水位。"""
    if request_incremental is True:
        return getattr(binding, "last_success_at", None) if binding else None
    if request_incremental is False:
        return None
    if sync_mode == "scheduled_incremental" and binding is not None:
        return getattr(binding, "last_success_at", None)
    return None


async def fetch_sync_rows(
    tenant_id: int,
    *,
    source_type: str,
    api_uuid: Optional[str],
    dataset_uuid: Optional[str],
    since: Optional[datetime] = None,
    active_only: bool = True,
) -> List[Dict[str, Any]]:
    if source_type == "api":
        if not api_uuid:
            raise ValidationError("数据接口同步须指定接口")
        return await fetch_rows_from_api(
            tenant_id, api_uuid, since=since, active_only=active_only
        )
    if source_type == "dataset":
        if not dataset_uuid:
            raise ValidationError("数据集同步须指定数据集")
        return await fetch_rows_from_dataset(tenant_id, dataset_uuid, since=since)
    raise ValidationError("来源类型须为 api 或 dataset")


def map_sync_rows(
    raw_rows: List[Dict[str, Any]],
    field_mapping: Dict[str, str],
) -> List[Dict[str, Any]]:
    mapped_rows: List[Dict[str, Any]] = []
    for raw in raw_rows:
        if not isinstance(raw, dict):
            continue
        mapped: Dict[str, Any] = {}
        for src_key, target_key in field_mapping.items():
            if not str(src_key).strip() or not str(target_key).strip():
                continue
            if src_key not in raw:
                continue
            mapped[str(target_key).strip()] = raw[src_key]
        if mapped:
            mapped_rows.append(mapped)
    return mapped_rows


SYNC_CUSTOM_FIELD_TARGET_PREFIX = "custom:"


def is_sync_custom_field_target(target_key: str) -> bool:
    return str(target_key or "").startswith(SYNC_CUSTOM_FIELD_TARGET_PREFIX)


def sync_custom_field_code_from_target(target_key: str) -> str:
    return str(target_key)[len(SYNC_CUSTOM_FIELD_TARGET_PREFIX) :]


def cell_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def cell_optional_bool(value: Any) -> Optional[bool]:
    """解析同步源布尔；空值表示未映射不改写。"""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if not text:
        return None
    if text in {"1", "true", "yes", "y", "是", "启用", "a", "on"}:
        return True
    if text in {"0", "false", "no", "n", "否", "禁用", "b", "off"}:
        return False
    raise ValidationError(f"无法解析布尔值：{value}")


def cell_optional_decimal(value: Any):
    if value is None or str(value).strip() == "":
        return None
    from decimal import Decimal, InvalidOperation

    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError(f"无法解析数值：{value}") from exc


def cell_optional_int(value: Any) -> Optional[int]:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(str(value).strip())
    except ValueError as exc:
        raise ValidationError(f"无法解析整数：{value}") from exc


async def load_custom_fields_by_code(tenant_id: int, record_table: str) -> Dict[str, Any]:
    from core.services.business.custom_field_service import CustomFieldService

    fields = await CustomFieldService.get_fields_by_table(
        tenant_id=tenant_id,
        table_name=record_table,
        is_active=True,
    )
    return {str(field.code): field for field in fields}


async def apply_mapped_custom_field_values(
    *,
    tenant_id: int,
    record_table: str,
    record_id: int,
    mapped_row: Dict[str, Any],
    fields_by_code: Dict[str, Any],
) -> None:
    """将映射行中 custom:{code} 写入自定义字段值。"""
    from core.services.business.custom_field_service import CustomFieldService

    for target_key, raw_value in mapped_row.items():
        if not is_sync_custom_field_target(target_key):
            continue
        code = sync_custom_field_code_from_target(target_key)
        field = fields_by_code.get(code)
        if field is None:
            continue
        await CustomFieldService.set_field_value(
            tenant_id=tenant_id,
            field_uuid=field.uuid,
            record_table=record_table,
            record_id=record_id,
            value=raw_value,
        )


def apply_mapped_scalar_fields(
    record: Any,
    mapped_row: Dict[str, Any],
    *,
    string_fields: frozenset[str] = frozenset(),
    bool_fields: frozenset[str] = frozenset(),
    decimal_fields: frozenset[str] = frozenset(),
    int_fields: frozenset[str] = frozenset(),
) -> List[str]:
    """
    将映射行中的额外标量写入模型实例，返回实际改动的字段名列表。
    仅处理 mapped_row 中出现的键；空字符串对可空字符列写 None。
    """
    touched: List[str] = []
    for field_name in string_fields:
        if field_name not in mapped_row:
            continue
        text = cell_str(mapped_row.get(field_name))
        setattr(record, field_name, text or None)
        touched.append(field_name)
    for field_name in bool_fields:
        if field_name not in mapped_row:
            continue
        coerced = cell_optional_bool(mapped_row.get(field_name))
        if coerced is None:
            continue
        setattr(record, field_name, coerced)
        touched.append(field_name)
    for field_name in decimal_fields:
        if field_name not in mapped_row:
            continue
        coerced = cell_optional_decimal(mapped_row.get(field_name))
        if coerced is None:
            continue
        setattr(record, field_name, coerced)
        touched.append(field_name)
    for field_name in int_fields:
        if field_name not in mapped_row:
            continue
        coerced = cell_optional_int(mapped_row.get(field_name))
        if coerced is None:
            continue
        setattr(record, field_name, coerced)
        touched.append(field_name)
    return touched


async def apply_sync_extras_after_write(
    *,
    tenant_id: int,
    record: Any,
    mapped_row: Dict[str, Any],
    record_table: str,
    fields_by_code: Dict[str, Any],
    string_fields: frozenset[str] = frozenset(),
    bool_fields: frozenset[str] = frozenset(),
    decimal_fields: frozenset[str] = frozenset(),
    int_fields: frozenset[str] = frozenset(),
) -> None:
    """写入额外系统字段并落自定义字段。"""
    touched = apply_mapped_scalar_fields(
        record,
        mapped_row,
        string_fields=string_fields,
        bool_fields=bool_fields,
        decimal_fields=decimal_fields,
        int_fields=int_fields,
    )
    if touched:
        await record.save(update_fields=[*touched, "updated_at"])
    if fields_by_code:
        await apply_mapped_custom_field_values(
            tenant_id=tenant_id,
            record_table=record_table,
            record_id=int(record.id),
            mapped_row=mapped_row,
            fields_by_code=fields_by_code,
        )


def is_kingdee_approved_active_master_row(row: Dict[str, Any]) -> bool:
    """
    金蝶客商行是否应写入本地。

    - FForbidStatus：A=未禁用，B=已禁用
    - FDocumentStatus：C=已审核（其余为暂存/创建/审核中等）
    源行无这两列时不拦截（非金蝶源或未选状态字段）。
    """
    forbid = cell_str(row.get("FForbidStatus")).upper()
    document = cell_str(row.get("FDocumentStatus")).upper()
    if forbid and forbid != "A":
        return False
    if document and document != "C":
        return False
    return True


def filter_kingdee_approved_active_master_rows(
    rows: List[Dict[str, Any]],
) -> tuple[List[Dict[str, Any]], int]:
    """过滤无效客商，返回 (保留行, 跳过数)。"""
    kept: List[Dict[str, Any]] = []
    skipped = 0
    for row in rows:
        if not isinstance(row, dict):
            skipped += 1
            continue
        if is_kingdee_approved_active_master_row(row):
            kept.append(row)
        else:
            skipped += 1
    return kept, skipped


async def mark_external_sync_record(record: Any) -> None:
    """写入 external_sync_at（外部同步真源标记）。"""
    sync_at = resolve_business_datetime()
    record.external_sync_at = sync_at
    await record.save(update_fields=["external_sync_at", "updated_at"])


async def mark_binding_attempt(binding: Any) -> None:
    binding.last_attempt_at = resolve_business_datetime()
    await binding.save(update_fields=["last_attempt_at", "updated_at"])


async def mark_binding_success(binding: Any) -> None:
    now = resolve_business_datetime()
    binding.last_attempt_at = now
    binding.last_success_at = now
    binding.last_error = None
    await binding.save(
        update_fields=["last_attempt_at", "last_success_at", "last_error", "updated_at"]
    )


async def mark_binding_failure(binding: Any, error: str) -> None:
    binding.last_attempt_at = resolve_business_datetime()
    binding.last_error = (error or "")[:2000]
    await binding.save(update_fields=["last_attempt_at", "last_error", "updated_at"])


def attach_sync_fetch_meta(result: Any, *, fetched: int, since: Optional[datetime]) -> Any:
    """补齐本轮拉取条数与全量/增量标记，供进度展示。"""
    result.fetched = int(fetched or 0)
    result.mode = "incremental" if since is not None else "full"
    return result
