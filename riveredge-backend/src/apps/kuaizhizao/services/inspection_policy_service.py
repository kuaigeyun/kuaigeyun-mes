"""
质检环节开关与有效策略解析（组织级 TenantConfig + 主数据 inspection_stages JSON）

设计要点：
- IQC/FQC/OQC：物料 inspection_stages[stage] 为唯一主数据源（legacy inspection_mode 仅读 shim）
- 物料未配置 inspection_stages 时，继承物料分组 inspection_stages（与分组工艺路线同理）
- IPQC：仅工序 inspection_stages.ipqc（物料不参与过程检）
- 检验方案 plan_type 与 stage 映射：iqc→incoming, ipqc→process, fqc→finished, oqc→outbound
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional, Tuple, TypedDict

from infra.exceptions.exceptions import ValidationError
from infra.services.tenant_service import TenantService


class QualityEffectiveConfig(TypedDict):
    stage_enabled: Dict[str, bool]
    module_enabled: Dict[str, bool]
    auto_create: Dict[str, bool]
    gate: Dict[str, bool]
    fai: Dict[str, bool]


MATERIAL_INSPECTION_STAGE_KEYS = ("iqc", "fqc", "oqc")
OPERATION_INSPECTION_STAGE_KEYS = ("ipqc",)

STAGE_TO_PLAN_TYPE: Dict[str, str] = {
    "iqc": "incoming",
    "ipqc": "process",
    "fqc": "finished",
    "oqc": "outbound",
}

STAGE_DISPLAY_LABELS: Dict[str, str] = {
    "iqc": "来料检验",
    "ipqc": "过程检验",
    "fqc": "成品检验",
    "oqc": "出货检验",
}

PLAN_TYPE_DISPLAY_LABELS: Dict[str, str] = {
    "incoming": "来料检验",
    "process": "过程检验",
    "finished": "成品检验",
    "outbound": "出货检验",
}

STAGE_MODULE_KEY: Dict[str, Optional[str]] = {
    "iqc": "incoming",
    "ipqc": "process",
    "fqc": "finished",
    "oqc": None,
}


def _quality_params_from_business_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    return (cfg.get("parameters") or {}).get("quality") or {}


async def get_quality_effective_config(tenant_id: int) -> QualityEffectiveConfig:
    """聚合 TenantConfig 环节开关与 business_config 质量参数（单一读取入口）。"""
    from infra.services.business_config_service import BusinessConfigService

    stages = await get_quality_inspection_stage_toggles(tenant_id)
    biz = await BusinessConfigService().get_business_config(tenant_id)
    q = _quality_params_from_business_config(biz)
    return {
        "stage_enabled": {
            "iqc": bool(stages.get("iqc_enabled", True)),
            "ipqc": bool(stages.get("ipqc_enabled", True)),
            "fqc": bool(stages.get("fqc_enabled", True)),
            "oqc": bool(stages.get("oqc_enabled", True)),
        },
        "module_enabled": {
            "incoming": bool(q.get("incoming_inspection", True)),
            "process": bool(q.get("process_inspection", True)),
            "finished": bool(q.get("finished_inspection", True)),
            "defect_handling": bool(q.get("defect_handling", True)),
        },
        "auto_create": {
            "iqc_on_purchase_receipt": bool(q.get("auto_create_iqc_on_purchase_receipt", False)),
            "ipqc_on_reporting": bool(q.get("auto_create_ipqc_on_reporting", True)),
            "fqc_on_last_reporting": bool(q.get("auto_create_fqc_on_last_reporting", False)),
            "oqc_on_shipment_notice_notify": bool(q.get("auto_create_oqc_on_shipment_notice_notify", False)),
            "oqc_on_sales_delivery": bool(q.get("auto_create_oqc_on_sales_delivery", False)),
        },
        "gate": {
            "require_iqc_before_receipt_confirm": bool(q.get("require_incoming_inspection_for_receipt", False)),
            "require_iqc_before_customer_material_confirm": bool(
                q.get("require_incoming_inspection_for_customer_material", False)
            ),
            "require_fqc_before_finished_goods_receipt": bool(
                q.get("require_fqc_before_finished_goods_receipt", False)
            ),
            "require_oqc_before_outbound": bool(stages.get("oqc_enabled", True)),
            "require_fai_before_mass_reporting": bool(q.get("require_fai_before_mass_reporting", False)),
        },
        "fai": {
            "auto_create_fai_on_work_order": bool(q.get("auto_create_fai_on_work_order", False)),
        },
    }


def validate_quality_business_parameters(quality_params: Dict[str, Any]) -> None:
    """保存业务配置时拒绝矛盾的质检参数组合。"""
    incoming = bool(quality_params.get("incoming_inspection", True))
    iqc_auto = bool(quality_params.get("auto_create_iqc_on_purchase_receipt", False))
    iqc_gate = bool(quality_params.get("require_incoming_inspection_for_receipt", False))
    cm_iqc_gate = bool(quality_params.get("require_incoming_inspection_for_customer_material", False))
    if not incoming and (iqc_auto or iqc_gate or cm_iqc_gate):
        raise ValidationError("未启用来料检验时，不能开启来料自动建单或收货门禁")
    process = bool(quality_params.get("process_inspection", True))
    if not process and bool(quality_params.get("auto_create_ipqc_on_reporting", True)):
        raise ValidationError("未启用过程检验时，不能开启报工自动创建过程检验单")
    finished = bool(quality_params.get("finished_inspection", True))
    fqc_gate = bool(quality_params.get("require_fqc_before_finished_goods_receipt", False))
    if not finished and fqc_gate:
        raise ValidationError("未启用成品检验时，不能开启成品入库门禁")


QUALITY_INSPECTION_STAGES_CONFIG_KEY = "quality_inspection_stages"

DEFAULT_STAGE_TOGGLES: Dict[str, bool] = {
    "iqc_enabled": True,
    "ipqc_enabled": True,
    "fqc_enabled": True,
    "oqc_enabled": True,
}

_STAGE_FLAG: Dict[str, str] = {
    "iqc": "iqc_enabled",
    "ipqc": "ipqc_enabled",
    "fqc": "fqc_enabled",
    "oqc": "oqc_enabled",
}

InspectionStage = Literal["iqc", "ipqc", "fqc", "oqc"]


def normalize_inspection_mode(raw: Any) -> str:
    """将任意来源的 inspection_mode 规范为 none | simple | plan。"""
    if raw is None:
        return "none"
    s = str(raw).strip().lower()
    if not s:
        return "none"
    if s not in ("none", "simple", "plan"):
        return "none"
    return s


def normalize_stage_policy(raw: Any) -> Dict[str, Any]:
    """规范单场景策略 { mode, plan_id }。

    同时认 plan_id / planId：JSON 主数据、API 别名、历史写入都可能是驼峰。
    """
    if not isinstance(raw, dict):
        return {"mode": "none", "plan_id": None}
    mode = normalize_inspection_mode(raw.get("mode"))
    plan_id = raw.get("plan_id")
    if plan_id is None:
        plan_id = raw.get("planId")
    if mode != "plan":
        return {"mode": mode, "plan_id": None}
    if plan_id is None:
        return {"mode": mode, "plan_id": None}
    try:
        return {"mode": mode, "plan_id": int(plan_id)}
    except (TypeError, ValueError):
        return {"mode": mode, "plan_id": None}


def material_stages_from_legacy(
    inspection_mode: Any,
    default_inspection_plan_id: Any,
) -> Dict[str, Dict[str, Any]]:
    """legacy inspection_mode + default_inspection_plan_id → IQC/FQC/OQC 同值 shim。"""
    mode = normalize_inspection_mode(inspection_mode)
    plan_id: Optional[int] = None
    if mode == "plan" and default_inspection_plan_id is not None:
        try:
            plan_id = int(default_inspection_plan_id)
        except (TypeError, ValueError):
            plan_id = None
    policy = {"mode": mode, "plan_id": plan_id}
    return {k: dict(policy) for k in MATERIAL_INSPECTION_STAGE_KEYS}


def operation_stages_from_legacy(
    inspection_mode: Any,
    default_inspection_plan_id: Any,
) -> Dict[str, Dict[str, Any]]:
    mode = normalize_inspection_mode(inspection_mode)
    plan_id: Optional[int] = None
    if mode == "plan" and default_inspection_plan_id is not None:
        try:
            plan_id = int(default_inspection_plan_id)
        except (TypeError, ValueError):
            plan_id = None
    return {"ipqc": {"mode": mode, "plan_id": plan_id}}


def normalize_material_inspection_stages(raw: Any, *, legacy_mode: Any = None, legacy_plan_id: Any = None) -> Dict[str, Dict[str, Any]]:
    if isinstance(raw, dict) and raw:
        return {k: normalize_stage_policy(raw.get(k)) for k in MATERIAL_INSPECTION_STAGE_KEYS}
    return material_stages_from_legacy(legacy_mode, legacy_plan_id)


def normalize_operation_inspection_stages(raw: Any, *, legacy_mode: Any = None, legacy_plan_id: Any = None) -> Dict[str, Dict[str, Any]]:
    if isinstance(raw, dict) and raw:
        out = {k: normalize_stage_policy(raw.get(k)) for k in OPERATION_INSPECTION_STAGE_KEYS}
        return out
    return operation_stages_from_legacy(legacy_mode, legacy_plan_id)


def sync_legacy_fields_from_stages(stages: Dict[str, Dict[str, Any]]) -> Tuple[str, Optional[int]]:
    """写回 legacy inspection_mode / default_inspection_plan_id（短期兼容报表）。"""
    priority = ("iqc", "fqc", "oqc")
    mode = "none"
    plan_id: Optional[int] = None
    for key in priority:
        p = normalize_stage_policy(stages.get(key))
        if p["mode"] != "none":
            mode = p["mode"]
            if p.get("plan_id"):
                plan_id = p["plan_id"]
            break
    if mode == "plan" and plan_id is None:
        for key in priority:
            p = normalize_stage_policy(stages.get(key))
            if p.get("plan_id"):
                plan_id = p["plan_id"]
                break
    return mode, plan_id


async def get_material_group_inspection_stages(tenant_id: int, group_id: int) -> Dict[str, Dict[str, Any]]:
    from apps.master_data.models.material import MaterialGroup

    group = await MaterialGroup.get_or_none(tenant_id=tenant_id, id=group_id, deleted_at__isnull=True)
    if not group:
        return material_stages_from_legacy("none", None)
    return normalize_material_inspection_stages(getattr(group, "inspection_stages", None))


async def resolve_effective_material_stage_policy(
    tenant_id: int,
    material_id: int,
    stage: InspectionStage,
) -> Tuple[str, Optional[int], str]:
    """物料级优先；物料未配置 inspection_stages 时继承分组默认（对齐工艺路线解析顺序）。"""
    cache = await build_material_policy_cache(tenant_id, [int(material_id)], stage)
    return cache.get(int(material_id), ("none", None, "default_none"))


async def get_material_inspection_stages(tenant_id: int, material_id: int) -> Dict[str, Dict[str, Any]]:
    from apps.master_data.models.material import Material

    mat = await Material.get_or_none(tenant_id=tenant_id, id=material_id, deleted_at__isnull=True)
    if not mat:
        return material_stages_from_legacy("none", None)
    return normalize_material_inspection_stages(
        getattr(mat, "inspection_stages", None),
        legacy_mode=getattr(mat, "inspection_mode", None),
        legacy_plan_id=getattr(mat, "default_inspection_plan_id", None),
    )


def _operation_stages_from_row(op: Any) -> Dict[str, Dict[str, Any]]:
    return normalize_operation_inspection_stages(
        getattr(op, "inspection_stages", None),
        legacy_mode=getattr(op, "inspection_mode", None),
        legacy_plan_id=getattr(op, "default_inspection_plan_id", None),
    )


async def get_operation_inspection_stages(tenant_id: int, operation_id: int) -> Dict[str, Dict[str, Any]]:
    from apps.master_data.models.process import Operation

    op = await Operation.get_or_none(tenant_id=tenant_id, id=operation_id, deleted_at__isnull=True)
    if not op:
        return operation_stages_from_legacy("none", None)
    return _operation_stages_from_row(op)


async def batch_get_operation_inspection_stages(
    tenant_id: int,
    operation_ids: List[int],
) -> Dict[int, Dict[str, Dict[str, Any]]]:
    """
    批量取工序检验场景配置（一次查询）。

    与 ``get_operation_inspection_stages`` 共用 ``_operation_stages_from_row``；
    查不到的工序不进结果，由调用方按「未配置」处理。
    """
    if not operation_ids:
        return {}
    from apps.master_data.models.process import Operation

    rows = await Operation.filter(
        tenant_id=tenant_id,
        id__in=list(operation_ids),
        deleted_at__isnull=True,
    ).only("id", "inspection_stages", "inspection_mode", "default_inspection_plan_id")
    return {int(row.id): _operation_stages_from_row(row) for row in rows}


def stage_plan_type(stage: InspectionStage) -> str:
    return STAGE_TO_PLAN_TYPE[stage]


def plan_type_display_label(plan_type: Any) -> str:
    key = str(plan_type or "").strip()
    return PLAN_TYPE_DISPLAY_LABELS.get(key, key or "-")


def stage_display_label(stage: Any) -> str:
    key = str(stage or "").strip()
    return STAGE_DISPLAY_LABELS.get(key, key or "-")


def _binding_token(code: Any, name: Any) -> str:
    return f"{str(code or '').strip()} {str(name or '').strip()}".strip() or "-"


def incompatible_bindings_for_plan_type(
    bindings: List[Dict[str, Any]],
    new_plan_type: str,
) -> List[Dict[str, Any]]:
    want = str(new_plan_type or "").strip()
    return [b for b in bindings if str(b.get("expected_plan_type") or "").strip() != want]


def format_incompatible_plan_type_change_message(
    plan_code: str,
    old_type: str,
    new_type: str,
    incompatible: List[Dict[str, Any]],
) -> str:
    ops = [_binding_token(b.get("code"), b.get("name")) for b in incompatible if b.get("kind") == "operation"]
    mats = [_binding_token(b.get("code"), b.get("name")) for b in incompatible if b.get("kind") == "material"]
    groups = [_binding_token(b.get("code"), b.get("name")) for b in incompatible if b.get("kind") == "material_group"]
    parts: List[str] = []
    if ops:
        parts.append("工序 " + "、".join(ops[:8]))
    if mats:
        parts.append("物料 " + "、".join(mats[:8]))
    if groups:
        parts.append("物料分组 " + "、".join(groups[:8]))
    bound = "，".join(parts) if parts else "主数据"
    return (
        f"质检方案 {plan_code} 已绑定{bound}，"
        f"不能将类型从{plan_type_display_label(old_type)}改为{plan_type_display_label(new_type)}。"
        f"请先解除绑定或改选与新类型一致的方案。"
    )


def assert_stage_plan_types(
    stage_plan_ids: List[Tuple[str, int]],
    plans_by_id: Dict[int, Any],
) -> None:
    """方案质检绑定：plan_type 必须与场景一致（工序仅 process，物料 iqc/fqc/oqc 各对其类型）。"""
    for stage, pid in stage_plan_ids:
        expected = STAGE_TO_PLAN_TYPE.get(str(stage or "").strip())
        if not expected:
            continue
        plan = plans_by_id.get(int(pid))
        if not plan:
            raise ValidationError(f"质检方案不存在：{pid}")
        actual = str(getattr(plan, "plan_type", None) or "").strip()
        if actual != expected:
            code = str(getattr(plan, "plan_code", None) or pid)
            raise ValidationError(
                f"质检方案 {code} 类型为{plan_type_display_label(actual)}，"
                f"不能绑定到{stage_display_label(stage)}（须为{plan_type_display_label(expected)}）"
            )


def _collect_stage_plan_ids_from_material(stages: Dict[str, Any]) -> List[Tuple[str, int]]:
    out: List[Tuple[str, int]] = []
    for key in MATERIAL_INSPECTION_STAGE_KEYS:
        pol = normalize_stage_policy(stages.get(key))
        if pol["mode"] == "plan" and pol.get("plan_id"):
            out.append((key, int(pol["plan_id"])))
    return out


def _collect_stage_plan_ids_from_operation(stages: Dict[str, Any]) -> List[Tuple[str, int]]:
    out: List[Tuple[str, int]] = []
    for key in OPERATION_INSPECTION_STAGE_KEYS:
        pol = normalize_stage_policy(stages.get(key))
        if pol["mode"] == "plan" and pol.get("plan_id"):
            out.append((key, int(pol["plan_id"])))
    return out


async def _load_plans_by_id(tenant_id: int, plan_ids: List[int]) -> Dict[int, Any]:
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan

    ids = list({int(x) for x in plan_ids if x})
    if not ids:
        return {}
    plans = await InspectionPlan.filter(
        tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
    ).all()
    return {int(p.id): p for p in plans}


async def list_inspection_plan_bindings(tenant_id: int, plan_id: int) -> List[Dict[str, Any]]:
    """列出仍引用该方案的工序 / 物料 / 物料分组。"""
    from tortoise.expressions import Q

    from apps.master_data.models.material import Material, MaterialGroup
    from apps.master_data.models.process import Operation

    pid = int(plan_id)
    bindings: List[Dict[str, Any]] = []

    ops = await Operation.filter(tenant_id=tenant_id, deleted_at__isnull=True).filter(
        Q(default_inspection_plan_id=pid) | Q(inspection_mode="plan")
    ).all()
    for op in ops:
        stages = normalize_operation_inspection_stages(
            getattr(op, "inspection_stages", None),
            legacy_mode=getattr(op, "inspection_mode", None),
            legacy_plan_id=getattr(op, "default_inspection_plan_id", None),
        )
        for stage, bound_id in _collect_stage_plan_ids_from_operation(stages):
            if bound_id != pid:
                continue
            bindings.append({
                "kind": "operation",
                "code": getattr(op, "code", None),
                "name": getattr(op, "name", None),
                "stage": stage,
                "expected_plan_type": STAGE_TO_PLAN_TYPE[stage],
            })

    mats = await Material.filter(tenant_id=tenant_id, deleted_at__isnull=True).filter(
        Q(default_inspection_plan_id=pid) | Q(inspection_mode="plan")
    ).all()
    for mat in mats:
        stages = normalize_material_inspection_stages(
            getattr(mat, "inspection_stages", None),
            legacy_mode=getattr(mat, "inspection_mode", None),
            legacy_plan_id=getattr(mat, "default_inspection_plan_id", None),
        )
        for stage, bound_id in _collect_stage_plan_ids_from_material(stages):
            if bound_id != pid:
                continue
            bindings.append({
                "kind": "material",
                "code": getattr(mat, "main_code", None) or getattr(mat, "code", None),
                "name": getattr(mat, "name", None),
                "stage": stage,
                "expected_plan_type": STAGE_TO_PLAN_TYPE[stage],
            })

    groups = await MaterialGroup.filter(
        tenant_id=tenant_id, deleted_at__isnull=True
    ).exclude(inspection_stages=None).all()
    for group in groups:
        stages = normalize_material_inspection_stages(getattr(group, "inspection_stages", None))
        for stage, bound_id in _collect_stage_plan_ids_from_material(stages):
            if bound_id != pid:
                continue
            bindings.append({
                "kind": "material_group",
                "code": getattr(group, "code", None),
                "name": getattr(group, "name", None),
                "stage": stage,
                "expected_plan_type": STAGE_TO_PLAN_TYPE[stage],
            })

    return bindings


async def assert_inspection_plan_type_change_allowed(
    tenant_id: int,
    plan: Any,
    new_plan_type: str,
) -> None:
    """已绑定主数据时，新类型必须仍匹配各绑定场景；否则拒绝改类型。"""
    old_type = str(getattr(plan, "plan_type", None) or "").strip()
    new_type = str(new_plan_type or "").strip()
    if not new_type or new_type == old_type:
        return
    bindings = await list_inspection_plan_bindings(tenant_id, int(plan.id))
    incompatible = incompatible_bindings_for_plan_type(bindings, new_type)
    if not incompatible:
        return
    raise ValidationError(
        format_incompatible_plan_type_change_message(
            str(getattr(plan, "plan_code", None) or plan.id),
            old_type,
            new_type,
            incompatible,
        )
    )


async def assert_master_data_inspection_stages_allowed(
    tenant_id: int,
    *,
    material_stages: Optional[Dict[str, Any]] = None,
    operation_stages: Optional[Dict[str, Any]] = None,
) -> None:
    """主数据保存：某场景 mode≠none 时组织须启用对应环节；方案质检须类型匹配场景。"""
    from infra.exceptions.exceptions import ConflictError

    cfg = await get_quality_effective_config(tenant_id)
    stage_plan_ids: List[Tuple[str, int]] = []

    if material_stages:
        norm = normalize_material_inspection_stages(material_stages)
        checks = (
            ("iqc", "来料检验", cfg["stage_enabled"]["iqc"] and cfg["module_enabled"]["incoming"]),
            ("fqc", "成品检验", cfg["stage_enabled"]["fqc"] and cfg["module_enabled"]["finished"]),
            ("oqc", "出货检验", cfg["stage_enabled"]["oqc"]),
        )
        for key, label, ok in checks:
            if normalize_stage_policy(norm.get(key))["mode"] != "none" and not ok:
                raise ConflictError(f"组织未启用{label}环节，无法将该场景的质检模式设为简易或方案质检")
        stage_plan_ids.extend(_collect_stage_plan_ids_from_material(norm))

    if operation_stages:
        norm = normalize_operation_inspection_stages(operation_stages)
        if normalize_stage_policy(norm.get("ipqc"))["mode"] != "none":
            if not (cfg["stage_enabled"]["ipqc"] and cfg["module_enabled"]["process"]):
                raise ConflictError("组织未启用过程检验环节，无法将工序 IPQC 设为简易或方案质检")
        stage_plan_ids.extend(_collect_stage_plan_ids_from_operation(norm))

    if stage_plan_ids:
        plans_by_id = await _load_plans_by_id(tenant_id, [pid for _, pid in stage_plan_ids])
        assert_stage_plan_types(stage_plan_ids, plans_by_id)


async def assert_master_data_inspection_mode_allowed(
    tenant_id: int,
    *,
    material_mode: Optional[str] = None,
    operation_mode: Optional[str] = None,
    material_stages: Optional[Dict[str, Any]] = None,
    operation_stages: Optional[Dict[str, Any]] = None,
) -> None:
    """兼容旧调用：优先 inspection_stages，否则 legacy mode 展开为四场景/单场景。"""
    if material_stages is not None or operation_stages is not None:
        await assert_master_data_inspection_stages_allowed(
            tenant_id,
            material_stages=material_stages,
            operation_stages=operation_stages,
        )
        return
    if material_mode is not None:
        await assert_master_data_inspection_stages_allowed(
            tenant_id,
            material_stages=material_stages_from_legacy(material_mode, None),
        )
    if operation_mode is not None:
        await assert_master_data_inspection_stages_allowed(
            tenant_id,
            operation_stages=operation_stages_from_legacy(operation_mode, None),
        )


async def get_quality_inspection_stage_toggles(tenant_id: int) -> Dict[str, bool]:
    """读取组织级质检环节总开关；未配置时全部视为开启。"""
    svc = TenantService()
    row = await svc.get_tenant_config(tenant_id, QUALITY_INSPECTION_STAGES_CONFIG_KEY)
    out = dict(DEFAULT_STAGE_TOGGLES)
    if row and isinstance(row.config_value, dict):
        for k in DEFAULT_STAGE_TOGGLES:
            if k in row.config_value:
                out[k] = bool(row.config_value[k])
    return out


async def set_quality_inspection_stage_toggles(
    tenant_id: int,
    toggles: Dict[str, bool],
    description: Optional[str] = None,
) -> Dict[str, bool]:
    """写入组织级质检环节开关（合并到默认值键集）。"""
    merged = dict(DEFAULT_STAGE_TOGGLES)
    for k, v in toggles.items():
        if k in merged:
            merged[k] = bool(v)
    svc = TenantService()
    await svc.set_tenant_config(
        tenant_id,
        QUALITY_INSPECTION_STAGES_CONFIG_KEY,
        merged,
        description=description,
    )
    return merged


async def batch_get_materials_for_policy(
    tenant_id: int,
    material_ids: List[int],
) -> Tuple[Dict[int, Any], Dict[int, Dict[str, Dict[str, Any]]]]:
    """
    批量取物料与分组检验场景配置（最多 2 次查询）。

    与单条 ``resolve_effective_material_stage_policy`` 共用 ``resolve_material_stage_policy_from_rows``。
    """
    if not material_ids:
        return {}, {}
    from apps.master_data.models.material import Material, MaterialGroup

    mats = await Material.filter(
        tenant_id=tenant_id,
        id__in=list(material_ids),
        deleted_at__isnull=True,
    ).only(
        "id",
        "inspection_stages",
        "inspection_mode",
        "default_inspection_plan_id",
        "group_id",
    )
    mat_by_id = {int(row.id): row for row in mats}
    group_ids = sorted({int(row.group_id) for row in mats if row.group_id})
    group_stages_by_id: Dict[int, Dict[str, Dict[str, Any]]] = {}
    if group_ids:
        groups = await MaterialGroup.filter(
            tenant_id=tenant_id,
            id__in=group_ids,
            deleted_at__isnull=True,
        ).only("id", "inspection_stages")
        for group in groups:
            group_stages_by_id[int(group.id)] = normalize_material_inspection_stages(
                getattr(group, "inspection_stages", None)
            )
    return mat_by_id, group_stages_by_id


def resolve_material_stage_policy_from_rows(
    cfg: QualityEffectiveConfig,
    stage: InspectionStage,
    mat: Optional[Any],
    group_stages: Optional[Dict[str, Dict[str, Any]]],
) -> Tuple[str, Optional[int], str]:
    """
    物料 IQC/FQC/OQC 策略判定（无 IO，唯一判定入口）。

    单条解析与批量预取 ``build_material_policy_cache`` 共用本函数。
    """
    if stage not in MATERIAL_INSPECTION_STAGE_KEYS:
        return "none", None, "default_none"
    if not cfg["stage_enabled"].get(stage, True):
        return "none", None, "stage_disabled"
    module_key = STAGE_MODULE_KEY.get(stage)
    if module_key and not cfg["module_enabled"].get(module_key, True):
        return "none", None, "module_disabled"
    if mat is None:
        return "none", None, "default_none"

    raw_stages = getattr(mat, "inspection_stages", None)
    if isinstance(raw_stages, dict) and raw_stages:
        mat_stages = normalize_material_inspection_stages(raw_stages)
        policy = normalize_stage_policy(mat_stages.get(stage))
        has_custom = any(
            normalize_stage_policy(mat_stages.get(k))["mode"] != "none"
            for k in MATERIAL_INSPECTION_STAGE_KEYS
        )
        if has_custom:
            return policy["mode"], policy["plan_id"], "material"

    legacy_stages = normalize_material_inspection_stages(
        None,
        legacy_mode=getattr(mat, "inspection_mode", None),
        legacy_plan_id=getattr(mat, "default_inspection_plan_id", None),
    )
    policy = normalize_stage_policy(legacy_stages.get(stage))
    if policy["mode"] != "none":
        return policy["mode"], policy["plan_id"], "material_legacy"

    if getattr(mat, "group_id", None) and group_stages is not None:
        grp_policy = normalize_stage_policy(group_stages.get(stage))
        if grp_policy["mode"] != "none":
            return grp_policy["mode"], grp_policy["plan_id"], "material_group"

    return "none", None, "default_none"


async def build_material_policy_cache(
    tenant_id: int,
    material_ids: List[int],
    stage: InspectionStage,
) -> Dict[int, Tuple[str, Optional[int], str]]:
    """
    批量解析物料检验策略（IQC/FQC/OQC）。

    固定 2–3 次查询（租户质量配置 + 物料批量 + 可选分组批量），不随物料数增长。
    """
    uniq: List[int] = []
    seen: set[int] = set()
    for mid in material_ids:
        if mid is None:
            continue
        oid = int(mid)
        if oid in seen:
            continue
        seen.add(oid)
        uniq.append(oid)
    if not uniq or stage not in MATERIAL_INSPECTION_STAGE_KEYS:
        return {}
    cfg = await get_quality_effective_config(tenant_id)
    mat_by_id, group_stages_by_id = await batch_get_materials_for_policy(tenant_id, uniq)
    result: Dict[int, Tuple[str, Optional[int], str]] = {}
    for mid in uniq:
        mat = mat_by_id.get(mid)
        grp_stages = None
        if mat is not None and mat.group_id is not None:
            grp_stages = group_stages_by_id.get(int(mat.group_id))
        result[mid] = resolve_material_stage_policy_from_rows(cfg, stage, mat, grp_stages)
    return result


def resolve_ipqc_policy_from_stages(
    cfg: QualityEffectiveConfig,
    op_stages: Optional[Dict[str, Dict[str, Any]]],
) -> Tuple[str, Optional[int], str]:
    """
    工序过程检验策略判定（无 IO，唯一判定入口）。

    单条解析 ``resolve_inspection_policy`` 与批量预取 ``build_operation_policy_cache``
    共用本函数，避免两套语义漂移。

    Args:
        cfg: ``get_quality_effective_config`` 结果
        op_stages: 工序 inspection_stages 规范化结果；None 表示工序不存在或未配置
    """
    if not cfg["stage_enabled"].get("ipqc", True):
        return "none", None, "stage_disabled"
    module_key = STAGE_MODULE_KEY.get("ipqc")
    if module_key and not cfg["module_enabled"].get(module_key, True):
        return "none", None, "module_disabled"
    op_policy = normalize_stage_policy((op_stages or {}).get("ipqc"))
    if op_policy["mode"] != "none":
        return op_policy["mode"], op_policy["plan_id"], "operation"
    return "none", None, "default_none"


async def resolve_inspection_policy(
    tenant_id: int,
    stage: InspectionStage,
    *,
    material_id: Optional[int] = None,
    operation_id: Optional[int] = None,
    work_order_override: Optional[str] = None,
    # legacy kwargs — 禁止新业务使用；仅当未传 material_id/operation_id 时生效
    material_inspection_mode: Optional[str] = None,
    operation_inspection_mode: Optional[str] = None,
) -> Tuple[str, Optional[int], str]:
    """
    解析最终生效的 inspection mode 与 plan_id。

    Returns:
        (effective_mode, plan_id, reason)
    """
    cfg = await get_quality_effective_config(tenant_id)
    if not cfg["stage_enabled"].get(stage, True):
        return "none", None, "stage_disabled"
    module_key = STAGE_MODULE_KEY.get(stage)
    if module_key and not cfg["module_enabled"].get(module_key, True):
        return "none", None, "module_disabled"

    wo = normalize_inspection_mode(work_order_override) if work_order_override is not None else None
    if wo and wo != "none":
        return wo, None, "work_order_override"

    if stage == "ipqc":
        if operation_id:
            op_stages = await get_operation_inspection_stages(tenant_id, operation_id)
            return resolve_ipqc_policy_from_stages(cfg, op_stages)
        if operation_inspection_mode is not None:
            leg = normalize_inspection_mode(operation_inspection_mode)
            if leg != "none":
                return leg, None, "operation_legacy"
        return "none", None, "default_none"

    if material_id:
        mat_by_id, group_stages_by_id = await batch_get_materials_for_policy(
            tenant_id, [int(material_id)]
        )
        mat = mat_by_id.get(int(material_id))
        grp_stages = None
        if mat is not None and mat.group_id is not None:
            grp_stages = group_stages_by_id.get(int(mat.group_id))
        eff_mode, plan_id, reason = resolve_material_stage_policy_from_rows(
            cfg, stage, mat, grp_stages
        )
        if eff_mode != "none":
            return eff_mode, plan_id, reason
    elif material_inspection_mode is not None:
        leg = normalize_inspection_mode(material_inspection_mode)
        if leg != "none":
            return leg, None, "material_legacy"

    return "none", None, "default_none"


_IQC_CONDUCTED_DOC_STATUSES = frozenset({"已检验", "已审核", "已驳回"})


def iqc_inspection_conducted(inspection: Any) -> bool:
    """来料检验单是否已执行检验（含不合格/驳回）。"""
    return str(getattr(inspection, "status", "") or "").strip() in _IQC_CONDUCTED_DOC_STATUSES


async def resolve_iqc_plan_label_for_material(tenant_id: int, material_id: int) -> Optional[str]:
    """解析物料来料检验方案展示名；无需检验时返回 None。"""
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan

    mode, plan_id, _ = await resolve_inspection_policy(tenant_id, "iqc", material_id=material_id)
    if mode == "none":
        return None
    if mode == "simple":
        return "简易检验"
    if plan_id:
        plan = await InspectionPlan.filter(
            tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True
        ).first()
        if plan:
            return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    plan = await InspectionPlan.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        plan_type="incoming",
        deleted_at__isnull=True,
        is_active=True,
    ).order_by("-created_at").first()
    if plan:
        return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"


async def resolve_oqc_plan_label_for_material(tenant_id: int, material_id: int) -> Optional[str]:
    """解析物料出货检验方案展示名；无需检验时返回 None。"""
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan

    mode, plan_id, _ = await resolve_inspection_policy(tenant_id, "oqc", material_id=material_id)
    if mode == "none":
        return None
    if mode == "simple":
        return "简易检验"
    if plan_id:
        plan = await InspectionPlan.filter(
            tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True
        ).first()
        if plan:
            return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    plan = await InspectionPlan.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        plan_type="outbound",
        deleted_at__isnull=True,
        is_active=True,
    ).order_by("-created_at").first()
    if plan:
        return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    return "检验方案"


async def resolve_fqc_plan_label_for_material(tenant_id: int, material_id: int) -> Optional[str]:
    """解析物料成品检验方案展示名；无需检验时返回 None。"""
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan

    mode, plan_id, _ = await resolve_inspection_policy(tenant_id, "fqc", material_id=material_id)
    if mode == "none":
        return None
    if mode == "simple":
        return "简易检验"
    if plan_id:
        plan = await InspectionPlan.filter(
            tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True
        ).first()
        if plan:
            return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    plan = await InspectionPlan.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        plan_type="finished",
        deleted_at__isnull=True,
        is_active=True,
    ).order_by("-created_at").first()
    if plan:
        return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    return "检验方案"


_IQC_PASSED_REVIEW_STATUSES = frozenset({
    "已审核",
    "通过",
    "已通过",
    "审核通过",
    "APPROVED",
    "approved",
})
_IQC_CONDUCTED_STATUSES = frozenset({"已检验", "已审核"})


async def iqc_inspection_passed_for_inbound(tenant_id: int, inspection: Any) -> bool:
    """来料检验是否满足采购入库确认条件（合格 + 已检验；需审核时另须审核通过）。"""
    if getattr(inspection, "quality_status", None) != "合格":
        return False
    from infra.services.business_config_service import BusinessConfigService

    audit_required = await BusinessConfigService().check_audit_required(tenant_id, "incoming_inspection")
    if not audit_required:
        return str(getattr(inspection, "status", "") or "").strip() in _IQC_CONDUCTED_STATUSES
    return getattr(inspection, "review_status", None) in _IQC_PASSED_REVIEW_STATUSES


_FQC_CONDUCTED_STATUSES = frozenset({"已检验", "已审核"})


_IPQC_CONDUCTED_STATUSES = frozenset({"已检验", "已审核"})


def _ipqc_transferable_qualified_quantity(inspection: Any) -> Decimal:
    try:
        return Decimal(str(getattr(inspection, "qualified_quantity", None) or 0))
    except Exception:
        return Decimal("0")


async def ipqc_inspection_passed_for_transfer(
    tenant_id: int,
    inspection: Any,
    *,
    audit_required: Optional[bool] = None,
) -> bool:
    """
    过程检验是否可计入转下道。

    口径：检验已执行，且合格数量 > 0；需审核时另须审核通过。
    整单 quality_status 可为「不合格」（部分不合格），仍放行其中的合格数量。

    Args:
        audit_required: 调用方已解析的「过程检验需审核」开关。批量场景须传入，
            否则本函数会按张检验单各查一次审核绑定，构成 N+1。
    """
    st = str(getattr(inspection, "status", "") or "").strip()
    if st not in _IPQC_CONDUCTED_STATUSES:
        return False
    if _ipqc_transferable_qualified_quantity(inspection) <= 0:
        return False
    if audit_required is None:
        from infra.services.business_config_service import BusinessConfigService

        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "process_inspection"
        )
    if not audit_required:
        return True
    return getattr(inspection, "review_status", None) in _IQC_PASSED_REVIEW_STATUSES


async def resolve_ipqc_plan_label_for_operation(
    tenant_id: int,
    operation_id: int,
    *,
    plan_id: Optional[int] = None,
) -> Optional[str]:
    """解析工序过程检验方案展示名；无需检验时返回 None。"""
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan

    mode, resolved_plan_id, _ = await resolve_inspection_policy(
        tenant_id, "ipqc", operation_id=operation_id
    )
    if mode == "none":
        return None
    if mode == "simple":
        return None
    pid = plan_id if plan_id is not None else resolved_plan_id
    if pid:
        plan = await InspectionPlan.filter(
            tenant_id=tenant_id, id=pid, deleted_at__isnull=True
        ).first()
        if plan:
            return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    plan = await InspectionPlan.filter(
        tenant_id=tenant_id,
        plan_type="process",
        deleted_at__isnull=True,
        is_active=True,
    ).order_by("-created_at").first()
    if plan:
        return str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
    return "检验方案"


async def fqc_inspection_passed_for_inbound(tenant_id: int, inspection: Any) -> bool:
    """
    成品检验是否满足成品入库确认条件。

    口径：检验已执行且合格数量 > 0；需审核时另须审核通过。
    整单 quality_status 可为「不合格」（部分不合格），仍放行其中的合格数量。
    """
    st = str(getattr(inspection, "status", "") or "").strip()
    if st not in _FQC_CONDUCTED_STATUSES:
        return False
    if _fqc_transferable_qualified_quantity(inspection) <= 0:
        return False
    from infra.services.business_config_service import BusinessConfigService

    audit_required = await BusinessConfigService().check_audit_required(tenant_id, "finished_goods_inspection")
    if not audit_required:
        return True
    return getattr(inspection, "review_status", None) in _IQC_PASSED_REVIEW_STATUSES


def _fqc_transferable_qualified_quantity(inspection: Any) -> Decimal:
    try:
        return Decimal(str(getattr(inspection, "qualified_quantity", None) or 0))
    except Exception:
        return Decimal("0")


async def sum_fqc_inbound_qualified_quantity(
    tenant_id: int,
    work_order_id: int,
    material_id: Optional[int] = None,
) -> Decimal:
    """汇总工单成品检验可用于入库的合格数量（已检验/已审核且合格数>0）。"""
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

    query = FinishedGoodsInspection.filter(
        tenant_id=tenant_id,
        work_order_id=int(work_order_id),
        deleted_at__isnull=True,
    )
    if material_id is not None:
        query = query.filter(material_id=int(material_id))
    inspections = await query.all()
    total = Decimal("0")
    for inspection in inspections:
        if await fqc_inspection_passed_for_inbound(tenant_id, inspection):
            total += _fqc_transferable_qualified_quantity(inspection)
    return total


async def sum_finished_goods_receipt_quantity_for_work_order(
    tenant_id: int,
    work_order_id: int,
    material_id: Optional[int] = None,
    *,
    exclude_receipt_id: Optional[int] = None,
) -> Decimal:
    """汇总工单已确认成品入库数量（按物料可选过滤）。"""
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
    from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem

    receipt_ids = await FinishedGoodsReceipt.filter(
        tenant_id=tenant_id,
        work_order_id=int(work_order_id),
        deleted_at__isnull=True,
        status="已入库",
    ).values_list("id", flat=True)
    ids = [int(rid) for rid in receipt_ids if int(rid) != int(exclude_receipt_id or 0)]
    if not ids:
        return Decimal("0")
    item_query = FinishedGoodsReceiptItem.filter(
        tenant_id=tenant_id,
        receipt_id__in=ids,
    )
    if material_id is not None:
        item_query = item_query.filter(material_id=int(material_id))
    items = await item_query.all()
    total = Decimal("0")
    for item in items:
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None) or 0
        try:
            total += Decimal(str(qty))
        except Exception:
            continue
    return total


async def get_fqc_inbound_remaining_quantity(
    tenant_id: int,
    work_order_id: int,
    material_id: int,
    *,
    exclude_receipt_id: Optional[int] = None,
) -> Decimal:
    """FQC 合格可入余量 = 已审合格数 − 已确认入库数。"""
    cap = await sum_fqc_inbound_qualified_quantity(tenant_id, work_order_id, material_id)
    received = await sum_finished_goods_receipt_quantity_for_work_order(
        tenant_id,
        work_order_id,
        material_id,
        exclude_receipt_id=exclude_receipt_id,
    )
    return max(Decimal("0"), cap - received)


async def assert_fqc_for_finished_goods_receipt(
    tenant_id: int,
    receipt_id: int,
    work_order_id: Optional[int],
    lines: List[Any],
) -> None:
    """成品入库确认：fqc≠none 时须已审 FQC 且入库数量不超过合格数。"""
    from infra.exceptions.exceptions import BusinessLogicError

    cfg = await get_quality_effective_config(tenant_id)
    gate_enabled = bool(cfg["gate"]["require_fqc_before_finished_goods_receipt"])

    if not work_order_id:
        return

    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None) or 0
        try:
            qty_dec = Decimal(str(qty))
        except (TypeError, ValueError):
            continue
        if qty_dec <= 0:
            continue
        eff, _, _ = await resolve_inspection_policy(tenant_id, "fqc", material_id=int(mid))
        if eff == "none":
            continue

        qualified_cap = await sum_fqc_inbound_qualified_quantity(
            tenant_id, int(work_order_id), int(mid)
        )
        if gate_enabled and qualified_cap <= 0:
            raise BusinessLogicError(
                "已启用「需已审 FQC 且入库数量不超过合格数」，请先完成成品检验"
                "（需审核时须审核通过）且存在合格数量后再确认成品入库"
            )

        remaining = await get_fqc_inbound_remaining_quantity(
            tenant_id,
            int(work_order_id),
            int(mid),
            exclude_receipt_id=receipt_id,
        )
        if qty_dec > remaining + Decimal("1e-9"):
            raise BusinessLogicError(
                f"入库数量 {qty_dec} 超过成品检验合格可入余量 {remaining}（合格合计 {qualified_cap}）"
            )


_OQC_CONDUCTED_STATUSES = frozenset({"已检验", "已审核"})


async def oqc_inspection_passed_for_outbound(tenant_id: int, inspection: Any) -> bool:
    """出货检验是否满足出库门禁（合格 + 已放行；需审核时另须审核通过）。"""
    if getattr(inspection, "quality_status", None) != "合格":
        return False
    if getattr(inspection, "release_decision", None) != "released":
        return False
    from infra.services.business_config_service import BusinessConfigService

    audit_required = await BusinessConfigService().check_audit_required(tenant_id, "oqc_inspection")
    if not audit_required:
        return str(getattr(inspection, "status", "") or "").strip() in _OQC_CONDUCTED_STATUSES
    return (
        str(getattr(inspection, "status", "") or "").strip() == "已审核"
        and getattr(inspection, "review_status", None) in _IQC_PASSED_REVIEW_STATUSES
    )


async def assert_iqc_for_purchase_receipt_lines(
    tenant_id: int,
    receipt_id: int,
    lines: List[Any],
) -> None:
    """采购入库确认：门禁开启时，对 iqc≠none 的行要求来料检验合格（需审核时须审核通过）。"""
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from infra.exceptions.exceptions import BusinessLogicError

    cfg = await get_quality_effective_config(tenant_id)
    # 与代工来料一致：组织「收货前必须来料检验」关闭时不卡确认入库
    if not cfg["gate"]["require_iqc_before_receipt_confirm"]:
        return

    needs_qc_mids: List[int] = []
    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "quantity", None) or 0
        try:
            if float(qty) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        eff, _, _ = await resolve_inspection_policy(tenant_id, "iqc", material_id=int(mid))
        if eff != "none":
            needs_qc_mids.append(int(mid))

    if not needs_qc_mids:
        return

    inspections = await IncomingInspection.filter(
        tenant_id=tenant_id,
        purchase_receipt_id=receipt_id,
        deleted_at__isnull=True,
    ).all()
    if not inspections:
        raise BusinessLogicError(
            "已启用「收货前必须来料检验」，请先创建并完成来料检验，检验合格后再确认入库"
        )

    passed_by_material: Dict[int, bool] = {}
    for i in inspections:
        if i.material_id and await iqc_inspection_passed_for_inbound(tenant_id, i):
            passed_by_material[int(i.material_id)] = True

    for mid in needs_qc_mids:
        if passed_by_material.get(mid):
            continue
        raise BusinessLogicError(
            "已启用「收货前必须来料检验」，相关物料的来料检验须审核通过且质量状态为合格后才能确认入库"
        )


async def assert_iqc_for_customer_material_registration_lines(
    tenant_id: int,
    registration_id: int,
    lines: List[Any],
) -> None:
    """代工来料确认入库：门禁开启时，仅对 iqc≠none 的行要求合格 IQC。"""
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from infra.exceptions.exceptions import BusinessLogicError

    cfg = await get_quality_effective_config(tenant_id)
    if not cfg["gate"]["require_iqc_before_customer_material_confirm"]:
        return

    needs_qc_mids: List[int] = []
    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "quantity", None) or 0
        try:
            if float(qty) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        eff, _, _ = await resolve_inspection_policy(tenant_id, "iqc", material_id=int(mid))
        if eff != "none":
            needs_qc_mids.append(int(mid))

    if not needs_qc_mids:
        return

    inspections = await IncomingInspection.filter(
        tenant_id=tenant_id,
        customer_material_registration_id=registration_id,
        deleted_at__isnull=True,
    ).all()
    if not inspections:
        raise BusinessLogicError(
            "已启用「代工来料入库前必须来料检验」，请先创建并完成来料检验，检验合格后再确认入库"
        )

    passed_by_material: Dict[int, bool] = {}
    for i in inspections:
        if i.quality_status == "合格" and i.review_status in ("已审核", "通过", "APPROVED"):
            if i.material_id:
                passed_by_material[int(i.material_id)] = True

    for mid in needs_qc_mids:
        if not passed_by_material.get(mid):
            raise BusinessLogicError(
                "已启用「代工来料入库前必须来料检验」，相关物料的来料检验须审核通过且质量状态为合格后才能确认入库"
            )


async def _shipment_notice_ids_for_sales_delivery(
    tenant_id: int,
    sales_delivery_id: int,
) -> List[int]:
    """解析销售出库单关联的发货通知单 ID（主关联 + related 列表）。"""
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery
    from apps.kuaizhizao.models.shipment_notice import ShipmentNotice

    notice_ids: set[int] = set()
    for nid in await ShipmentNotice.filter(
        tenant_id=tenant_id,
        sales_delivery_id=int(sales_delivery_id),
        deleted_at__isnull=True,
    ).values_list("id", flat=True):
        notice_ids.add(int(nid))

    delivery = await SalesDelivery.get_or_none(
        tenant_id=tenant_id, id=int(sales_delivery_id), deleted_at__isnull=True
    )
    so_id = getattr(delivery, "sales_order_id", None) if delivery else None
    if so_id:
        candidates = await ShipmentNotice.filter(
            tenant_id=tenant_id,
            sales_order_id=int(so_id),
            deleted_at__isnull=True,
        ).all()
        for notice in candidates:
            if int(notice.id) in notice_ids:
                continue
            related = getattr(notice, "related_sales_delivery_ids", None) or []
            if not isinstance(related, list):
                continue
            for entry in related:
                eid = entry.get("id") if isinstance(entry, dict) else None
                if eid is not None and int(eid) == int(sales_delivery_id):
                    notice_ids.add(int(notice.id))
                    break
    return sorted(notice_ids)


async def assert_oqc_for_outbound_lines(
    tenant_id: int,
    *,
    sales_order_id: Optional[int],
    customer_id: Optional[int],
    lines: List[Any],
    quantity_attr: str = "delivery_quantity",
    shipment_notice_id: Optional[int] = None,
    shipment_notice_ids: Optional[List[int]] = None,
    source_type: Optional[str] = None,
    source_id: Optional[int] = None,
) -> None:
    """
    出库相关动作前的出货检（OQC）校验。
    当行物料 oqc 策略≠none 时，要求存在合格且放行的 OQC 检验单；
    是否必须「已审核」由业务配置中 oqc_inspection 审核开关决定（与 IQC/FQC 一致）。

    单据锚定优先级：发货通知 / 销售出库（可同时 OR）→ 销售订单 → 客户。
    """
    cfg = await get_quality_effective_config(tenant_id)
    if not cfg["gate"]["require_oqc_before_outbound"]:
        return

    from tortoise.expressions import Q

    from apps.kuaizhizao.models.oqc_inspection import OQCInspection
    from infra.exceptions.exceptions import BusinessLogicError
    from infra.services.business_config_service import BusinessConfigService

    oqc_audit_required = await BusinessConfigService().check_audit_required(tenant_id, "oqc_inspection")

    notice_ids: List[int] = []
    for nid in list(shipment_notice_ids or []):
        if nid is not None:
            notice_ids.append(int(nid))
    if shipment_notice_id is not None:
        notice_ids.append(int(shipment_notice_id))
    notice_ids = sorted({n for n in notice_ids if n > 0})
    has_doc_anchor = bool(notice_ids) or bool(source_type and source_id)

    for item in lines:
        qty_raw = getattr(item, quantity_attr, None)
        try:
            qd = Decimal(str(qty_raw or 0))
        except Exception:
            qd = Decimal(0)
        if qd <= 0:
            continue
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        eff, _, _ = await resolve_inspection_policy(tenant_id, "oqc", material_id=int(mid))
        if eff == "none":
            continue

        mc = getattr(item, "material_code", None) or str(mid)
        q = OQCInspection.filter(
            tenant_id=tenant_id,
            material_id=int(mid),
            quality_status="合格",
            release_decision="released",
            deleted_at__isnull=True,
        )
        if has_doc_anchor:
            doc_q = Q()
            if notice_ids:
                doc_q |= Q(shipment_notice_id__in=notice_ids)
            if source_type and source_id:
                doc_q |= Q(source_type=str(source_type), source_id=int(source_id))
            q = q.filter(doc_q)
        elif sales_order_id:
            q = q.filter(sales_order_id=int(sales_order_id))
        elif customer_id is not None:
            q = q.filter(customer_id=int(customer_id))

        inspections = await q.all()
        passed = False
        for inspection in inspections:
            if await oqc_inspection_passed_for_outbound(tenant_id, inspection):
                passed = True
                break
        if passed:
            continue

        hint = ""
        if has_doc_anchor:
            hint = "（需与本发货通知或销售出库关联且已合格放行的 OQC 检验单一致）"
        elif sales_order_id:
            hint = "（需与销售订单关联的 OQC 检验单一致）"
        elif customer_id is not None:
            hint = "（需与客户关联的 OQC 检验单一致）"
        audit_tip = "已审核、" if oqc_audit_required else "已检验、"
        raise BusinessLogicError(
            f"出货检（OQC）未通过：物料 {mc} 需存在{audit_tip}合格且放行的 OQC 检验单后方可继续{hint}"
        )


async def assert_oqc_before_sales_delivery_confirm(
    tenant_id: int,
    *,
    sales_order_id: Optional[int],
    customer_id: Optional[int],
    delivery_items: List[Any],
    sales_delivery_id: Optional[int] = None,
) -> None:
    """销售出库「确认出库」前的 OQC 校验（由组织 OQC 门禁控制，不依赖销售出库审核开关）。"""
    notice_ids: List[int] = []
    if sales_delivery_id:
        notice_ids = await _shipment_notice_ids_for_sales_delivery(
            tenant_id, int(sales_delivery_id)
        )

    await assert_oqc_for_outbound_lines(
        tenant_id,
        sales_order_id=sales_order_id,
        customer_id=customer_id,
        lines=list(delivery_items),
        quantity_attr="delivery_quantity",
        shipment_notice_ids=notice_ids or None,
        source_type="sales_delivery" if sales_delivery_id else None,
        source_id=sales_delivery_id,
    )


def prepare_material_group_inspection_for_write(data: Dict[str, Any]) -> Dict[str, Any]:
    """写入物料分组：规范化 inspection_stages。"""
    if data.get("inspection_stages") is not None:
        stages = normalize_material_inspection_stages(data["inspection_stages"])
        data["inspection_stages"] = {k: stages[k] for k in MATERIAL_INSPECTION_STAGE_KEYS}
    return data


def prepare_material_inspection_for_write(data: Dict[str, Any]) -> Dict[str, Any]:
    """写入物料：以 inspection_stages 为主，同步 legacy 字段。"""
    if data.get("inspection_stages") is not None:
        stages = normalize_material_inspection_stages(data["inspection_stages"])
        mode, plan_id = sync_legacy_fields_from_stages(stages)
        data["inspection_stages"] = {k: stages[k] for k in MATERIAL_INSPECTION_STAGE_KEYS}
        data["inspection_mode"] = mode
        data["default_inspection_plan_id"] = plan_id
    elif data.get("inspection_mode") is not None or data.get("default_inspection_plan_id") is not None:
        stages = material_stages_from_legacy(
            data.get("inspection_mode"),
            data.get("default_inspection_plan_id"),
        )
        data["inspection_stages"] = stages
    return data


def prepare_operation_inspection_for_write(data: Dict[str, Any]) -> Dict[str, Any]:
    """写入工序：以 inspection_stages 为主，同步 legacy 字段。"""
    if data.get("inspection_stages") is not None:
        stages = normalize_operation_inspection_stages(data["inspection_stages"])
        ipqc = normalize_stage_policy(stages.get("ipqc"))
        data["inspection_stages"] = stages
        data["inspection_mode"] = ipqc["mode"]
        data["default_inspection_plan_id"] = ipqc["plan_id"]
    elif data.get("inspection_mode") is not None or data.get("default_inspection_plan_id") is not None:
        stages = operation_stages_from_legacy(
            data.get("inspection_mode"),
            data.get("default_inspection_plan_id"),
        )
        data["inspection_stages"] = stages
    return data
