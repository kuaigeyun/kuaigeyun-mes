"""
业财集成钩子：会计事件链路 + 单据关联（供 kuaizhizao 仓库/委外等触发）。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from loguru import logger

from apps.kuaicaiwu.services.accounting_event_service import AccountingEventService


async def record_finance_accounting_event(
    *,
    tenant_id: int,
    event_type: str,
    business_type: str,
    source_doc_type: str,
    source_doc_id: int,
    source_doc_code: Optional[str],
    target_doc_type: str,
    target_doc_id: int,
    target_doc_code: Optional[str],
    amount: Optional[Decimal] = None,
    operator_id: Optional[int] = None,
    operator_name: Optional[str] = None,
    notes: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
) -> None:
    try:
        await AccountingEventService.record_event(
            tenant_id=tenant_id,
            event_type=event_type,
            business_type=business_type,
            source_doc_type=source_doc_type,
            source_doc_id=source_doc_id,
            source_doc_code=source_doc_code,
            target_doc_type=target_doc_type,
            target_doc_id=target_doc_id,
            target_doc_code=target_doc_code,
            amount=amount,
            operator_id=operator_id,
            operator_name=operator_name,
            notes=notes,
            payload=payload,
        )
    except Exception as e:
        logger.error(
            "记录会计事件失败 %s→%s (source=%s#%s target=%s#%s): %s",
            source_doc_type,
            target_doc_type,
            source_doc_type,
            source_doc_id,
            target_doc_type,
            target_doc_id,
            e,
        )


async def link_finance_document_relation(
    *,
    tenant_id: int,
    source_type: str,
    source_id: int,
    source_code: Optional[str],
    target_type: str,
    target_id: int,
    target_code: Optional[str],
    relation_desc: str,
    created_by: int,
) -> None:
    try:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        rel_svc = DocumentRelationNewService()
        await rel_svc.create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type=source_type,
                source_id=source_id,
                source_code=source_code,
                source_name=None,
                target_type=target_type,
                target_id=target_id,
                target_code=target_code,
                target_name=None,
                relation_type="source",
                relation_mode="push",
                relation_desc=relation_desc,
            ),
            created_by=created_by,
        )
    except Exception as e:
        logger.error(
            "创建单据关联失败 %s→%s (source=%s#%s target=%s#%s): %s",
            source_type,
            target_type,
            source_type,
            source_id,
            target_type,
            target_id,
            e,
        )
