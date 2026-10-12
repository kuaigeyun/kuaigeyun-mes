"""从数据接口或数据集拉取同步用行数据。"""

from __future__ import annotations

import copy
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from infra.exceptions.exceptions import ValidationError

from core.services.data.sync_progress import emit_sync_progress
from core.services.data.sync_source_rows import normalize_api_body_to_rows
from core.services.integration.kingdee_bill_query_page import (
    MAX_PAGES,
    is_kingdee_execute_bill_query,
    parse_kingdee_query,
    resolve_page_size,
    with_bill_query_page,
)
from core.services.integration.kingdee_cosmic_since_filter import (
    apply_cosmic_since_filter,
    apply_cosmic_since_to_params,
    filter_rows_by_since,
    is_cosmic_paged_query,
    resolve_cosmic_page_size,
    with_cosmic_page,
)
from core.services.integration.kingdee_field_keys import extract_kingdee_field_keys
from core.services.integration.kingdee_active_scope_filter import apply_kingdee_active_scope_filter
from core.services.integration.kingdee_since_filter import apply_kingdee_since_filter


async def _execute_api_once(
    *,
    api_service: Any,
    tenant_id: int,
    api_uuid: str,
    request_body: Dict[str, Any],
    request_params: Optional[Dict[str, Any]] = None,
    timeout: float,
) -> List[Dict[str, Any]]:
    from core.schemas.api import APITestRequest

    result = await api_service.test_api(
        tenant_id,
        UUID(api_uuid),
        APITestRequest(body=request_body, params=request_params),
        timeout=timeout,
    )
    status_code = int(result.get("status_code") or 0)
    body = result.get("body")
    from core.services.integration.kingdee_cosmic_service import (
        is_kingdee_cosmic_access_token_rejected,
    )

    if is_kingdee_cosmic_access_token_rejected(body, http_status=status_code):
        detail = (
            body.get("message")
            if isinstance(body, dict) and body.get("message")
            else "AccessToken 已过期或无效"
        )
        raise ValidationError(
            f"苍穹鉴权失败：{detail}。请在连接器点「测试连接」换票后重试"
        )
    if status_code < 200 or status_code >= 300:
        detail = (
            body.get("error")
            if isinstance(body, dict) and body.get("error")
            else f"HTTP {status_code}"
        )
        raise ValidationError(f"数据接口请求失败：{detail}")

    column_names = extract_kingdee_field_keys(
        request_body if isinstance(request_body, dict) else None
    )
    return normalize_api_body_to_rows(body, column_names=column_names)


def _overlay_json_object(
    base: Optional[Dict[str, Any]],
    override: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    merged = copy.deepcopy(base) if isinstance(base, dict) else {}
    if isinstance(override, dict):
        merged.update(copy.deepcopy(override))
    return merged


def _set_nested_value(body: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
    cloned = copy.deepcopy(body)
    keys = [part.strip() for part in str(path or "").split(".") if part.strip()]
    if not keys:
        return cloned
    cursor: Any = cloned
    for key in keys[:-1]:
        if not isinstance(cursor, dict):
            return cloned
        nxt = cursor.get(key)
        if not isinstance(nxt, dict):
            cursor[key] = {}
        cursor = cursor[key]
    if isinstance(cursor, dict):
        cursor[keys[-1]] = value
    return cloned


def _resolve_batch_fill_size(request_body: Dict[str, Any], default: int = 100) -> int:
    raw = request_body.get("pageSize", request_body.get("page_size", default))
    try:
        size = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        size = default
    if size <= 0:
        return default
    return min(size, 5000)


async def _fetch_paged_rows(
    *,
    api_service: Any,
    tenant_id: int,
    api_uuid: str,
    request_body: Dict[str, Any],
    request_params: Optional[Dict[str, Any]],
    timeout: float,
) -> List[Dict[str, Any]]:
    if is_kingdee_execute_bill_query(request_body):
        _, query = parse_kingdee_query(request_body)
        page_size = resolve_page_size(query or {})
        all_rows: List[Dict[str, Any]] = []
        start_row = 0
        for page_no in range(1, MAX_PAGES + 1):
            await emit_sync_progress(
                f"正在从源端拉取第 {page_no} 页（每页最多 {page_size} 条，已累计 {len(all_rows)} 条）…"
            )
            page_body = with_bill_query_page(request_body, start_row=start_row, limit=page_size)
            chunk = await _execute_api_once(
                api_service=api_service,
                tenant_id=tenant_id,
                api_uuid=api_uuid,
                request_body=page_body,
                request_params=request_params or None,
                timeout=timeout,
            )
            if not chunk:
                break
            all_rows.extend(chunk)
            if len(chunk) < page_size:
                break
            start_row += len(chunk)
        return all_rows
    if is_cosmic_paged_query(request_body):
        page_size = resolve_cosmic_page_size(request_body)
        all_rows = []
        for page_no in range(1, MAX_PAGES + 1):
            await emit_sync_progress(
                f"正在从苍穹拉取第 {page_no} 页（每页最多 {page_size} 条，已累计 {len(all_rows)} 条）…"
            )
            page_body = with_cosmic_page(request_body, page_no=page_no, page_size=page_size)
            chunk = await _execute_api_once(
                api_service=api_service,
                tenant_id=tenant_id,
                api_uuid=api_uuid,
                request_body=page_body,
                request_params=request_params or None,
                timeout=timeout,
            )
            if not chunk:
                break
            all_rows.extend(chunk)
            if len(chunk) < page_size:
                break
        return all_rows
    await emit_sync_progress("正在从数据接口拉取…")
    return await _execute_api_once(
        api_service=api_service,
        tenant_id=tenant_id,
        api_uuid=api_uuid,
        request_body=request_body,
        request_params=request_params or None,
        timeout=timeout,
    )


async def fetch_rows_from_api(
    tenant_id: int,
    api_uuid: str,
    *,
    since: Optional[datetime] = None,
    active_only: bool = True,
    timeout: float = 600.0,
    request_body_override: Optional[Dict[str, Any]] = None,
    request_params_override: Optional[Dict[str, Any]] = None,
    batch_fill_path: Optional[str] = None,
    batch_fill_values: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    from core.services.application.api_service import APIService

    api_service = APIService()
    api = await api_service.get_api_by_uuid(tenant_id, UUID(api_uuid))
    request_body = _overlay_json_object(
        api.request_body if isinstance(api.request_body, dict) else {},
        request_body_override,
    )
    request_params = _overlay_json_object(
        api.request_params if isinstance(api.request_params, dict) else {},
        request_params_override,
    )
    request_body = apply_kingdee_active_scope_filter(request_body, active_only=active_only)
    if since is not None:
        request_body = apply_kingdee_since_filter(request_body, since)
        request_body = apply_cosmic_since_filter(request_body, since)
        request_params = apply_cosmic_since_to_params(
            request_params,
            since,
            path=str(getattr(api, "path", None) or ""),
        )
        await emit_sync_progress(
            f"已注入增量水位（自 {since.isoformat(sep=' ', timespec='seconds')}）…"
        )
    if active_only:
        await emit_sync_progress("已启用有效/未完成过滤（源端 FilterString）…")
    else:
        await emit_sync_progress("已关闭有效/未完成过滤，按接口可拉全量…")

    fill_path = str(batch_fill_path or "").strip()
    fill_values = [str(item).strip() for item in (batch_fill_values or []) if str(item).strip()]
    if fill_path and fill_values:
        chunk_size = _resolve_batch_fill_size(request_body)
        total_chunks = (len(fill_values) + chunk_size - 1) // chunk_size
        all_rows: List[Dict[str, Any]] = []
        for index in range(0, len(fill_values), chunk_size):
            chunk_vals = fill_values[index : index + chunk_size]
            chunk_no = index // chunk_size + 1
            await emit_sync_progress(
                f"按物料编码第 {chunk_no}/{total_chunks} 批调用（本批 {len(chunk_vals)} 个，pageSize={chunk_size}）…"
            )
            chunk_body = _set_nested_value(request_body, fill_path, ",".join(chunk_vals))
            all_rows.extend(
                await _fetch_paged_rows(
                    api_service=api_service,
                    tenant_id=tenant_id,
                    api_uuid=api_uuid,
                    request_body=chunk_body,
                    request_params=request_params or None,
                    timeout=timeout,
                )
            )
    else:
        all_rows = await _fetch_paged_rows(
            api_service=api_service,
            tenant_id=tenant_id,
            api_uuid=api_uuid,
            request_body=request_body,
            request_params=request_params or None,
            timeout=timeout,
        )

    if since is not None:
        before = len(all_rows)
        all_rows = filter_rows_by_since(all_rows, since)
        dropped = before - len(all_rows)
        if dropped > 0:
            await emit_sync_progress(
                f"本地水位过滤：丢弃早于水位 {dropped} 条，保留 {len(all_rows)} 条"
            )

    await emit_sync_progress(f"源端拉取完成，共 {len(all_rows)} 条")
    return all_rows


async def fetch_rows_from_dataset(
    tenant_id: int,
    dataset_uuid: str,
    *,
    since: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    from core.schemas.dataset import ExecuteQueryRequest
    from core.services.data.dataset_service import DatasetService

    svc = DatasetService()
    parameters: Dict[str, Any] = {}
    if since is not None:
        # 数据集若声明了 since 参数则生效；未声明时由执行层忽略多余参数或仍全量
        parameters["since"] = since.isoformat()
    all_rows: List[Dict[str, Any]] = []
    offset = 0
    page_size = 2000
    page_no = 0
    while True:
        page_no += 1
        await emit_sync_progress(
            f"正在从数据集拉取第 {page_no} 页（已累计 {len(all_rows)} 条）…"
        )
        res = await svc.execute_query(
            tenant_id,
            UUID(dataset_uuid),
            ExecuteQueryRequest(parameters=parameters, limit=page_size, offset=offset),
        )
        if not res.success:
            raise ValidationError(res.error or "数据集查询失败")
        chunk = [row for row in (res.data or []) if isinstance(row, dict)]
        if not chunk:
            break
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += len(chunk)
    if since is not None:
        all_rows = filter_rows_by_since(all_rows, since)
    await emit_sync_progress(f"数据集拉取完成，共 {len(all_rows)} 条")
    return all_rows
