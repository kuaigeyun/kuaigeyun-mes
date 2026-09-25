"""开放 API 对接文档：从 Pydantic Schema 源文件抽取请求字段（含说明与分类）。

不 import 业务模块（避免 loguru/服务副作用），用 AST 解析 schemas/*.py。
映射优先读 open_api_schema_map.json，缺失项用 MANUAL_OVERRIDES。
"""

from __future__ import annotations

import ast
import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_SRC_ROOT = Path(__file__).resolve().parents[2]  # .../src
_MAP_PATH = Path(__file__).with_name("open_api_schema_map.json")

MANUAL_OVERRIDES: dict[str, tuple[str, str]] = {
    "kuaizhizao:outsource-issue:update": (
        "apps.kuaizhizao.schemas.outsource_work_order",
        "OutsourceMaterialIssueUpdate",
    ),
    "kuaizhizao:outsource-receipt:update": (
        "apps.kuaizhizao.schemas.outsource_work_order",
        "OutsourceMaterialReceiptUpdate",
    ),
    "kuaizhizao:outsource-material-return:update": (
        "apps.kuaizhizao.schemas.outsource_work_order",
        "OutsourceMaterialReturnCreate",
    ),
    "kuaizhizao:outsource-product-return:update": (
        "apps.kuaizhizao.schemas.outsource_work_order",
        "OutsourceProductReturnCreate",
    ),
    "kuaizhizao:plan-management-rolling-scheduling:create": (
        "apps.kuaizhizao.schemas.rolling_schedule",
        "RollingScheduleGenerateRequest",
    ),
    "kuaizhizao:plan-management-rolling-scheduling:update": (
        "apps.kuaizhizao.schemas.rolling_schedule",
        "RollingScheduleUpdateLinesRequest",
    ),
    "kuaizhizao:production-execution-reporting:update": (
        "apps.kuaizhizao.schemas.reporting_record",
        "ReportingRecordUpdate",
    ),
    "kuaizhizao:quality-management-incoming-inspection:update": (
        "apps.kuaizhizao.schemas.quality",
        "IncomingInspectionUpdate",
    ),
    "kuaizhizao:quality-management-process-inspection:update": (
        "apps.kuaizhizao.schemas.quality",
        "ProcessInspectionUpdate",
    ),
    "kuaizhizao:quality-management-finished-goods-inspection:update": (
        "apps.kuaizhizao.schemas.quality",
        "FinishedGoodsInspectionUpdate",
    ),
    "kuaizhizao:quality-management-oqc-inspection:update": (
        "apps.kuaizhizao.schemas.quality_improvement",
        "OQCInspectionCreate",
    ),
}

_CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("明细行", ("items", "lines", "details", "operations", "milestones", "payment_milestones", "fee_details")),
    ("客户信息", ("customer_", "customer")),
    ("供应商信息", ("supplier_", "supplier", "vendor_")),
    ("物料/产品", ("material_", "product_", "sku_", "bom_")),
    (
        "数量/金额",
        (
            "quantity",
            "qty",
            "amount",
            "price",
            "tax_",
            "discount",
            "cost",
            "currency",
            "prepayment",
            "unit_price",
            "total_",
        ),
    ),
    ("日期/计划", ("_date", "date", "planned_", "actual_", "schedule", "delivery_date", "order_date")),
    ("物流/地址", ("shipping_", "address", "freight_", "logistics_", "warehouse_", "location_")),
    ("审核/状态", ("review_", "reviewer_", "status", "approve", "audit_", "submit_")),
    ("组织/人员", ("salesman_", "buyer_", "workshop_", "work_center_", "dept_", "employee_", "operator_")),
    ("附件/备注", ("attachment", "remark", "note", "comment", "description")),
    ("编码/标识", ("code", "uuid", "name", "title")),
    ("追踪/批号", ("batch_", "serial_", "tracking_", "lot_")),
]

_SKIP_BASES = frozenset(
    {
        "BaseModel",
        "BaseSchema",
        "BaseSchemaV2",
        "object",
        "ABC",
    }
)

_map_cache: dict[str, dict[str, Any]] | None = None
_file_ast_cache: dict[Path, ast.Module] = {}
_fields_cache: dict[str, dict[str, Any] | None] = {}


def _load_schema_map() -> dict[str, dict[str, Any]]:
    global _map_cache
    if _map_cache is not None:
        return _map_cache
    if not _MAP_PATH.exists():
        _map_cache = {}
        return _map_cache
    try:
        _map_cache = json.loads(_MAP_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("load open_api_schema_map failed: %s", exc)
        _map_cache = {}
    return _map_cache


def _resolve_schema_ref(permission_code: str) -> tuple[str, str] | None:
    if permission_code in MANUAL_OVERRIDES:
        return MANUAL_OVERRIDES[permission_code]
    entry = _load_schema_map().get(permission_code)
    if not entry:
        return None
    mod = entry.get("import_module")
    name = entry.get("import_name") or entry.get("schema_local")
    if not mod or not name:
        return None
    return str(mod), str(name)


def _module_to_path(mod_name: str) -> Path | None:
    rel = Path(*mod_name.split(".")).with_suffix(".py")
    path = _SRC_ROOT / rel
    return path if path.exists() else None


def _parse_file(path: Path) -> ast.Module | None:
    if path in _file_ast_cache:
        return _file_ast_cache[path]
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        _file_ast_cache[path] = tree
        return tree
    except Exception as exc:
        logger.warning("parse %s failed: %s", path, exc)
        return None


def _ann_to_str(node: ast.AST | None) -> str:
    if node is None:
        return "any"
    try:
        return ast.unparse(node)
    except Exception:
        return "any"


def _const_str(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _field_meta_from_value(value: ast.AST | None) -> tuple[bool, Any, str | None]:
    """从赋值右侧推断 required / default / description。

    返回 (required, default, description)。
    """
    if value is None:
        return True, None, None

    # Field(...)
    if isinstance(value, ast.Call):
        func = value.func
        fname = func.id if isinstance(func, ast.Name) else (func.attr if isinstance(func, ast.Attribute) else "")
        if fname == "Field":
            required = True
            default: Any = None
            desc: str | None = None
            # positional default: Field(None, ...) or Field(..., description=)
            if value.args:
                a0 = value.args[0]
                if isinstance(a0, ast.Constant):
                    if a0.value is ...:
                        required = True
                        default = None
                    else:
                        required = False
                        default = a0.value
                elif isinstance(a0, ast.Name) and a0.id in ("None",):
                    required = False
                    default = None
                else:
                    # Field(Decimal("0")) etc → has default
                    required = False
                    try:
                        default = ast.unparse(a0)
                    except Exception:
                        default = "<expr>"
            for kw in value.keywords:
                if kw.arg == "description":
                    desc = _const_str(kw.value)
                elif kw.arg == "default":
                    required = False
                    if isinstance(kw.value, ast.Constant):
                        default = kw.value.value
                    else:
                        try:
                            default = ast.unparse(kw.value)
                        except Exception:
                            default = "<expr>"
                elif kw.arg == "default_factory":
                    required = False
                    default = "<factory>"
            return required, default, desc

    # bare default: x: int = 1 / x: Optional[str] = None
    if isinstance(value, ast.Constant):
        return False, value.value, None
    if isinstance(value, ast.Name) and value.id == "None":
        return False, None, None
    try:
        return False, ast.unparse(value), None
    except Exception:
        return False, None, None


def _class_def(tree: ast.Module, class_name: str) -> ast.ClassDef | None:
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return node
    return None


def _base_names(cls: ast.ClassDef) -> list[str]:
    names: list[str] = []
    for b in cls.bases:
        if isinstance(b, ast.Name):
            names.append(b.id)
        elif isinstance(b, ast.Attribute):
            names.append(b.attr)
    return names


def _own_fields(cls: ast.ClassDef) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for stmt in cls.body:
        if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            name = stmt.target.id
            if name.startswith("_"):
                continue
            required, default, desc = _field_meta_from_value(stmt.value)
            # Optional[...] without default still often treated optional in pydantic v2 if Union with None
            type_str = _ann_to_str(stmt.annotation)
            if "Optional[" in type_str or "| None" in type_str:
                # 无显式 Field(...) 时，Optional 视为非必填
                if stmt.value is None:
                    required = False
            rows.append(
                {
                    "name": name,
                    "type": type_str.replace("typing.", ""),
                    "required": required,
                    "description": desc,
                    "default": default,
                }
            )
        elif isinstance(stmt, ast.Assign):
            # model_config = ... skip
            continue
    return rows


def _collect_class_fields(
    path: Path,
    class_name: str,
    *,
    seen: set[str] | None = None,
    depth: int = 0,
) -> list[dict[str, Any]]:
    if depth > 8:
        return []
    seen = seen or set()
    key = f"{path}::{class_name}"
    if key in seen:
        return []
    seen.add(key)

    tree = _parse_file(path)
    if tree is None:
        return []
    cls = _class_def(tree, class_name)
    if cls is None:
        return []

    # parents first (Base fields), then own overrides
    merged: dict[str, dict[str, Any]] = {}
    for base in _base_names(cls):
        if base in _SKIP_BASES:
            continue
        # same file parent
        for f in _collect_class_fields(path, base, seen=seen, depth=depth + 1):
            merged[f["name"]] = f
    for f in _own_fields(cls):
        merged[f["name"]] = f
    return list(merged.values())


def _find_nested_class_name(type_str: str) -> str | None:
    """从 List[FooCreate] / Optional[Bar] 中提取可展开的嵌套模型名。"""
    import re

    m = re.search(r"List\[([A-Za-z_][A-Za-z0-9_]*)\]", type_str)
    if m:
        return m.group(1)
    m = re.search(r"Optional\[([A-Za-z_][A-Za-z0-9_]*)\]", type_str)
    if m and m.group(1)[0].isupper():
        return m.group(1)
    # bare ModelName
    if re.fullmatch(r"[A-Z][A-Za-z0-9_]+", type_str):
        return type_str
    return None


def _categorize(field_name: str) -> str:
    lower = field_name.lower().split(".")[-1].rstrip("[]")
    for cat, keys in _CATEGORY_RULES:
        for k in keys:
            if lower == k or lower.startswith(k) or lower.endswith(k) or k in lower:
                return cat
    return "其他"


def _expand_fields(
    path: Path,
    class_name: str,
    *,
    prefix: str = "",
    depth: int = 0,
    max_depth: int = 2,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for f in _collect_class_fields(path, class_name):
        name = f["name"]
        full = f"{prefix}.{name}" if prefix else name
        type_str = f["type"]
        cat = _categorize(name)
        if prefix.split(".")[0].rstrip("[]") in ("items", "lines", "operations", "details"):
            cat = "明细行"
        rows.append(
            {
                "name": full,
                "type": type_str,
                "required": bool(f["required"]),
                "description": f.get("description"),
                "category": cat,
                "default": f.get("default"),
            }
        )
        if depth >= max_depth:
            continue
        nested = _find_nested_class_name(type_str)
        if not nested or nested in _SKIP_BASES:
            continue
        # only expand if class exists in same file
        tree = _parse_file(path)
        if tree is None or _class_def(tree, nested) is None:
            continue
        is_list = "List[" in type_str
        child_prefix = f"{full}[]" if is_list else full
        rows.extend(
            _expand_fields(path, nested, prefix=child_prefix, depth=depth + 1, max_depth=max_depth)
        )
    return rows


def _group_fields(
    rows: list[dict[str, Any]],
    *,
    category_order: list[str] | None = None,
) -> list[dict[str, Any]]:
    order = category_order or ([c for c, _ in _CATEGORY_RULES] + ["其他"])
    buckets: dict[str, list[dict[str, Any]]] = {c: [] for c in order}
    for r in rows:
        cat = r.get("category") or "其他"
        buckets.setdefault(cat, []).append(r)
    groups: list[dict[str, Any]] = []
    for cat in order:
        items = buckets.get(cat) or []
        if items:
            groups.append({"category": cat, "fields": items})
    for cat, items in buckets.items():
        if cat not in order and items:
            groups.append({"category": cat, "fields": items})
    return groups


def request_fields_for_permission(permission_code: str) -> Optional[dict[str, Any]]:
    """返回某权限码对应的请求字段文档；无法解析时返回 None。"""
    if permission_code in _fields_cache:
        return _fields_cache[permission_code]

    ref = _resolve_schema_ref(permission_code)
    if not ref:
        _fields_cache[permission_code] = None
        return None
    mod_name, cls_name = ref
    path = _module_to_path(mod_name)
    if path is None:
        logger.warning("schema file missing for %s", mod_name)
        _fields_cache[permission_code] = None
        return None

    rows = _expand_fields(path, cls_name)
    if not rows:
        _fields_cache[permission_code] = None
        return None

    doc = {
        "schema": cls_name,
        "schema_module": mod_name,
        "field_count": len(rows),
        "groups": _group_fields(rows),
        "fields": rows,
    }
    _fields_cache[permission_code] = doc
    return doc


# ---- GET / 查询：query 参数 + 响应字段 ----

_READ_MAP_PATH = Path(__file__).with_name("open_api_read_map.json")
_read_map_cache: dict[str, dict[str, Any]] | None = None
_read_fields_cache: dict[str, dict[str, Any] | None] = {}

# 滚动计划等无标准 list 根路径的手工补齐
MANUAL_READ_OVERRIDES: dict[str, dict[str, Any]] = {
    "kuaizhizao:plan-management-rolling-scheduling:read": {
        "module_key": "kuaizhizao:plan-management-rolling-scheduling",
        "list": {
            "path": "/api/v1/apps/kuaizhizao/rolling-schedules/by-date/{plan_date}",
            "response_model": "RollingSchedulePlanResponse",
            "import_module": "apps.kuaizhizao.schemas.rolling_schedule",
            "query_params": [
                {
                    "name": "plan_date",
                    "type": "date",
                    "required": True,
                    "default": None,
                    "description": "计划工作日",
                    "in": "path",
                }
            ],
            "note": "主查询为按日期取计划；另有 GET /next-workday?base_date=",
        },
        "detail": None,
    },
}


def _load_read_map() -> dict[str, dict[str, Any]]:
    global _read_map_cache
    if _read_map_cache is not None:
        return _read_map_cache
    data: dict[str, dict[str, Any]] = {}
    if _READ_MAP_PATH.exists():
        try:
            data = json.loads(_READ_MAP_PATH.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("load open_api_read_map failed: %s", exc)
    data.update(MANUAL_READ_OVERRIDES)
    _read_map_cache = data
    return _read_map_cache


def _categorize_query(name: str, kind: str) -> str:
    if kind == "path":
        return "路径参数"
    lower = name.lower()
    if lower in ("skip", "limit", "page", "page_size", "offset"):
        return "分页"
    if lower in ("keyword", "q", "search", "order_by", "sort", "view", "list_scope"):
        return "通用筛选"
    if "date" in lower or lower.startswith("start") or lower.startswith("end"):
        return "日期筛选"
    if "status" in lower or "review" in lower:
        return "状态筛选"
    if "customer" in lower or "supplier" in lower:
        return "往来单位"
    if "material" in lower or "product" in lower:
        return "物料筛选"
    return "其他筛选"


def _query_rows(params: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for p in params or []:
        kind = p.get("in") or "query"
        rows.append(
            {
                "name": p.get("name"),
                "type": p.get("type") or "any",
                "required": bool(p.get("required")),
                "description": p.get("description"),
                "category": _categorize_query(str(p.get("name") or ""), kind),
                "default": p.get("default"),
                "in": kind,
            }
        )
    return rows


def _response_doc_from_ref(import_module: str | None, model_name: str | None) -> dict[str, Any] | None:
    if not model_name:
        return None
    # import_module 可能为空：尝试在常见 schemas 下找不到则只返回名
    path: Path | None = None
    if import_module:
        path = _module_to_path(import_module)
    if path is None:
        return {
            "schema": model_name,
            "schema_module": import_module,
            "field_count": 0,
            "groups": [],
            "fields": [],
        }
    rows = _expand_fields(path, model_name, max_depth=2)
    if not rows:
        return {
            "schema": model_name,
            "schema_module": import_module,
            "field_count": 0,
            "groups": [],
            "fields": [],
        }
    return {
        "schema": model_name,
        "schema_module": import_module,
        "field_count": len(rows),
        "groups": _group_fields(rows),
        "fields": rows,
    }


def read_fields_for_permission(permission_code: str) -> Optional[dict[str, Any]]:
    """GET/read：查询参数 + 列表/详情响应字段。"""
    if not permission_code.endswith(":read"):
        return None
    if permission_code in _read_fields_cache:
        return _read_fields_cache[permission_code]

    entry = _load_read_map().get(permission_code)
    if not entry:
        _read_fields_cache[permission_code] = None
        return None

    list_info = entry.get("list") or {}
    detail_info = entry.get("detail") or {}

    query_rows = _query_rows(list_info.get("query_params") or [])
    # 详情路径参数并入查询说明
    if detail_info.get("path_params"):
        for p in detail_info["path_params"]:
            # 避免与 list 重复
            if any(r["name"] == p.get("name") and r.get("in") == "path" for r in query_rows):
                continue
            query_rows.append(
                {
                    "name": p.get("name"),
                    "type": p.get("type") or "any",
                    "required": bool(p.get("required", True)),
                    "description": (p.get("description") or "详情路径参数") + "（详情 GET）",
                    "category": "路径参数",
                    "default": p.get("default"),
                    "in": "path",
                }
            )

    _QUERY_ORDER = [
        "路径参数",
        "分页",
        "通用筛选",
        "日期筛选",
        "状态筛选",
        "往来单位",
        "物料筛选",
        "其他筛选",
        "其他",
    ]

    list_resp = _response_doc_from_ref(
        list_info.get("import_module"), list_info.get("response_model")
    )
    detail_resp = _response_doc_from_ref(
        detail_info.get("import_module"), detail_info.get("response_model")
    )

    doc = {
        "list_path": list_info.get("path"),
        "detail_path": detail_info.get("path"),
        "note": list_info.get("note"),
        "query": {
            "field_count": len(query_rows),
            "groups": _group_fields(query_rows, category_order=_QUERY_ORDER) if query_rows else [],
            "fields": query_rows,
        },
        "list_response": list_resp,
        "detail_response": detail_resp,
    }
    _read_fields_cache[permission_code] = doc
    return doc
