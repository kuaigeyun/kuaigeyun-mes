"""单据 capabilities enrich（报价单试点）。"""

from __future__ import annotations

from typing import Any, List, Optional, TypeVar

from infra.services.business_config_service import BusinessConfigService

from apps.kuaizhizao.services.document_action_policy.quotation import (
    derive_quotation_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.types import QuotationCapabilities

T = TypeVar("T")


async def _quotation_audit_required(tenant_id: int) -> bool:
    return await BusinessConfigService().check_audit_required(tenant_id, "quotation")


async def enrich_quotation_capabilities_on_model(
    tenant_id: int,
    quotation_model: Any,
    response: T,
    *,
    conversion_downstream_missing: bool = False,
    contract_downstream_missing: bool = False,
) -> T:
    audit_required = await _quotation_audit_required(tenant_id)
    caps = derive_quotation_capabilities(
        quotation_model,
        audit_required=audit_required,
        conversion_downstream_missing=conversion_downstream_missing,
        contract_downstream_missing=contract_downstream_missing,
    )
    if hasattr(response, "model_copy"):
        return response.model_copy(update={"capabilities": caps})
    return response


async def enrich_quotation_list_capabilities(
    tenant_id: int,
    quotations: List[Any],
    responses: List[T],
    *,
    conversion_downstream_missing_by_id: Optional[dict[int, bool]] = None,
    contract_downstream_missing_by_id: Optional[dict[int, bool]] = None,
) -> List[T]:
    audit_required = await _quotation_audit_required(tenant_id)
    missing_map = conversion_downstream_missing_by_id or {}
    contract_missing_map = contract_downstream_missing_by_id or {}
    out: List[T] = []
    for q_model, resp in zip(quotations, responses):
        qid = int(getattr(q_model, "id", 0) or 0)
        caps = derive_quotation_capabilities(
            q_model,
            audit_required=audit_required,
            conversion_downstream_missing=missing_map.get(qid, False),
            contract_downstream_missing=contract_missing_map.get(qid, False),
        )
        if hasattr(resp, "model_copy"):
            out.append(resp.model_copy(update={"capabilities": caps}))
        else:
            out.append(resp)
    return out


def get_quotation_capabilities_from_record(
    quotation: Any,
    *,
    audit_required: bool,
    conversion_downstream_missing: bool = False,
    contract_downstream_missing: bool = False,
) -> QuotationCapabilities:
    return derive_quotation_capabilities(
        quotation,
        audit_required=audit_required,
        conversion_downstream_missing=conversion_downstream_missing,
        contract_downstream_missing=contract_downstream_missing,
    )
