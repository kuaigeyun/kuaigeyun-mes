import sys
import types
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.api.finance import (
    invoices,
    payables,
    payments,
    purchase_invoices,
    receipts,
    receivables,
    sales_invoices,
)
from apps.kuaicaiwu.api import finance_settlement
from apps.kuaicaiwu.api.cost import (
    cost_calculations,
    cost_comparison,
    cost_optimization,
    cost_report,
    cost_rules,
    outsource_cost,
    production_cost,
    purchase_cost,
    quality_cost,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError


@pytest.mark.unit
@pytest.mark.asyncio
async def test_invoices_api_create_should_map_validation_error_to_422_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad invoice payload")

    monkeypatch.setattr(invoices.invoice_service, "create_invoice", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await invoices.create_invoice(
            data=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad invoice payload"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_invoices_api_approve_should_map_business_error_to_400_with_trace_id(monkeypatch):
    async def _raise_business_error(*args, **kwargs):
        raise BusinessLogicError("invoice status invalid")

    monkeypatch.setattr(purchase_invoices.invoice_service, "approve_invoice", _raise_business_error)

    with pytest.raises(HTTPException) as exc:
        await purchase_invoices.approve_purchase_invoice(
            id=1,
            rejection_reason=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "invoice status invalid"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_receivables_api_get_should_map_not_found_to_404_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("receivable not found")

    monkeypatch.setattr(receivables.receivable_service, "get_receivable_by_id", _raise_not_found)

    with pytest.raises(HTTPException) as exc:
        await receivables.get_receivable(id=1, tenant_id=1)

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "receivable not found" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_payables_api_record_payment_should_map_business_error_to_400_with_trace_id(monkeypatch):
    async def _raise_business_error(*args, **kwargs):
        raise BusinessLogicError("payable can not record payment")

    monkeypatch.setattr(payables.payable_service, "record_payment", _raise_business_error)

    with pytest.raises(HTTPException) as exc:
        await payables.record_payment(
            id=1,
            data=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "payable can not record payment"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_invoices_api_update_should_map_status_error_to_400_with_trace_id(monkeypatch):
    async def _audited_invoice(*args, **kwargs):
        return SimpleNamespace(status="已审核")

    monkeypatch.setattr(sales_invoices, "_get_or_404", _audited_invoice)

    with pytest.raises(HTTPException) as exc:
        await sales_invoices.update_sales_invoice(
            id=1,
            data=SimpleNamespace(
                invoice_number=None,
                invoice_date=None,
                invoice_type=None,
                tax_rate=None,
                invoice_amount=None,
                tax_amount=None,
                total_amount=None,
                notes=None,
            ),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "已审核的发票不能修改"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_payments_api_confirm_should_map_status_error_to_400_with_trace_id(monkeypatch):
    async def _non_draft_payment(*args, **kwargs):
        return SimpleNamespace(status="Confirmed")

    monkeypatch.setattr(payments, "_get_or_404", _non_draft_payment)

    with pytest.raises(HTTPException) as exc:
        await payments.confirm_payment(
            id=1,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "只有草稿状态的付款单可以确认"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_receipts_api_delete_should_map_status_error_to_400_with_trace_id(monkeypatch):
    async def _confirmed_receipt(*args, **kwargs):
        return SimpleNamespace(status="Confirmed")

    monkeypatch.setattr(receipts, "_get_or_404", _confirmed_receipt)

    with pytest.raises(HTTPException) as exc:
        await receipts.delete_receipt(
            id=1,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "已确认的收款单不能删除"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finance_settlement_api_should_map_invalid_doc_type_to_422_with_trace_id():
    with pytest.raises(HTTPException) as exc:
        await finance_settlement.revaluate_period_end(
            period="2026-03",
            currency="USD",
            book_rate=1,
            period_end_rate=1,
            doc_type="invalid",
            current_user=SimpleNamespace(id=1, tenant_id=1),
        )

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "doc_type 必须为 all/receivable/payable"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cost_calculations_api_period_summary_should_map_internal_error_to_500_with_trace_id(monkeypatch):
    async def _raise_runtime_error(*args, **kwargs):
        raise RuntimeError("summary failed")

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.CostCalculationService.get_period_summary",
        _raise_runtime_error,
    )

    with pytest.raises(HTTPException) as exc:
        await cost_calculations.get_period_summary(
            year=2026,
            month=3,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 500
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "summary failed"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cost_rules_api_create_should_map_validation_error_to_422_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("invalid cost rule")

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.CostRuleService.create_cost_rule",
        _raise_validation_error,
    )

    with pytest.raises(HTTPException) as exc:
        await cost_rules.create_cost_rule(
            data=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "invalid cost rule"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_production_cost_api_should_map_validation_error_to_422_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad production cost request")

    monkeypatch.setattr(
        "apps.kuaizhizao.services.production_cost_service.ProductionCostService.calculate_production_cost",
        _raise_validation_error,
    )

    with pytest.raises(HTTPException) as exc:
        await production_cost.calculate_production_cost(
            data=SimpleNamespace(
                material_id=1,
                quantity=1,
                variant_attributes=None,
                calculation_date=None,
            ),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad production cost request"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cost_comparison_api_should_map_validation_error_to_422_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad comparison request")

    monkeypatch.setattr(
        "apps.kuaizhizao.services.cost_comparison_service.CostComparisonService.compare_costs_by_source_type",
        _raise_validation_error,
    )

    with pytest.raises(HTTPException) as exc:
        await cost_comparison.compare_costs_by_source_type(
            data=SimpleNamespace(material_ids=[1], calculation_date=None),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad comparison request"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cost_report_api_should_map_invalid_report_type_to_422_with_trace_id():
    with pytest.raises(HTTPException) as exc:
        await cost_report.generate_cost_report(
            data=SimpleNamespace(
                report_type="invalid",
                start_date=None,
                end_date=None,
                material_id=None,
                source_type=None,
                group_by=None,
            ),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "report_type必须是trend、structure或comprehensive之一"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cost_optimization_api_should_map_missing_material_id_to_422_with_trace_id():
    with pytest.raises(HTTPException) as exc:
        await cost_optimization.generate_optimization_suggestions_single(
            data=SimpleNamespace(material_id=None),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "单个物料分析时必须提供material_id"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_quality_cost_api_should_map_business_error_to_400_with_trace_id(monkeypatch):
    async def _raise_business_error(*args, **kwargs):
        raise BusinessLogicError("quality business blocked")

    monkeypatch.setattr(
        "apps.kuaizhizao.services.quality_cost_service.QualityCostService.calculate_quality_cost",
        _raise_business_error,
    )

    with pytest.raises(HTTPException) as exc:
        await quality_cost.calculate_quality_cost(
            data=SimpleNamespace(
                start_date=None,
                end_date=None,
                material_id=None,
                work_order_id=None,
                calculation_date=None,
            ),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "quality business blocked"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_cost_api_should_map_not_found_to_404_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("purchase source not found")

    monkeypatch.setattr(
        "apps.kuaizhizao.services.purchase_cost_service.PurchaseCostService.calculate_purchase_cost",
        _raise_not_found,
    )

    with pytest.raises(HTTPException) as exc:
        await purchase_cost.calculate_purchase_cost(
            data=SimpleNamespace(
                material_id=1,
                purchase_order_id=None,
                purchase_order_item_id=None,
                quantity=1,
                calculation_date=None,
            ),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "purchase source not found" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_outsource_cost_api_should_map_not_found_to_404_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("outsource source not found")

    monkeypatch.setattr(
        "apps.kuaizhizao.services.outsource_cost_service.OutsourceCostService.calculate_outsource_cost",
        _raise_not_found,
    )

    with pytest.raises(HTTPException) as exc:
        await outsource_cost.calculate_outsource_cost(
            data=SimpleNamespace(
                material_id=1,
                outsource_work_order_id=None,
                quantity=1,
                calculation_date=None,
            ),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "outsource source not found" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")
