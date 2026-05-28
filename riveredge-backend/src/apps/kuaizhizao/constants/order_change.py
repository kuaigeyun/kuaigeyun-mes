"""订单变更单常量"""

from enum import Enum


class OrderChangeCategory(str, Enum):
    QUANTITY = "QUANTITY"
    DELIVERY = "DELIVERY"
    PRICE = "PRICE"
    CANCEL = "CANCEL"
    MIXED = "MIXED"
    OTHER = "OTHER"


class OrderChangeLineType(str, Enum):
    QUANTITY = "QUANTITY"
    DELIVERY_DATE = "DELIVERY_DATE"
    UNIT_PRICE = "UNIT_PRICE"
    LINE_CANCEL = "LINE_CANCEL"
    LINE_ADD = "LINE_ADD"
    HEADER = "HEADER"


class OrderChangeApplyStatus(str, Enum):
    """变更单生效状态（与 status/review 配合）"""
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    AUDITED = "AUDITED"
    REJECTED = "REJECTED"
    APPLIED = "APPLIED"
    WITHDRAWN = "WITHDRAWN"
