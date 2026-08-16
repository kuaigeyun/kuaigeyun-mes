"""原料行情维护与行情定价试算。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from tortoise.expressions import Q

from apps.master_data.constants.material_market_price_presets import MARKET_PRICE_PRESETS
from apps.master_data.models.material import Material
from apps.master_data.models.material_market_price import MaterialMarketPrice
from apps.master_data.services.market_float_formula import (
    evaluate_market_float_formula,
    normalize_market_float_formula,
)
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

_Q6 = Decimal("0.000001")
_PRICE_TYPES = frozenset({"tax_inclusive", "tax_exclusive"})


def _actor_fields(user: Optional[User], *, creating: bool) -> dict[str, Any]:
    if not user:
        return {}
    payload = {
        "updated_by": user.id,
        "updated_by_name": getattr(user, "full_name", None) or getattr(user, "username", None),
    }
    if creating:
        payload["created_by"] = user.id
        payload["created_by_name"] = payload["updated_by_name"]
    return payload


def _as_decimal(value: Any, default: str = "0") -> Decimal:
    if value is None or value == "":
        return Decimal(default)
    return Decimal(str(value))


def _defaults_dict(raw: Any) -> dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


def _sale_price_method(defaults: dict[str, Any]) -> str:
    raw = defaults.get("salePriceMethod") or defaults.get("sale_price_method") or "fixed"
    return "market" if str(raw) == "market" else "fixed"


def _tax_rate(defaults: dict[str, Any]) -> Decimal:
    return _as_decimal(defaults.get("defaultTaxRate") or defaults.get("default_tax_rate") or 0)


def _sale_price_type(defaults: dict[str, Any]) -> str:
    raw = defaults.get("defaultSalePriceType") or defaults.get("default_sale_price_type") or "tax_inclusive"
    return "tax_exclusive" if raw == "tax_exclusive" else "tax_inclusive"


def _normalize_code(code: Any) -> str:
    return str(code or "").strip()


def convert_unit_price(
    unit_price: Decimal,
    tax_rate: Decimal,
    from_type: str,
    to_type: str,
) -> Decimal:
    if from_type == to_type:
        return unit_price.quantize(_Q6, rounding=ROUND_HALF_UP)
    factor = Decimal("1") + (tax_rate / Decimal("100"))
    if factor <= 0:
        return unit_price.quantize(_Q6, rounding=ROUND_HALF_UP)
    if from_type == "tax_exclusive" and to_type == "tax_inclusive":
        return (unit_price * factor).quantize(_Q6, rounding=ROUND_HALF_UP)
    if from_type == "tax_inclusive" and to_type == "tax_exclusive":
        return (unit_price / factor).quantize(_Q6, rounding=ROUND_HALF_UP)
    return unit_price.quantize(_Q6, rounding=ROUND_HALF_UP)


class MaterialMarketPriceService:
    @staticmethod
    async def _get_material(tenant_id: int, *, material_uuid: str) -> Material:
        row = await Material.filter(tenant_id=tenant_id, uuid=material_uuid, deleted_at=None).first()
        if not row:
            raise NotFoundError("物料不存在")
        return row

    @staticmethod
    def _to_response_payload(row: MaterialMarketPrice) -> dict[str, Any]:
        return {
            "id": row.id,
            "uuid": row.uuid,
            "code": row.code,
            "name": row.name,
            "price_date": row.price_date,
            "unit_price": row.unit_price,
            "price_type": row.price_type,
            "created_by": row.created_by,
            "created_by_name": row.created_by_name,
            "updated_by": row.updated_by,
            "updated_by_name": row.updated_by_name,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    @staticmethod
    async def list_prices(
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        quote_code: Optional[str] = None,
        price_date: Optional[date] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        q = MaterialMarketPrice.filter(tenant_id=tenant_id, deleted_at=None)
        if quote_code:
            q = q.filter(code=_normalize_code(quote_code))
        if price_date is not None:
            q = q.filter(price_date=price_date)
        if keyword and keyword.strip():
            kw = keyword.strip()
            q = q.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await q.count()
        order = "-price_date"
        allowed = {"price_date", "unit_price", "code", "name", "created_at", "updated_at"}
        if sort_by in allowed:
            order = sort_by if (sort_order or "asc").lower() != "desc" else f"-{sort_by}"
        rows = await q.order_by(order, "-id").offset(skip).limit(limit)
        return [MaterialMarketPriceService._to_response_payload(row) for row in rows], total

    @staticmethod
    def _today() -> date:
        return to_site_date(resolve_business_datetime())

    @staticmethod
    async def list_preset_preview(tenant_id: int) -> list[dict[str, Any]]:
        today = MaterialMarketPriceService._today()
        existing = await MaterialMarketPrice.filter(
            tenant_id=tenant_id,
            price_date=today,
            deleted_at=None,
        ).values_list("code", flat=True)
        existing_codes = {str(code) for code in existing}
        return [
            {
                "code": item["code"],
                "name": item["name"],
                "exists": item["code"] in existing_codes,
            }
            for item in MARKET_PRICE_PRESETS
        ]

    @staticmethod
    async def load_presets(
        tenant_id: int,
        codes: Optional[list[str]] = None,
        *,
        user: Optional[User] = None,
    ) -> dict[str, Any]:
        today = MaterialMarketPriceService._today()
        selected = None if codes is None else {_normalize_code(c) for c in codes if _normalize_code(c)}
        items = [
            item
            for item in MARKET_PRICE_PRESETS
            if selected is None or item["code"] in selected
        ]
        created = 0
        skipped = 0
        for item in items:
            existing = await MaterialMarketPrice.get_or_none(
                tenant_id=tenant_id,
                code=item["code"],
                price_date=today,
                deleted_at=None,
            )
            if existing:
                skipped += 1
                continue
            await MaterialMarketPrice.create(
                tenant_id=tenant_id,
                code=item["code"],
                name=item["name"],
                price_date=today,
                unit_price=Decimal("0"),
                price_type="tax_inclusive",
                **_actor_fields(user, creating=True),
            )
            created += 1
        return {
            "created": created,
            "skipped": skipped,
            "price_date": today,
            "message": f"已加载 {created} 个常用品种，跳过 {skipped} 个已存在",
        }

    @staticmethod
    async def list_instruments(tenant_id: int) -> list[dict[str, str]]:
        rows = await MaterialMarketPrice.filter(tenant_id=tenant_id, deleted_at=None).order_by(
            "-price_date", "-id"
        )
        seen: dict[str, str] = {}
        for row in rows:
            if row.code not in seen:
                seen[row.code] = row.name
        return [{"code": code, "name": name} for code, name in seen.items()]

    @staticmethod
    async def get_by_uuid(tenant_id: int, row_uuid: str) -> dict[str, Any]:
        row = await MaterialMarketPrice.get_or_none(tenant_id=tenant_id, uuid=row_uuid, deleted_at=None)
        if not row:
            raise NotFoundError("原料行情不存在")
        return MaterialMarketPriceService._to_response_payload(row)

    @staticmethod
    async def upsert(
        tenant_id: int,
        data: dict[str, Any],
        *,
        user: Optional[User] = None,
    ) -> dict[str, Any]:
        code = _normalize_code(data.get("code"))
        name = _normalize_code(data.get("name")) or code
        price_date = data.get("price_date") or data.get("priceDate")
        unit_price = _as_decimal(data.get("unit_price") if data.get("unit_price") is not None else data.get("unitPrice"))
        price_type = data.get("price_type") or data.get("priceType") or "tax_inclusive"
        if not code:
            raise ValidationError("请输入行情品种编码")
        if price_type not in _PRICE_TYPES:
            raise ValidationError("价类无效")
        if unit_price <= 0:
            raise ValidationError("行情单价须大于0")
        if not isinstance(price_date, date):
            raise ValidationError("行情日无效")
        existing = await MaterialMarketPrice.get_or_none(
            tenant_id=tenant_id,
            code=code,
            price_date=price_date,
            deleted_at=None,
        )
        if existing:
            await existing.update_from_dict(
                {
                    "name": name,
                    "unit_price": unit_price,
                    "price_type": price_type,
                    **_actor_fields(user, creating=False),
                }
            ).save()
            row = existing
        else:
            row = await MaterialMarketPrice.create(
                tenant_id=tenant_id,
                code=code,
                name=name,
                price_date=price_date,
                unit_price=unit_price,
                price_type=price_type,
                **_actor_fields(user, creating=True),
            )
        await MaterialMarketPriceService.refresh_linked_default_sale_prices(
            tenant_id, quote_code=code, price_date=price_date, user=user
        )
        return MaterialMarketPriceService._to_response_payload(row)

    @staticmethod
    async def update_price(
        tenant_id: int,
        row_uuid: str,
        data: dict[str, Any],
        *,
        user: Optional[User] = None,
    ) -> dict[str, Any]:
        row = await MaterialMarketPrice.get_or_none(tenant_id=tenant_id, uuid=row_uuid, deleted_at=None)
        if not row:
            raise NotFoundError("原料行情不存在")
        patch: dict[str, Any] = {}
        if "name" in data and data["name"] is not None:
            patch["name"] = _normalize_code(data["name"]) or row.name
        if "unit_price" in data and data["unit_price"] is not None:
            price = _as_decimal(data["unit_price"])
            if price < 0:
                raise ValidationError("行情单价不能为负")
            patch["unit_price"] = price
        if "price_type" in data and data["price_type"] is not None:
            if data["price_type"] not in _PRICE_TYPES:
                raise ValidationError("价类无效")
            patch["price_type"] = data["price_type"]
        if patch:
            patch.update(_actor_fields(user, creating=False))
            await row.update_from_dict(patch).save()
        await MaterialMarketPriceService.refresh_linked_default_sale_prices(
            tenant_id, quote_code=row.code, price_date=row.price_date, user=user
        )
        return MaterialMarketPriceService._to_response_payload(row)

    @staticmethod
    async def delete_price(tenant_id: int, row_uuid: str, *, user: Optional[User] = None) -> None:
        row = await MaterialMarketPrice.get_or_none(tenant_id=tenant_id, uuid=row_uuid, deleted_at=None)
        if not row:
            raise NotFoundError("原料行情不存在")
        await row.update_from_dict(
            {
                "deleted_at": resolve_business_datetime(),
                **_actor_fields(user, creating=False),
            }
        ).save()

    @staticmethod
    async def refresh_linked_default_sale_prices(
        tenant_id: int,
        *,
        quote_code: str,
        price_date: date,
        user: Optional[User] = None,
    ) -> None:
        today = to_site_date(resolve_business_datetime())
        if price_date != today:
            return
        code = _normalize_code(quote_code)
        materials = await Material.filter(tenant_id=tenant_id, deleted_at=None).only(
            "id",
            "uuid",
            "defaults",
            "updated_at",
            "updated_by",
            "updated_by_name",
        )
        for material in materials:
            defaults = _defaults_dict(material.defaults)
            if _sale_price_method(defaults) != "market":
                continue
            linked = _normalize_code(
                defaults.get("marketBaseQuoteCode") or defaults.get("market_base_quote_code")
            )
            if linked != code:
                continue
            try:
                computed = await MaterialMarketPriceService.compute_market_sale_price(
                    tenant_id, material, price_date
                )
            except ValidationError:
                continue
            next_defaults = {**defaults, "defaultSalePrice": float(computed["display_price"])}
            patch = {"defaults": next_defaults, **_actor_fields(user, creating=False)}
            update_fields = list(patch.keys())
            if "updated_at" not in update_fields:
                update_fields.append("updated_at")
            await material.update_from_dict(patch).save(update_fields=update_fields)

    @staticmethod
    async def compute_market_sale_price(
        tenant_id: int,
        material: Material,
        price_date: date,
    ) -> dict[str, Any]:
        defaults = _defaults_dict(material.defaults)
        if _sale_price_method(defaults) != "market":
            raise ValidationError("该物料不是行情定价")
        quote_code = _normalize_code(
            defaults.get("marketBaseQuoteCode") or defaults.get("market_base_quote_code")
        )
        if not quote_code:
            raise ValidationError("请先选择关联的原料行情品种")
        factor_raw = defaults.get("marketQtyFactor")
        if factor_raw is None:
            factor_raw = defaults.get("market_qty_factor")
        factor = _as_decimal(factor_raw if factor_raw not in (None, "") else 1)
        if factor <= 0:
            factor = Decimal("1")
        fixed_raw = (
            defaults.get("marketFixedSalePrice")
            if defaults.get("marketFixedSalePrice") is not None
            else defaults.get("market_fixed_sale_price")
        )
        if fixed_raw is None:
            fixed_raw = defaults.get("marketProcessFee")
            if fixed_raw is None:
                fixed_raw = defaults.get("market_process_fee")
        fixed = _as_decimal(fixed_raw)
        formula = defaults.get("marketFloatFormula") or defaults.get("market_float_formula")
        if fixed < 0:
            raise ValidationError("固定售价不能为负")
        spot = await MaterialMarketPrice.get_or_none(
            tenant_id=tenant_id,
            code=quote_code,
            price_date=price_date,
            deleted_at=None,
        )
        if not spot or _as_decimal(spot.unit_price) <= 0:
            raise ValidationError("未维护该日原料行情，请到原料行情录入")
        tax = _tax_rate(defaults)
        sale_type = _sale_price_type(defaults)
        spot_norm = convert_unit_price(_as_decimal(spot.unit_price), tax, spot.price_type, sale_type)
        floating = evaluate_market_float_formula(formula, quote=spot_norm, factor=factor)
        display_price = (fixed + floating).quantize(_Q6, rounding=ROUND_HALF_UP)
        exclusive = convert_unit_price(display_price, tax, sale_type, "tax_exclusive")
        return {
            "display_price": display_price,
            "exclusive_price": exclusive,
            "tax_rate": tax,
            "sale_type": sale_type,
            "snapshot": {
                "priceDate": price_date.isoformat(),
                "quoteCode": spot.code,
                "quoteName": spot.name,
                "marketUnitPrice": str(spot.unit_price),
                "marketPriceType": spot.price_type,
                "qtyFactor": str(factor),
                "fixedSalePrice": str(fixed),
                "floatFormula": normalize_market_float_formula(formula),
                "floatAmount": str(floating),
                "resultUnitPrice": str(exclusive),
                "resultPriceType": "tax_exclusive",
            },
        }

    @staticmethod
    async def resolve_sale_price(
        tenant_id: int,
        material_uuid: str,
        price_date: date,
    ) -> dict[str, Any]:
        material = await MaterialMarketPriceService._get_material(tenant_id, material_uuid=material_uuid)
        defaults = _defaults_dict(material.defaults)
        method = _sale_price_method(defaults)
        tax = _tax_rate(defaults)
        if method != "market":
            raw = _as_decimal(defaults.get("defaultSalePrice") or defaults.get("default_sale_price"))
            exclusive = convert_unit_price(raw, tax, _sale_price_type(defaults), "tax_exclusive")
            return {
                "found": raw > 0,
                "sale_price_method": "fixed",
                "unit_price": exclusive,
                "tax_rate": tax,
                "snapshot": None,
                "message": None,
            }
        computed = await MaterialMarketPriceService.compute_market_sale_price(
            tenant_id, material, price_date
        )
        return {
            "found": True,
            "sale_price_method": "market",
            "unit_price": computed["exclusive_price"],
            "tax_rate": tax,
            "snapshot": computed["snapshot"],
            "message": None,
        }
