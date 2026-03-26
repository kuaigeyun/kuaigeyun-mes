"""
波次拣货服务 (Wave Picking Service)

用于将多张叫料单/领料单合并为一张“波次拣货单”，并按照物料库位进行最优化动线排序。
解决车间多次零散叫料导致仓管员来回跑库的问题。

Author: Advanced Agent
Date: 2026-03-26
"""

from typing import List, Dict, Any
from collections import defaultdict
from decimal import Decimal
from loguru import logger
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem

class WavePickingService:
    @staticmethod
    async def generate_picking_wave(tenant_id: int, picking_ids: List[int]) -> Dict[str, Any]:
        """
        生成波次拣货虚拟合单
        
        逻辑：
        1. 捞取所有选中单据下的有效明细。
        2. 以“库位 + 物料”为基准进行分组累加。
        3. 利用库位字符排序实现简单的“S型/Z型最优步行路线”规划。
        """
        # 1. 抓取所有的领料明细，带有状态为“待领料”的
        items = await ProductionPickingItem.filter(
            tenant_id=tenant_id,
            picking_id__in=picking_ids,
            status="待领料",
            deleted_at__isnull=True
        ).prefetch_related("picking").all()
        
        if not items:
            raise ValueError("选中的单据中没有有效的待领料明细")
            
        # 2. 建立合并归拢 Map
        merged_map = defaultdict(lambda: {
            "warehouse_id": None,
            "warehouse_name": "",
            "location_code": "",
            "material_id": None,
            "material_code": "",
            "material_name": "",
            "total_quantity": Decimal("0"),
            "unit": "",
            "source_pickings": set()
        })
        
        for item in items:
            # 以库位+物料作为合并的主键
            loc = getattr(item, "location_code", "") or getattr(item, "warehouse_name", "") or "Z_未分配"
            key = f"{loc}_{item.material_id}"
            
            row = merged_map[key]
            row["warehouse_id"] = getattr(item, "warehouse_id", None)
            row["warehouse_name"] = getattr(item, "warehouse_name", "未知仓库")
            row["location_code"] = getattr(item, "location_code", "")
            row["material_id"] = item.material_id
            row["material_code"] = item.material_code
            row["material_name"] = getattr(item, "material_name", getattr(item, "material_code", "未知物料"))
            row["unit"] = getattr(item, "material_unit", "件")
            
            qty = item.required_quantity or Decimal("0")
            row["total_quantity"] += qty
            if getattr(item, "picking", None) and item.picking.picking_code:
                row["source_pickings"].add(item.picking.picking_code)
                
        # 3. 转换并按库位排序 (拟合最优路径推荐)
        result_items = []
        for v in merged_map.values():
            v["source_pickings"] = list(v["source_pickings"])
            v["total_quantity"] = float(v["total_quantity"])
            result_items.append(v)
            
        # 排序：优先按仓库名，再按库位码 (使得仓管按照 A-01, A-02, B-01 的顺序一直往前走)
        result_items.sort(key=lambda x: (x["warehouse_name"] or "", x["location_code"] or ""))
        
        # 4. 生成统一波次返回对象
        import datetime
        now_str = datetime.datetime.now().strftime("%Y%m%d-%H%M")
        wave_code = f"WAVE-{now_str}"
        
        return {
            "wave_code": wave_code,
            "source_picking_ids": picking_ids,
            "total_items": len(result_items),
            "merged_items": result_items
        }
