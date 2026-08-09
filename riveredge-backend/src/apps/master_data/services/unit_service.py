"""物料单位与全局换算服务。"""

from __future__ import annotations

import math
from typing import Any, Optional

from tortoise.expressions import Q

from apps.master_data.constants.unit_presets import SYSTEM_CONVERSION_PRESETS, SYSTEM_UNIT_PRESETS
from apps.master_data.models.material import Material
from apps.master_data.models.unit import MaterialUnit, MaterialUnitConversion
from apps.master_data.schemas.unit_schemas import (
    MaterialUnitConversionResolveResponse,
    MaterialUnitEnsurePresetsResponse,
)
from core.models.data_dictionary import DataDictionary
from core.models.dictionary_item import DictionaryItem
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


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


def _normalize_code(code: str) -> str:
    return str(code or "").strip()


class MaterialUnitService:
    """单位目录 CRUD + 预设/回填。"""

    @staticmethod
    async def list_units(
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> tuple[list[MaterialUnit], int]:
        q = MaterialUnit.filter(tenant_id=tenant_id, deleted_at=None)
        if is_active is not None:
            q = q.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            q = q.filter(Q(code__icontains=kw) | Q(name__icontains=kw) | Q(description__icontains=kw))
        total = await q.count()
        order = "sort_order"
        if sort_by in {"code", "name", "sort_order", "is_active", "created_at", "updated_at"}:
            order = sort_by if (sort_order or "asc").lower() != "desc" else f"-{sort_by}"
        else:
            order = "sort_order"
        items = await q.order_by(order, "id").offset(skip).limit(limit)
        return items, total

    @staticmethod
    async def get_by_uuid(tenant_id: int, unit_uuid: str) -> MaterialUnit:
        row = await MaterialUnit.get_or_none(tenant_id=tenant_id, uuid=unit_uuid, deleted_at=None)
        if not row:
            raise NotFoundError("单位不存在")
        return row

    @staticmethod
    async def create_unit(
        tenant_id: int,
        data: dict[str, Any],
        *,
        user: Optional[User] = None,
        is_system: bool = False,
    ) -> MaterialUnit:
        code = _normalize_code(data.get("code", ""))
        name = _normalize_code(data.get("name", "")) or code
        if not code:
            raise ValidationError("单位编码不能为空")
        exists = await MaterialUnit.filter(tenant_id=tenant_id, code=code, deleted_at=None).exists()
        if exists:
            raise ValidationError(f"单位编码已存在: {code}")
        return await MaterialUnit.create(
            tenant_id=tenant_id,
            code=code,
            name=name,
            is_active=bool(data.get("is_active", True)),
            is_system=is_system,
            sort_order=int(data.get("sort_order") or 0),
            description=(data.get("description") or None),
            **_actor_fields(user, creating=True),
        )

    @staticmethod
    async def update_unit(
        tenant_id: int,
        unit_uuid: str,
        data: dict[str, Any],
        *,
        user: Optional[User] = None,
    ) -> MaterialUnit:
        row = await MaterialUnitService.get_by_uuid(tenant_id, unit_uuid)
        patch: dict[str, Any] = {}
        if "name" in data and data["name"] is not None:
            patch["name"] = _normalize_code(data["name"]) or row.name
        if "is_active" in data and data["is_active"] is not None:
            patch["is_active"] = bool(data["is_active"])
        if "sort_order" in data and data["sort_order"] is not None:
            patch["sort_order"] = int(data["sort_order"])
        if "description" in data:
            patch["description"] = data["description"]
        if patch:
            patch.update(_actor_fields(user, creating=False))
            await row.update_from_dict(patch).save()
        return await MaterialUnitService.get_by_uuid(tenant_id, unit_uuid)

    @staticmethod
    async def delete_unit(tenant_id: int, unit_uuid: str, *, user: Optional[User] = None) -> None:
        row = await MaterialUnitService.get_by_uuid(tenant_id, unit_uuid)
        if row.is_system:
            raise ValidationError("系统内置单位不可删除，可停用")
        await row.update_from_dict(
            {
                "deleted_at": resolve_business_datetime(),
                "is_active": False,
                **_actor_fields(user, creating=False),
            }
        ).save()

    @staticmethod
    async def ensure_presets_and_backfill(
        tenant_id: int,
        *,
        user: Optional[User] = None,
    ) -> MaterialUnitEnsurePresetsResponse:
        units_created = 0
        conversions_created = 0
        units_backfilled = 0

        for preset in SYSTEM_UNIT_PRESETS:
            exists = await MaterialUnit.filter(
                tenant_id=tenant_id, code=preset["code"], deleted_at=None
            ).exists()
            if exists:
                continue
            await MaterialUnit.create(
                tenant_id=tenant_id,
                code=preset["code"],
                name=preset["name"],
                description=preset.get("description"),
                sort_order=preset["sort_order"],
                is_system=True,
                is_active=True,
                **_actor_fields(user, creating=True),
            )
            units_created += 1

        # 字典 MATERIAL_UNIT 历史项
        dicts = await DataDictionary.filter(tenant_id=tenant_id, code="MATERIAL_UNIT").all()
        for d in dicts:
            items = await DictionaryItem.filter(tenant_id=tenant_id, dictionary_id=d.id).all()
            for it in items:
                code = _normalize_code(it.value or it.label or "")
                if not code:
                    continue
                exists = await MaterialUnit.filter(
                    tenant_id=tenant_id, code=code, deleted_at=None
                ).exists()
                if exists:
                    continue
                await MaterialUnit.create(
                    tenant_id=tenant_id,
                    code=code,
                    name=_normalize_code(it.label or code) or code,
                    description=it.description,
                    sort_order=int(getattr(it, "sort_order", 0) or 0),
                    is_system=False,
                    is_active=bool(getattr(it, "is_active", True)),
                    **_actor_fields(user, creating=True),
                )
                units_backfilled += 1

        # 物料上出现过的单位
        materials = await Material.filter(tenant_id=tenant_id, deleted_at=None).only(
            "base_unit", "units"
        )
        seen: set[str] = set()
        for m in materials:
            codes: list[str] = []
            if m.base_unit:
                codes.append(str(m.base_unit))
            units_payload = m.units if isinstance(m.units, dict) else {}
            for u in units_payload.get("units") or []:
                if isinstance(u, dict) and u.get("unit"):
                    codes.append(str(u["unit"]))
            scenarios = units_payload.get("scenarios") or {}
            if isinstance(scenarios, dict):
                for v in scenarios.values():
                    if v:
                        codes.append(str(v))
            for raw in codes:
                code = _normalize_code(raw)
                if not code or code in seen:
                    continue
                seen.add(code)
                exists = await MaterialUnit.filter(
                    tenant_id=tenant_id, code=code, deleted_at=None
                ).exists()
                if exists:
                    continue
                await MaterialUnit.create(
                    tenant_id=tenant_id,
                    code=code,
                    name=code,
                    is_system=False,
                    is_active=True,
                    sort_order=999,
                    **_actor_fields(user, creating=True),
                )
                units_backfilled += 1

        for preset in SYSTEM_CONVERSION_PRESETS:
            exists = await MaterialUnitConversion.filter(
                tenant_id=tenant_id,
                from_unit_code=preset["from_unit_code"],
                to_unit_code=preset["to_unit_code"],
                deleted_at=None,
            ).exists()
            if exists:
                continue
            # 确保两端单位存在
            for side in (preset["from_unit_code"], preset["to_unit_code"]):
                if not await MaterialUnit.filter(
                    tenant_id=tenant_id, code=side, deleted_at=None
                ).exists():
                    await MaterialUnit.create(
                        tenant_id=tenant_id,
                        code=side,
                        name=side,
                        is_system=True,
                        is_active=True,
                        **_actor_fields(user, creating=True),
                    )
            await MaterialUnitConversion.create(
                tenant_id=tenant_id,
                from_unit_code=preset["from_unit_code"],
                to_unit_code=preset["to_unit_code"],
                numerator=preset["numerator"],
                denominator=preset["denominator"],
                description=preset.get("description"),
                is_system=True,
                is_active=True,
                **_actor_fields(user, creating=True),
            )
            conversions_created += 1

        return MaterialUnitEnsurePresetsResponse(
            units_created=units_created,
            conversions_created=conversions_created,
            units_backfilled=units_backfilled,
        )


class MaterialUnitConversionService:
    """全局换算 CRUD + resolve。"""

    @staticmethod
    def _validate_pair(from_code: str, to_code: str, numerator: int, denominator: int) -> None:
        if not from_code or not to_code:
            raise ValidationError("源单位与目标单位不能为空")
        if from_code == to_code:
            raise ValidationError("源单位与目标单位不能相同")
        if numerator <= 0 or denominator <= 0:
            raise ValidationError("分子与分母须为正整数")

    @staticmethod
    async def list_conversions(
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[list[MaterialUnitConversion], int]:
        q = MaterialUnitConversion.filter(tenant_id=tenant_id, deleted_at=None)
        if is_active is not None:
            q = q.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            q = q.filter(
                Q(from_unit_code__icontains=kw)
                | Q(to_unit_code__icontains=kw)
                | Q(description__icontains=kw)
            )
        total = await q.count()
        items = await q.order_by("from_unit_code", "to_unit_code", "id").offset(skip).limit(limit)
        return items, total

    @staticmethod
    async def get_by_uuid(tenant_id: int, conv_uuid: str) -> MaterialUnitConversion:
        row = await MaterialUnitConversion.get_or_none(
            tenant_id=tenant_id, uuid=conv_uuid, deleted_at=None
        )
        if not row:
            raise NotFoundError("换算关系不存在")
        return row

    @staticmethod
    async def create_conversion(
        tenant_id: int,
        data: dict[str, Any],
        *,
        user: Optional[User] = None,
        is_system: bool = False,
    ) -> MaterialUnitConversion:
        from_code = _normalize_code(data.get("from_unit_code", ""))
        to_code = _normalize_code(data.get("to_unit_code", ""))
        numerator = int(data.get("numerator") or 0)
        denominator = int(data.get("denominator") or 0)
        MaterialUnitConversionService._validate_pair(from_code, to_code, numerator, denominator)
        for code in (from_code, to_code):
            if not await MaterialUnit.filter(tenant_id=tenant_id, code=code, deleted_at=None).exists():
                raise ValidationError(f"单位不存在: {code}，请先在单位管理中创建")
        exists = await MaterialUnitConversion.filter(
            tenant_id=tenant_id,
            from_unit_code=from_code,
            to_unit_code=to_code,
            deleted_at=None,
        ).exists()
        if exists:
            raise ValidationError(f"换算关系已存在: 1{from_code}→{to_code}")
        return await MaterialUnitConversion.create(
            tenant_id=tenant_id,
            from_unit_code=from_code,
            to_unit_code=to_code,
            numerator=numerator,
            denominator=denominator,
            is_active=bool(data.get("is_active", True)),
            is_system=is_system,
            description=data.get("description"),
            **_actor_fields(user, creating=True),
        )

    @staticmethod
    async def update_conversion(
        tenant_id: int,
        conv_uuid: str,
        data: dict[str, Any],
        *,
        user: Optional[User] = None,
    ) -> MaterialUnitConversion:
        row = await MaterialUnitConversionService.get_by_uuid(tenant_id, conv_uuid)
        patch: dict[str, Any] = {}
        if "numerator" in data and data["numerator"] is not None:
            patch["numerator"] = int(data["numerator"])
        if "denominator" in data and data["denominator"] is not None:
            patch["denominator"] = int(data["denominator"])
        if "is_active" in data and data["is_active"] is not None:
            patch["is_active"] = bool(data["is_active"])
        if "description" in data:
            patch["description"] = data["description"]
        num = patch.get("numerator", row.numerator)
        den = patch.get("denominator", row.denominator)
        MaterialUnitConversionService._validate_pair(
            row.from_unit_code, row.to_unit_code, int(num), int(den)
        )
        if patch:
            patch.update(_actor_fields(user, creating=False))
            await row.update_from_dict(patch).save()
        return await MaterialUnitConversionService.get_by_uuid(tenant_id, conv_uuid)

    @staticmethod
    async def delete_conversion(
        tenant_id: int, conv_uuid: str, *, user: Optional[User] = None
    ) -> None:
        row = await MaterialUnitConversionService.get_by_uuid(tenant_id, conv_uuid)
        if row.is_system:
            raise ValidationError("系统内置换算不可删除，可停用")
        await row.update_from_dict(
            {
                "deleted_at": resolve_business_datetime(),
                "is_active": False,
                **_actor_fields(user, creating=False),
            }
        ).save()

    @staticmethod
    def _to_material_factors(
        *,
        base_unit: str,
        aux_unit: str,
        from_code: str,
        to_code: str,
        numerator: int,
        denominator: int,
    ) -> tuple[int, int] | None:
        """
        全局：1 from = (n/d) × to
        物料：1 aux = (mn/md) × base
        """
        base = _normalize_code(base_unit)
        aux = _normalize_code(aux_unit)
        if not base or not aux or base == aux:
            return None
        # 表存 1 from=(n/d)×to；料级要 1 aux=(mn/md)×base
        if from_code == aux and to_code == base:
            return numerator, denominator
        if from_code == base and to_code == aux:
            return denominator, numerator
        return None

    @staticmethod
    async def resolve_for_material(
        tenant_id: int,
        *,
        base_unit: str,
        aux_unit: str,
    ) -> MaterialUnitConversionResolveResponse:
        base = _normalize_code(base_unit)
        aux = _normalize_code(aux_unit)
        empty = MaterialUnitConversionResolveResponse(
            found=False, from_unit_code=aux, to_unit_code=base
        )
        if not base or not aux or base == aux:
            return empty

        # 优先查 1 aux → base 方向（或反向）
        row = await MaterialUnitConversion.get_or_none(
            tenant_id=tenant_id,
            from_unit_code=aux,
            to_unit_code=base,
            deleted_at=None,
            is_active=True,
        )
        if not row:
            row = await MaterialUnitConversion.get_or_none(
                tenant_id=tenant_id,
                from_unit_code=base,
                to_unit_code=aux,
                deleted_at=None,
                is_active=True,
            )
        if not row:
            return empty

        factors = MaterialUnitConversionService._to_material_factors(
            base_unit=base,
            aux_unit=aux,
            from_code=row.from_unit_code,
            to_code=row.to_unit_code,
            numerator=int(row.numerator),
            denominator=int(row.denominator),
        )
        if not factors:
            return empty
        mn, md = factors
        g = math.gcd(mn, md)
        mn, md = mn // g, md // g
        return MaterialUnitConversionResolveResponse(
            found=True,
            from_unit_code=row.from_unit_code,
            to_unit_code=row.to_unit_code,
            numerator=int(row.numerator),
            denominator=int(row.denominator),
            material_numerator=mn,
            material_denominator=md,
        )
