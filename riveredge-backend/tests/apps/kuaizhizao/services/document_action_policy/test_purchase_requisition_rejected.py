"""采购申请驳回后 capabilities。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.document_action_policy.purchase_requisition import (
    derive_purchase_requisition_capabilities,
)


def test_rejected_requisition_allows_update_and_submit():
    req = SimpleNamespace(status="已驳回")
    caps = derive_purchase_requisition_capabilities(req)
    assert caps.update.allowed is True
    assert caps.submit.allowed is True
