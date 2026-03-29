"""
统一库存服务

为领料、退料、入库、出库、盘点、调拨、组装、拆解等业务提供统一的库存增减接口。

业务逻辑：
- 主仓（normal/wip，如原材料仓、成品仓）：使用 MaterialBatch
- 线边仓（line_side）：使用 LineSideInventory，仅发料/配料时写入

采购入库、成品入库等入库操作 → 主仓 MaterialBatch
发料/配料到线边仓 → LineSideInventory

Author: RiverEdge Team
Date: 2026-02-28
"""

from decimal import Decimal
from typing import Optional, Dict, Any
from loguru import logger
from tortoise.transactions import atomic

from apps.kuaizhizao.utils.inventory_helper import get_material_inventory_info
from infra.services.business_config_service import BusinessConfigService


class InventoryService:
    """
    统一库存服务

    提供 increase_stock、decrease_stock、get_quantity、adjust_inventory 等接口，
    供 warehouse_service、stocktaking_service、assembly_order_service 等调用。
    """

    @staticmethod
    async def _get_warehouse_management_flags(tenant_id: int) -> tuple[bool, bool]:
        """读取仓储批号/序列号管理开关。"""
        from infra.services.business_config_service import BusinessConfigService

        cfg = await BusinessConfigService().get_business_config(tenant_id)
        wh = cfg.get("parameters", {}).get("warehouse", {})
        return bool(wh.get("batch_management", False)), bool(wh.get("serial_management", False))

    @staticmethod
    @atomic()
    async def increase_stock(
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
    ) -> bool:
        """
        增加库存

        Args:
            tenant_id: 租户ID
            material_id: 物料ID
            quantity: 增加数量
            warehouse_id: 仓库ID。根据 warehouse_type 决定：line_side→LineSideInventory，normal/wip→MaterialBatch
            batch_no: 批号（主仓必填，线边仓可选）
            source_type: 来源类型（如 production_picking, sales_delivery）
            source_doc_id: 来源单据ID
            source_doc_code: 来源单据编码

        Returns:
            是否成功
        """
        try:
            # 根据 warehouse_type 决定写入目标：line_side → LineSideInventory，否则 → MaterialBatch
            use_line_side = False
            if warehouse_id is not None:
                from apps.master_data.models.warehouse import Warehouse
                wh = await Warehouse.get_or_none(id=warehouse_id, deleted_at__isnull=True)
                if wh and wh.warehouse_type == "line_side":
                    use_line_side = True

            if not use_line_side:
                # 主仓（normal/wip 或 warehouse_id 为空）：使用 MaterialBatch
                from apps.master_data.models.material_batch import MaterialBatch
                from apps.master_data.models.material import Material
                from infra.exceptions.exceptions import BusinessLogicError

                batch_management_enabled, _ = await InventoryService._get_warehouse_management_flags(tenant_id)
                if batch_management_enabled:
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=material_id,
                        deleted_at__isnull=True,
                    )
                    if material and getattr(material, "batch_managed", False) and not (batch_no and str(batch_no).strip()):
                        material_code = getattr(material, "main_code", None) or getattr(material, "code", "")
                        raise BusinessLogicError(
                            f"物料 {material.name}（{material_code}）启用了批号管理，入库必须提供批号"
                        )

                batch_no = batch_no or "DEFAULT"
                batch = await MaterialBatch.filter(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=batch_no,
                    deleted_at__isnull=True,
                ).select_for_update().first()
                if batch:
                    batch.quantity = (batch.quantity or Decimal(0)) + quantity
                    await batch.save()
                else:
                    await MaterialBatch.create(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        batch_no=batch_no,
                        quantity=quantity,
                        status="in_stock",
                    )
                logger.info(
                    f"InventoryService.increase_stock: tenant={tenant_id} material={material_id} "
                    f"qty={quantity} warehouse={warehouse_id} batch={batch_no} source={source_type}"
                )
            else:
                # 线边仓（warehouse_type=line_side）：使用 LineSideInventory
                from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

                inv_filter = dict(
                    tenant_id=tenant_id,
                    warehouse_id=warehouse_id,
                    material_id=material_id,
                    deleted_at__isnull=True,
                    status="available",
                )
                if batch_no:
                    inv_filter["batch_no"] = batch_no
                inv = await LineSideInventory.filter(**inv_filter).select_for_update().first()
                if inv:
                    inv.quantity = (inv.quantity or Decimal(0)) + quantity
                    await inv.save()
                else:
                    from apps.master_data.models.material import Material

                    mat = await Material.get_or_none(id=material_id)
                    await LineSideInventory.create(
                        tenant_id=tenant_id,
                        warehouse_id=warehouse_id,
                        material_id=material_id,
                        material_code=mat.code if mat else "",
                        material_name=mat.name if mat else "",
                        batch_no=batch_no or "",
                        quantity=quantity,
                        reserved_quantity=Decimal(0),
                        status="available",
                        source_type=source_type or "direct",
                        source_doc_id=source_doc_id,
                        source_doc_code=source_doc_code or "",
                    )
                logger.info(
                    f"InventoryService.increase_stock(line_side): tenant={tenant_id} "
                    f"warehouse={warehouse_id} material={material_id} qty={quantity}"
                )
            return True
        except Exception as e:
            logger.error(f"InventoryService.increase_stock 失败: {e}")
            raise

    @staticmethod
    @atomic()
    async def decrease_stock(
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        enforce_fifo: bool = False,
    ) -> bool:
        """
        扣减库存

        Args:
            同 increase_stock
            enforce_fifo: 是否强校验先进先出（拦截）

        Returns:
            是否成功
        """
        try:
            # 根据 warehouse_type 决定扣减目标：line_side → LineSideInventory，否则 → MaterialBatch
            use_line_side = False
            if warehouse_id is not None:
                from apps.master_data.models.warehouse import Warehouse
                wh = await Warehouse.get_or_none(id=warehouse_id, deleted_at__isnull=True)
                if wh and wh.warehouse_type == "line_side":
                    use_line_side = True

            if not use_line_side:
                from apps.master_data.models.material_batch import MaterialBatch
                from apps.master_data.models.material import Material
                from infra.exceptions.exceptions import BusinessLogicError

                batch_management_enabled, _ = await InventoryService._get_warehouse_management_flags(tenant_id)
                cfg = await BusinessConfigService().get_business_config(tenant_id)
                wh_cfg = cfg.get("parameters", {}).get("warehouse", {})
                lifo_enabled = bool(wh_cfg.get("lifo", False))
                if batch_management_enabled:
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=material_id,
                        deleted_at__isnull=True,
                    )
                    if material and getattr(material, "batch_managed", False) and not (batch_no and str(batch_no).strip()):
                        material_code = getattr(material, "main_code", None) or getattr(material, "code", "")
                        raise BusinessLogicError(
                            f"物料 {material.name}（{material_code}）启用了批号管理，出库必须指定批号"
                        )

                if batch_no:
                    batch = await MaterialBatch.filter(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        batch_no=batch_no,
                        deleted_at__isnull=True,
                        status="in_stock",
                    ).select_for_update().first()
                    if not batch or (batch.quantity or 0) < quantity:
                        raise ValueError(
                            f"库存不足: material={material_id} batch={batch_no} "
                            f"need={quantity} have={batch.quantity if batch else 0}"
                        )
                        
                    # 阶段2：强制先进先出 (FIFO Strict Enforcement) 拦截网
                    if enforce_fifo:
                        # 检查是否有更早产生的（id 更小），且有库存的批次
                        older_batch = await MaterialBatch.filter(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            deleted_at__isnull=True,
                            status="in_stock",
                            quantity__gt=0,
                            id__lt=batch.id
                        ).order_by("id").first()
                        if older_batch:
                            from infra.exceptions.exceptions import BusinessLogicError
                            raise BusinessLogicError(
                                f"【防呆拦截】当前物料不符合先入先出！"
                                f"系统内仍存在早期旧批次 (批号:{older_batch.batch_no}) 未用完！"
                                f"请优先领用早期批次以防产品滞留过期。"
                            )
                    # 开启 LIFO 且未开启 FIFO 时，强制优先使用最新批次
                    if lifo_enabled and not enforce_fifo:
                        newer_batch = await MaterialBatch.filter(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            deleted_at__isnull=True,
                            status="in_stock",
                            quantity__gt=0,
                            id__gt=batch.id,
                        ).order_by("-id").first()
                        if newer_batch:
                            raise BusinessLogicError(
                                f"【防呆拦截】当前物料不符合后进先出！"
                                f"系统内仍存在更新批次 (批号:{newer_batch.batch_no}) 未用完！"
                                f"请优先领用最新批次。"
                            )
                    batch.quantity = (batch.quantity or Decimal(0)) - quantity
                    if batch.quantity <= 0:
                        batch.status = "out_stock"
                    await batch.save()
                else:
                    # 默认 FIFO；若开启 LIFO 且未开启 FIFO，则按最新批次扣减
                    order_key = "-id" if (lifo_enabled and not enforce_fifo) else "id"
                    batches = (
                        await MaterialBatch.filter(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            deleted_at__isnull=True,
                            status="in_stock",
                            quantity__gt=0,
                        )
                        .select_for_update()
                        .order_by(order_key)
                        .all()
                    )
                    remaining = quantity
                    for b in batches:
                        if remaining <= 0:
                            break
                        deduct = min(remaining, b.quantity or Decimal(0))
                        if deduct > 0:
                            b.quantity = (b.quantity or Decimal(0)) - deduct
                            if b.quantity <= 0:
                                b.status = "out_stock"
                            await b.save()
                            remaining -= deduct
                    if remaining > 0:
                        raise ValueError(
                            f"库存不足: material={material_id} need={quantity}"
                        )
                logger.info(
                    f"InventoryService.decrease_stock: tenant={tenant_id} material={material_id} "
                    f"qty={quantity} warehouse={warehouse_id} batch={batch_no}"
                )
            else:
                # 线边仓（warehouse_type=line_side）：扣减 LineSideInventory
                from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

                inv_filter = dict(
                    tenant_id=tenant_id,
                    warehouse_id=warehouse_id,
                    material_id=material_id,
                    deleted_at__isnull=True,
                    status="available",
                )
                if batch_no:
                    inv_filter["batch_no"] = batch_no
                inv = await LineSideInventory.filter(**inv_filter).select_for_update().first()
                if not inv:
                    raise ValueError(
                        f"线边仓无库存: warehouse={warehouse_id} material={material_id}"
                    )
                available = (inv.quantity or Decimal(0)) - (
                    inv.reserved_quantity or Decimal(0)
                )
                if available < quantity:
                    raise ValueError(
                        f"线边仓库存不足: warehouse={warehouse_id} material={material_id} "
                        f"need={quantity} available={available}"
                    )
                inv.quantity = (inv.quantity or Decimal(0)) - quantity
                await inv.save()
                logger.info(
                    f"InventoryService.decrease_stock(line_side): tenant={tenant_id} "
                    f"warehouse={warehouse_id} material={material_id} qty={quantity}"
                )
            return True
        except Exception as e:
            logger.error(f"InventoryService.decrease_stock 失败: {e}")
            raise

    @staticmethod
    async def get_quantity(
        tenant_id: int,
        material_id: int,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
    ) -> Decimal:
        """
        获取库存数量

        Returns:
            可用数量
        """
        info = await get_material_inventory_info(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
        )
        return Decimal(str(info["available_quantity"]))

    @staticmethod
    @atomic()
    async def adjust_inventory(
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> bool:
        """
        盘点调整库存（直接设置为指定数量，或增减）

        Args:
            quantity: 调整后数量（或调整量，由 reason 语义决定，此处为调整后数量）
            reason: 调整原因（如 stocktaking）

        Returns:
            是否成功
        """
        try:
            # 根据 warehouse_type 决定调整目标：line_side → LineSideInventory，否则 → MaterialBatch
            use_line_side = False
            if warehouse_id is not None:
                from apps.master_data.models.warehouse import Warehouse
                wh = await Warehouse.get_or_none(id=warehouse_id, deleted_at__isnull=True)
                if wh and wh.warehouse_type == "line_side":
                    use_line_side = True

            if not use_line_side:
                from apps.master_data.models.material_batch import MaterialBatch

                batch_no = batch_no or "DEFAULT"
                batch = await MaterialBatch.filter(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=batch_no,
                    deleted_at__isnull=True,
                ).select_for_update().first()
                if batch:
                    batch.quantity = quantity
                    batch.status = "in_stock" if quantity > 0 else "out_stock"
                    await batch.save()
                else:
                    await MaterialBatch.create(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        batch_no=batch_no,
                        quantity=quantity,
                        status="in_stock" if quantity > 0 else "out_stock",
                    )
                logger.info(
                    f"InventoryService.adjust_inventory: tenant={tenant_id} "
                    f"material={material_id} qty={quantity} reason={reason}"
                )
            else:
                from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

                inv = await LineSideInventory.filter(
                    tenant_id=tenant_id,
                    warehouse_id=warehouse_id,
                    material_id=material_id,
                    deleted_at__isnull=True,
                ).select_for_update().first()
                if inv:
                    inv.quantity = quantity
                    await inv.save()
                else:
                    from apps.master_data.models.material import Material

                    mat = await Material.get_or_none(id=material_id)
                    await LineSideInventory.create(
                        tenant_id=tenant_id,
                        warehouse_id=warehouse_id,
                        material_id=material_id,
                        material_code=mat.code if mat else "",
                        material_name=mat.name if mat else "",
                        batch_no=batch_no or "",
                        quantity=quantity,
                        reserved_quantity=Decimal(0),
                        status="available",
                        source_type="stocktaking",
                    )
                logger.info(
                    f"InventoryService.adjust_inventory(line_side): tenant={tenant_id} "
                    f"warehouse={warehouse_id} material={material_id} qty={quantity}"
                )
            return True
        except Exception as e:
            logger.error(f"InventoryService.adjust_inventory 失败: {e}")
            raise
