"""税务设置读写。"""

from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.gl_tax_settings import GlTaxSettings
from apps.kuaicaiwu.services.tax.tax_constants import (
    DEFAULT_SURCHARGE_RATES,
    DEFAULT_TAX_RATES,
    TAXPAYER_GENERAL,
)
from infra.exceptions.exceptions import ValidationError


class TaxSettingsService:
    async def get_or_create(self, tenant_id: int) -> GlTaxSettings:
        row = await GlTaxSettings.get_or_none(tenant_id=tenant_id, deleted_at__isnull=True)
        if row:
            return row
        return await GlTaxSettings.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            taxpayer_type=TAXPAYER_GENERAL,
            tax_rates=deepcopy(DEFAULT_TAX_RATES),
            surcharge_rates=deepcopy(DEFAULT_SURCHARGE_RATES),
            account_bindings={},
        )

    def _validate_tax_rates(self, rates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not rates:
            raise ValidationError("税率目录不能为空")
        normalized: List[Dict[str, Any]] = []
        seen: set[float] = set()
        for item in rates:
            rate = float(item.get("rate", 0))
            if rate in seen:
                raise ValidationError(f"重复税率: {rate}")
            seen.add(rate)
            normalized.append(
                {
                    "rate": rate,
                    "label": str(item.get("label") or f"{rate}%"),
                    "is_active": bool(item.get("is_active", True)),
                }
            )
        return normalized

    def _validate_surcharge_rates(self, rates: Dict[str, Any]) -> Dict[str, float]:
        keys = ("urban_construction", "education", "local_education")
        out: Dict[str, float] = {}
        for key in keys:
            val = float(rates.get(key, DEFAULT_SURCHARGE_RATES[key]))
            if val < 0 or val > 100:
                raise ValidationError(f"附加税税率 {key} 须在 0–100 之间")
            out[key] = val
        return out

    async def update_settings(self, tenant_id: int, data: Dict[str, Any]) -> GlTaxSettings:
        row = await self.get_or_create(tenant_id)
        if "taxpayer_type" in data:
            tt = str(data["taxpayer_type"]).strip()
            if tt not in ("general", "small_scale"):
                raise ValidationError("纳税人类型须为 general 或 small_scale")
            row.taxpayer_type = tt
        if "tax_rates" in data and data["tax_rates"] is not None:
            row.tax_rates = self._validate_tax_rates(list(data["tax_rates"]))
        if "surcharge_rates" in data and data["surcharge_rates"] is not None:
            row.surcharge_rates = self._validate_surcharge_rates(dict(data["surcharge_rates"]))
        if "account_bindings" in data and data["account_bindings"] is not None:
            bindings = dict(data["account_bindings"])
            for key, val in bindings.items():
                if val is not None and not isinstance(val, int):
                    raise ValidationError(f"科目绑定 {key} 须为科目 ID")
            row.account_bindings = bindings
        await row.save()
        return row

    def to_dict(self, row: GlTaxSettings) -> Dict[str, Any]:
        return {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "taxpayer_type": row.taxpayer_type,
            "tax_rates": row.tax_rates or [],
            "surcharge_rates": row.surcharge_rates or deepcopy(DEFAULT_SURCHARGE_RATES),
            "account_bindings": row.account_bindings or {},
        }

    async def require_account_id(
        self,
        tenant_id: int,
        binding_key: str,
        *,
        label: Optional[str] = None,
    ) -> int:
        row = await self.get_or_create(tenant_id)
        bindings = row.account_bindings or {}
        account_id = bindings.get(binding_key)
        if not account_id:
            raise ValidationError(f"税务设置未绑定科目: {label or binding_key}")
        return int(account_id)
