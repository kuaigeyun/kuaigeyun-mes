"""继电器换型矩阵查找（供 APS 软依赖；无表/未装包时安全降级）。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional, Set, Tuple

from loguru import logger


@dataclass
class ChangeoverContext:
    """租户级换型上下文：料号族矩阵 + 产线默认换型。"""

    fallback_hours: float = 0.0
    product_code_by_id: Dict[int, str] = field(default_factory=dict)
    known_families: Set[str] = field(default_factory=set)
    # (from_family, to_family) -> (hours, forbid_same_line)
    matrix: Dict[Tuple[str, str], Tuple[float, bool]] = field(default_factory=dict)
    # production_line_id -> default changeover hours
    line_default_hours: Dict[int, float] = field(default_factory=dict)
    available: bool = False

    def family_of(self, product_id: int) -> str:
        code = (self.product_code_by_id.get(int(product_id or 0)) or "").strip()
        if not code:
            return ""
        if code in self.known_families:
            return code
        best = ""
        for fam in self.known_families:
            if code.startswith(fam) and len(fam) > len(best):
                best = fam
        return best or code

    def lookup(
        self,
        from_product_id: int,
        to_product_id: int,
        *,
        production_line_id: Optional[int] = None,
    ) -> Tuple[float, bool, str]:
        """
        返回 (换型小时, 是否禁共线, 来源码)。

        来源码：same / matrix / line_default / fallback / none
        """
        a = int(from_product_id or 0)
        b = int(to_product_id or 0)
        if a <= 0 or b <= 0 or a == b:
            return 0.0, False, "same"
        from_fam = self.family_of(a)
        to_fam = self.family_of(b)
        if from_fam and to_fam and from_fam == to_fam:
            return 0.0, False, "same"
        if from_fam and to_fam:
            hit = self.matrix.get((from_fam, to_fam))
            if hit is not None:
                return float(hit[0]), bool(hit[1]), "matrix"
        line_id = int(production_line_id or 0)
        if line_id > 0 and line_id in self.line_default_hours:
            hours = float(self.line_default_hours[line_id])
            if hours > 0:
                return hours, False, "line_default"
        if self.fallback_hours > 0:
            return float(self.fallback_hours), False, "fallback"
        return 0.0, False, "none"


async def load_changeover_context(
    tenant_id: int,
    *,
    fallback_hours: float = 0.0,
    product_ids: Optional[Set[int]] = None,
) -> ChangeoverContext:
    """加载换型上下文；行业表不存在或查询失败时仅保留 fallback。"""
    ctx = ChangeoverContext(fallback_hours=float(fallback_hours or 0.0))
    try:
        from apps.ind_relay.models.changeover_matrix import RelayChangeoverMatrix
        from apps.ind_relay.models.line_capacity import RelayLineCapacity
        from apps.master_data.models.product import Product
    except Exception as exc:
        logger.debug("ind_relay changeover unavailable: {}", exc)
        return ctx

    try:
        rows = await RelayChangeoverMatrix.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).all()
        for row in rows:
            ff = (row.from_family or "").strip()
            tf = (row.to_family or "").strip()
            if not ff or not tf:
                continue
            minutes = float(row.changeover_minutes or 0)
            ctx.matrix[(ff, tf)] = (minutes / 60.0, bool(row.forbid_same_line))
            ctx.known_families.add(ff)
            ctx.known_families.add(tf)

        caps = await RelayLineCapacity.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
        ).all()
        for cap in caps:
            mins = float(cap.changeover_minutes_default or 0)
            if mins > 0:
                ctx.line_default_hours[int(cap.production_line_id)] = mins / 60.0

        ids = {int(i) for i in (product_ids or set()) if int(i or 0) > 0}
        if ids:
            for row in await Product.filter(
                tenant_id=tenant_id, id__in=list(ids), deleted_at__isnull=True
            ).values("id", "code"):
                ctx.product_code_by_id[int(row["id"])] = str(row.get("code") or "")
        ctx.available = bool(ctx.matrix or ctx.line_default_hours)
    except Exception as exc:
        logger.warning("load_changeover_context failed tenant={}: {}", tenant_id, exc)
        return ChangeoverContext(fallback_hours=float(fallback_hours or 0.0))
    return ctx
