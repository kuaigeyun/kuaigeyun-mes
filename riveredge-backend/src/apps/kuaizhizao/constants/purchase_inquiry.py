"""采购询价单状态常量"""

from enum import Enum


class PurchaseInquiryStatus(str, Enum):
    DRAFT = "DRAFT"
    QUOTING = "QUOTING"
    PENDING_COMPARE = "PENDING_COMPARE"
    AWARDED = "AWARDED"
    CONVERTED = "CONVERTED"
    CANCELLED = "CANCELLED"


class PurchaseInquiryVendorStatus(str, Enum):
    INVITED = "INVITED"
    QUOTED = "QUOTED"
    DECLINED = "DECLINED"
    NO_RESPONSE = "NO_RESPONSE"


class PurchaseSupplierQuoteStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"


class PurchaseSupplierQuoteChannel(str, Enum):
    INTERNAL = "internal"
    PORTAL = "portal"


# 中文展示别名（与 DocumentStatus 风格对齐）
INQUIRY_STATUS_LABELS = {
    PurchaseInquiryStatus.DRAFT.value: "草稿",
    PurchaseInquiryStatus.QUOTING.value: "询价中",
    PurchaseInquiryStatus.PENDING_COMPARE.value: "待比价",
    PurchaseInquiryStatus.AWARDED.value: "已定标",
    PurchaseInquiryStatus.CONVERTED.value: "已转单",
    PurchaseInquiryStatus.CANCELLED.value: "已取消",
}

# 询价进行中：PR 行不可重复直转 PO
INQUIRY_ACTIVE_STATUSES = frozenset({
    PurchaseInquiryStatus.DRAFT.value,
    PurchaseInquiryStatus.QUOTING.value,
    PurchaseInquiryStatus.PENDING_COMPARE.value,
    PurchaseInquiryStatus.AWARDED.value,
    "草稿",
    "询价中",
    "待比价",
    "已定标",
})
