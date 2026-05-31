"""设备保养方案：按设备/方案加载模板行，校验并生成完修单存储结构。"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException, status

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_upkeep_param import (
    HaoligoEquipmentUpkeepParam,
    HaoligoEquipmentUpkeepParamSet,
    HaoligoEquipmentUpkeepParamSetItem,
)
from apps.haoligo.services.mold_upkeep_param_value import (
    normalize_upkeep_record_value,
    normalize_upkeep_value_type,
    option_values_for_param,
)

_RECORD_VALUE_MAX = 2000


def summarize_upkeep_content(record_lines: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for ln in record_lines:
        name = (ln.get("param_name") or "").strip()
        val = (ln.get("record_value") or "").strip()
        if not name and not val:
            continue
        if val:
            parts.append(f"【{name}】{val}" if name else val)
        elif name:
            parts.append(f"【{name}】")
    return "\n".join(parts)


async def load_upkeep_scheme_template_lines(tenant_id: int, set_id: int) -> list[dict[str, Any]]:
    parent = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        return []
    items = (
        await tenant_alive(HaoligoEquipmentUpkeepParamSetItem, tenant_id)
        .filter(set_id=set_id)
        .order_by("sort_order", "id")
        .prefetch_related("param")
    )
    out: list[dict[str, Any]] = []
    for it in items:
        p = it.param
        if p is None or p.deleted_at is not None:
            continue
        vt = normalize_upkeep_value_type(getattr(p, "value_type", None))
        opts = option_values_for_param(vt, getattr(p, "default_value", None))
        out.append(
            {
                "param_id": p.id,
                "param_code": (p.code or "").strip(),
                "param_name": (p.name or "").strip(),
                "requirement": (p.requirement or "").strip() or None,
                "value_type": vt,
                "option_values": opts,
                "is_required": bool(it.is_required),
                "sort_order": int(it.sort_order or 0),
                "record_value": None,
            }
        )
    return out


async def equipment_ledger_upkeep_param_set_id(tenant_id: int, equipment_id: int) -> int | None:
    row = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not row or row.upkeep_param_set_id is None:
        return None
    return int(row.upkeep_param_set_id)


async def load_upkeep_scheme_for_equipment(tenant_id: int, equipment_id: int) -> list[dict[str, Any]]:
    sid = await equipment_ledger_upkeep_param_set_id(tenant_id, equipment_id)
    if sid is None:
        return []
    return await load_upkeep_scheme_template_lines(tenant_id, sid)


async def resolve_upkeep_scheme_template_lines(
    tenant_id: int,
    equipment_id: int,
    *,
    upkeep_param_set_id: int | None = None,
) -> list[dict[str, Any]]:
    if upkeep_param_set_id is not None:
        return await load_upkeep_scheme_template_lines(tenant_id, int(upkeep_param_set_id))
    return await load_upkeep_scheme_for_equipment(tenant_id, equipment_id)


def _clip_record_value(
    raw: Optional[str],
    *,
    label: str,
    value_type: str = "text",
    option_values: Optional[list[str]] = None,
) -> Optional[str]:
    if raw is None:
        return None
    try:
        s = normalize_upkeep_record_value(
            value_type,
            raw,
            option_values=option_values,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label}：{e}",
        ) from e
    if not s:
        return None
    if len(s) > _RECORD_VALUE_MAX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label}最多 {_RECORD_VALUE_MAX} 字",
        )
    return s


async def build_equipment_upkeep_completion_storage(
    tenant_id: int,
    equipment_id: int,
    *,
    upkeep_param_set_id: Optional[int] = None,
    completion_content: Optional[str],
    upkeep_record_lines: Optional[list[dict[str, Any]]],
) -> dict[str, Any]:
    """保养完修：有方案则按保养项填 record_value；无方案则须填写自由文本 completion_content。"""
    eff_set_id = upkeep_param_set_id
    if eff_set_id is not None:
        parent = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=eff_set_id).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养方案不存在")
    template = await resolve_upkeep_scheme_template_lines(
        tenant_id, equipment_id, upkeep_param_set_id=eff_set_id
    )
    if template:
        by_param: dict[int, dict[str, Any]] = {}
        for raw in upkeep_record_lines or []:
            if not isinstance(raw, dict):
                continue
            try:
                pid = int(raw.get("param_id"))
            except (TypeError, ValueError):
                continue
            by_param[pid] = raw
        stored: list[dict[str, Any]] = []
        for tpl in template:
            pid = int(tpl["param_id"])
            client = by_param.get(pid)
            rv = _clip_record_value(
                (client or {}).get("record_value") if client else None,
                label=f"保养项「{tpl.get('param_name') or pid}」",
                value_type=str(tpl.get("value_type") or "text"),
                option_values=tpl.get("option_values") or None,
            )
            if tpl.get("is_required") and not rv:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"请填写保养项「{tpl.get('param_name') or tpl.get('param_code') or pid}」的保养记录",
                )
            stored.append({**tpl, "record_value": rv})
        summary = summarize_upkeep_content(stored)
        if not summary:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请按保养方案填写保养记录",
            )
        ledger_set_id = await equipment_ledger_upkeep_param_set_id(tenant_id, equipment_id)
        stored_set_id = eff_set_id if eff_set_id is not None else ledger_set_id
        return {
            "completion_content": summary,
            "upkeep_record_lines": stored,
            "upkeep_param_set_id": stored_set_id,
        }
    uc = (completion_content or "").strip() if completion_content is not None else ""
    if not uc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请填写保养完成说明，或选择带保养项的保养方案后逐项填写",
        )
    if len(uc) > 4000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="保养完成说明最多 4000 字",
        )
    return {"completion_content": uc, "upkeep_record_lines": [], "upkeep_param_set_id": None}
