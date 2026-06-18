"""客户供应商价格本服务"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material
from apps.master_data.models.material_code_alias import MaterialCodeAlias
from apps.master_data.models.partner_price_book import PartnerPriceBook
from apps.master_data.models.supplier import Supplier
from apps.master_data.schemas.partner_price_book_schemas import (
    PartnerPriceBookCreate,
    PartnerPriceBookResponse,
    PartnerPriceBookUpdate,
    PartnerPriceResolveBatchRequest,
    PartnerPriceResolveRequest,
    PartnerPriceResolveResponse,
)
from apps.master_data.services.material_code_service import MaterialCodeService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PartnerPriceBookService:
    PARTNER_TYPES = ("customer", "supplier")

    @staticmethod
    def _normalize_variant_attributes(attrs: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not attrs:
            return {}
        cleaned: Dict[str, Any] = {}
        for key, value in attrs.items():
            if value is None or value == "":
                continue
            if isinstance(value, list) and len(value) == 0:
                continue
            cleaned[str(key)] = value
        return dict(sorted(cleaned.items(), key=lambda x: x[0]))

    @classmethod
    def _variant_attributes_match(cls, line_attrs: Dict[str, Any], query_attrs: Dict[str, Any]) -> bool:
        norm_line = cls._normalize_variant_attributes(line_attrs)
        norm_query = cls._normalize_variant_attributes(query_attrs)
        if not norm_line:
            return False
        for key, value in norm_line.items():
            if norm_query.get(key) != value:
                return False
        return True

    @classmethod
    def _serialize_variant_prices_for_storage(
        cls,
        variant_prices: Optional[List[Any]],
    ) -> Optional[List[Dict[str, Any]]]:
        if not variant_prices:
            return None
        stored: List[Dict[str, Any]] = []
        for line in variant_prices:
            if hasattr(line, "model_dump"):
                raw = line.model_dump(by_alias=False)
            elif isinstance(line, dict):
                raw = {
                    "variant_attributes": line.get("variant_attributes") or line.get("variantAttributes") or {},
                    "unit_price": line.get("unit_price") if line.get("unit_price") is not None else line.get("unitPrice"),
                }
            else:
                continue
            attrs = cls._normalize_variant_attributes(raw.get("variant_attributes"))
            price = raw.get("unit_price")
            if not attrs or price is None:
                continue
            stored.append(
                {
                    "variant_attributes": attrs,
                    "unit_price": str(price),
                }
            )
        return stored or None

    @classmethod
    def _deserialize_variant_prices(cls, raw: Any) -> Optional[List[Dict[str, Any]]]:
        if not raw:
            return None
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                return None
        if not isinstance(raw, list):
            return None
        lines: List[Dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            attrs = cls._normalize_variant_attributes(
                item.get("variant_attributes") or item.get("variantAttributes")
            )
            price = item.get("unit_price") if item.get("unit_price") is not None else item.get("unitPrice")
            if not attrs or price is None:
                continue
            lines.append({"variantAttributes": attrs, "unitPrice": Decimal(str(price))})
        return lines or None

    @staticmethod
    def _normalize_stored_unit_price_to_exclusive(
        unit_price: Optional[Decimal],
        tax_rate: Optional[Decimal],
        price_type: Optional[str],
    ) -> Optional[Decimal]:
        """询价返回不含税单价，与单据行价税口径一致。"""
        if unit_price is None:
            return None
        price = Decimal(str(unit_price))
        if price <= 0:
            return None
        pt = (price_type or "tax_inclusive").strip()
        if pt == "tax_exclusive":
            return price
        rate = Decimal(str(tax_rate or 0))
        if rate > Decimal("1"):
            rate = rate / Decimal("100")
        factor = Decimal("1") + rate
        if factor <= 0:
            return price
        return (price / factor).quantize(Decimal("0.0001"))

    @classmethod
    def _resolve_price_from_row(
        cls,
        row: PartnerPriceBook,
        variant_attributes: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Optional[Decimal], bool]:
        """返回 (单价, 是否属性 SKU 价)。"""
        query_attrs = cls._normalize_variant_attributes(variant_attributes)
        variant_lines = cls._deserialize_variant_prices(row.variant_prices) or []
        if query_attrs and variant_lines:
            best_price: Optional[Decimal] = None
            best_score = -1
            for line in variant_lines:
                line_attrs = line.get("variantAttributes") or {}
                if cls._variant_attributes_match(line_attrs, query_attrs):
                    score = len(cls._normalize_variant_attributes(line_attrs))
                    if score > best_score:
                        best_score = score
                        best_price = line.get("unitPrice")
            if best_price is not None:
                return (
                    cls._normalize_stored_unit_price_to_exclusive(
                        best_price, row.tax_rate, row.price_type
                    ),
                    True,
                )
        if row.unit_price is not None:
            return (
                cls._normalize_stored_unit_price_to_exclusive(
                    row.unit_price, row.tax_rate, row.price_type
                ),
                False,
            )
        return None, False

    @staticmethod
    def _split_alias_sync_fields(payload: dict, *, default_sync: bool) -> tuple[dict, Optional[str], Optional[str], bool]:
        alias_code = payload.pop("partner_material_code", None)
        alias_name = payload.pop("partner_material_name", None)
        sync_flag = payload.pop("sync_partner_alias", None)
        if sync_flag is None:
            sync_flag = default_sync if default_sync else bool(alias_code or alias_name)
        return payload, alias_code, alias_name, bool(sync_flag)

    @classmethod
    async def _sync_alias_if_needed(
        cls,
        tenant_id: int,
        partner_type: str,
        partner_id: int,
        material_id: int,
        alias_code: Optional[str],
        alias_name: Optional[str],
        sync_partner_alias: bool,
    ) -> None:
        await MaterialCodeService.sync_partner_alias_from_price_book(
            tenant_id=tenant_id,
            material_id=material_id,
            partner_type=partner_type,
            partner_id=partner_id,
            partner_material_code=alias_code,
            partner_material_name=alias_name,
            sync_partner_alias=sync_partner_alias,
        )

    @staticmethod
    def _code_type(partner_type: str) -> str:
        return "CUSTOMER" if partner_type == "customer" else "SUPPLIER"

    @staticmethod
    def _ranges_overlap(
        a_from: Optional[date],
        a_to: Optional[date],
        b_from: Optional[date],
        b_to: Optional[date],
    ) -> bool:
        a_start = a_from or date.min
        a_end = a_to or date.max
        b_start = b_from or date.min
        b_end = b_to or date.max
        return a_start <= b_end and b_start <= a_end

    @classmethod
    async def _validate_partner_exists(cls, tenant_id: int, partner_type: str, partner_id: int) -> None:
        if partner_type == "customer":
            exists = await Customer.filter(
                tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True
            ).exists()
            if not exists:
                raise ValidationError(f"客户 ID {partner_id} 不存在")
        elif partner_type == "supplier":
            exists = await Supplier.filter(
                tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True
            ).exists()
            if not exists:
                raise ValidationError(f"供应商 ID {partner_id} 不存在")
        else:
            raise ValidationError(f"无效的伙伴类型: {partner_type}")

    @classmethod
    async def _validate_material_exists(cls, tenant_id: int, material_id: int) -> Material:
        material = await Material.filter(
            tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
        ).first()
        if not material:
            raise ValidationError(f"物料 ID {material_id} 不存在")
        return material

    @classmethod
    async def _validate_no_overlap(
        cls,
        tenant_id: int,
        partner_type: str,
        partner_id: int,
        material_id: int,
        effective_from: Optional[date],
        effective_to: Optional[date],
        exclude_id: Optional[int] = None,
    ) -> None:
        query = PartnerPriceBook.filter(
            tenant_id=tenant_id,
            partner_type=partner_type,
            partner_id=partner_id,
            material_id=material_id,
            deleted_at__isnull=True,
        )
        if exclude_id:
            query = query.exclude(id=exclude_id)
        rows = await query.all()
        for row in rows:
            if cls._ranges_overlap(effective_from, effective_to, row.effective_from, row.effective_to):
                raise ValidationError(
                    "同一客户/供应商与物料在重叠的有效期内已存在价格本记录"
                )

    @classmethod
    async def _get_partner_alias(
        cls,
        tenant_id: int,
        partner_type: str,
        partner_id: int,
        material_id: int,
    ) -> Optional[MaterialCodeAlias]:
        return await MaterialCodeAlias.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            code_type=cls._code_type(partner_type),
            external_entity_type=partner_type,
            external_entity_id=partner_id,
            deleted_at__isnull=True,
        ).first()

    @classmethod
    async def _resolve_material_id_by_partner_code(
        cls,
        tenant_id: int,
        partner_type: str,
        partner_id: int,
        partner_material_code: str,
    ) -> Optional[int]:
        alias = await MaterialCodeAlias.filter(
            tenant_id=tenant_id,
            code=partner_material_code,
            code_type=cls._code_type(partner_type),
            external_entity_type=partner_type,
            external_entity_id=partner_id,
            deleted_at__isnull=True,
        ).first()
        return alias.material_id if alias else None

    @classmethod
    def _is_effective(cls, row: PartnerPriceBook, as_of: date) -> bool:
        if not row.is_active:
            return False
        if row.effective_from and as_of < row.effective_from:
            return False
        if row.effective_to and as_of > row.effective_to:
            return False
        return True

    @classmethod
    async def _pick_price_row(
        cls,
        tenant_id: int,
        partner_type: str,
        partner_id: int,
        material_id: int,
        as_of: date,
    ) -> Optional[PartnerPriceBook]:
        rows = await PartnerPriceBook.filter(
            tenant_id=tenant_id,
            partner_type=partner_type,
            partner_id=partner_id,
            material_id=material_id,
            is_active=True,
            deleted_at__isnull=True,
        ).order_by("-effective_from", "-id")
        for row in rows:
            if cls._is_effective(row, as_of):
                return row
        return None

    @classmethod
    async def _enrich_response(
        cls,
        tenant_id: int,
        row: PartnerPriceBook,
        partner_cache: Optional[Dict[int, Any]] = None,
        material_cache: Optional[Dict[int, Material]] = None,
    ) -> PartnerPriceBookResponse:
        partner_code = partner_name = None
        if partner_cache is not None and row.partner_id in partner_cache:
            p = partner_cache[row.partner_id]
            partner_code = getattr(p, "code", None)
            partner_name = getattr(p, "name", None)
        else:
            if row.partner_type == "customer":
                p = await Customer.filter(
                    tenant_id=tenant_id, id=row.partner_id, deleted_at__isnull=True
                ).first()
            else:
                p = await Supplier.filter(
                    tenant_id=tenant_id, id=row.partner_id, deleted_at__isnull=True
                ).first()
            if p:
                partner_code, partner_name = p.code, p.name

        material_code = material_name = None
        material_id = row.material_id
        if material_cache is not None and material_id in material_cache:
            m = material_cache[material_id]
            material_code, material_name = m.main_code, m.name
        else:
            m = await Material.filter(
                tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
            ).first()
            if m:
                material_code, material_name = m.main_code, m.name

        alias = await cls._get_partner_alias(tenant_id, row.partner_type, row.partner_id, material_id)
        data = {
            "id": row.id,
            "uuid": str(row.uuid),
            "tenant_id": row.tenant_id,
            "partner_type": row.partner_type,
            "partner_id": row.partner_id,
            "partner_code": partner_code,
            "partner_name": partner_name,
            "material_id": material_id,
            "material_code": material_code,
            "material_name": material_name,
            "partner_material_code": alias.code if alias else None,
            "partner_material_name": alias.name if alias else None,
            "unit_price": row.unit_price,
            "price_type": row.price_type or "tax_inclusive",
            "variant_prices": cls._deserialize_variant_prices(row.variant_prices),
            "currency_code": row.currency_code,
            "tax_rate": row.tax_rate,
            "unit": row.unit,
            "effective_from": row.effective_from,
            "effective_to": row.effective_to,
            "remark": row.remark,
            "is_active": row.is_active,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
        return PartnerPriceBookResponse.model_validate(data)

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        partner_type: str,
        data: PartnerPriceBookCreate,
    ) -> PartnerPriceBookResponse:
        if partner_type not in cls.PARTNER_TYPES:
            raise ValidationError(f"无效的伙伴类型: {partner_type}")

        payload = data.model_dump(by_alias=False)
        payload, alias_code, alias_name, sync_alias = cls._split_alias_sync_fields(payload, default_sync=True)
        partner_id = payload["partner_id"]
        material_id = payload["material_id"]
        await cls._validate_partner_exists(tenant_id, partner_type, partner_id)
        material = await cls._validate_material_exists(tenant_id, material_id)
        await cls._validate_no_overlap(
            tenant_id,
            partner_type,
            partner_id,
            material_id,
            payload.get("effective_from"),
            payload.get("effective_to"),
        )

        if payload.get("is_active") is None:
            payload["is_active"] = True
        if not payload.get("price_type"):
            payload["price_type"] = "tax_inclusive"
        if not payload.get("unit") and material.base_unit:
            payload["unit"] = material.base_unit
        payload["variant_prices"] = cls._serialize_variant_prices_for_storage(payload.get("variant_prices"))

        async with in_transaction():
            row = await PartnerPriceBook.create(
                tenant_id=tenant_id,
                partner_type=partner_type,
                **payload,
            )
            await cls._sync_alias_if_needed(
                tenant_id, partner_type, partner_id, material_id, alias_code, alias_name, sync_alias
            )
        return await cls._enrich_response(tenant_id, row)

    @classmethod
    async def get_by_uuid(
        cls,
        tenant_id: int,
        partner_type: str,
        uuid: str,
    ) -> PartnerPriceBookResponse:
        row = await PartnerPriceBook.filter(
            tenant_id=tenant_id,
            partner_type=partner_type,
            uuid=uuid,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError("价格本记录不存在")
        return await cls._enrich_response(tenant_id, row)

    @classmethod
    async def list_rows(
        cls,
        tenant_id: int,
        partner_type: str,
        skip: int = 0,
        limit: int = 100,
        partner_id: Optional[int] = None,
        material_id: Optional[int] = None,
        keyword: Optional[str] = None,
        active_only: Optional[bool] = None,
        effective_on: Optional[date] = None,
    ) -> Tuple[List[PartnerPriceBookResponse], int]:
        query = PartnerPriceBook.filter(
            tenant_id=tenant_id,
            partner_type=partner_type,
            deleted_at__isnull=True,
        )
        if partner_id is not None:
            query = query.filter(partner_id=partner_id)
        if material_id is not None:
            query = query.filter(material_id=material_id)
        if active_only is True:
            query = query.filter(is_active=True)
        if effective_on is not None:
            query = query.filter(
                Q(effective_from__isnull=True) | Q(effective_from__lte=effective_on),
                Q(effective_to__isnull=True) | Q(effective_to__gte=effective_on),
            )

        if keyword:
            kw = keyword.strip()
            partner_ids: List[int] = []
            material_ids: List[int] = []
            if partner_type == "customer":
                partner_ids = await Customer.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).filter(
                    Q(code__icontains=kw) | Q(name__icontains=kw)
                ).values_list("id", flat=True)
            else:
                partner_ids = await Supplier.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).filter(
                    Q(code__icontains=kw) | Q(name__icontains=kw)
                ).values_list("id", flat=True)
            material_ids = await Material.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).filter(
                Q(main_code__icontains=kw) | Q(name__icontains=kw)
            ).values_list("id", flat=True)
            alias_material_ids = await MaterialCodeAlias.filter(
                tenant_id=tenant_id,
                code_type=cls._code_type(partner_type),
                deleted_at__isnull=True,
            ).filter(
                Q(code__icontains=kw) | Q(name__icontains=kw)
            ).values_list("material_id", flat=True)
            material_ids = list(set(list(material_ids) + list(alias_material_ids)))
            query = query.filter(
                Q(partner_id__in=partner_ids)
                | Q(material_id__in=material_ids)
                | Q(remark__icontains=kw)
            )

        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)

        partner_cache: Dict[int, Any] = {}
        material_cache: Dict[int, Material] = {}
        partner_id_set = {r.partner_id for r in rows}
        material_id_set = {r.material_id for r in rows}
        if partner_type == "customer":
            for p in await Customer.filter(tenant_id=tenant_id, id__in=partner_id_set):
                partner_cache[p.id] = p
        else:
            for p in await Supplier.filter(tenant_id=tenant_id, id__in=partner_id_set):
                partner_cache[p.id] = p
        for m in await Material.filter(tenant_id=tenant_id, id__in=material_id_set):
            material_cache[m.id] = m

        items = [
            await cls._enrich_response(tenant_id, r, partner_cache, material_cache)
            for r in rows
        ]
        return items, total

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        partner_type: str,
        uuid: str,
        data: PartnerPriceBookUpdate,
    ) -> PartnerPriceBookResponse:
        row = await PartnerPriceBook.filter(
            tenant_id=tenant_id,
            partner_type=partner_type,
            uuid=uuid,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError("价格本记录不存在")

        payload = data.model_dump(by_alias=False, exclude_unset=True)
        payload, alias_code, alias_name, sync_alias = cls._split_alias_sync_fields(payload, default_sync=False)
        partner_id = payload.get("partner_id", row.partner_id)
        material_id = payload.get("material_id", row.material_id)
        effective_from = payload.get("effective_from", row.effective_from)
        effective_to = payload.get("effective_to", row.effective_to)

        if "partner_id" in payload:
            await cls._validate_partner_exists(tenant_id, partner_type, partner_id)
        if "material_id" in payload:
            await cls._validate_material_exists(tenant_id, material_id)
        await cls._validate_no_overlap(
            tenant_id,
            partner_type,
            partner_id,
            material_id,
            effective_from,
            effective_to,
            exclude_id=row.id,
        )

        async with in_transaction():
            if "variant_prices" in payload:
                payload["variant_prices"] = cls._serialize_variant_prices_for_storage(payload.get("variant_prices"))
            for key, value in payload.items():
                setattr(row, key, value)
            await row.save()
            await cls._sync_alias_if_needed(
                tenant_id, partner_type, partner_id, material_id, alias_code, alias_name, sync_alias
            )
        return await cls._enrich_response(tenant_id, row)

    @classmethod
    async def delete(cls, tenant_id: int, partner_type: str, uuid: str) -> None:
        row = await PartnerPriceBook.filter(
            tenant_id=tenant_id,
            partner_type=partner_type,
            uuid=uuid,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError("价格本记录不存在")
        row.deleted_at = datetime.now()
        await row.save()

    @classmethod
    async def _resolve_master_material_for_price(
        cls,
        tenant_id: int,
        material_id: int,
        variant_attributes: Optional[Dict[str, Any]] = None,
    ) -> Tuple[int, Optional[Dict[str, Any]]]:
        """属性 SKU 行映射到主物料 ID，并合并有效属性组合。"""
        material = await Material.filter(
            tenant_id=tenant_id,
            id=material_id,
            deleted_at__isnull=True,
        ).first()
        if not material:
            return material_id, variant_attributes

        effective_attrs = variant_attributes
        price_material_id = material_id

        if material.variant_attributes:
            effective_attrs = effective_attrs or material.variant_attributes
            master = await Material.filter(
                tenant_id=tenant_id,
                main_code=material.main_code,
                variant_managed=True,
                variant_attributes__isnull=True,
                deleted_at__isnull=True,
            ).first()
            if master:
                price_material_id = master.id
        elif material.variant_managed and not effective_attrs:
            price_material_id = material_id

        return price_material_id, effective_attrs

    @classmethod
    async def resolve(
        cls,
        tenant_id: int,
        partner_type: str,
        data: PartnerPriceResolveRequest,
    ) -> PartnerPriceResolveResponse:
        as_of = data.as_of or date.today()
        partner_id = data.partner_id
        material_id = data.material_id

        if not material_id and data.partner_material_code:
            material_id = await cls._resolve_material_id_by_partner_code(
                tenant_id, partner_type, partner_id, data.partner_material_code
            )
            if not material_id:
                return PartnerPriceResolveResponse(found=False, material_id=None)

        if not material_id:
            return PartnerPriceResolveResponse(found=False)

        price_material_id, effective_attrs = await cls._resolve_master_material_for_price(
            tenant_id, material_id, data.variant_attributes
        )

        alias = await cls._get_partner_alias(tenant_id, partner_type, partner_id, material_id)
        row = await cls._pick_price_row(tenant_id, partner_type, partner_id, price_material_id, as_of)
        if not row:
            return PartnerPriceResolveResponse(
                found=False,
                material_id=material_id,
                partner_material_code=alias.code if alias else None,
                partner_material_name=alias.name if alias else None,
            )
        unit_price, is_variant = cls._resolve_price_from_row(row, effective_attrs)
        if unit_price is None:
            return PartnerPriceResolveResponse(
                found=False,
                material_id=material_id,
                partner_material_code=alias.code if alias else None,
                partner_material_name=alias.name if alias else None,
            )
        return PartnerPriceResolveResponse(
            found=True,
            unit_price=unit_price,
            is_variant_price=is_variant,
            currency_code=row.currency_code,
            tax_rate=row.tax_rate,
            unit=row.unit,
            material_id=material_id,
            partner_material_code=alias.code if alias else None,
            partner_material_name=alias.name if alias else None,
            price_book_uuid=str(row.uuid),
        )

    @classmethod
    async def resolve_batch(
        cls,
        tenant_id: int,
        partner_type: str,
        data: PartnerPriceResolveBatchRequest,
    ) -> List[PartnerPriceResolveResponse]:
        as_of = data.as_of or date.today()
        results: List[PartnerPriceResolveResponse] = []
        lines: List[Tuple[int, Optional[Dict[str, Any]]]] = []
        if data.items:
            for item in data.items:
                lines.append((item.material_id, item.variant_attributes))
        elif data.material_ids:
            for material_id in data.material_ids:
                lines.append((material_id, None))
        for material_id, variant_attributes in lines:
            item = await cls.resolve(
                tenant_id,
                partner_type,
                PartnerPriceResolveRequest(
                    partner_id=data.partner_id,
                    material_id=material_id,
                    variant_attributes=variant_attributes,
                    as_of=as_of,
                ),
            )
            results.append(item)
        return results
