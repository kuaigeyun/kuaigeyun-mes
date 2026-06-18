"""
质检方案步骤值类型与规格（阶段 1）

value_type: boolean | single_select | multi_select | text | numeric
"""

from __future__ import annotations

import ast
import operator
import re
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from infra.exceptions.exceptions import ValidationError

INSPECTION_STEP_VALUE_TYPES = ("boolean", "single_select", "multi_select", "text", "numeric")

FORMULA_REF_PATTERN = re.compile(r"\{([^}]+)\}")

_SAFE_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}
_SAFE_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def normalize_value_type(raw: Any) -> str:
    if raw is None:
        return "boolean"
    s = str(raw).strip().lower()
    if s not in INSPECTION_STEP_VALUE_TYPES:
        return "boolean"
    return s


def default_value_spec(value_type: str) -> Dict[str, Any]:
    vt = normalize_value_type(value_type)
    if vt == "boolean":
        return {"required": True, "pass_when": True}
    if vt == "single_select":
        return {
            "required": True,
            "options": [
                {"value": "pass", "label": "合格", "result": "pass"},
                {"value": "fail", "label": "不合格", "result": "fail"},
            ],
        }
    if vt == "multi_select":
        return {
            "required": True,
            "options": [],
            "pass_rule": "no_defect_selected",
        }
    if vt == "text":
        return {"required": True, "multiline": False, "max_length": 500, "judgment": "manual"}
    if vt == "numeric":
        return {"required": True, "decimal_places": 4}
    return {"required": True, "pass_when": True}


def _coerce_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if v in (1, "1", "true", "True", "yes", "是"):
        return True
    if v in (0, "0", "false", "False", "no", "否"):
        return False
    return bool(v)


def extract_formula_refs(formula: str) -> List[str]:
    if not formula:
        return []
    return [m.group(1).strip() for m in FORMULA_REF_PATTERN.finditer(formula) if m.group(1).strip()]


def _safe_eval_numeric(expr: str) -> float:
    node = ast.parse(expr, mode="eval")

    def _eval(n: ast.AST) -> float:
        if isinstance(n, ast.Expression):
            return _eval(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return float(n.value)
        if isinstance(n, ast.Num):  # pragma: no cover - py<3.8 compat
            return float(n.n)
        if isinstance(n, ast.BinOp) and type(n.op) in _SAFE_BIN_OPS:
            return _SAFE_BIN_OPS[type(n.op)](_eval(n.left), _eval(n.right))
        if isinstance(n, ast.UnaryOp) and type(n.op) in _SAFE_UNARY_OPS:
            return _SAFE_UNARY_OPS[type(n.op)](_eval(n.operand))
        raise ValueError("unsupported expression")

    return _eval(node)


def evaluate_derived_formula(formula: str, variables: Dict[str, float]) -> Optional[float]:
    if not formula:
        return None
    expr = formula
    for key, val in variables.items():
        expr = expr.replace(f"{{{key}}}", str(val))
    if FORMULA_REF_PATTERN.search(expr):
        return None
    try:
        return _safe_eval_numeric(expr)
    except (ValueError, SyntaxError, TypeError, ZeroDivisionError):
        return None


def _normalize_step_photos(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        uid = item.get("uid") or item.get("uuid")
        if not uid and not item.get("url"):
            continue
        out.append(
            {
                "uid": str(uid) if uid else None,
                "name": item.get("name"),
                "url": item.get("url"),
                "status": item.get("status") or "done",
            }
        )
    return out


def normalize_value_spec(value_type: str, raw: Any) -> Dict[str, Any]:
    vt = normalize_value_type(value_type)
    base = default_value_spec(vt)
    if not isinstance(raw, dict):
        return base
    spec = {**base, **raw}

    if vt == "boolean":
        spec["pass_when"] = _coerce_bool(spec.get("pass_when", True))
    elif vt == "single_select":
        opts = spec.get("options")
        if not isinstance(opts, list) or not opts:
            spec["options"] = base["options"]
        else:
            cleaned = []
            for o in opts:
                if not isinstance(o, dict):
                    continue
                val = str(o.get("value") or "").strip()
                if not val:
                    continue
                result = str(o.get("result") or "pass").lower()
                if result not in ("pass", "fail"):
                    result = "pass"
                cleaned.append({
                    "value": val,
                    "label": str(o.get("label") or val).strip() or val,
                    "result": result,
                })
            spec["options"] = cleaned or base["options"]
    elif vt == "multi_select":
        opts = spec.get("options")
        cleaned = []
        if isinstance(opts, list):
            for o in opts:
                if not isinstance(o, dict):
                    continue
                val = str(o.get("value") or "").strip()
                if not val:
                    continue
                cleaned.append({
                    "value": val,
                    "label": str(o.get("label") or val).strip() or val,
                    "defect": _coerce_bool(o.get("defect", False)),
                })
        spec["options"] = cleaned
        pr = str(spec.get("pass_rule") or "no_defect_selected")
        if pr not in ("no_defect_selected",):
            pr = "no_defect_selected"
        spec["pass_rule"] = pr
    elif vt == "text":
        spec["judgment"] = "manual"
        if spec.get("max_length") is not None:
            try:
                spec["max_length"] = int(spec["max_length"])
            except (TypeError, ValueError):
                spec["max_length"] = 500
    elif vt == "numeric":
        for key in ("target", "lower_limit", "upper_limit"):
            if spec.get(key) is not None and spec[key] != "":
                try:
                    spec[key] = float(spec[key])
                except (TypeError, ValueError):
                    spec[key] = None
            else:
                spec[key] = None
        for key in ("lower_inclusive", "upper_inclusive"):
            if key in spec:
                spec[key] = _coerce_bool(spec.get(key, True))
            else:
                spec[key] = True
        if spec.get("decimal_places") is not None:
            try:
                spec["decimal_places"] = int(spec["decimal_places"])
            except (TypeError, ValueError):
                spec["decimal_places"] = 4
        unit = spec.get("unit")
        spec["unit"] = str(unit).strip() if unit else None
        spec["derived"] = _coerce_bool(spec.get("derived", False))
        if spec.get("derived"):
            formula = str(spec.get("formula") or "").strip()
            spec["formula"] = formula
            explicit_refs = spec.get("formula_refs")
            if isinstance(explicit_refs, list) and explicit_refs:
                spec["formula_refs"] = [str(x).strip() for x in explicit_refs if str(x).strip()]
            else:
                spec["formula_refs"] = extract_formula_refs(formula)
        else:
            spec.pop("formula", None)
            spec.pop("formula_refs", None)

    spec["required"] = _coerce_bool(spec.get("required", True))
    spec["allow_na"] = _coerce_bool(spec.get("allow_na", False))
    spec["critical"] = _coerce_bool(spec.get("critical", False))
    spec["require_photo"] = _coerce_bool(spec.get("require_photo", False))
    return spec


def normalize_sampling_spec(raw: Any) -> Dict[str, Any]:
    base = {"sample_size": 1, "accept_num": 0, "reject_num": 1}
    if not isinstance(raw, dict):
        return base
    out = dict(base)
    for key in ("sample_size", "accept_num", "reject_num"):
        if raw.get(key) is None:
            continue
        try:
            out[key] = max(0, int(raw[key]))
        except (TypeError, ValueError):
            pass
    if out["sample_size"] < 1:
        out["sample_size"] = 1
    return out


def format_sampling_criteria(spec: Dict[str, Any]) -> Optional[str]:
    sampling = spec.get("sampling") if isinstance(spec.get("sampling"), dict) else None
    if not sampling:
        return None
    n = sampling.get("sample_size", 1)
    a = sampling.get("accept_num", 0)
    r = sampling.get("reject_num", 1)
    return f"抽检 n={n}，Ac={a}，Re={r}"


def format_acceptance_criteria(value_type: str, spec: Dict[str, Any]) -> Optional[str]:
    vt = normalize_value_type(value_type)
    if vt == "boolean":
        return "合格：是" if spec.get("pass_when", True) else "合格：否"
    if vt == "numeric":
        unit = spec.get("unit") or ""
        suffix = f" {unit}".rstrip()
        if spec.get("derived") and spec.get("formula"):
            return f"派生：{spec.get('formula')}"
        lo, hi = spec.get("lower_limit"), spec.get("upper_limit")
        target = spec.get("target")
        if lo is not None and hi is not None:
            return f"{lo} ~ {hi}{suffix}"
        if lo is not None:
            return f"≥ {lo}{suffix}"
        if hi is not None:
            return f"≤ {hi}{suffix}"
        if target is not None:
            return f"目标 {target}{suffix}"
        return None
    if vt == "single_select":
        opts = spec.get("options") or []
        pass_labels = [o.get("label") for o in opts if o.get("result") == "pass"]
        if pass_labels:
            return "合格选项：" + "、".join(str(x) for x in pass_labels)
        return None
    if vt == "multi_select":
        return "未选择缺陷项为合格"
    if vt == "text":
        return "人工判定"
    return None


def prepare_plan_step_dict(step_dict: Dict[str, Any]) -> Dict[str, Any]:
    """写入方案步骤前规范化。"""
    out = dict(step_dict)
    vt = normalize_value_type(out.get("value_type"))
    out["value_type"] = vt
    out["value_spec"] = normalize_value_spec(vt, out.get("value_spec"))
    sampling_raw = out.pop("sampling_spec", None)
    if out.get("sampling_type") == "sampling":
        nested = sampling_raw
        if nested is None and isinstance(out["value_spec"], dict):
            nested = out["value_spec"].get("sampling")
        out["value_spec"] = {**out["value_spec"], "sampling": normalize_sampling_spec(nested)}
    elif isinstance(out.get("value_spec"), dict):
        out["value_spec"] = {k: v for k, v in out["value_spec"].items() if k != "sampling"}
    if not out.get("step_key"):
        out["step_key"] = str(uuid.uuid4())
    if not out.get("acceptance_criteria"):
        auto = format_acceptance_criteria(vt, out["value_spec"])
        if out.get("sampling_type") == "sampling":
            sampling_text = format_sampling_criteria(out["value_spec"])
            auto = " · ".join(x for x in [auto, sampling_text] if x)
        if auto:
            out["acceptance_criteria"] = auto
    return out


def validate_plan_step_dict(step_dict: Dict[str, Any]) -> None:
    vt = normalize_value_type(step_dict.get("value_type"))
    spec = normalize_value_spec(vt, step_dict.get("value_spec"))
    name = step_dict.get("inspection_item") or "检验项"
    if vt == "single_select" and not spec.get("options"):
        raise ValidationError(f"检验项「{name}」须配置单选选项")
    if vt == "multi_select" and not spec.get("options"):
        raise ValidationError(f"检验项「{name}」须配置多选选项")
    if vt == "numeric":
        if spec.get("derived"):
            if not spec.get("formula"):
                raise ValidationError(f"检验项「{name}」派生项须填写公式")
            lo, hi = spec.get("lower_limit"), spec.get("upper_limit")
            if lo is None and hi is None and spec.get("target") is None:
                raise ValidationError(f"检验项「{name}」派生项须填写下限、上限或目标值用于判定")
        else:
            lo, hi = spec.get("lower_limit"), spec.get("upper_limit")
            if lo is None and hi is None and spec.get("target") is None:
                raise ValidationError(f"检验项「{name}」数值类型须填写下限、上限或目标值至少一项")
    if step_dict.get("sampling_type") == "sampling":
        sampling = normalize_sampling_spec(
            (step_dict.get("value_spec") or {}).get("sampling")
            if isinstance(step_dict.get("value_spec"), dict)
            else None
        )
        if sampling.get("sample_size", 0) < 1:
            raise ValidationError(f"检验项「{name}」抽检样本量须 ≥ 1")


def validate_plan_steps_relations(steps: List[Dict[str, Any]]) -> None:
    """校验步骤间派生公式引用与循环依赖。"""
    if not steps:
        return
    keys: Dict[str, Dict[str, Any]] = {}
    for idx, step in enumerate(steps):
        if not isinstance(step, dict):
            continue
        key = str(step.get("step_key") or idx)
        keys[key] = step

    graph: Dict[str, List[str]] = {}
    for key, step in keys.items():
        vt = normalize_value_type(step.get("value_type"))
        spec = normalize_value_spec(vt, step.get("value_spec") if isinstance(step.get("value_spec"), dict) else {})
        if vt != "numeric" or not spec.get("derived"):
            graph[key] = []
            continue
        refs = spec.get("formula_refs") or []
        graph[key] = [str(r) for r in refs]
        for ref in refs:
            ref_key = str(ref)
            if ref_key not in keys:
                name = step.get("inspection_item") or key
                raise ValidationError(f"检验项「{name}」公式引用了不存在的步骤：{ref_key}")
            ref_step = keys[ref_key]
            ref_vt = normalize_value_type(ref_step.get("value_type"))
            ref_spec = normalize_value_spec(
                ref_vt,
                ref_step.get("value_spec") if isinstance(ref_step.get("value_spec"), dict) else {},
            )
            if ref_vt != "numeric" or ref_spec.get("derived"):
                name = step.get("inspection_item") or key
                raise ValidationError(f"检验项「{name}」公式仅可引用非派生数值步骤")

    visiting: set = set()
    visited: set = set()

    def dfs(node: str) -> None:
        if node in visiting:
            raise ValidationError("检验步骤派生公式存在循环依赖")
        if node in visited:
            return
        visiting.add(node)
        for dep in graph.get(node, []):
            dfs(dep)
        visiting.remove(node)
        visited.add(node)

    for node in graph:
        dfs(node)


def apply_derived_step_results(template_json: Any, conduct_data: Dict[str, Any]) -> Dict[str, Any]:
    """根据依赖步骤计算派生数值并写入 conduct_step_results。"""
    out = dict(conduct_data)
    if not template_json or not isinstance(template_json, dict):
        return out
    items = template_json.get("items") or []
    if not isinstance(items, list):
        return out
    step_results = dict(out.get("conduct_step_results") or {})
    if not isinstance(step_results, dict):
        step_results = {}

    indexed: List[Tuple[str, Dict[str, Any]]] = []
    for idx, item in enumerate(items):
        if isinstance(item, dict):
            indexed.append((_step_conduct_key(item, idx), item))

    changed = True
    max_passes = len(indexed) + 1
    passes = 0
    while changed and passes < max_passes:
        changed = False
        passes += 1
        for key, item in indexed:
            vt = normalize_value_type(item.get("value_type"))
            spec = normalize_value_spec(vt, item.get("value_spec") if isinstance(item.get("value_spec"), dict) else {})
            if vt != "numeric" or not spec.get("derived"):
                continue
            entry = dict(step_results.get(key) or {})
            if entry.get("judgment") == "na":
                continue
            variables: Dict[str, float] = {}
            incomplete = False
            for ref in spec.get("formula_refs") or []:
                ref_key = str(ref)
                ref_entry = step_results.get(ref_key) if isinstance(step_results.get(ref_key), dict) else {}
                if ref_entry.get("judgment") == "na":
                    incomplete = True
                    break
                try:
                    variables[ref_key] = float(ref_entry.get("value"))
                except (TypeError, ValueError):
                    incomplete = True
                    break
            if incomplete:
                continue
            computed = evaluate_derived_formula(str(spec.get("formula") or ""), variables)
            if computed is None:
                continue
            decimal_places = spec.get("decimal_places", 4)
            try:
                rounded = round(computed, int(decimal_places))
            except (TypeError, ValueError):
                rounded = round(computed, 4)
            if entry.get("value") != rounded:
                entry["value"] = rounded
                entry["judgment_source"] = "derived"
                changed = True
            step_results[key] = entry

    out["conduct_step_results"] = step_results
    return out


def plan_step_to_snapshot_item(step: Any) -> Dict[str, Any]:
    """ORM 步骤 → 检验单快照项。"""
    vt = normalize_value_type(getattr(step, "value_type", None))
    spec = normalize_value_spec(vt, getattr(step, "value_spec", None))
    step_key = getattr(step, "step_key", None) or str(uuid.uuid4())
    sampling_type = getattr(step, "sampling_type", "full")
    ac = getattr(step, "acceptance_criteria", None) or format_acceptance_criteria(vt, spec)
    if sampling_type == "sampling":
        sampling_text = format_sampling_criteria(spec)
        ac = " · ".join(x for x in [ac, sampling_text] if x)
    return {
        "step_key": step_key,
        "sequence": getattr(step, "sequence", 0),
        "inspection_item": getattr(step, "inspection_item", ""),
        "inspection_method": getattr(step, "inspection_method", None),
        "acceptance_criteria": ac,
        "sampling_type": sampling_type,
        "value_type": vt,
        "value_spec": spec,
    }


def _step_conduct_key(item: Dict[str, Any], idx: int) -> str:
    return str(item.get("step_key") or idx)


def _is_value_filled(value: Any, value_type: str) -> bool:
    vt = normalize_value_type(value_type)
    if vt == "multi_select":
        return isinstance(value, list) and len(value) > 0
    if vt == "boolean":
        return value is not None and value != ""
    if vt == "text":
        return value is not None and str(value).strip() != ""
    return value is not None and value != ""


def judge_step_value(value_type: str, value_spec: Dict[str, Any], value: Any) -> Optional[str]:
    """自动判定 pass/fail；无法判定时返回 None（需人工）。"""
    vt = normalize_value_type(value_type)
    spec = normalize_value_spec(vt, value_spec)

    if not _is_value_filled(value, vt):
        return None

    if vt == "boolean":
        actual = _coerce_bool(value)
        return "pass" if actual == _coerce_bool(spec.get("pass_when", True)) else "fail"

    if vt == "single_select":
        selected = str(value)
        for opt in spec.get("options") or []:
            if str(opt.get("value")) == selected:
                return str(opt.get("result") or "pass")
        return None

    if vt == "multi_select":
        selected = {str(v) for v in (value if isinstance(value, list) else [])}
        defect_values = {str(o.get("value")) for o in (spec.get("options") or []) if o.get("defect")}
        if spec.get("pass_rule") == "no_defect_selected":
            return "fail" if selected & defect_values else "pass"
        return "pass"

    if vt == "numeric":
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None
        lo, hi = spec.get("lower_limit"), spec.get("upper_limit")
        if lo is not None:
            if spec.get("lower_inclusive", True):
                if num < lo:
                    return "fail"
            elif num <= lo:
                return "fail"
        if hi is not None:
            if spec.get("upper_inclusive", True):
                if num > hi:
                    return "fail"
            elif num >= hi:
                return "fail"
        if lo is None and hi is None:
            return None
        return "pass"

    return None


def resolve_step_judgment(
    item: Dict[str, Any],
    entry: Dict[str, Any],
) -> Optional[str]:
    """合并自动判定与人工判定（text / 覆盖）。"""
    manual = entry.get("judgment")
    if manual in ("pass", "fail", "na"):
        return str(manual)
    vt = normalize_value_type(item.get("value_type"))
    spec = item.get("value_spec") if isinstance(item.get("value_spec"), dict) else {}
    return judge_step_value(vt, spec, entry.get("value"))


def validate_inspection_template_conduct(template_json: Any, conduct_data: Dict[str, Any]) -> None:
    """校验方案检验项 conduct（支持 conduct_step_results 与 legacy item_results）。"""
    if not template_json or not isinstance(template_json, dict):
        return
    items = template_json.get("items")
    if not items or not isinstance(items, list):
        if template_json.get("plan_id"):
            step_results = conduct_data.get("conduct_step_results") or {}
            item_results = conduct_data.get("item_results") or {}
            if not step_results and not item_results:
                raise ValidationError("检验方案模式下须填写检验项结果")
        return

    step_results = conduct_data.get("conduct_step_results") or {}
    if not isinstance(step_results, dict):
        step_results = {}
    item_results = conduct_data.get("item_results") or {}
    measurement = conduct_data.get("measurement_data") or {}

    missing: List[str] = []
    critical_fails: List[str] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        name = item.get("inspection_item") or f"项{idx + 1}"
        key = _step_conduct_key(item, idx)
        vt = normalize_value_type(item.get("value_type"))
        spec = normalize_value_spec(vt, item.get("value_spec") if isinstance(item.get("value_spec"), dict) else {})

        entry = step_results.get(key) if isinstance(step_results.get(key), dict) else {}
        legacy_pass_fail = item_results.get(str(idx)) or item_results.get(key)

        if entry.get("judgment") == "na":
            if not spec.get("allow_na"):
                raise ValidationError(f"检验项「{name}」不允许标记为不适用")
            continue

        if vt in INSPECTION_STEP_VALUE_TYPES and item.get("value_type"):
            value = entry.get("value")
            is_derived = vt == "numeric" and spec.get("derived")
            filled = _is_value_filled(value, vt) if not is_derived else value is not None and value != ""
            if vt == "text":
                filled = filled and entry.get("judgment") in ("pass", "fail", "na")
            if not filled and legacy_pass_fail in (None, ""):
                if spec.get("required", True):
                    missing.append(str(name))
                continue
            if spec.get("require_photo") and entry.get("judgment") != "na":
                if not _normalize_step_photos(entry.get("photos")):
                    missing.append(f"{name}（照片）")
            if filled:
                judgment = resolve_step_judgment(item, entry)
                if judgment is None and vt != "text":
                    raise ValidationError(f"检验项「{name}」无法判定，请检查录入值")
                if spec.get("critical") and judgment == "fail":
                    critical_fails.append(str(name))
            continue

        # legacy boolean（无 value_type）
        filled = (
            str(idx) in item_results and item_results[str(idx)] not in (None, "")
        ) or (
            name in measurement and measurement[name] not in (None, "")
        )
        if not filled:
            missing.append(str(name))

    if missing:
        raise ValidationError(f"请完成检验项：{'、'.join(missing)}")
    if critical_fails:
        raise ValidationError(f"关键检验项不合格：{'、'.join(critical_fails)}")


def merge_template_conduct_results(template_json: Any, conduct_data: Dict[str, Any]) -> Any:
    if not template_json or not isinstance(template_json, dict):
        return template_json
    merged = dict(template_json)
    step_results = conduct_data.get("conduct_step_results")
    if step_results:
        enriched: Dict[str, Any] = {}
        items = merged.get("items") or []
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            key = _step_conduct_key(item, idx)
            raw = step_results.get(key) if isinstance(step_results.get(key), dict) else {}
            entry = dict(raw)
            if "judgment" not in entry or not entry.get("judgment"):
                j = resolve_step_judgment(item, entry)
                if j:
                    entry["judgment"] = j
            if entry.get("photos") is not None:
                entry["photos"] = _normalize_step_photos(entry.get("photos"))
            enriched[key] = entry
        merged["conduct_step_results"] = enriched
    if conduct_data.get("item_results"):
        merged["conduct_item_results"] = conduct_data["item_results"]
    if conduct_data.get("measurement_data"):
        merged["conduct_measurement_data"] = conduct_data["measurement_data"]
    return merged


def build_measurement_data_from_conduct(template_json: Any, conduct_data: Dict[str, Any]) -> Dict[str, Any]:
    """从 conduct_step_results 提取数值项供 SPC（兼容 measurement_data）。"""
    out: Dict[str, Any] = dict(conduct_data.get("measurement_data") or {})
    if not template_json or not isinstance(template_json, dict):
        return out
    step_results = conduct_data.get("conduct_step_results") or {}
    if not isinstance(step_results, dict):
        return out
    for idx, item in enumerate(template_json.get("items") or []):
        if not isinstance(item, dict):
            continue
        if normalize_value_type(item.get("value_type")) != "numeric":
            continue
        key = _step_conduct_key(item, idx)
        entry = step_results.get(key)
        if not isinstance(entry, dict):
            continue
        if entry.get("judgment") == "na":
            continue
        val = entry.get("value")
        if val is not None and val != "":
            name = item.get("inspection_item") or key
            out[str(name)] = val
    return out


def build_spc_sample_payloads(
    template_json: Any,
    conduct_data: Dict[str, Any],
    *,
    material_id: Optional[int] = None,
    material_code: Optional[str] = None,
    source_type: Optional[str] = None,
    source_id: Optional[int] = None,
    source_code: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """从方案 conduct 生成 SPC 采样写入载荷（按 step_key + 物料）。"""
    payloads: List[Dict[str, Any]] = []
    seen_chars: set = set()
    step_results = conduct_data.get("conduct_step_results") or {}
    items = (template_json or {}).get("items") if isinstance(template_json, dict) else None
    if isinstance(items, list) and items:
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            if normalize_value_type(item.get("value_type")) != "numeric":
                continue
            key = _step_conduct_key(item, idx)
            entry = step_results.get(key) if isinstance(step_results.get(key), dict) else {}
            if entry.get("judgment") == "na":
                continue
            val = entry.get("value")
            try:
                numeric = float(val)
            except (TypeError, ValueError):
                continue
            item_name = str(item.get("inspection_item") or key)
            char_name = f"{material_code}·{item_name}" if material_code else item_name
            if char_name in seen_chars:
                char_name = f"{char_name}#{key[:8]}"
            seen_chars.add(char_name)
            payloads.append(
                {
                    "characteristic_name": char_name,
                    "sample_value": numeric,
                    "sample_group": key,
                    "source_type": source_type,
                    "source_id": source_id,
                    "source_code": source_code,
                    "remarks": f"step_key={key};material_id={material_id or ''}",
                }
            )
        return payloads

    measurement = conduct_data.get("measurement_data") or {}
    if not isinstance(measurement, dict):
        return payloads
    for name, val in measurement.items():
        if val is None:
            continue
        try:
            numeric = float(val)
        except (TypeError, ValueError):
            continue
        payloads.append(
            {
                "characteristic_name": str(name),
                "sample_value": numeric,
                "sample_group": None,
                "source_type": source_type,
                "source_id": source_id,
                "source_code": source_code,
                "remarks": f"material_id={material_id or ''}",
            }
        )
    return payloads


def upgrade_template_snapshot_item(item: Dict[str, Any], idx: int) -> Tuple[Dict[str, Any], bool]:
    """将检验单快照中的旧步骤升级为 typed 结构。"""
    if not isinstance(item, dict):
        return item, False
    if item.get("value_type"):
        out = dict(item)
        changed = False
        if not out.get("step_key"):
            out["step_key"] = str(uuid.uuid4())
            changed = True
        vt = normalize_value_type(out["value_type"])
        spec = normalize_value_spec(vt, out.get("value_spec"))
        if out.get("value_type") != vt:
            out["value_type"] = vt
            changed = True
        if out.get("value_spec") != spec:
            out["value_spec"] = spec
            changed = True
        return out, changed

    step_dict = {
        "step_key": item.get("step_key"),
        "sequence": item.get("sequence", idx),
        "inspection_item": item.get("inspection_item") or f"项{idx + 1}",
        "inspection_method": item.get("inspection_method"),
        "acceptance_criteria": item.get("acceptance_criteria"),
        "sampling_type": item.get("sampling_type") or "full",
        "value_type": "boolean",
        "value_spec": item.get("value_spec"),
        "remarks": item.get("remarks"),
    }
    out = prepare_plan_step_dict(step_dict)
    if item.get("standard"):
        out["standard"] = item["standard"]
    return out, True


def upgrade_inspection_template_json(
    template: Any,
    *,
    plan_version: Optional[str] = None,
) -> Tuple[Any, bool]:
    """升级检验单内嵌模板 JSON（items / conduct / plan_version）。"""
    if not template or not isinstance(template, dict):
        return template, False

    changed = False
    out = dict(template)

    items = out.get("items")
    if isinstance(items, list):
        new_items: List[Any] = []
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                new_items.append(item)
                continue
            upgraded, item_changed = upgrade_template_snapshot_item(item, idx)
            new_items.append(upgraded)
            changed = changed or item_changed
        if changed:
            out["items"] = new_items
            items = new_items

    if isinstance(items, list) and items:
        legacy = out.get("conduct_item_results")
        if isinstance(legacy, dict) and legacy and not out.get("conduct_step_results"):
            step_results: Dict[str, Any] = {}
            for idx, item in enumerate(items):
                if not isinstance(item, dict):
                    continue
                key = _step_conduct_key(item, idx)
                val = legacy.get(key) or legacy.get(str(idx))
                if val in ("pass", "fail"):
                    step_results[key] = {"judgment": val}
            if step_results:
                out["conduct_step_results"] = step_results
                changed = True

    if out.get("plan_id") and not out.get("plan_version") and plan_version:
        out["plan_version"] = plan_version
        changed = True

    return out, changed


def plan_step_row_to_dict(step: Any) -> Dict[str, Any]:
    """ORM 步骤行 → prepare_plan_step_dict 输入。"""
    return {
        "step_key": getattr(step, "step_key", None),
        "sequence": getattr(step, "sequence", 0),
        "inspection_item": getattr(step, "inspection_item", ""),
        "inspection_method": getattr(step, "inspection_method", None),
        "acceptance_criteria": getattr(step, "acceptance_criteria", None),
        "sampling_type": getattr(step, "sampling_type", "full"),
        "value_type": getattr(step, "value_type", None),
        "value_spec": getattr(step, "value_spec", None),
        "quality_standard_id": getattr(step, "quality_standard_id", None),
        "remarks": getattr(step, "remarks", None),
    }


def quality_standard_to_template_items(std: Any) -> Optional[List[Dict[str, Any]]]:
    """质检标准 inspection_items 为结构化步骤列表时，转为方案快照 items。"""
    items = getattr(std, "inspection_items", None) if std is not None else None
    if items is None and isinstance(std, dict):
        items = std.get("inspection_items")
    if not isinstance(items, list) or not items:
        return None
    if not isinstance(items[0], dict):
        return None
    if not items[0].get("inspection_item"):
        return None
    out: List[Dict[str, Any]] = []
    for idx, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        step_dict = {**raw, "sequence": raw.get("sequence", idx)}
        out.append(prepare_plan_step_dict(step_dict))
    return out or None
