"""
质检环节开关与有效策略解析（组织级 TenantConfig + 主数据 inspection_stages JSON）

设计要点：
- IQC/FQC/OQC：物料 inspection_stages[stage] 为唯一主数据源（legacy inspection_mode 仅读 shim）
- 物料未配置 inspection_stages 时，继承物料分组 inspection_stages（与分组工艺路线同理）
- IPQC：仅工序 inspection_stages.ipqc（物料不参与过程检）
- 检验方案 plan_type 与 stage 映射：iqc→incoming, ipqc→process, fqc→finished, oqc→outbound
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Tuple, TypedDict

from infra.exceptions.exceptions import ValidationError
from infra.services.tenant_service import TenantService


class QualityEffectiveConfig(TypedDict):
    stage_enabled: Dict[str, bool]
    module_enabled: Dict[str, bool]
    auto_create: Dict[str, bool]
    gate: Dict[str, bool]


MATERIAL_INSPECTION_STAGE_KEYS = ("iqc", "fqc", "oqc")
OPERATION_INSPECTION_STAGE_KEYS = ("ipqc",)

STAGE_TO_PLAN_TYPE: Dict[str, str] = {
    "iqc": "incoming",
    "ipqc": "process",
    "fqc": "finished",
    "oqc": "outbound",
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
            "fqc_on_last_reporting": bool(q.get("auto_create_fqc_on_last_reporting", True)),
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
    fqc_auto = bool(quality_params.get("auto_create_fqc_on_last_reporting", True))
    fqc_gate = bool(quality_params.get("require_fqc_before_finished_goods_receipt", False))
    if not finished and (fqc_auto or fqc_gate):
        raise ValidationError("未启用成品检验时，不能开启末道报工自动创建成品检验单或成品入库门禁")


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
    """规范单场景策略 { mode, plan_id }。"""
    if not isinstance(raw, dict):
        return {"mode": "none", "plan_id": None}
    mode = normalize_inspection_mode(raw.get("mode"))
    plan_id = raw.get("plan_id")
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
    from apps.master_data.models.material import Material

    if stage not in MATERIAL_INSPECTION_STAGE_KEYS:
        return "none", None, "default_none"

    mat = await Material.get_or_none(tenant_id=tenant_id, id=material_id, deleted_at__isnull=True)
    if not mat:
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
        # 物料三场景均为 none：与未配置同理，继承分组默认

    legacy_stages = normalize_material_inspection_stages(
        None,
        legacy_mode=getattr(mat, "inspection_mode", None),
        legacy_plan_id=getattr(mat, "default_inspection_plan_id", None),
    )
    policy = normalize_stage_policy(legacy_stages.get(stage))
    if policy["mode"] != "none":
        return policy["mode"], policy["plan_id"], "material_legacy"

    if mat.group_id:
        grp_stages = await get_material_group_inspection_stages(tenant_id, mat.group_id)
        grp_policy = normalize_stage_policy(grp_stages.get(stage))
        if grp_policy["mode"] != "none":
            return grp_policy["mode"], grp_policy["plan_id"], "material_group"

    return "none", None, "default_none"


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


async def get_operation_inspection_stages(tenant_id: int, operation_id: int) -> Dict[str, Dict[str, Any]]:
    from apps.master_data.models.process import Operation

    op = await Operation.get_or_none(tenant_id=tenant_id, id=operation_id, deleted_at__isnull=True)
    if not op:
        return operation_stages_from_legacy("none", None)
    return normalize_operation_inspection_stages(
        getattr(op, "inspection_stages", None),
        legacy_mode=getattr(op, "inspection_mode", None),
        legacy_plan_id=getattr(op, "default_inspection_plan_id", None),
    )


def stage_plan_type(stage: InspectionStage) -> str:
    return STAGE_TO_PLAN_TYPE[stage]


async def assert_master_data_inspection_stages_allowed(
    tenant_id: int,
    *,
    material_stages: Optional[Dict[str, Any]] = None,
    operation_stages: Optional[Dict[str, Any]] = None,
) -> None:
    """主数据保存：某场景 mode≠none 时组织须启用对应环节。"""
    from infra.exceptions.exceptions import ConflictError

    cfg = await get_quality_effective_config(tenant_id)

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

    if operation_stages:
        norm = normalize_operation_inspection_stages(operation_stages)
        if normalize_stage_policy(norm.get("ipqc"))["mode"] != "none":
            if not (cfg["stage_enabled"]["ipqc"] and cfg["module_enabled"]["process"]):
                raise ConflictError("组织未启用过程检验环节，无法将工序 IPQC 设为简易或方案质检")


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
            op_policy = normalize_stage_policy(op_stages.get("ipqc"))
            if op_policy["mode"] != "none":
                return op_policy["mode"], op_policy["plan_id"], "operation"
        elif operation_inspection_mode is not None:
            leg = normalize_inspection_mode(operation_inspection_mode)
            if leg != "none":
                return leg, None, "operation_legacy"
        return "none", None, "default_none"

    if material_id:
        eff_mode, plan_id, reason = await resolve_effective_material_stage_policy(
            tenant_id, material_id, stage
        )
        if eff_mode != "none":
            return eff_mode, plan_id, reason
    elif material_inspection_mode is not None:
        leg = normalize_inspection_mode(material_inspection_mode)
        if leg != "none":
            return leg, None, "material_legacy"

    return "none", None, "default_none"


async def assert_iqc_for_purchase_receipt_lines(
    tenant_id: int,
    receipt_id: int,
    lines: List[Any],
) -> None:
    """采购入库确认：门禁开启时，仅对 iqc≠none 的行要求合格 IQC。"""
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from infra.exceptions.exceptions import BusinessLogicError

    cfg = await get_quality_effective_config(tenant_id)
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
        if i.quality_status == "合格" and i.review_status in ("已审核", "通过", "APPROVED"):
            if i.material_id:
                passed_by_material[int(i.material_id)] = True

    for mid in needs_qc_mids:
        if not passed_by_material.get(mid):
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


async def assert_fqc_for_finished_goods_receipt(
    tenant_id: int,
    receipt_id: int,
    work_order_id: Optional[int],
    lines: List[Any],
) -> None:
    """成品入库确认：门禁开启时，对 fqc≠none 的行要求工单 FQC 合格且已审核。"""
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
    from infra.exceptions.exceptions import BusinessLogicError

    cfg = await get_quality_effective_config(tenant_id)
    if not cfg["gate"]["require_fqc_before_finished_goods_receipt"]:
        return

    needs_fqc = False
    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None) or 0
        try:
            if float(qty) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        eff, _, _ = await resolve_inspection_policy(tenant_id, "fqc", material_id=int(mid))
        if eff != "none":
            needs_fqc = True
            break

    if not needs_fqc or not work_order_id:
        return

    qc_ok = await FinishedGoodsInspection.filter(
        tenant_id=tenant_id,
        work_order_id=int(work_order_id),
        quality_status="合格",
        review_status__in=("已审核", "通过", "APPROVED"),
        deleted_at__isnull=True,
    ).exists()
    if not qc_ok:
        raise BusinessLogicError(
            "已启用「成品检验合格才入库」，请先完成成品检验且审核通过后再确认成品入库"
        )


async def assert_oqc_for_outbound_lines(
    tenant_id: int,
    *,
    sales_order_id: Optional[int],
    customer_id: Optional[int],
    lines: List[Any],
    quantity_attr: str = "delivery_quantity",
    shipment_notice_id: Optional[int] = None,
    source_type: Optional[str] = None,
    source_id: Optional[int] = None,
) -> None:
    """
    出库相关动作前的出货检（OQC）校验。
    当行物料 oqc 策略≠none 时，要求存在合格且放行的 OQC 检验单。
    """
    from decimal import Decimal

    from apps.kuaizhizao.models.oqc_inspection import OQCInspection
    from infra.exceptions.exceptions import BusinessLogicError

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
            status="已审核",
            review_status="已审核",
            deleted_at__isnull=True,
        )
        if shipment_notice_id:
            q = q.filter(shipment_notice_id=int(shipment_notice_id))
        elif source_type and source_id:
            q = q.filter(source_type=str(source_type), source_id=int(source_id))
        elif sales_order_id:
            q = q.filter(sales_order_id=int(sales_order_id))
        elif customer_id is not None:
            q = q.filter(customer_id=int(customer_id))
        if not await q.exists():
            hint = ""
            if shipment_notice_id:
                hint = "（需与本发货通知关联且已审核放行的 OQC 检验单一致）"
            elif sales_order_id:
                hint = "（需与销售订单关联的 OQC 检验单一致）"
            elif customer_id is not None:
                hint = "（需与客户关联的 OQC 检验单一致）"
            raise BusinessLogicError(
                f"出货检（OQC）未通过：物料 {mc} 需存在已审核、合格且放行的 OQC 检验单后方可继续{hint}"
            )


async def assert_oqc_before_sales_delivery_confirm(
    tenant_id: int,
    *,
    sales_order_id: Optional[int],
    customer_id: Optional[int],
    delivery_items: List[Any],
    sales_delivery_id: Optional[int] = None,
) -> None:
    """销售出库「确认出库」前的 OQC 校验。"""
    await assert_oqc_for_outbound_lines(
        tenant_id,
        sales_order_id=sales_order_id,
        customer_id=customer_id,
        lines=list(delivery_items),
        quantity_attr="delivery_quantity",
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
