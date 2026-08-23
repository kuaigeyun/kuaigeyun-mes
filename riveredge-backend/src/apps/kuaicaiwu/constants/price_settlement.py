"""月结定价常量"""

from enum import Enum


class PriceSettlementStatus(str, Enum):
    PROVISIONAL = "PROVISIONAL"
    SETTLED = "SETTLED"


class PriceSettlementSide(str, Enum):
    SALES = "sales"
    PURCHASE = "purchase"


class PriceSettlementBatchStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    APPLIED = "applied"
    CANCELLED = "cancelled"


class PriceSettlementPriceSource(str, Enum):
    MANUAL = "manual"
    PARTNER_BOOK = "partner_book"
    MARKET = "market"
    HISTORY = "history"


MONTHLY_SETTLEMENT_METHOD_CODES = frozenset({"monthly", "月结"})
