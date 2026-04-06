"""
质检环节开关与有效策略解析（组织级 TenantConfig + 主数据字段）

设计要点（与产品规范一致）：
- IQC：来料检，优先看物料侧配置；组织关闭 IQC 时不应自动建单/强控。
- IPQC：过程检，优先看工序，其次物料；组织关闭 IPQC 时同理。
- FQC / OQC：成品检、出货检，当前阶段与物料级默认对齐；工单/订单级覆盖由调用方传入。

配置存储：infra_tenant_configs.config_key = quality_inspection_stages
config_value 示例：{"iqc_enabled": true, "ipqc_enabled": true, "fqc_enabled": true, "oqc_enabled": true}
缺省均为 True（不改变现有行为）。

IQC/IPQC/FQC 已在质量管理服务中接入；OQC 在销售出库确认出库、发货通知「通知仓库」等节点校验成品检验放行记录。
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Tuple

from infra.services.tenant_service import TenantService

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
) -> None:
    """
    出库相关动作前的出货检（OQC）校验（销售出库确认、发货通知仓库等共用）。

    当组织开启 OQC 且行物料解析为需质检时，要求存在至少一张「已检验/已审核且合格」的成品检验单，
    并与销售订单或客户维度匹配。
    """
    from decimal import Decimal

    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
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
        q = FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            material_id=int(mid),
            quality_status="合格",
            status__in=["已审核", "已检验"],
            deleted_at__isnull=True,
        )
        if sales_order_id:
            q = q.filter(sales_order_id=int(sales_order_id))
        elif customer_id is not None:
            q = q.filter(customer_id=int(customer_id))
        if not await q.exists():
            hint = "（需与销售订单关联的成品检验记录一致）" if sales_order_id else "（需与客户关联的成品检验记录一致）"
            raise BusinessLogicError(
                f"出货检（OQC）未通过：物料 {mc} 需存在已检验且合格的成品检验单后方可继续{hint}"
            )


async def assert_oqc_before_sales_delivery_confirm(
    tenant_id: int,
    *,
    sales_order_id: Optional[int],
    customer_id: Optional[int],
    delivery_items: List[Any],
) -> None:
    """销售出库「确认出库」前的 OQC 校验。"""
    await assert_oqc_for_outbound_lines(
        tenant_id,
        sales_order_id=sales_order_id,
        customer_id=customer_id,
        lines=list(delivery_items),
        quantity_attr="delivery_quantity",
    )
