"""
质检环节开关与有效策略解析（组织级 TenantConfig + 主数据字段）

设计要点（与产品规范一致）：
- IQC：来料检，优先看物料侧配置；组织关闭 IQC 时不应自动建单/强控。
- IPQC：过程检，优先看工序，其次物料；组织关闭 IPQC 时同理。
- FQC / OQC：成品检、出货检，当前阶段与物料级默认对齐；工单/订单级覆盖由调用方传入。

配置存储：infra_tenant_configs.config_key = quality_inspection_stages
config_value 示例：{"iqc_enabled": true, "ipqc_enabled": true, "fqc_enabled": true, "oqc_enabled": true}
缺省均为 True（不改变现有行为）。

IQC/IPQC/FQC 已在质量管理服务中接入；OQC 在销售出库确认出库、发货通知「通知仓库」等节点校验 OQC 出货检验单放行记录。
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
            "oqc_before_outbound": bool(stages.get("oqc_enabled", True)),
        },
    }


def validate_quality_business_parameters(quality_params: Dict[str, Any]) -> None:
    """保存业务配置时拒绝矛盾的质检参数组合。"""
    incoming = bool(quality_params.get("incoming_inspection", True))
    iqc_auto = bool(quality_params.get("auto_create_iqc_on_purchase_receipt", False))
    iqc_gate = bool(quality_params.get("require_incoming_inspection_for_receipt", False))
    if not incoming and (iqc_auto or iqc_gate):
        raise ValidationError("未启用来料检验时，不能开启来料自动建单或收货门禁")
    process = bool(quality_params.get("process_inspection", True))
    if not process and bool(quality_params.get("auto_create_ipqc_on_reporting", True)):
        raise ValidationError("未启用过程检验时，不能开启报工自动创建过程检验单")
    finished = bool(quality_params.get("finished_inspection", True))
    if not finished and bool(quality_params.get("auto_create_fqc_on_last_reporting", True)):
        raise ValidationError("未启用成品检验时，不能开启末道报工自动创建成品检验单")


async def assert_master_data_inspection_mode_allowed(
    tenant_id: int,
    *,
    material_mode: Optional[str] = None,
    operation_mode: Optional[str] = None,
) -> None:
    """主数据保存时：质检模式非 none 须至少有一个对应组织环节可用。"""
    from infra.exceptions.exceptions import ConflictError

    cfg = await get_quality_effective_config(tenant_id)
    mat = normalize_inspection_mode(material_mode) if material_mode is not None else None
    op = normalize_inspection_mode(operation_mode) if operation_mode is not None else None

    if mat and mat != "none":
        iqc_ok = cfg["stage_enabled"]["iqc"] and cfg["module_enabled"]["incoming"]
        fqc_ok = cfg["stage_enabled"]["fqc"] and cfg["module_enabled"]["finished"]
        oqc_ok = cfg["stage_enabled"]["oqc"]
        if not (iqc_ok or fqc_ok or oqc_ok):
            raise ConflictError(
                "组织未启用来料/成品/出货检验环节，无法将物料质检模式设为简易或方案质检"
            )

    if op and op != "none":
        if not (cfg["stage_enabled"]["ipqc"] and cfg["module_enabled"]["process"]):
            raise ConflictError(
                "组织未启用过程检验环节，无法将工序质检模式设为简易或方案质检"
            )

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
    material_inspection_mode: Optional[str] = None,
    operation_inspection_mode: Optional[str] = None,
    work_order_override: Optional[str] = None,
) -> Tuple[str, str]:
    """
    在组织环节开关之后，解析最终生效的 inspection_mode。

    优先级：工单/订单显式覆盖 > 工序（仅 IPQC 参与）> 物料。

    Returns:
        (effective_mode, reason)  reason 便于日志：stage_disabled | work_order_override | operation | material | default_none
    """
    toggles = await get_quality_inspection_stage_toggles(tenant_id)
    flag = _STAGE_FLAG[stage]
    if not toggles.get(flag, True):
        return "none", "stage_disabled"

    wo = normalize_inspection_mode(work_order_override) if work_order_override is not None else None
    if wo and wo != "none":
        return wo, "work_order_override"

    mat = normalize_inspection_mode(material_inspection_mode)
    op = normalize_inspection_mode(operation_inspection_mode)

    if stage == "ipqc":
        if op != "none":
            return op, "operation"
        if mat != "none":
            return mat, "material"
        return "none", "default_none"

    # iqc / fqc / oqc：以物料为主（后续若有工单快照字段，在传入 work_order_override 即可）
    if mat != "none":
        return mat, "material"
    return "none", "default_none"


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
    出库相关动作前的出货检（OQC）校验（销售出库确认、发货通知仓库等共用）。

    当组织开启 OQC 且行物料解析为需质检时，要求存在至少一张已审核、合格且放行的 OQC 出货检验单。
    """
    from decimal import Decimal

    from apps.kuaizhizao.models.oqc_inspection import OQCInspection
    from apps.master_data.models.material import Material
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
        mat = await Material.get_or_none(tenant_id=tenant_id, id=int(mid), deleted_at__isnull=True)
        eff, _reason = await resolve_inspection_policy(
            tenant_id,
            "oqc",
            material_inspection_mode=getattr(mat, "inspection_mode", None) if mat else None,
        )
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
