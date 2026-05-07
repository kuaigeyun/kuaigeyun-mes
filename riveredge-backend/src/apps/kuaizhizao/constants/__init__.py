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
    CONFIRMED = "CONFIRMED"     # 已确认（销售/采购订单确认后）
    CANCELLED = "CANCELLED"
    # 工单等执行类单据
    RELEASED = "RELEASED"       # 已下达
    IN_PROGRESS = "IN_PROGRESS" # 执行中
    COMPLETED = "COMPLETED"     # 已完成
    # 采购申请转单状态
    PARTIAL_CONVERTED = "PARTIAL_CONVERTED"  # 部分转单
    FULL_CONVERTED = "FULL_CONVERTED"       # 全部转单


# 存量数据可能为中文，用于读取兼容判断
LEGACY_AUDITED_VALUES = ("AUDITED", "已审核", "审核通过", "CONFIRMED", "已确认")
LEGACY_PENDING_VALUES = ("PENDING_REVIEW", "PENDING", "待审核")
# 销售订单可下推状态：已审核、已确认、进行中
ORDER_PUSHABLE_STATUSES = LEGACY_AUDITED_VALUES + ("IN_PROGRESS", "进行中")

# 状态别名：中文/旧值 <-> 枚举，用于状态流转规则匹配与读取兼容
STATE_ALIASES: dict[str, str] = {
    "草稿": DocumentStatus.DRAFT.value,
    "待审核": DocumentStatus.PENDING_REVIEW.value,
    "已审核": DocumentStatus.AUDITED.value,
    "已驳回": DocumentStatus.REJECTED.value,
    "已取消": DocumentStatus.CANCELLED.value,
    "已确认": DocumentStatus.CONFIRMED.value,
    "已生效": "EFFECTIVE",
    "已完成": DocumentStatus.COMPLETED.value,
    "已通过": DocumentStatus.AUDITED.value,  # 采购申请审核通过
    "部分转单": DocumentStatus.PARTIAL_CONVERTED.value,
    "全部转单": DocumentStatus.FULL_CONVERTED.value,
    "draft": DocumentStatus.DRAFT.value,
    "released": DocumentStatus.RELEASED.value,
    "in_progress": DocumentStatus.IN_PROGRESS.value,
    "completed": DocumentStatus.COMPLETED.value,
    "cancelled": DocumentStatus.CANCELLED.value,
}

# review_status 别名：中文 <-> ReviewStatus 枚举
REVIEW_STATUS_ALIASES: dict[str, str] = {
    "待审核": ReviewStatus.PENDING.value,
    "审核通过": ReviewStatus.APPROVED.value,
    "审核驳回": ReviewStatus.REJECTED.value,
    "通过": ReviewStatus.APPROVED.value,
    "驳回": ReviewStatus.REJECTED.value,
    "已通过": ReviewStatus.APPROVED.value,
}

def normalize_status(status: str) -> str:
    """将中文/旧值归一化为枚举值，用于读取时的兼容判断"""
    if not status:
        return status
    return STATE_ALIASES.get(str(status).strip(), status)


def is_draft_status(status: str) -> bool:
    """判断是否为草稿状态（兼容中文与枚举）"""
    n = normalize_status(status) if status else ""
    return n == DocumentStatus.DRAFT.value


def is_pending_review_status(status: str) -> bool:
    """判断是否为待审核状态"""
    n = normalize_status(status) if status else ""
    return n == DocumentStatus.PENDING_REVIEW.value


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
