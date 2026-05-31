"""模具保养方案：按模具/方案加载模板行，校验并生成完修单存储结构。"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException, status

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_upkeep import (
    HaoligoMoldUpkeepParam,
    HaoligoMoldUpkeepParamSet,
    HaoligoMoldUpkeepParamSetItem,
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
    """按方案 id 返回有序模板行（无 record_value）。"""
    parent = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        return []
    items = (
        await tenant_alive(HaoligoMoldUpkeepParamSetItem, tenant_id)
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


async def mold_ledger_upkeep_param_set_id(tenant_id: int, mold_code: str) -> int | None:
    mc = (mold_code or "").strip()
    if not mc:
        return None
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold or mold.upkeep_param_set_id is None:
        return None
    return int(mold.upkeep_param_set_id)


async def load_upkeep_scheme_for_mold_code(tenant_id: int, mold_code: str) -> list[dict[str, Any]]:
    sid = await mold_ledger_upkeep_param_set_id(tenant_id, mold_code)
    if sid is None:
        return []
    return await load_upkeep_scheme_template_lines(tenant_id, sid)


async def resolve_upkeep_scheme_template_lines(
    tenant_id: int,
    mold_code: str,
    *,
    upkeep_param_set_id: int | None = None,
) -> list[dict[str, Any]]:
    """完修单行：优先使用行内所选方案，否则用台账绑定方案。"""
    if upkeep_param_set_id is not None:
        return await load_upkeep_scheme_template_lines(tenant_id, int(upkeep_param_set_id))
    return await load_upkeep_scheme_for_mold_code(tenant_id, mold_code)


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


async def build_upkeep_line_storage(
    tenant_id: int,
    mold_code: str,
    *,
    upkeep_param_set_id: Optional[int] = None,
    upkeep_content: Optional[str],
    upkeep_record_lines: Optional[list[dict[str, Any]]],
) -> dict[str, Any]:
    """
    保养完修行：有方案（台账绑定或行内所选）则按方案项校验 record_value；
    无方案则须填写自由文本 upkeep_content。
    """
    mc = (mold_code or "").strip()
    eff_set_id = upkeep_param_set_id
    if eff_set_id is not None:
        parent = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=eff_set_id).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养方案不存在")
    template = await resolve_upkeep_scheme_template_lines(tenant_id, mc, upkeep_param_set_id=eff_set_id)
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
                label=f"模具「{mc}」保养项「{tpl.get('param_name') or pid}」",
                value_type=str(tpl.get("value_type") or "text"),
                option_values=tpl.get("option_values") or None,
            )
            if tpl.get("is_required") and not rv:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"请填写模具「{mc}」保养项「{tpl.get('param_name') or tpl.get('param_code') or pid}」的保养记录",
                )
            stored.append({**tpl, "record_value": rv})
        summary = summarize_upkeep_content(stored)
        if not summary:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"请按保养方案填写模具「{mc}」的保养记录",
            )
        ledger_set_id = await mold_ledger_upkeep_param_set_id(tenant_id, mc)
        stored_set_id = eff_set_id if eff_set_id is not None else ledger_set_id
        out: dict[str, Any] = {
            "upkeep_content": summary,
            "upkeep_record_lines": stored,
            "upkeep_param_set_id": stored_set_id,
        }
        return out
    uc = (upkeep_content or "").strip() if upkeep_content is not None else ""
    if not uc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"请填写模具「{mc}」的保养内容",
        )
    if len(uc) > 4000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"模具「{mc}」保养内容最多 4000 字",
        )
    return {"upkeep_content": uc, "upkeep_record_lines": [], "upkeep_param_set_id": None}
