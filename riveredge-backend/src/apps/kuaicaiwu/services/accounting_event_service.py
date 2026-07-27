"""
会计事件链路服务
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
import uuid

from apps.kuaicaiwu.models.accounting_event import AccountingEvent
from core.utils.timezone_utils import resolve_business_datetime, to_site_date


class AccountingEventService:
    """记录业务事件与会计事件链路。"""

    @staticmethod
    async def record_event(
        *,
        tenant_id: int,
        event_type: str,
        business_type: str,
        source_doc_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        target_doc_type: Optional[str] = None,
        target_doc_id: Optional[int] = None,
        target_doc_code: Optional[str] = None,
        amount: Optional[Decimal] = None,
        currency: str = "CNY",
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None,
        notes: Optional[str] = None,
    ) -> AccountingEvent:
        event_code = f"AE-{uuid.uuid4().hex[:12].upper()}"
        return await AccountingEvent.create(
            tenant_id=tenant_id,
            event_code=event_code,
            event_type=event_type,
            business_type=business_type,
            source_doc_type=source_doc_type,
            source_doc_id=source_doc_id,
            source_doc_code=source_doc_code,
            target_doc_type=target_doc_type,
            target_doc_id=target_doc_id,
            target_doc_code=target_doc_code,
            amount=amount,
            currency=currency,
            event_date=to_site_date(resolve_business_datetime()),
            operator_id=operator_id,
            operator_name=operator_name,
            payload=payload,
            notes=notes,
        )
