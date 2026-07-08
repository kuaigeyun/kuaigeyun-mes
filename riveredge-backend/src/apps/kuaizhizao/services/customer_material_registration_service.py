"""
代工来料（客户来料登记）业务服务
"""

import uuid
import re
import json
import logging
from datetime import datetime, date
from typing import List, Optional, Tuple, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from tortoise.timezone import now as tz_now

from core.utils.timezone_utils import resolve_business_datetime, to_site_date

from apps.kuaizhizao.models.customer_material_registration import (
    BarcodeMappingRule,
    CustomerMaterialRegistration,
    CustomerMaterialRegistrationItem,
)
from apps.kuaizhizao.schemas.customer_material_registration import (
    BarcodeMappingRuleCreate,
    BarcodeMappingRuleUpdate,
    BarcodeMappingRuleResponse,
    BarcodeMappingRuleListResponse,
    CustomerMaterialRegistrationCreate,
    CustomerMaterialRegistrationUpdate,
    CustomerMaterialRegistrationResponse,
    CustomerMaterialRegistrationListResponse,
    CustomerMaterialRegistrationItemCreate,
    CustomerMaterialRegistrationItemResponse,
    CustomerMaterialStartProductionResponse,
    ParseBarcodeRequest,
    ParseBarcodeResponse,
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

logger = logging.getLogger(__name__)


class BarcodeMappingRuleService(AppBaseService[BarcodeMappingRule]):
    def __init__(self):
        super().__init__(BarcodeMappingRule)

    async def create_mapping_rule(
        self,
        tenant_id: int,
        rule_data: BarcodeMappingRuleCreate,
        created_by: int,
    ) -> BarcodeMappingRuleResponse:
        async with in_transaction():
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="BARCODE_MAPPING_RULE_CODE",
                prefix="BMR",
            )
            user_info = await self.get_user_info(created_by)
            mapping_rule = await BarcodeMappingRule.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=rule_data.name,
                customer_id=rule_data.customer_id,
                customer_name=rule_data.customer_name,
                barcode_pattern=rule_data.barcode_pattern,
                barcode_type=rule_data.barcode_type,
                material_id=rule_data.material_id,
                material_code=rule_data.material_code,
                material_name=rule_data.material_name,
                parsing_rule=rule_data.parsing_rule,
                is_enabled=rule_data.is_enabled,
                priority=rule_data.priority,
                remarks=rule_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )
            return BarcodeMappingRuleResponse.model_validate(mapping_rule)

    async def list_mapping_rules(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        customer_id: Optional[int] = None,
        is_enabled: Optional[bool] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[BarcodeMappingRuleListResponse], int]:
        query = BarcodeMappingRule.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        if is_enabled is not None:
            query = query.filter(is_enabled=is_enabled)

        from apps.kuaizhizao.services.warehouse_list_core import (
            BARCODE_MAPPING_RULE_KEYWORD_FIELDS,
            BARCODE_MAPPING_RULE_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )
        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            allowed_fields=BARCODE_MAPPING_RULE_SORTABLE_FIELDS,
            default_order="-priority",
            keyword_fields=BARCODE_MAPPING_RULE_KEYWORD_FIELDS,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )

        total = await query.count()
        rules = await query.order_by(order_clause).offset(skip).limit(limit)
        return [BarcodeMappingRuleListResponse.model_validate(rule) for rule in rules], total


def _parse_serial_numbers(serial_numbers: Any) -> List[str]:
    if serial_numbers is None:
        return []
    if isinstance(serial_numbers, list):
        return [str(x).strip() for x in serial_numbers if str(x).strip()]
    if isinstance(serial_numbers, str):
        text = serial_numbers.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except json.JSONDecodeError:
            pass
        return [s.strip() for s in text.replace("\n", ",").split(",") if s.strip()]
    return []


class CustomerMaterialRegistrationService(AppBaseService[CustomerMaterialRegistration]):
    def __init__(self):
        super().__init__(CustomerMaterialRegistration)
        self.mapping_rule_service = BarcodeMappingRuleService()

    async def _load_items(self, tenant_id: int, registration_id: int) -> List[CustomerMaterialRegistrationItem]:
        return await CustomerMaterialRegistrationItem.filter(
            tenant_id=tenant_id,
            registration_id=registration_id,
            deleted_at__isnull=True,
        ).all()

    async def _effective_items(
        self, registration: CustomerMaterialRegistration
    ) -> List[CustomerMaterialRegistrationItem]:
        items = await self._load_items(registration.tenant_id, registration.id)
        if items:
            return items
        if registration.mapped_material_id and registration.quantity:
            pseudo = CustomerMaterialRegistrationItem(
                id=0,
                tenant_id=registration.tenant_id,
                uuid=str(uuid.uuid4()),
                registration_id=registration.id,
                material_id=registration.mapped_material_id,
                material_code=registration.mapped_material_code or "",
                material_name=registration.mapped_material_name or "",
                quantity=registration.quantity,
                barcode=registration.barcode,
                barcode_type=registration.barcode_type,
                mapping_rule_id=registration.mapping_rule_id,
                batch_number=registration.batch_number,
                serial_numbers=getattr(registration, "serial_numbers", None),
                status=registration.status,
            )
            return [pseudo]
        return []

    def _to_response(
        self,
        registration: CustomerMaterialRegistration,
        items: Optional[List[CustomerMaterialRegistrationItem]] = None,
    ) -> CustomerMaterialRegistrationResponse:
        data = CustomerMaterialRegistrationResponse.model_validate(registration)
        if items is not None:
            data.items = []
            for it in items:
                row = CustomerMaterialRegistrationItemResponse.model_validate(it)
                parsed = _parse_serial_numbers(getattr(it, "serial_numbers", None))
                row.serial_numbers = parsed or None
                data.items.append(row)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_customer_material_registration_capabilities_on_response,
        )
        return enrich_customer_material_registration_capabilities_on_response(registration, data)

    async def parse_barcode(
        self,
        tenant_id: int,
        parse_request: ParseBarcodeRequest,
    ) -> ParseBarcodeResponse:
        barcode = parse_request.barcode.strip()
        if not barcode:
            raise ValidationError("条码不能为空")

        query = BarcodeMappingRule.filter(
            tenant_id=tenant_id, is_enabled=True, deleted_at__isnull=True
        )
        if parse_request.customer_id:
            query = query.filter(
                Q(customer_id=parse_request.customer_id) | Q(customer_id__isnull=True)
            )
        rules = await query.order_by("-priority", "-created_at")

        matched_rule = None
        parsed_data: Dict[str, Any] = {}
        mapped_material_id = None
        mapped_material_code = None
        mapped_material_name = None

        for rule in rules:
            try:
                if re.match(rule.barcode_pattern, barcode):
                    matched_rule = rule
                    mapped_material_id = rule.material_id
                    mapped_material_code = rule.material_code
                    mapped_material_name = rule.material_name
                    parsed_data = {
                        "barcode": barcode,
                        "material_code": rule.material_code,
                        "material_name": rule.material_name,
                    }
                    break
            except re.error:
                continue

        return ParseBarcodeResponse(
            barcode=barcode,
            barcode_type=parse_request.barcode_type or "1d",
            parsed_data=parsed_data,
            mapped_material_id=mapped_material_id,
            mapped_material_code=mapped_material_code,
            mapped_material_name=mapped_material_name,
            mapping_rule_id=matched_rule.id if matched_rule else None,
            mapping_rule_name=matched_rule.name if matched_rule else None,
        )

    async def _create_items(
        self,
        tenant_id: int,
        registration_id: int,
        items_data: List[CustomerMaterialRegistrationItemCreate],
    ) -> List[CustomerMaterialRegistrationItem]:
        created: List[CustomerMaterialRegistrationItem] = []
        for row in items_data:
            serial_numbers = row.serial_numbers
            serial_numbers_json = None
            if serial_numbers and isinstance(serial_numbers, list):
                serial_numbers_json = json.dumps(serial_numbers)
            item = await CustomerMaterialRegistrationItem.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                registration_id=registration_id,
                material_id=row.material_id,
                material_code=row.material_code,
                material_name=row.material_name,
                material_spec=row.material_spec,
                material_unit=row.material_unit,
                quantity=row.quantity,
                barcode=row.barcode,
                barcode_type=row.barcode_type,
                mapping_rule_id=row.mapping_rule_id,
                batch_number=row.batch_number,
                serial_numbers=serial_numbers_json,
                status="pending",
                remarks=row.remarks,
            )
            created.append(item)
        return created

    async def create_registration(
        self,
        tenant_id: int,
        registration_data: CustomerMaterialRegistrationCreate,
        registered_by: int,
    ) -> CustomerMaterialRegistrationResponse:
        async with in_transaction():
            mapped_material_id = None
            mapped_material_code = None
            mapped_material_name = None
            mapping_rule_id = None
            parsed_data = None

            if registration_data.barcode:
                try:
                    parse_result = await self.parse_barcode(
                        tenant_id=tenant_id,
                        parse_request=ParseBarcodeRequest(
                            barcode=registration_data.barcode,
                            barcode_type=registration_data.barcode_type,
                            customer_id=registration_data.customer_id,
                        ),
                    )
                    mapped_material_id = parse_result.mapped_material_id
                    mapped_material_code = parse_result.mapped_material_code
                    mapped_material_name = parse_result.mapped_material_name
                    mapping_rule_id = parse_result.mapping_rule_id
                    parsed_data = parse_result.parsed_data
                except Exception:
                    pass

            if registration_data.material_id:
                from apps.master_data.models.material import Material

                mat = await Material.get_or_none(
                    tenant_id=tenant_id,
                    id=registration_data.material_id,
                    deleted_at__isnull=True,
                )
                if not mat:
                    raise ValidationError(f"物料不存在: {registration_data.material_id}")
                mapped_material_id = mat.id
                mapped_material_code = (
                    registration_data.material_code
                    or getattr(mat, "main_code", None)
                    or getattr(mat, "code", "")
                )
                mapped_material_name = registration_data.material_name or mat.name

            from core.services.default.default_values_service import DefaultValuesService

            await DefaultValuesService.ensure_code_rule_for_page(
                tenant_id, "kuaizhizao-warehouse-customer-material-registration"
            )
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="CUSTOMER_MATERIAL_REGISTRATION_CODE",
                prefix="CMR",
            )
            user_info = await self.get_user_info(registered_by)

            total_qty = Decimal("0")
            if registration_data.items:
                total_qty = sum((row.quantity for row in registration_data.items), Decimal("0"))
            elif registration_data.quantity:
                total_qty = registration_data.quantity

            registration = await CustomerMaterialRegistration.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                registration_code=code,
                customer_id=registration_data.customer_id,
                customer_name=registration_data.customer_name,
                barcode=registration_data.barcode or "",
                barcode_type=registration_data.barcode_type,
                parsed_data=parsed_data,
                mapped_material_id=mapped_material_id,
                mapped_material_code=mapped_material_code,
                mapped_material_name=mapped_material_name,
                mapping_rule_id=mapping_rule_id,
                quantity=registration_data.quantity or total_qty,
                total_quantity=total_qty,
                registration_date=registration_data.registration_date or datetime.now(),
                registered_by=registered_by,
                registered_by_name=user_info["name"],
                warehouse_id=registration_data.warehouse_id,
                warehouse_name=registration_data.warehouse_name,
                sales_order_id=registration_data.sales_order_id,
                sales_order_code=registration_data.sales_order_code,
                work_order_id=registration_data.work_order_id,
                work_order_code=registration_data.work_order_code,
                batch_number=registration_data.batch_number,
                status="pending",
                remarks=registration_data.remarks,
            )

            if not registration_data.items and not mapped_material_id:
                raise ValidationError("请指定来料物料（选择已有物料或快速新建）")

            items: List[CustomerMaterialRegistrationItem] = []
            if registration_data.items:
                items = await self._create_items(tenant_id, registration.id, registration_data.items)
            elif mapped_material_id and registration_data.quantity:
                items = await self._create_items(
                    tenant_id,
                    registration.id,
                    [
                        CustomerMaterialRegistrationItemCreate(
                            material_id=mapped_material_id,
                            material_code=mapped_material_code or "",
                            material_name=mapped_material_name or "",
                            quantity=registration_data.quantity,
                            barcode=registration_data.barcode,
                            barcode_type=registration_data.barcode_type,
                            mapping_rule_id=mapping_rule_id,
                            batch_number=registration_data.batch_number,
                            serial_numbers=registration_data.serial_numbers,
                        )
                    ],
                )

            return self._to_response(registration, items)

    async def update_registration(
        self,
        tenant_id: int,
        registration_id: int,
        update_data: CustomerMaterialRegistrationUpdate,
        updated_by: int,
    ) -> CustomerMaterialRegistrationResponse:
        async with in_transaction():
            registration = await CustomerMaterialRegistration.get_or_none(
                id=registration_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not registration:
                raise NotFoundError(f"代工来料单不存在: {registration_id}")
            if registration.status != "pending":
                raise BusinessLogicError("仅待入库状态的代工来料单可编辑")

            fields = update_data.model_dump(exclude_unset=True, exclude={"items"})
            if fields:
                for k, v in fields.items():
                    setattr(registration, k, v)
                await registration.save()

            if update_data.items is not None:
                await CustomerMaterialRegistrationItem.filter(
                    tenant_id=tenant_id, registration_id=registration_id
                ).update(deleted_at=datetime.now())
                items = await self._create_items(tenant_id, registration_id, update_data.items)
                registration.total_quantity = sum((it.quantity for it in items), Decimal("0"))
                await registration.save()
            else:
                items = await self._load_items(tenant_id, registration_id)

            return self._to_response(registration, items)

    async def list_registrations(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        registration_date_start: Optional[str] = None,
        registration_date_end: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[CustomerMaterialRegistrationListResponse], int]:
        from apps.kuaizhizao.services.warehouse_list_core import apply_warehouse_registration_list_filters

        query = CustomerMaterialRegistration.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status)

        query, order_clause = apply_warehouse_registration_list_filters(
            query,
            keyword=keyword,
            search=search,
            order_by=order_by,
            registration_start_date=registration_date_start,
            registration_end_date=registration_date_end,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        registrations = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_customer_material_registration_list_capabilities,
        )
        responses = [CustomerMaterialRegistrationListResponse.model_validate(reg) for reg in registrations]
        enriched = enrich_customer_material_registration_list_capabilities(registrations, responses)
        return enriched, total

    async def get_registration_by_id(
        self,
        tenant_id: int,
        registration_id: int,
    ) -> CustomerMaterialRegistrationResponse:
        registration = await CustomerMaterialRegistration.get_or_none(
            id=registration_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not registration:
            raise NotFoundError(f"代工来料单不存在: {registration_id}")
        items = await self._load_items(tenant_id, registration_id)
        return self._to_response(registration, items)

    async def _post_inventory_for_registration(
        self,
        registration: CustomerMaterialRegistration,
        items: List[CustomerMaterialRegistrationItem],
        operator_id: int,
        ledger_production_date: date,
    ) -> None:
        from apps.kuaizhizao.services.inventory_service import InventoryService
        from apps.master_data.models.material import Material
        from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item, ensure_serial_nos_for_item

        if not registration.warehouse_id:
            raise BusinessLogicError("确认入库前必须指定入库仓库")

        for item in items:
            qty = Decimal(str(item.quantity or 0))
            if qty <= 0:
                continue
            material = await Material.get_or_none(
                tenant_id=registration.tenant_id,
                id=item.material_id,
                deleted_at__isnull=True,
            )
            if not material:
                raise BusinessLogicError(f"物料不存在: {item.material_id}")

            batch_no = item.batch_number
            if material.batch_managed and not batch_no:
                batch_no = await ensure_batch_no_for_item(
                    registration.tenant_id, material, item
                )
                if batch_no:
                    item.batch_number = batch_no
                    if item.id:
                        await item.save()

            serial_nos = _parse_serial_numbers(getattr(item, "serial_numbers", None))
            if material.serial_managed and not serial_nos:
                count = int(qty)
                serial_nos = await ensure_serial_nos_for_item(
                    registration.tenant_id, material, item, count
                )
                if serial_nos and item.id:
                    item.serial_numbers = json.dumps(serial_nos)
                    await item.save()

            await InventoryService._increase_stock_no_atomic(
                tenant_id=registration.tenant_id,
                material_id=item.material_id,
                quantity=qty,
                warehouse_id=registration.warehouse_id,
                batch_no=batch_no or None,
                serial_nos=serial_nos or None,
                source_type="customer_material_inbound",
                source_doc_id=registration.id,
                source_doc_code=registration.registration_code,
                work_order_id=registration.work_order_id,
                work_order_code=registration.work_order_code,
                ownership_type="customer_provided",
                customer_id=registration.customer_id,
                customer_name=registration.customer_name,
                ledger_production_date=ledger_production_date,
            )

    async def process_registration(
        self,
        tenant_id: int,
        registration_id: int,
        processed_by: int,
    ) -> CustomerMaterialRegistrationResponse:
        async with in_transaction():
            registration = await CustomerMaterialRegistration.get_or_none(
                id=registration_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not registration:
                raise NotFoundError(f"代工来料单不存在: {registration_id}")
            from apps.kuaizhizao.services.document_action_policy.customer_material_registration import (
                assert_customer_material_registration_capability,
            )
            assert_customer_material_registration_capability(registration, "confirm")
            if registration.status != "pending":
                raise BusinessLogicError(f"代工来料单状态不允许确认入库: {registration.status}")

            items = await self._effective_items(registration)
            if not items:
                raise BusinessLogicError("代工来料单无有效明细，无法确认入库")

            from apps.kuaizhizao.services.inspection_policy_service import (
                assert_iqc_for_customer_material_registration_lines,
            )

            await assert_iqc_for_customer_material_registration_lines(
                tenant_id, registration_id, items
            )

            now = tz_now()
            await self._post_inventory_for_registration(
                registration, items, processed_by, ledger_production_date=to_site_date(now)
            )

            user_info = await self.get_user_name(processed_by)
            registration.status = "processed"
            registration.processed_at = now
            registration.processed_by = processed_by
            registration.processed_by_name = user_info
            await registration.save()

            for item in items:
                if item.id:
                    item.status = "processed"
                    await item.save()

            items = await self._load_items(tenant_id, registration_id)
            return self._to_response(registration, items)

    async def withdraw_registration(
        self,
        tenant_id: int,
        registration_id: int,
        withdrawn_by: int,
    ) -> CustomerMaterialRegistrationResponse:
        async with in_transaction():
            registration = await CustomerMaterialRegistration.get_or_none(
                id=registration_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not registration:
                raise NotFoundError(f"代工来料单不存在: {registration_id}")
            from apps.kuaizhizao.services.document_action_policy.customer_material_registration import (
                assert_customer_material_registration_capability,
            )
            assert_customer_material_registration_capability(registration, "withdraw")
            if registration.status != "processed":
                raise BusinessLogicError("仅已入库状态的代工来料单可撤回")

            items = await self._effective_items(registration)
            from apps.kuaizhizao.services.inventory_service import InventoryService

            for item in items:
                qty = Decimal(str(item.quantity or 0))
                if qty <= 0:
                    continue
                await InventoryService._decrease_stock_no_atomic(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=qty,
                    warehouse_id=registration.warehouse_id,
                    batch_no=item.batch_number or None,
                    source_type="customer_material_inbound_revoke",
                    source_doc_id=registration.id,
                    source_doc_code=registration.registration_code,
                    ownership_type="customer_provided",
                    customer_id=registration.customer_id,
                )

            registration.status = "pending"
            registration.processed_at = None
            registration.processed_by = None
            registration.processed_by_name = None
            await registration.save()

            db_items = await self._load_items(tenant_id, registration_id)
            for item in db_items:
                item.status = "pending"
                await item.save()

            return self._to_response(registration, db_items)

    async def cancel_registration(
        self,
        tenant_id: int,
        registration_id: int,
        cancelled_by: int,
    ) -> CustomerMaterialRegistrationResponse:
        async with in_transaction():
            registration = await CustomerMaterialRegistration.get_or_none(
                id=registration_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not registration:
                raise NotFoundError(f"代工来料单不存在: {registration_id}")
            from apps.kuaizhizao.services.document_action_policy.customer_material_registration import (
                assert_customer_material_registration_capability,
            )
            assert_customer_material_registration_capability(registration, "cancel")
            if registration.status != "pending":
                raise BusinessLogicError(f"代工来料单状态不允许取消: {registration.status}")

            registration.status = "cancelled"
            await registration.save()
            items = await self._load_items(tenant_id, registration_id)
            return self._to_response(registration, items)

    async def delete_registration(
        self,
        tenant_id: int,
        registration_id: int,
        deleted_by: int,
    ) -> None:
        async with in_transaction():
            registration = await CustomerMaterialRegistration.get_or_none(
                id=registration_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not registration:
                raise NotFoundError(f"代工来料单不存在: {registration_id}")
            if registration.status != "pending":
                raise BusinessLogicError("仅待入库状态的代工来料单可删除")

            now = datetime.now()
            user_name = await self.get_user_name(deleted_by)
            registration.deleted_at = now
            registration.updated_by = deleted_by
            registration.updated_by_name = user_name
            await registration.save()
            await CustomerMaterialRegistrationItem.filter(
                tenant_id=tenant_id,
                registration_id=registration_id,
                deleted_at__isnull=True,
            ).update(
                deleted_at=now,
                updated_by=deleted_by,
                updated_by_name=user_name,
            )

    async def _batch_apply(
        self,
        registration_ids: List[int],
        action: str,
        apply_fn,
        not_found_as_success: bool = False,
    ) -> Dict[str, Any]:
        success_count = 0
        failed_ids: List[int] = []
        errors: List[str] = []
        seen: set[int] = set()
        for registration_id in registration_ids:
            if registration_id in seen:
                continue
            seen.add(registration_id)
            try:
                await apply_fn(registration_id)
                success_count += 1
            except NotFoundError as exc:
                if not_found_as_success:
                    success_count += 1
                else:
                    failed_ids.append(registration_id)
                    errors.append(f"{action}失败({registration_id}): {exc}")
            except (ValidationError, BusinessLogicError) as exc:
                failed_ids.append(registration_id)
                errors.append(f"{action}失败({registration_id}): {exc}")
        return {
            "success_count": success_count,
            "failed_count": len(failed_ids),
            "failed_ids": failed_ids,
            "errors": errors,
        }

    async def batch_process_registrations(
        self,
        tenant_id: int,
        registration_ids: List[int],
        processed_by: int,
    ) -> Dict[str, Any]:
        return await self._batch_apply(
            registration_ids=registration_ids,
            action="确认入库",
            apply_fn=lambda registration_id: self.process_registration(
                tenant_id=tenant_id,
                registration_id=registration_id,
                processed_by=processed_by,
            ),
        )

    async def batch_withdraw_registrations(
        self,
        tenant_id: int,
        registration_ids: List[int],
        withdrawn_by: int,
    ) -> Dict[str, Any]:
        return await self._batch_apply(
            registration_ids=registration_ids,
            action="撤回入库",
            apply_fn=lambda registration_id: self.withdraw_registration(
                tenant_id=tenant_id,
                registration_id=registration_id,
                withdrawn_by=withdrawn_by,
            ),
        )

    async def batch_cancel_registrations(
        self,
        tenant_id: int,
        registration_ids: List[int],
        cancelled_by: int,
    ) -> Dict[str, Any]:
        return await self._batch_apply(
            registration_ids=registration_ids,
            action="取消",
            apply_fn=lambda registration_id: self.cancel_registration(
                tenant_id=tenant_id,
                registration_id=registration_id,
                cancelled_by=cancelled_by,
            ),
        )

    async def batch_delete_registrations(
        self,
        tenant_id: int,
        registration_ids: List[int],
        deleted_by: int,
    ) -> Dict[str, Any]:
        return await self._batch_apply(
            registration_ids=registration_ids,
            action="删除",
            apply_fn=lambda registration_id: self.delete_registration(
                tenant_id=tenant_id,
                registration_id=registration_id,
                deleted_by=deleted_by,
            ),
            not_found_as_success=True,
        )

    async def create_and_start_production(
        self,
        tenant_id: int,
        registration_data: CustomerMaterialRegistrationCreate,
        operator_id: int,
    ) -> CustomerMaterialStartProductionResponse:
        """
        客供料入库并直接发料开工：创建代工来料单 → 确认入库 → 按明细创建工单 → 生成并确认配料单 → 下达工单。
        单条自制/配置件明细创建普通工单；多条创建平级组工单。
        """
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.kuaizhizao.schemas.batching_order import PullFromWorkOrderRequest, BatchingOrderConfirmRequest
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService
        from apps.kuaizhizao.services.batching_order_service import BatchingOrderService
        from apps.kuaizhizao.utils.material_source_helper import (
            get_material_source_type,
            SOURCE_TYPE_MAKE,
            SOURCE_TYPE_CONFIGURE,
        )

        warnings: List[str] = []
        created = await self.create_registration(
            tenant_id=tenant_id,
            registration_data=registration_data,
            registered_by=operator_id,
        )
        if not created.id:
            raise BusinessLogicError("代工来料单创建失败")

        processed = await self.process_registration(
            tenant_id=tenant_id,
            registration_id=created.id,
            processed_by=operator_id,
        )
        items = processed.items or []
        if not items:
            raise BusinessLogicError("代工来料单无有效明细，无法开工")

        wo_lines: List[Dict[str, Any]] = []
        for idx, item in enumerate(items):
            source_type = await get_material_source_type(tenant_id, item.material_id)
            if source_type not in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE):
                warnings.append(
                    f"第 {idx + 1} 行物料 {item.material_code or item.material_id} "
                    f"来源为 {source_type or '未配置'}，已跳过工单创建"
                )
                continue
            if source_type == SOURCE_TYPE_CONFIGURE:
                warnings.append(
                    f"第 {idx + 1} 行配置件 {item.material_code or item.material_id} "
                    f"暂不支持一键开工，请手工创建工单并指定属性"
                )
                continue
            qty = Decimal(str(item.quantity or 0))
            if qty <= 0:
                continue
            wo_lines.append(
                {
                    "product_id": int(item.material_id),
                    "quantity": qty,
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                }
            )

        if not wo_lines:
            raise ValidationError(
                "明细中无可用自制件物料，无法创建生产工单。"
                + (f" 提示：{'；'.join(warnings)}" if warnings else "")
            )

        production_mode = "MTO" if registration_data.sales_order_id else "MTS"
        wo_svc = WorkOrderService()
        group_svc = WorkOrderGroupService()
        work_order_ids: List[int] = []
        work_order_codes: List[str] = []
        group_id: Optional[int] = None
        group_code: Optional[str] = None

        if len(wo_lines) == 1:
            line = wo_lines[0]
            wo = await wo_svc.create_work_order(
                tenant_id=tenant_id,
                work_order_data=WorkOrderCreate(
                    code_rule="WORK_ORDER_CODE",
                    product_id=line["product_id"],
                    quantity=line["quantity"],
                    production_mode=production_mode,
                    sales_order_id=registration_data.sales_order_id,
                    priority="normal",
                ),
                created_by=operator_id,
            )
            if wo.id is None:
                raise BusinessLogicError("生产工单创建失败")
            work_order_ids = [int(wo.id)]
            work_order_codes = [wo.code or ""]
        else:
            group_result = await group_svc.create_peer_group_work_orders(
                tenant_id=tenant_id,
                items=[
                    {
                        "product_id": line["product_id"],
                        "quantity": line["quantity"],
                        "priority": "normal",
                    }
                    for line in wo_lines
                ],
                group_name=f"客供开工-{processed.registration_code}",
                production_mode=production_mode,
                sales_order_id=registration_data.sales_order_id,
                created_by=operator_id,
            )
            work_order_ids = [int(i) for i in group_result.get("work_order_ids") or []]
            work_order_codes = list(group_result.get("work_order_codes") or [])
            group_id = group_result.get("work_order_group_id")
            group_code = group_result.get("group_code")

        registration = await CustomerMaterialRegistration.get_or_none(
            id=created.id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if registration and work_order_ids:
            registration.work_order_id = work_order_ids[0]
            registration.work_order_code = work_order_codes[0] if work_order_codes else None
            await registration.save()
            processed = await self.get_registration_by_id(tenant_id, created.id)

        batching_svc = BatchingOrderService()
        batching_ids: List[int] = []
        batching_codes: List[str] = []

        for wo_id, wo_code in zip(work_order_ids, work_order_codes):
            try:
                batching = await batching_svc.pull_from_work_order(
                    tenant_id=tenant_id,
                    request_data=PullFromWorkOrderRequest(
                        work_order_id=wo_id,
                        warehouse_id=registration_data.warehouse_id,
                        warehouse_name=registration_data.warehouse_name,
                        remarks=f"客供开工自动配料（{processed.registration_code}）",
                        allow_existing_draft=True,
                    ),
                    created_by=operator_id,
                )
                if batching.id:
                    await batching_svc.confirm_batching_order(
                        tenant_id=tenant_id,
                        order_id=int(batching.id),
                        executed_by=operator_id,
                        confirm_data=BatchingOrderConfirmRequest(),
                    )
                    batching_ids.append(int(batching.id))
                    batching_codes.append(batching.code or "")
            except (ValidationError, BusinessLogicError) as exc:
                warnings.append(f"工单 {wo_code} 配料：{exc}")

            try:
                await wo_svc.release_work_order(
                    tenant_id=tenant_id,
                    work_order_id=wo_id,
                    released_by=operator_id,
                    check_shortage=False,
                )
            except (ValidationError, BusinessLogicError) as exc:
                warnings.append(f"工单 {wo_code} 下达：{exc}")

        return CustomerMaterialStartProductionResponse(
            registration=processed,
            work_order_ids=work_order_ids,
            work_order_codes=work_order_codes,
            work_order_group_id=group_id,
            work_order_group_code=group_code,
            batching_order_ids=batching_ids,
            batching_order_codes=batching_codes,
            warnings=warnings,
        )
