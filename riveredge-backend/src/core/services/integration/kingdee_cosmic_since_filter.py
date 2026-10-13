"""苍穹 OpenAPI：按修改时间注入增量 filter / start_modifytime，并支持本地行级水位过滤。"""

from __future__ import annotations

import copy
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from core.utils.timezone_utils import to_site_timezone

# 源行上常见的修改时间字段（苍穹 / 星空混用）
ROW_MODIFY_TIME_KEYS: tuple[str, ...] = (
    "modifytime",
    "modifyTime",
    "modify_time",
    "lastupdatetime",
    "lastUpdateTime",
    "FModifyDate",
    "fmodifydate",
    "updatetime",
    "updateTime",
)

# Cosmic batchQuery data 内常见「起始时间」字段（仅在已有同类 start_* 时写入，避免未知属性 400）
_DATA_START_MODIFY_KEYS: tuple[str, ...] = (
    "start_modifytime",
    "start_modifyTime",
    "start_lastupdatetime",
)


def _site_since_text(since: datetime) -> str:
    return to_site_timezone(since).strftime("%Y-%m-%d %H:%M:%S")


def _cosmic_ge_clause(date_field: str, since: datetime) -> str:
    return f"{date_field} GE '{_site_since_text(since)}'"


def _merge_cosmic_filter(existing: Any, clause: str) -> str:
    text = str(existing or "").strip()
    compact = re.sub(r"\s+", " ", text)
    if clause in compact or clause.replace(" ", "") in compact.replace(" ", ""):
        return text or clause
    if not text:
        return clause
    return f"({text}) AND ({clause})"


def is_cosmic_paged_query(request_body: Optional[Dict[str, Any]]) -> bool:
    """识别苍穹 v2 分页体：data/params + pageNo/pageSize，或扁平商品分类体（非星空 ExecuteBillQuery）。"""
    if not isinstance(request_body, dict):
        return False
    has_page = any(
        request_body.get(key) not in (None, "")
        for key in ("pageNo", "pageSize", "page_no", "page_size")
    )
    if not has_page:
        return False
    if "data" in request_body or "params" in request_body:
        return True
    # getMalGoodsClass 等：筛选项与分页同级，无 data/params；排除星空 parameters
    return "parameters" not in request_body


def resolve_cosmic_page_size(request_body: Dict[str, Any], *, default: int = 100) -> int:
    raw = request_body.get("pageSize", request_body.get("page_size", default))
    try:
        size = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        size = default
    if size <= 0:
        return default
    return min(size, 500)


def cosmic_paged_response_is_last_page(
    response_body: Any,
    *,
    chunk_len: int,
    page_size: int,
) -> bool:
    """苍穹 v2 分页：优先认 data.lastPage，避免末页仍满 pageSize 时多打无效请求。"""
    if chunk_len <= 0:
        return True
    if chunk_len < page_size:
        return True
    if not isinstance(response_body, dict):
        return False
    data = response_body.get("data")
    if isinstance(data, dict):
        if data.get("lastPage") is True or data.get("last_page") is True:
            return True
    return False


def with_cosmic_page(
    request_body: Dict[str, Any],
    *,
    page_no: int,
    page_size: Optional[int] = None,
) -> Dict[str, Any]:
    body = copy.deepcopy(request_body) if isinstance(request_body, dict) else {}
    size = int(page_size) if page_size is not None else resolve_cosmic_page_size(body)
    if "page_no" in body or "page_size" in body:
        body["page_no"] = int(page_no)
        body["page_size"] = size
    # 主字段仍用 pageNo/pageSize（苍穹 v2 常见）
    body["pageNo"] = int(page_no)
    body["pageSize"] = size
    return body


def apply_cosmic_since_filter(
    request_body: Optional[Dict[str, Any]],
    since: datetime,
    *,
    date_field: str = "modifytime",
) -> Dict[str, Any]:
    """
    深拷贝苍穹请求体并注入增量条件：
    - 已有 filter 字符串（顶层或 data.filter）：追加 ``modifytime GE '...'``
    - batchQuery data 已含 start_* 时间字段时：写入 start_modifytime（避免对 basedata 空 data 乱塞未知属性）
    无法识别时原样返回拷贝，由行级 filter_rows_by_since 兜底。
    """
    body = copy.deepcopy(request_body) if isinstance(request_body, dict) else {}
    clause = _cosmic_ge_clause(date_field, since)
    touched = False

    if "filter" in body or isinstance(body.get("filter"), str):
        body["filter"] = _merge_cosmic_filter(body.get("filter"), clause)
        touched = True

    data = body.get("data")
    if isinstance(data, dict):
        if "filter" in data or isinstance(data.get("filter"), str):
            data["filter"] = _merge_cosmic_filter(data.get("filter"), clause)
            touched = True
        has_start_time = any(
            str(key).startswith("start_") and ("time" in str(key).lower() or "date" in str(key).lower())
            for key in data.keys()
        )
        if has_start_time:
            site_text = _site_since_text(since)
            for key in _DATA_START_MODIFY_KEYS:
                if key not in data or data.get(key) in (None, ""):
                    data[key] = site_text
                    touched = True
                    break

    # 无 filter、也无 start_* 时不改 data，避免 basedata 因未知属性 400；由行级水位兜底
    return body


def apply_cosmic_since_to_params(
    request_params: Optional[Dict[str, Any]],
    since: datetime,
    *,
    path: str = "",
    date_field: str = "modifytime",
) -> Dict[str, Any]:
    """
    为苍穹 sys/query 等 Query 参数注入 filter。
    仅在已有 filter，或路径形如 kapi/sys/.../query 时写入，避免污染 basedata batchQuery。
    """
    params = copy.deepcopy(request_params) if isinstance(request_params, dict) else {}
    clause = _cosmic_ge_clause(date_field, since)
    lower_path = str(path or "").lower()
    is_sys_query = "/sys/" in lower_path and lower_path.rstrip("/").endswith("/query")
    if "filter" in params or is_sys_query:
        params["filter"] = _merge_cosmic_filter(params.get("filter"), clause)
    return params


def _parse_row_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    # 常见：2024-01-02 15:04:05 / 2024-01-02T15:04:05 / 带毫秒
    for candidate in (text, text.replace("T", " ")[:19], text[:19]):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(candidate, fmt)
            except ValueError:
                continue
    return None


def extract_row_modify_time(row: Dict[str, Any]) -> Optional[datetime]:
    if not isinstance(row, dict):
        return None
    for key in ROW_MODIFY_TIME_KEYS:
        if key in row:
            parsed = _parse_row_datetime(row.get(key))
            if parsed is not None:
                return parsed
    # 宽松：任意键名含 modify + time/date
    for key, value in row.items():
        lower = str(key).lower()
        if "modify" in lower and ("time" in lower or "date" in lower):
            parsed = _parse_row_datetime(value)
            if parsed is not None:
                return parsed
    return None


def filter_rows_by_since(
    rows: Sequence[Dict[str, Any]],
    since: Optional[datetime],
    *,
    field_keys: Sequence[str] = ROW_MODIFY_TIME_KEYS,
) -> List[Dict[str, Any]]:
    """
    本地水位过滤：有修改时间且 < since 的行丢弃。
    若整批都没有可解析的修改时间，则原样返回（无法判断时不误杀）。
    """
    if since is None:
        return [row for row in rows if isinstance(row, dict)]
    site_since = to_site_timezone(since).replace(tzinfo=None)
    kept: List[Dict[str, Any]] = []
    saw_timestamp = False
    for row in rows:
        if not isinstance(row, dict):
            continue
        modified = None
        for key in field_keys:
            if key in row:
                modified = _parse_row_datetime(row.get(key))
                if modified is not None:
                    break
        if modified is None:
            modified = extract_row_modify_time(row)
        if modified is None:
            kept.append(row)
            continue
        saw_timestamp = True
        row_ts = modified.replace(tzinfo=None) if modified.tzinfo else modified
        if row_ts >= site_since:
            kept.append(row)
    if not saw_timestamp:
        return [row for row in rows if isinstance(row, dict)]
    return kept
