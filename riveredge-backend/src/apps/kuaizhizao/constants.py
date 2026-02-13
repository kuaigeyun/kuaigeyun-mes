from enum import Enum

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
    """业务单据通用状态（与 DemandStatus 语义对齐，供采购订单、销售预测等使用）"""
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    AUDITED = "AUDITED"
    REJECTED = "REJECTED"
    APPROVED = "APPROVED"


# 存量数据可能为中文，用于读取兼容判断
LEGACY_AUDITED_VALUES = ("AUDITED", "已审核", "审核通过")
LEGACY_PENDING_VALUES = ("PENDING_REVIEW", "PENDING", "待审核")
