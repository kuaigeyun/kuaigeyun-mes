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
