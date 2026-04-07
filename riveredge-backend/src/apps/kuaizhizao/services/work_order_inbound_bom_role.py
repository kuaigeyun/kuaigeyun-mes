"""
工单生产入库类型（成品 vs 半成品）按 BOM 角色判定。

规则：若工单产出物料在任意有效 BOM 中曾作为子件（component_id）出现，则视为「半成品」；
否则视为「成品」。与主数据 list_bom_component_ids 口径一致（不含已作废 BOM 行）。
"""

from __future__ import annotations

from apps.master_data.services.material_service import MaterialService


async def is_semi_finished_product_by_bom_role(tenant_id: int, product_id: int) -> bool:
    if not product_id:
        return False
    component_ids = await MaterialService.list_bom_component_ids(tenant_id, include_obsolete=False)
    return int(product_id) in set(int(x) for x in component_ids if x is not None)
