from enum import Enum
from typing import Tuple

class DemandStatus(str, Enum):
    """需求状态"""
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    AUDITED = "AUDITED"
    REJECTED = "REJECTED"
    CONFIRMED = "CONFIRMED"

class ReviewStatus(str, Enum):
    """审核状态"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DocumentStatus(str, Enum):
    """
    业务单据通用状态（与 DemandStatus 语义对齐，供采购订单、销售预测等使用）
    扩展执行类单据状态：RELEASED/IN_PROGRESS/COMPLETED
    """
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    AUDITED = "AUDITED"
    REJECTED = "REJECTED"
    APPROVED = "APPROVED"
    CANCELLED = "CANCELLED"
    # 工单等执行类单据
    RELEASED = "RELEASED"       # 已下达
    IN_PROGRESS = "IN_PROGRESS" # 执行中
    COMPLETED = "COMPLETED"     # 已完成


# 存量数据可能为中文，用于读取兼容判断
LEGACY_AUDITED_VALUES = ("AUDITED", "已审核", "审核通过")
LEGACY_PENDING_VALUES = ("PENDING_REVIEW", "PENDING", "待审核")

# 状态别名：中文 <-> 枚举，用于状态流转规则匹配
STATE_ALIASES: dict[str, str] = {
    "草稿": DocumentStatus.DRAFT.value,
    "待审核": DocumentStatus.PENDING_REVIEW.value,
    "已审核": DocumentStatus.AUDITED.value,
    "已驳回": DocumentStatus.REJECTED.value,
    "已取消": DocumentStatus.CANCELLED.value,
    "已生效": "EFFECTIVE",
    "已完成": DocumentStatus.COMPLETED.value,
    "draft": DocumentStatus.DRAFT.value,
    "released": DocumentStatus.RELEASED.value,
    "in_progress": DocumentStatus.IN_PROGRESS.value,
    "completed": DocumentStatus.COMPLETED.value,
    "cancelled": DocumentStatus.CANCELLED.value,
}

# 支持状态流转的单据类型（用于扩展 StateTransitionRule）
DOCUMENT_ENTITY_TYPES: Tuple[str, ...] = (
    "demand",
    "sales_order",
    "sales_forecast",
    "work_order",
    "purchase_order",
    "purchase_requisition",
    "demand_computation",
    "production_plan",
)
