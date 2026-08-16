"""快财务 AR/AP 等单据列表：keyword、日期区间、排序。"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta
from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.master_data.services.master_data_list_core import (
    apply_master_crud_created_date_range,
    apply_master_crud_updated_date_range,
)
from core.utils.timezone_utils import resolve_business_datetime, to_site_date

FINANCE_AGING_BUCKETS = frozenset({"within_30", "31_60", "61_90", "over_90"})


def apply_finance_aging_list_filters(
    query,
    *,
    aging_bucket: Optional[str] = None,
    overdue_only: bool = False,
):
    """按账龄区间或逾期筛选 AR/AP 列表（与 get_*_aging_analysis 口径一致）。"""
    bucket = str(aging_bucket).strip() if aging_bucket else None
    if bucket and bucket not in FINANCE_AGING_BUCKETS:
        bucket = None
    if not bucket and not overdue_only:
        return query

    query = query.filter(remaining_amount__gt=0)
    today = to_site_date(resolve_business_datetime())

    if overdue_only:
        query = query.filter(due_date__lt=today)

    if bucket == "within_30":
        query = query.filter(due_date__gte=today - timedelta(days=30))
    elif bucket == "31_60":
        query = query.filter(
            due_date__gte=today - timedelta(days=60),
            due_date__lte=today - timedelta(days=31),
        )
    elif bucket == "61_90":
        query = query.filter(
            due_date__gte=today - timedelta(days=90),
            due_date__lte=today - timedelta(days=61),
        )
    elif bucket == "over_90":
        query = query.filter(due_date__lte=today - timedelta(days=91))

    return query


FINANCE_AR_AP_SORT_DB_COLS = frozenset({
    "receivable_code",
    "payable_code",
    "customer_name",
    "supplier_name",
    "source_code",
    "total_amount",
    "received_amount",
    "paid_amount",
    "remaining_amount",
    "due_date",
    "business_date",
    "status",
    "review_status",
    "created_at",
    "updated_at",
})


def _parse_optional_api_date(value: Optional[str]) -> Optional[date]:
    if value is None or not str(value).strip():
        return None
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        return None


def apply_finance_doc_date_range(
    query,
    field: str,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    start = _parse_optional_api_date(start_date)
    end = _parse_optional_api_date(end_date)
    if start is not None:
        query = query.filter(**{f"{field}__gte": start})
    if end is not None:
        query = query.filter(**{f"{field}__lte": end})
    return query


def apply_finance_ar_ap_search_filters(
    query,
    *,
    doc_code_field: str,
    partner_name_field: str,
    keyword: Optional[str] = None,
    doc_code: Optional[str] = None,
    partner_name: Optional[str] = None,
    keyword_fields: Optional[List[str]] = None,
):
    fields = keyword_fields or [doc_code_field, partner_name_field, "source_code"]
    kw = (keyword or "").strip()
    if kw:
        cond = Q()
        for field in fields:
            cond |= Q(**{f"{field}__icontains": kw})
        return query.filter(cond)
    if doc_code and str(doc_code).strip():
        query = query.filter(**{f"{doc_code_field}__icontains": str(doc_code).strip()})
    if partner_name and str(partner_name).strip():
        query = query.filter(**{f"{partner_name_field}__icontains": str(partner_name).strip()})
    return query


def resolve_finance_ar_ap_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    default_col: str = "created_at",
) -> str:
    key = (sort_field or "").strip()
    col = key if key in FINANCE_AR_AP_SORT_DB_COLS else default_col
    if (sort_order or "desc").lower() == "desc":
        return f"-{col}"
    return col


FINANCE_VOUCHER_SORT_DB_COLS = frozenset({
    "receipt_code",
    "payment_code",
    "customer_name",
    "supplier_name",
    "total_amount",
    "settled_amount",
    "unsettled_amount",
    "receipt_date",
    "payment_date",
    "payment_method",
    "status",
    "settlement_type",
    "created_at",
    "updated_at",
})


def resolve_finance_voucher_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    default_col: str = "created_at",
) -> str:
    key = (sort_field or "").strip()
    col = key if key in FINANCE_VOUCHER_SORT_DB_COLS else default_col
    if (sort_order or "desc").lower() == "desc":
        return f"-{col}"
    return col


def apply_finance_voucher_list_filters(
    query,
    *,
    doc_code_field: str,
    partner_name_field: str,
    doc_date_field: str,
    keyword: Optional[str] = None,
    doc_code: Optional[str] = None,
    partner_name: Optional[str] = None,
    doc_date_start: Optional[str] = None,
    doc_date_end: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    query = apply_finance_ar_ap_search_filters(
        query,
        doc_code_field=doc_code_field,
        partner_name_field=partner_name_field,
        keyword=keyword,
        doc_code=doc_code,
        partner_name=partner_name,
        keyword_fields=[doc_code_field, partner_name_field],
    )
    query = apply_finance_doc_date_range(
        query,
        doc_date_field,
        start_date=doc_date_start,
        end_date=doc_date_end,
    )
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = resolve_finance_voucher_order_clause(
        sort_field,
        sort_order,
        default_col=default_sort_col,
    )
    return query, order_expr


FINANCE_INVOICE_SORT_DB_COLS = frozenset({
    "invoice_code",
    "invoice_number",
    "partner_name",
    "customer_name",
    "supplier_name",
    "source_document_code",
    "purchase_order_code",
    "invoice_date",
    "amount_excluding_tax",
    "invoice_amount",
    "tax_amount",
    "total_amount",
    "tax_rate",
    "status",
    "review_status",
    "created_at",
    "updated_at",
})

FINANCE_INVOICE_SORT_FIELD_ALIASES = {
    "customer_name": "partner_name",
    "invoice_amount": "amount_excluding_tax",
}


def apply_sales_invoice_review_status_filter(query, review_status: Optional[str]):
    rs = (review_status or "").strip()
    if not rs:
        return query
    if rs == "待审核":
        return query.filter(status__in=["未审核", "DRAFT"])
    if rs == "已审核":
        return query.filter(status__in=["已审核", "已开票"])
    if rs == "已驳回":
        return query.filter(status="已驳回")
    if rs == "已作废":
        return query.filter(status="已作废")
    if rs == "已红冲":
        return query.filter(status="已红冲")
    return query.filter(status=rs)


def resolve_finance_invoice_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    default_col: str = "invoice_date",
) -> str:
    key = (sort_field or "").strip()
    col = FINANCE_INVOICE_SORT_FIELD_ALIASES.get(key, key)
    if col not in FINANCE_INVOICE_SORT_DB_COLS:
        col = default_col
    if (sort_order or "desc").lower() == "desc":
        return f"-{col}"
    return col


def apply_finance_invoice_list_filters(
    query,
    *,
    doc_code_field: str,
    partner_name_field: str,
    doc_date_field: str = "invoice_date",
    keyword: Optional[str] = None,
    doc_code: Optional[str] = None,
    partner_name: Optional[str] = None,
    invoice_number: Optional[str] = None,
    keyword_fields: Optional[List[str]] = None,
    review_status: Optional[str] = None,
    review_status_mode: str = "column",
    doc_date_start: Optional[str] = None,
    doc_date_end: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    fields = keyword_fields or [doc_code_field, partner_name_field, "invoice_number"]
    query = apply_finance_ar_ap_search_filters(
        query,
        doc_code_field=doc_code_field,
        partner_name_field=partner_name_field,
        keyword=keyword,
        doc_code=doc_code,
        partner_name=partner_name,
        keyword_fields=fields,
    )
    if invoice_number and str(invoice_number).strip():
        query = query.filter(invoice_number__icontains=str(invoice_number).strip())
    if review_status and str(review_status).strip():
        if review_status_mode == "sales_status":
            query = apply_sales_invoice_review_status_filter(query, review_status)
        else:
            query = query.filter(review_status=str(review_status).strip())
    query = apply_finance_doc_date_range(
        query,
        doc_date_field,
        start_date=doc_date_start,
        end_date=doc_date_end,
    )
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = resolve_finance_invoice_order_clause(
        sort_field,
        sort_order,
        default_col=default_sort_col,
    )
    return query, order_expr


FINANCE_PARTNER_STATEMENT_SORT_DB_COLS = frozenset({
    "statement_code",
    "partner_name",
    "statement_period",
    "opening_balance",
    "debit_total",
    "credit_total",
    "closing_balance",
    "status",
    "start_date",
    "end_date",
    "created_at",
    "updated_at",
})


def resolve_finance_partner_statement_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    default_col: str = "created_at",
) -> str:
    key = (sort_field or "").strip()
    col = key if key in FINANCE_PARTNER_STATEMENT_SORT_DB_COLS else default_col
    if (sort_order or "desc").lower() == "desc":
        return f"-{col}"
    return col


def apply_finance_partner_statement_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    statement_code: Optional[str] = None,
    partner_name: Optional[str] = None,
    statement_period: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    kw = (keyword or "").strip()
    if kw:
        cond = Q()
        for field in ("statement_code", "partner_name"):
            cond |= Q(**{f"{field}__icontains": kw})
        query = query.filter(cond)
    else:
        if statement_code and str(statement_code).strip():
            query = query.filter(statement_code__icontains=str(statement_code).strip())
        if partner_name and str(partner_name).strip():
            query = query.filter(partner_name__icontains=str(partner_name).strip())
    if statement_period and str(statement_period).strip():
        query = query.filter(statement_period=str(statement_period).strip())
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = resolve_finance_partner_statement_order_clause(
        sort_field,
        sort_order,
        default_col=default_sort_col,
    )
    return query, order_expr


def apply_finance_ar_ap_list_filters(
    query,
    *,
    doc_code_field: str,
    partner_name_field: str,
    keyword: Optional[str] = None,
    doc_code: Optional[str] = None,
    partner_name: Optional[str] = None,
    keyword_fields: Optional[List[str]] = None,
    review_status: Optional[str] = None,
    business_date_start: Optional[str] = None,
    business_date_end: Optional[str] = None,
    due_date_start: Optional[str] = None,
    due_date_end: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    query = apply_finance_ar_ap_search_filters(
        query,
        doc_code_field=doc_code_field,
        partner_name_field=partner_name_field,
        keyword=keyword,
        doc_code=doc_code,
        partner_name=partner_name,
        keyword_fields=keyword_fields,
    )
    if review_status and str(review_status).strip():
        query = query.filter(review_status=str(review_status).strip())
    query = apply_finance_doc_date_range(
        query,
        "business_date",
        start_date=business_date_start,
        end_date=business_date_end,
    )
    query = apply_finance_doc_date_range(
        query,
        "due_date",
        start_date=due_date_start,
        end_date=due_date_end,
    )
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = resolve_finance_ar_ap_order_clause(
        sort_field,
        sort_order,
        default_col=default_sort_col,
    )
    return query, order_expr


FINANCE_BANK_ACCOUNT_KEYWORD_FIELDS = (
    "account_code",
    "account_name",
    "bank_name",
    "account_number",
)

FINANCE_BANK_ACCOUNT_SORT_DB_COLS = frozenset({
    "account_code",
    "account_name",
    "bank_name",
    "account_number",
    "currency",
    "current_balance",
    "opening_balance",
    "is_active",
    "created_at",
    "updated_at",
})


def resolve_finance_bank_account_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    default_col: str = "account_code",
) -> str:
    key = (sort_field or "").strip()
    col = key if key in FINANCE_BANK_ACCOUNT_SORT_DB_COLS else default_col
    if (sort_order or "asc").lower() == "desc":
        return f"-{col}"
    return col


def apply_finance_bank_account_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    account_code: Optional[str] = None,
    account_name: Optional[str] = None,
    bank_name: Optional[str] = None,
    account_number: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    kw = (keyword or "").strip()
    if kw:
        cond = Q()
        for field in FINANCE_BANK_ACCOUNT_KEYWORD_FIELDS:
            cond |= Q(**{f"{field}__icontains": kw})
        query = query.filter(cond)
    else:
        if account_code and str(account_code).strip():
            query = query.filter(account_code__icontains=str(account_code).strip())
        if account_name and str(account_name).strip():
            query = query.filter(account_name__icontains=str(account_name).strip())
        if bank_name and str(bank_name).strip():
            query = query.filter(bank_name__icontains=str(bank_name).strip())
        if account_number and str(account_number).strip():
            query = query.filter(account_number__icontains=str(account_number).strip())
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = resolve_finance_bank_account_order_clause(
        sort_field,
        sort_order,
        default_col=default_sort_col,
    )
    return query, order_expr


FINANCE_GAP_ITEM_SORT_FIELDS = frozenset({
    "doc_type",
    "doc_code",
    "quantity",
    "pushed_quantity",
    "max_push_quantity",
    "amount",
    "finance_related_count",
})


def filter_sort_paginate_finance_gap_items(
    items: List[dict],
    *,
    keyword: Optional[str] = None,
    doc_type: Optional[str] = None,
    doc_code: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[dict], int]:
    filtered = list(items)
    kw = (keyword or "").strip().lower()
    if kw:
        filtered = [
            row
            for row in filtered
            if kw
            in "\n".join(
                str(row.get(key) or "")
                for key in (
                    "doc_type",
                    "doc_code",
                    "settlement_type",
                    "gap_reason",
                    "amount",
                    "quantity",
                    "pushed_quantity",
                    "max_push_quantity",
                    "remaining_amount",
                    "unsettled_amount",
                )
            ).lower()
        ]
    if doc_type and str(doc_type).strip():
        dt = str(doc_type).strip()
        filtered = [row for row in filtered if str(row.get("doc_type") or "") == dt]
    if doc_code and str(doc_code).strip():
        code_kw = str(doc_code).strip().lower()
        filtered = [
            row
            for row in filtered
            if code_kw in str(row.get("doc_code") or "").lower()
        ]

    key = (sort_field or "doc_code").strip()
    if key not in FINANCE_GAP_ITEM_SORT_FIELDS:
        key = "doc_code"
    reverse = (sort_order or "asc").lower() == "desc"

    def _sort_value(row: dict):
        val = row.get(key)
        if isinstance(val, (int, float)):
            return val
        if isinstance(val, date):
            return val.isoformat()
        return str(val or "")

    filtered.sort(key=_sort_value, reverse=reverse)
    total = len(filtered)
    start = max(skip, 0)
    end = start + max(limit, 1)
    return filtered[start:end], total


FINANCE_BANK_TRANSACTION_SORT_FIELDS = frozenset({
    "transaction_date",
    "direction",
    "amount",
    "balance_after",
    "source_doc_code",
    "summary",
    "created_at",
})


def apply_finance_bank_transaction_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    source_doc_code: Optional[str] = None,
    direction: Optional[str] = None,
    transaction_date_start: Optional[str] = None,
    transaction_date_end: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    kw = (keyword or "").strip()
    if kw:
        cond = Q(source_doc_code__icontains=kw) | Q(summary__icontains=kw)
        query = query.filter(cond)
    elif source_doc_code and str(source_doc_code).strip():
        query = query.filter(source_doc_code__icontains=str(source_doc_code).strip())
    if direction and str(direction).strip():
        query = query.filter(direction=str(direction).strip())
    if transaction_date_start:
        try:
            start = date.fromisoformat(str(transaction_date_start).strip()[:10])
            query = query.filter(transaction_date__gte=start)
        except ValueError:
            pass
    if transaction_date_end:
        try:
            end = date.fromisoformat(str(transaction_date_end).strip()[:10])
            query = query.filter(transaction_date__lte=end)
        except ValueError:
            pass
    key = (sort_field or "").strip()
    col = key if key in FINANCE_BANK_TRANSACTION_SORT_FIELDS else default_sort_col
    if (sort_order or "desc").lower() == "desc":
        order_expr = f"-{col}"
    else:
        order_expr = col
    return query, order_expr


PREPAYMENT_BALANCE_SORT_FIELDS = frozenset({
    "partner_name",
    "prepayment_balance",
    "receipt_count",
    "payment_count",
})


def filter_sort_paginate_prepayment_balance_items(
    items: List[dict],
    *,
    keyword: Optional[str] = None,
    partner_name: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[dict], int]:
    filtered = list(items)
    kw = (keyword or "").strip().lower()
    if kw:
        filtered = [
            row
            for row in filtered
            if kw
            in "\n".join(
                str(row.get(key) or "")
                for key in ("partner_name", "prepayment_balance", "receipt_count", "payment_count")
            ).lower()
        ]
    if partner_name and str(partner_name).strip():
        name_kw = str(partner_name).strip().lower()
        filtered = [
            row
            for row in filtered
            if name_kw in str(row.get("partner_name") or "").lower()
        ]

    key = (sort_field or "prepayment_balance").strip()
    if key not in PREPAYMENT_BALANCE_SORT_FIELDS:
        key = "prepayment_balance"
    reverse = (sort_order or "desc").lower() == "desc"

    def _sort_value(row: dict):
        val = row.get(key)
        if isinstance(val, (int, float)):
            return val
        return str(val or "")

    filtered.sort(key=_sort_value, reverse=reverse)
    total = len(filtered)
    start = max(skip, 0)
    end = start + max(limit, 1)
    return filtered[start:end], total
