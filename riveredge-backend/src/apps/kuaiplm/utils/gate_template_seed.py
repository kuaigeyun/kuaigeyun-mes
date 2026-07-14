"""
阶段门模板系统种子数据

Author: RiverEdge Team
Date: 2026-07-07
"""

from typing import Any, Dict, List, Optional, Tuple

from apps.common.audit_actor import apply_create_audit
from apps.kuaiplm.constants.rd_project import (
    DEFAULT_DELIVERY_DELIVERABLES,
    DEFAULT_DELIVERY_GATES,
    DEFAULT_GATE_DELIVERABLES,
    DEFAULT_NPI_GATES,
    GateMilestoneRole,
    RdProjectType,
)
from apps.kuaiplm.models import (
    RdGateTemplate,
    RdGateTemplateDeliverable,
    RdGateTemplateStage,
)
from infra.models.user import User


def _npi_stage_defs() -> List[Dict[str, Any]]:
    stages = []
    for gate in DEFAULT_NPI_GATES:
        milestone = GateMilestoneRole.NONE.value
        if gate["gate_key"] == "release":
            milestone = GateMilestoneRole.SPAWN_DELIVERY.value
        stages.append({**gate, "milestone_role": milestone})
    return stages


SYSTEM_TEMPLATE_SPECS: List[Dict[str, Any]] = [
    {
        "project_type": RdProjectType.RD.value,
        "template_code": "npi_standard",
        "template_name": "NPI 标准",
        "stages": _npi_stage_defs(),
        "deliverables": DEFAULT_GATE_DELIVERABLES,
    },
    {
        "project_type": RdProjectType.DELIVERY.value,
        "template_code": "delivery_standard",
        "template_name": "交付标准",
        "stages": [{**g, "milestone_role": GateMilestoneRole.NONE.value} for g in DEFAULT_DELIVERY_GATES],
        "deliverables": DEFAULT_DELIVERY_DELIVERABLES,
    },
]


async def ensure_system_gate_templates(
    tenant_id: int,
    *,
    created_by: Optional[int] = None,
) -> None:
    """为租户补齐系统默认阶段门模板（幂等）。"""
    for spec in SYSTEM_TEMPLATE_SPECS:
        existing = await RdGateTemplate.get_or_none(
            tenant_id=tenant_id,
            project_type=spec["project_type"],
            template_code=spec["template_code"],
            deleted_at__isnull=True,
        )
        if existing:
            continue
        payload = {
            "tenant_id": tenant_id,
            "project_type": spec["project_type"],
            "template_code": spec["template_code"],
            "template_name": spec["template_name"],
            "is_default": True,
            "is_active": True,
            "notes": "系统预置模板",
        }
        user = await User.filter(id=created_by).first() if created_by else None
        apply_create_audit(payload, user)
        template = await RdGateTemplate.create(**payload)
        deliverables_map: Dict[str, List[Dict[str, str]]] = spec["deliverables"]
        for stage_def in spec["stages"]:
            stage = await RdGateTemplateStage.create(
                tenant_id=tenant_id,
                template_id=template.id,
                gate_key=stage_def["gate_key"],
                gate_name=stage_def["gate_name"],
                sort_order=stage_def["sort_order"],
                milestone_role=stage_def.get("milestone_role", GateMilestoneRole.NONE.value),
            )
            for idx, deliv in enumerate(deliverables_map.get(stage_def["gate_key"], []), start=1):
                await RdGateTemplateDeliverable.create(
                    tenant_id=tenant_id,
                    stage_id=stage.id,
                    name=deliv["name"],
                    deliverable_type=deliv.get("deliverable_type"),
                    sort_order=idx,
                )


async def load_template_gate_defs(
    tenant_id: int,
    project_type: str,
    gate_template_id: Optional[int] = None,
) -> Tuple[Optional[RdGateTemplate], List[Dict[str, Any]], Dict[str, List[Dict[str, str]]]]:
    """
    解析模板为创建项目所需的阶段与交付物定义。
    返回 (template, gate_defs, deliverables_map)。
    """
    await ensure_system_gate_templates(tenant_id)

    template: Optional[RdGateTemplate] = None
    if gate_template_id:
        template = await RdGateTemplate.get_or_none(
            tenant_id=tenant_id,
            id=gate_template_id,
            project_type=project_type,
            deleted_at__isnull=True,
        )
        if not template:
            raise ValueError(f"阶段门模板不存在: {gate_template_id}")
        if not template.is_active:
            raise ValueError("所选阶段门模板已停用，无法用于新建项目")
    else:
        template = await RdGateTemplate.get_or_none(
            tenant_id=tenant_id,
            project_type=project_type,
            is_default=True,
            is_active=True,
            deleted_at__isnull=True,
        )

    if not template:
        return None, [], {}

    stages = await RdGateTemplateStage.filter(
        tenant_id=tenant_id, template_id=template.id
    ).order_by("sort_order", "id").all()
    if not stages:
        return template, [], {}

    stage_ids = [s.id for s in stages]
    deliverables = await RdGateTemplateDeliverable.filter(
        tenant_id=tenant_id, stage_id__in=stage_ids
    ).order_by("sort_order", "id").all()
    deliv_by_stage: Dict[int, List[RdGateTemplateDeliverable]] = {}
    for d in deliverables:
        deliv_by_stage.setdefault(d.stage_id, []).append(d)

    gate_defs: List[Dict[str, Any]] = []
    deliverables_map: Dict[str, List[Dict[str, str]]] = {}
    for stage in stages:
        gate_defs.append({
            "gate_key": stage.gate_key,
            "gate_name": stage.gate_name,
            "sort_order": stage.sort_order,
            "milestone_role": stage.milestone_role or GateMilestoneRole.NONE.value,
        })
        deliverables_map[stage.gate_key] = [
            {"name": d.name, "deliverable_type": d.deliverable_type}
            for d in deliv_by_stage.get(stage.id, [])
        ]

    return template, gate_defs, deliverables_map
