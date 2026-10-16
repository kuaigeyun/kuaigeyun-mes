"""B-01: 采购订单 start 失败保持 DRAFT，不得落 PENDING_REVIEW。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from infra.exceptions.exceptions import BusinessLogicError


@pytest.mark.asyncio
async def test_submit_purchase_order_keeps_draft_when_no_approval_flow():
    from apps.kuaizhizao.constants import DocumentStatus
    from apps.kuaizhizao.services.purchase_service import PurchaseService

    order = MagicMock()
    order.id = 42
    order.uuid = "u-po-42"
    order.order_code = "PO-42"
    order.supplier_id = 8
    order.supplier_name = "S"
    order.total_amount = 100
    order.status = DocumentStatus.DRAFT.value
    order.update_from_dict = MagicMock(return_value=MagicMock(save=AsyncMock()))
    order.refresh_from_db = AsyncMock()

    supplier = MagicMock()
    svc = PurchaseService()

    with (
        patch(
            "apps.kuaizhizao.services.purchase_service.PurchaseOrder.get_or_none",
            new=AsyncMock(return_value=order),
        ),
        patch(
            "apps.kuaizhizao.services.purchase_service.assert_purchase_order_capability",
        ),
        patch(
            "apps.kuaizhizao.services.purchase_service.Supplier.get_or_none",
            new=AsyncMock(return_value=supplier),
        ),
        patch(
            "apps.master_data.services.supplier_governance.assert_supplier_purchasable_for_tenant",
            new=AsyncMock(),
        ),
        patch(
            "infra.services.business_config_service.BusinessConfigService.check_audit_required",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "core.services.approval.audit_flow_guard.start_document_approval_or_raise",
            new=AsyncMock(
                side_effect=BusinessLogicError(
                    "采购订单审核已开启但未找到可用的审批流程，"
                    "请在配置中心检查 purchase_order 审批流程是否已激活"
                )
            ),
        ),
    ):
        with pytest.raises(BusinessLogicError, match="未找到可用的审批流程"):
            await svc.submit_purchase_order(tenant_id=1, order_id=42, submitted_by=7)

    order.update_from_dict.assert_not_called()
    assert order.status == DocumentStatus.DRAFT.value


@pytest.mark.asyncio
async def test_withdraw_purchase_order_uses_business_config_service():
    """撤回提交须能读审核开关；PurchaseService 须挂 business_config_service。"""
    from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
    from apps.kuaizhizao.services.purchase_service import PurchaseService

    order = MagicMock()
    order.id = 42
    order.status = DocumentStatus.PENDING_REVIEW.value
    order.update_from_dict = MagicMock(return_value=MagicMock(save=AsyncMock()))

    svc = PurchaseService()
    assert hasattr(svc, "business_config_service")

    with (
        patch(
            "apps.kuaizhizao.services.purchase_service.PurchaseOrder.get_or_none",
            new=AsyncMock(return_value=order),
        ),
        patch(
            "apps.kuaizhizao.services.purchase_service.assert_purchase_order_capability",
        ),
        patch.object(
            svc.business_config_service,
            "check_audit_required",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "core.services.approval.approval_instance_service.ApprovalInstanceService.cancel_approval",
            new=AsyncMock(),
        ),
        patch.object(
            svc,
            "get_purchase_order_by_id",
            new=AsyncMock(return_value={"id": 42, "status": DocumentStatus.DRAFT.value}),
        ),
    ):
        result = await svc.withdraw_purchase_order(tenant_id=1, order_id=42, withdrawn_by=7)

    order.update_from_dict.assert_called_once()
    payload = order.update_from_dict.call_args[0][0]
    assert payload["status"] == DocumentStatus.DRAFT.value
    assert payload["review_status"] == ReviewStatus.PENDING.value
    assert result["id"] == 42
