"""制造协同申请服务。"""

from __future__ import annotations

from typing import Any, Callable, Optional

from tortoise.models import Model

from apps.kuaioa.models.collaboration import (
    KuaioaConcessionRequest,
    KuaioaProcessDeviation,
    KuaioaSpecialPriceRequest,
)
from apps.kuaioa.schemas.collaboration import (
    ConcessionRequestCreate,
    ConcessionRequestUpdate,
    ProcessDeviationCreate,
    ProcessDeviationUpdate,
    SpecialPriceRequestCreate,
    SpecialPriceRequestUpdate,
)
from apps.kuaioa.services.kuaioa_approval_doc_service import (
    KuaioaApprovalDocConfig,
    KuaioaApprovalDocService,
    apply_approval_decision,
    parse_business_datetime,
)
from apps.kuaioa.services.kuaioa_list_core import parse_optional_date
from infra.exceptions.exceptions import BusinessLogicError
from infra.models.user import User


def _special_price_payload(data: SpecialPriceRequestCreate | SpecialPriceRequestUpdate, *, create: bool) -> dict[str, Any]:
    raw = data.model_dump(exclude_unset=not create)
    if "valid_until" in raw:
        raw["valid_until"] = parse_optional_date(raw["valid_until"])
    return raw


def _process_deviation_payload(data: ProcessDeviationCreate | ProcessDeviationUpdate, *, create: bool) -> dict[str, Any]:
    raw = data.model_dump(exclude_unset=not create)
    for key in ("start_at", "end_at"):
        if key in raw:
            raw[key] = parse_business_datetime(raw[key])
    start_at = raw.get("start_at")
    end_at = raw.get("end_at")
    if start_at and end_at and end_at < start_at:
        raise BusinessLogicError("结束时间不能早于开始时间")
    return raw


class _CollaborationServiceBase:
    def __init__(self, config: KuaioaApprovalDocConfig, content_getter: Callable[[Model], str]) -> None:
        self._svc = KuaioaApprovalDocService(config)
        self._model = config.model
        self._content_getter = content_getter

    async def list_requests(
        self, tenant_id: int, *, keyword: Optional[str] = None, status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        return await self._svc.list_rows(tenant_id, keyword=keyword, status=status)

    async def get_request(self, tenant_id: int, request_id: int) -> dict[str, Any]:
        return await self._svc.get_row(tenant_id, request_id)

    async def delete_request(self, tenant_id: int, request_id: int, user: User) -> None:
        await self._svc.delete_row(tenant_id, request_id, user.id)

    async def submit_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        return await self._svc.submit_row(
            tenant_id,
            request_id,
            user_id,
            title_getter=lambda r: r.title,
            content_getter=self._content_getter,
        )

    async def revoke_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        return await self._svc.revoke_row(tenant_id, request_id, user_id)

    async def apply_decision(
        self, tenant_id: int, request_id: int, approved: bool, user_id: int
    ) -> None:
        await apply_approval_decision(self._model, tenant_id, request_id, approved, user_id)


_SPECIAL_PRICE = KuaioaApprovalDocConfig(
    model=KuaioaSpecialPriceRequest,
    code_field="request_code",
    code_prefix="SP",
    entity_type="kuaioa_special_price",
    audit_node_key="kuaioa_special_price",
    title_prefix="特价申请",
    keyword_fields=("request_code", "title", "customer_name", "material_code", "material_name"),
    not_found_message="特价申请不存在",
)
_CONCESSION = KuaioaApprovalDocConfig(
    model=KuaioaConcessionRequest,
    code_field="request_code",
    code_prefix="CN",
    entity_type="kuaioa_concession",
    audit_node_key="kuaioa_concession",
    title_prefix="让步接收",
    keyword_fields=("request_code", "title", "material_code", "source_doc_no"),
    not_found_message="让步接收申请不存在",
)
_PROCESS_DEVIATION = KuaioaApprovalDocConfig(
    model=KuaioaProcessDeviation,
    code_field="request_code",
    code_prefix="PD",
    entity_type="kuaioa_process_deviation",
    audit_node_key="kuaioa_process_deviation",
    title_prefix="工艺偏离",
    keyword_fields=("request_code", "title", "operation_name", "source_doc_no"),
    not_found_message="工艺偏离申请不存在",
)


class SpecialPriceRequestService(_CollaborationServiceBase):
    def __init__(self) -> None:
        super().__init__(_SPECIAL_PRICE, lambda r: r.reason or r.title)

    async def create_request(
        self, tenant_id: int, data: SpecialPriceRequestCreate, user: User
    ) -> dict[str, Any]:
        return await self._svc.create_row(tenant_id, _special_price_payload(data, create=True), user)

    async def update_request(
        self, tenant_id: int, request_id: int, data: SpecialPriceRequestUpdate, user: User
    ) -> dict[str, Any]:
        return await self._svc.update_row(
            tenant_id, request_id, _special_price_payload(data, create=False), user.id
        )


class ConcessionRequestService(_CollaborationServiceBase):
    def __init__(self) -> None:
        super().__init__(_CONCESSION, lambda r: r.defect_description or r.title)

    async def create_request(
        self, tenant_id: int, data: ConcessionRequestCreate, user: User
    ) -> dict[str, Any]:
        return await self._svc.create_row(tenant_id, data.model_dump(), user)

    async def update_request(
        self, tenant_id: int, request_id: int, data: ConcessionRequestUpdate, user: User
    ) -> dict[str, Any]:
        return await self._svc.update_row(tenant_id, request_id, data.model_dump(exclude_unset=True), user.id)


class ProcessDeviationService(_CollaborationServiceBase):
    def __init__(self) -> None:
        super().__init__(_PROCESS_DEVIATION, lambda r: r.deviation_description or r.title)

    async def create_request(
        self, tenant_id: int, data: ProcessDeviationCreate, user: User
    ) -> dict[str, Any]:
        return await self._svc.create_row(
            tenant_id, _process_deviation_payload(data, create=True), user
        )

    async def update_request(
        self, tenant_id: int, request_id: int, data: ProcessDeviationUpdate, user: User
    ) -> dict[str, Any]:
        return await self._svc.update_row(
            tenant_id, request_id, _process_deviation_payload(data, create=False), user.id
        )


async def apply_special_price_decision(
    tenant_id: int, request_id: int, approved: bool, user_id: int
) -> None:
    await apply_approval_decision(KuaioaSpecialPriceRequest, tenant_id, request_id, approved, user_id)


async def apply_concession_decision(
    tenant_id: int, request_id: int, approved: bool, user_id: int
) -> None:
    await apply_approval_decision(KuaioaConcessionRequest, tenant_id, request_id, approved, user_id)


async def apply_process_deviation_decision(
    tenant_id: int, request_id: int, approved: bool, user_id: int
) -> None:
    await apply_approval_decision(KuaioaProcessDeviation, tenant_id, request_id, approved, user_id)
