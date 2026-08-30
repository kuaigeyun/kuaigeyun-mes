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
from core.services.integration.kingdee_field_keys import extract_kingdee_field_keys
from core.services.integration.kingdee_active_scope_filter import apply_kingdee_active_scope_filter
from core.services.integration.kingdee_since_filter import apply_kingdee_since_filter


async def _execute_api_once(
    *,
    api_service: Any,
    tenant_id: int,
    api_uuid: str,
    request_body: Dict[str, Any],
    timeout: float,
) -> List[Dict[str, Any]]:
    from core.schemas.api import APITestRequest

    result = await api_service.test_api(
        tenant_id,
        UUID(api_uuid),
        APITestRequest(body=request_body),
        timeout=timeout,
    )
    status_code = int(result.get("status_code") or 0)
    if status_code < 200 or status_code >= 300:
        body = result.get("body")
        detail = (
            body.get("error")
            if isinstance(body, dict) and body.get("error")
            else f"HTTP {status_code}"
        )
        raise ValidationError(f"数据接口请求失败：{detail}")

    column_names = extract_kingdee_field_keys(
        request_body if isinstance(request_body, dict) else None
    )
    return normalize_api_body_to_rows(result.get("body"), column_names=column_names)


async def fetch_rows_from_api(
    tenant_id: int,
    api_uuid: str,
    *,
    since: Optional[datetime] = None,
    active_only: bool = True,
    timeout: float = 600.0,
) -> List[Dict[str, Any]]:
    from core.services.application.api_service import APIService

    api_service = APIService()
    api = await api_service.get_api_by_uuid(tenant_id, UUID(api_uuid))
    request_body = copy.deepcopy(api.request_body) if isinstance(api.request_body, dict) else {}
    request_body = apply_kingdee_active_scope_filter(request_body, active_only=active_only)
    if since is not None:
        request_body = apply_kingdee_since_filter(request_body, since)
    if active_only:
        await emit_sync_progress("已启用有效/未完成过滤（源端 FilterString）…")
    else:
        await emit_sync_progress("已关闭有效/未完成过滤，按接口可拉全量…")

    if not is_kingdee_execute_bill_query(request_body):
        await emit_sync_progress("正在从数据接口拉取…")
        return await _execute_api_once(
            api_service=api_service,
            tenant_id=tenant_id,
            api_uuid=api_uuid,
            request_body=request_body,
            timeout=timeout,
        )

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
            timeout=timeout,
        )
        if not chunk:
            break
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        start_row += len(chunk)
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
    await emit_sync_progress(f"数据集拉取完成，共 {len(all_rows)} 条")
    return all_rows
