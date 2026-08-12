"""
业财集成钩子：会计事件链路 + 单据关联（供 kuaizhizao 仓库/委外/订单等触发）。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from loguru import logger

from apps.kuaicaiwu.services.accounting_event_service import AccountingEventService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date

_MONEY = Decimal("0.01")


def _q_money(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value or 0)).quantize(_MONEY)


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


async def _resolve_bank_account_for_voucher(
    tenant_id: int, bank_account_id: Optional[int]
) -> tuple[Optional[int], Optional[str], str]:
    """解析入账账户及对应收/付款方式。"""
    if not bank_account_id:
        return None, None, "其他"
    from apps.kuaicaiwu.models.bank_account import BankAccount
    from apps.kuaicaiwu.services.bank_account_service import BankAccountService

    account = await BankAccount.get_or_none(
        tenant_id=tenant_id, id=bank_account_id, deleted_at__isnull=True
    )
    if not account:
        return bank_account_id, None, "其他"
    account_type = BankAccountService.normalize_account_type(
        getattr(account, "account_type", None)
    )
    payment_method = (
        BankAccountService.resolve_payment_method_for_account_type(account_type) or "其他"
    )
    if account_type == "cash":
        return account.id, account.account_name, payment_method
    label = f"{account.bank_name or ''} {account.account_number or ''}".strip()
    return account.id, label or account.account_name, payment_method


async def _existing_order_prepayment_relation(
    tenant_id: int, source_type: str, source_id: int, target_type: str
) -> bool:
    from apps.kuaizhizao.models.document_relation import DocumentRelation

    return await DocumentRelation.filter(
        tenant_id=tenant_id,
        source_type=source_type,
        source_id=source_id,
        target_type=target_type,
    ).exists()


async def backfill_missing_purchase_order_prepayments(
    tenant_id: int, *, operator_id: int
) -> int:
    """
    补齐历史缺口：已确认采购订单填写了预付金额，但提交时未生成预付付款单。
    幂等（已有 purchase_order→payment 关联则跳过）。
    """
    from apps.kuaizhizao.constants import DocumentStatus, LEGACY_AUDITED_VALUES, normalize_status
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder

    orders = await PurchaseOrder.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        prepayment_amount__gt=0,
    ).all()
    created = 0
    for order in orders:
        raw_status = str(order.status or "").strip()
        normalized = normalize_status(raw_status)
        confirmed = (
            normalized
            in (DocumentStatus.CONFIRMED.value, DocumentStatus.AUDITED.value)
            or raw_status in LEGACY_AUDITED_VALUES
        )
        if not confirmed:
            continue
        if await _existing_order_prepayment_relation(
            tenant_id, "purchase_order", int(order.id), "payment"
        ):
            continue
        try:
            payment_id = await ensure_prepayment_payment_for_purchase_order(
                tenant_id=tenant_id,
                order_id=int(order.id),
                order_code=str(order.order_code or ""),
                supplier_id=int(order.supplier_id),
                supplier_name=str(order.supplier_name or ""),
                prepayment_amount=order.prepayment_amount,
                prepayment_bank_account_id=order.prepayment_bank_account_id,
                operator_id=operator_id,
            )
            if payment_id:
                created += 1
        except Exception as e:
            logger.warning(
                "补齐采购订单 %s 预付付款单失败: %s",
                getattr(order, "order_code", order.id),
                e,
            )
    return created


async def ensure_prepayment_payment_for_purchase_order(
    *,
    tenant_id: int,
    order_id: int,
    order_code: str,
    supplier_id: int,
    supplier_name: str,
    prepayment_amount: Optional[Decimal],
    prepayment_bank_account_id: Optional[int],
    operator_id: int,
) -> Optional[int]:
    """采购订单审核/确认后：按 prepayment_amount 自动生成预付付款单（幂等）。"""
    amount = _q_money(prepayment_amount or 0)
    if amount <= 0:
        return None

    if await _existing_order_prepayment_relation(
        tenant_id, "purchase_order", order_id, "payment"
    ):
        logger.info(
            "采购订单 %s 已存在预付付款单关联，跳过重复生成", order_code
        )
        return None

    try:
        from apps.common.base_service import AppBaseService
        from apps.kuaicaiwu.models.payment import Payment

        user_info = await AppBaseService().get_user_info(operator_id)
        bank_account_id, bank_account_label, payment_method = await _resolve_bank_account_for_voucher(
            tenant_id, prepayment_bank_account_id
        )
        if bank_account_id:
            from apps.kuaicaiwu.services.bank_account_service import BankAccountService

            await BankAccountService().validate_voucher_account(
                tenant_id,
                payment_method=payment_method,
                bank_account_id=bank_account_id,
            )
        today = today_site_str()
        count = await Payment.filter(tenant_id=tenant_id).count()
        payment_code = f"PK{today}{count + 1:04d}"
        biz_date = to_site_date(resolve_business_datetime())

        payment = await Payment.create(
            tenant_id=tenant_id,
            payment_code=payment_code,
            supplier_id=supplier_id,
            supplier_name=supplier_name,
            total_amount=amount,
            settled_amount=Decimal("0.00"),
            unsettled_amount=amount,
            payment_date=biz_date,
            payment_method=payment_method,
            bank_account=bank_account_label,
            bank_account_id=bank_account_id,
            settlement_type="prepayment",
            status="Confirmed",
            notes=f"采购订单 {order_code} 审核通过自动生成预付付款单",
            created_by=operator_id,
            created_by_name=user_info["name"],
            updated_by=operator_id,
            updated_by_name=user_info["name"],
        )

        await link_finance_document_relation(
            tenant_id=tenant_id,
            source_type="purchase_order",
            source_id=order_id,
            source_code=order_code,
            target_type="payment",
            target_id=payment.id,
            target_code=payment.payment_code,
            relation_desc="采购订单审核通过自动生成预付付款单",
            created_by=operator_id,
        )
        await record_finance_accounting_event(
            tenant_id=tenant_id,
            event_type="PURCHASE_ORDER_TO_PREPAYMENT",
            business_type="payment",
            source_doc_type="purchase_order",
            source_doc_id=order_id,
            source_doc_code=order_code,
            target_doc_type="Payment",
            target_doc_id=payment.id,
            target_doc_code=payment.payment_code,
            amount=amount,
            operator_id=operator_id,
            notes=f"采购订单 {order_code} 自动生成预付付款单",
        )
        return payment.id
    except Exception as e:
        logger.error(
            "采购订单 %s 自动生成预付付款单失败: %s", order_code, e
        )
        from infra.exceptions.exceptions import BusinessLogicError

        raise BusinessLogicError(
            f"采购订单 {order_code} 自动生成预付付款单失败: {e}"
        ) from e


async def ensure_prepayment_receipt_for_sales_order(
    *,
    tenant_id: int,
    order_id: int,
    order_code: str,
    customer_id: int,
    customer_name: str,
    prepayment_amount: Optional[Decimal],
    prepayment_bank_account_id: Optional[int],
    operator_id: int,
) -> Optional[int]:
    """销售订单审核通过后：按 prepayment_amount 自动生成预收收款单（幂等）。"""
    amount = _q_money(prepayment_amount or 0)
    if amount <= 0:
        return None

    if await _existing_order_prepayment_relation(
        tenant_id, "sales_order", order_id, "receipt"
    ):
        logger.info(
            "销售订单 %s 已存在预收收款单关联，跳过重复生成", order_code
        )
        return None

    try:
        from apps.common.base_service import AppBaseService
        from apps.kuaicaiwu.models.receipt import Receipt

        user_info = await AppBaseService().get_user_info(operator_id)
        bank_account_id, bank_account_label, payment_method = await _resolve_bank_account_for_voucher(
            tenant_id, prepayment_bank_account_id
        )
        if bank_account_id:
            from apps.kuaicaiwu.services.bank_account_service import BankAccountService

            await BankAccountService().validate_voucher_account(
                tenant_id,
                payment_method=payment_method,
                bank_account_id=bank_account_id,
            )
        today = today_site_str()
        count = await Receipt.filter(tenant_id=tenant_id).count()
        receipt_code = f"SK{today}{count + 1:04d}"
        biz_date = to_site_date(resolve_business_datetime())

        receipt = await Receipt.create(
            tenant_id=tenant_id,
            receipt_code=receipt_code,
            customer_id=customer_id,
            customer_name=customer_name,
            total_amount=amount,
            settled_amount=Decimal("0.00"),
            unsettled_amount=amount,
            receipt_date=biz_date,
            payment_method=payment_method,
            bank_account=bank_account_label,
            bank_account_id=bank_account_id,
            settlement_type="prepayment",
            status="Confirmed",
            notes=f"销售订单 {order_code} 审核通过自动生成预收收款单",
            created_by=operator_id,
            created_by_name=user_info["name"],
            updated_by=operator_id,
            updated_by_name=user_info["name"],
        )

        await link_finance_document_relation(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=order_id,
            source_code=order_code,
            target_type="receipt",
            target_id=receipt.id,
            target_code=receipt.receipt_code,
            relation_desc="销售订单审核通过自动生成预收收款单",
            created_by=operator_id,
        )
        await record_finance_accounting_event(
            tenant_id=tenant_id,
            event_type="SALES_ORDER_TO_PREPAYMENT",
            business_type="receipt",
            source_doc_type="sales_order",
            source_doc_id=order_id,
            source_doc_code=order_code,
            target_doc_type="Receipt",
            target_doc_id=receipt.id,
            target_doc_code=receipt.receipt_code,
            amount=amount,
            operator_id=operator_id,
            notes=f"销售订单 {order_code} 自动生成预收收款单",
        )
        return receipt.id
    except Exception as e:
        logger.error(
            "销售订单 %s 自动生成预收收款单失败: %s", order_code, e
        )
        from infra.exceptions.exceptions import BusinessLogicError

        raise BusinessLogicError(
            f"销售订单 {order_code} 自动生成预收收款单失败: {e}"
        ) from e
