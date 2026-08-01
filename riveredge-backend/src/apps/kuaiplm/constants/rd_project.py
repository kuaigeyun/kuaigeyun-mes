"""研发项目 / NPI 阶段门常量"""

from enum import Enum
from typing import List, Dict, Any


class RdProjectStatus(str, Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    ON_HOLD = "ON_HOLD"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class RdGateStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    PASSED = "PASSED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class RdTaskStatus(str, Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class RdDeliverableStatus(str, Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class RdProjectType(str, Enum):
    RD = "RD"
    DELIVERY = "DELIVERY"


class GateMilestoneRole(str, Enum):
    NONE = "none"
    SPAWN_DELIVERY = "spawn_delivery"


PROJECT_TYPE_LABELS: Dict[str, str] = {
    RdProjectType.RD.value: "研发项目",
    RdProjectType.DELIVERY.value: "交付项目",
}


class RdProjectLinkType(str, Enum):
    BOM = "bom"
    PROCESS_ROUTE = "process_route"
    DRAWING = "drawing"
    SOP = "sop"
    WORK_ORDER = "work_order"
    REQUIREMENT = "requirement"
    MATERIAL = "material"
    OTHER = "other"


PROJECT_STATUS_LABELS: Dict[str, str] = {
    RdProjectStatus.DRAFT.value: "草稿",
    RdProjectStatus.IN_PROGRESS.value: "进行中",
    RdProjectStatus.ON_HOLD.value: "暂停",
    RdProjectStatus.COMPLETED.value: "已完成",
    RdProjectStatus.CANCELLED.value: "已取消",
}

DEFAULT_NPI_GATES: List[Dict[str, Any]] = [
    {"gate_key": "concept", "gate_name": "概念阶段", "sort_order": 1},
    {"gate_key": "design", "gate_name": "设计阶段", "sort_order": 2},
    {"gate_key": "prototype", "gate_name": "样机阶段", "sort_order": 3},
    {"gate_key": "pilot", "gate_name": "试产阶段", "sort_order": 4},
    {"gate_key": "release", "gate_name": "量产发布", "sort_order": 5},
    {"gate_key": "ramp", "gate_name": "量产爬坡", "sort_order": 6},
    {"gate_key": "first_delivery", "gate_name": "首批交付", "sort_order": 7},
    {"gate_key": "stable_production", "gate_name": "稳定量产", "sort_order": 8},
    {"gate_key": "service_handover", "gate_name": "售后移交", "sort_order": 9},
]

# 各阶段门默认交付物（新建项目时预置，可删改）
DEFAULT_GATE_DELIVERABLES: Dict[str, List[Dict[str, str]]] = {
    "concept": [
        {"name": "项目立项书", "deliverable_type": "document"},
        {"name": "市场调研摘要", "deliverable_type": "document"},
    ],
    "design": [
        {"name": "EBOM 初版", "deliverable_type": "bom"},
        {"name": "图纸包", "deliverable_type": "drawing"},
        {"name": "DFM 评审纪要", "deliverable_type": "document"},
    ],
    "prototype": [
        {"name": "样机试制报告", "deliverable_type": "document"},
        {"name": "样机测试记录", "deliverable_type": "test"},
    ],
    "pilot": [
        {"name": "试产工艺路线", "deliverable_type": "process"},
        {"name": "试产质量报告", "deliverable_type": "quality"},
    ],
    "release": [
        {"name": "量产 EBOM", "deliverable_type": "bom"},
        {"name": "作业指导书包", "deliverable_type": "sop"},
        {"name": "量产移交清单", "deliverable_type": "document"},
    ],
    "ramp": [
        {"name": "量产爬坡计划", "deliverable_type": "document"},
        {"name": "产能爬坡报告", "deliverable_type": "document"},
    ],
    "first_delivery": [
        {"name": "首批出货检验记录", "deliverable_type": "quality"},
        {"name": "首批交付签收单", "deliverable_type": "document"},
    ],
    "stable_production": [
        {"name": "产能达成报告", "deliverable_type": "document"},
        {"name": "质量稳定报告", "deliverable_type": "quality"},
    ],
    "service_handover": [
        {"name": "售后移交清单", "deliverable_type": "document"},
        {"name": "备件与维保方案", "deliverable_type": "document"},
    ],
}

DEFAULT_DELIVERY_GATES: List[Dict[str, Any]] = [
    {"gate_key": "ramp", "gate_name": "量产爬坡", "sort_order": 1},
    {"gate_key": "first_delivery", "gate_name": "首批交付", "sort_order": 2},
    {"gate_key": "stable_production", "gate_name": "稳定量产", "sort_order": 3},
    {"gate_key": "service_handover", "gate_name": "售后移交", "sort_order": 4},
]

DEFAULT_DELIVERY_DELIVERABLES: Dict[str, List[Dict[str, str]]] = {
    "ramp": [
        {"name": "量产爬坡计划", "deliverable_type": "document"},
        {"name": "产能爬坡报告", "deliverable_type": "document"},
    ],
    "first_delivery": [
        {"name": "首批出货检验记录", "deliverable_type": "quality"},
        {"name": "首批交付签收单", "deliverable_type": "document"},
    ],
    "stable_production": [
        {"name": "产能达成报告", "deliverable_type": "document"},
        {"name": "质量稳定报告", "deliverable_type": "quality"},
    ],
    "service_handover": [
        {"name": "售后移交清单", "deliverable_type": "document"},
        {"name": "备件与维保方案", "deliverable_type": "document"},
    ],
}

# 下推交付项目时从研发项目复制的关联类型（不含试产工单）
SPAWN_INHERIT_LINK_TYPES = frozenset({
    RdProjectLinkType.BOM.value,
    RdProjectLinkType.PROCESS_ROUTE.value,
    RdProjectLinkType.DRAWING.value,
    RdProjectLinkType.SOP.value,
    RdProjectLinkType.MATERIAL.value,
})
