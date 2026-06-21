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
from datetime import date
from loguru import logger
from tortoise.exceptions import IntegrityError
from tortoise.transactions import atomic, in_transaction

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
    def _ownership_filter(
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> dict:
        ot = ownership_type or "company_owned"
        cid = customer_id if customer_id is not None else 0
        return {"ownership_type": ot, "customer_id": cid}

    @staticmethod
    def _normalize_batch_no_for_ledger(batch_no: Optional[str]) -> str:
        bn = str(batch_no or "").strip()
        return bn if bn else "DEFAULT"

    @staticmethod
    def _material_batch_no_lookup_q(batch_no: Optional[str]):
        from tortoise.expressions import Q

        bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
        if bn == "DEFAULT":
            return Q(batch_no="DEFAULT") | Q(batch_no="")
        return Q(batch_no=bn)

    @staticmethod
    async def _find_in_stock_material_batch(
        tenant_id: int,
        material_id: int,
        batch_no: Optional[str],
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        *,
        for_update: bool = False,
    ):
        from apps.master_data.models.material_batch import MaterialBatch

        own = InventoryService._ownership_filter(ownership_type, customer_id)
        q = InventoryService._material_batch_no_lookup_q(batch_no)
        query = MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            status="in_stock",
            **own,
        ).filter(q)
        if for_update:
            query = query.select_for_update()
        return await query.first()

    @staticmethod
    async def _material_batch_increase_or_restore(
        tenant_id: int,
        material_id: int,
        batch_no: str,
        quantity: Decimal,
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        customer_name: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        ledger_production_date: Optional[date] = None,
    ) -> None:
        """
        主仓批次数量增加。包含软删行：若 (tenant, material, batch_no) 已存在但 deleted_at 有值，
        仅查未删行会误判为不存在，insert 会撞唯一约束 uid_apps_master_batch_tenant_material_batch。
        """
        from apps.master_data.models.material_batch import MaterialBatch

        bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
        own = InventoryService._ownership_filter(ownership_type, customer_id)
        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            batch_no=bn,
            **own,
        ).select_for_update().first()
        if batch:
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = (batch.quantity or Decimal(0)) + quantity
            batch.status = "in_stock"
            if customer_name:
                batch.customer_name = customer_name
            if source_doc_id:
                batch.source_doc_id = source_doc_id
            if source_doc_code:
                batch.source_doc_code = source_doc_code
            if ledger_production_date is not None and batch.production_date is None:
                batch.production_date = ledger_production_date
            await batch.save()
            return
        try:
            async with in_transaction():
                await MaterialBatch.create(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=bn,
                    quantity=quantity,
                    status="in_stock",
                    production_date=ledger_production_date,
                    ownership_type=own["ownership_type"],
                    customer_id=own["customer_id"],
                    customer_name=customer_name,
                    source_doc_id=source_doc_id,
                    source_doc_code=source_doc_code,
                )
        except IntegrityError:
            batch = await MaterialBatch.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                batch_no=bn,
                **own,
            ).select_for_update().first()
            if not batch:
                from infra.exceptions.exceptions import BusinessLogicError

                legacy = await MaterialBatch.filter(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=bn,
                    deleted_at__isnull=True,
                ).first()
                if legacy and (
                    legacy.ownership_type != own["ownership_type"]
                    or int(legacy.customer_id or 0) != int(own["customer_id"])
                ):
                    raise BusinessLogicError(
                        f"批号 {bn} 已存在其他归属的库存记录"
                        f"（现有：{legacy.ownership_type or 'company_owned'}"
                        f"{f'，客户 {legacy.customer_name}' if legacy.customer_name else ''}；"
                        f"本次：{own['ownership_type']}）。"
                        f"自购入库与客供库存请分别记账；若系统仍报唯一约束冲突，"
                        f"请执行数据库迁移 396（修复批次归属唯一索引）。"
                    )
                raise
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = (batch.quantity or Decimal(0)) + quantity
            batch.status = "in_stock"
            if ledger_production_date is not None and batch.production_date is None:
                batch.production_date = ledger_production_date
            await batch.save()

    @staticmethod
    async def _material_batch_adjust_set(
        tenant_id: int,
        material_id: int,
        batch_no: str,
        quantity: Decimal,
    ) -> None:
        """盘点等场景直接设定批次数量；与 increase 相同需处理软删行与并发 insert。"""
        from apps.master_data.models.material_batch import MaterialBatch

        bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            batch_no=bn,
        ).select_for_update().first()
        if batch:
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = quantity
            batch.status = "in_stock" if quantity > 0 else "out_stock"
            await batch.save()
            return
        try:
            async with in_transaction():
                await MaterialBatch.create(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=bn,
                    quantity=quantity,
                    status="in_stock" if quantity > 0 else "out_stock",
                )
        except IntegrityError:
            batch = await MaterialBatch.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                batch_no=bn,
            ).select_for_update().first()
            if not batch:
                raise
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = quantity
            batch.status = "in_stock" if quantity > 0 else "out_stock"
            await batch.save()

    @staticmethod
    async def _increase_stock_no_atomic(
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        serial_nos: Optional[list[str]] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        work_order_id: Optional[int] = None,
        work_order_code: Optional[str] = None,
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        customer_name: Optional[str] = None,
        ledger_production_date: Optional[date] = None,
    ) -> bool:
        """
        增加库存（不开启独立事务）。
        """
        try:
            # 根据 warehouse_type 决定写入目标
            use_line_side = False
            wh = None
            if warehouse_id is not None:
                from apps.master_data.models.warehouse import Warehouse
                wh = await Warehouse.get_or_none(id=warehouse_id, deleted_at__isnull=True)
                if wh and wh.warehouse_type == "line_side":
                    use_line_side = True

            from apps.master_data.models.material import Material
            from infra.exceptions.exceptions import BusinessLogicError

            batch_management_enabled, serial_management_enabled = False, False
            try:
                batch_management_enabled, serial_management_enabled = await InventoryService._get_warehouse_management_flags(tenant_id)
            except Exception as _flag_exc:
                logger.warning(f"获取仓库管理标志失败（跳过批号/序列号强制校验）: {_flag_exc}")
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id, deleted_at__isnull=True)

            if not use_line_side:
                # 批号管理校验
                if batch_management_enabled:
                    if material and getattr(material, "batch_managed", False) and not (batch_no and str(batch_no).strip()):
                        material_code = getattr(material, "main_code", None) or getattr(material, "code", "")
                        raise BusinessLogicError(f"物料 {material.name}（{material_code}）启用了批号管理，入库必须提供批号")

                # 序列号管理校验
                if serial_management_enabled:
                    if material and getattr(material, "serial_managed", False):
                        if not serial_nos or len(serial_nos) <= 0:
                            material_code = getattr(material, "main_code", None) or getattr(material, "code", "")
                            raise BusinessLogicError(f"物料 {material.name}（{material_code}）启用了序列号管理，入库必须提供序列号")
                        if abs(float(quantity) - len(serial_nos)) > 0.001:
                            raise BusinessLogicError(f"入库数量（{quantity}）与序列号数量（{len(serial_nos)}）不一致")

                if (
                    material
                    and getattr(material, "batch_managed", False)
                    and batch_no
                    and str(batch_no).strip()
                    and str(batch_no).strip() != "DEFAULT"
                    and ledger_production_date is None
                ):
                    raise BusinessLogicError("批号管理物料入库必须提供入库日期（来自入库单确认时间）")
                if serial_nos and ledger_production_date is None:
                    raise BusinessLogicError("序列号入库必须提供入库日期（来自入库单确认时间）")

                logger.info(f"Adding stock for material_id={material_id}, batch_no={batch_no}, qty={quantity}")
                await InventoryService._material_batch_increase_or_restore(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=batch_no or "DEFAULT",
                    quantity=quantity,
                    ownership_type=ownership_type,
                    customer_id=customer_id,
                    customer_name=customer_name,
                    source_doc_id=source_doc_id,
                    source_doc_code=source_doc_code,
                    ledger_production_date=ledger_production_date,
                )

                # 记录序列号
                if serial_nos:
                    from apps.master_data.models.material_serial import MaterialSerial

                    for s_no in serial_nos:
                        existing = await MaterialSerial.filter(tenant_id=tenant_id, serial_no=s_no).first()
                        if existing:
                            if existing.status == "in_stock":
                                raise BusinessLogicError(f"序列号 {s_no} 已在库，不可重复入库")
                            existing.status = "in_stock"
                            existing.material_id = material_id
                            if existing.production_date is None and ledger_production_date is not None:
                                existing.production_date = ledger_production_date
                            await existing.save()
                        else:
                            await MaterialSerial.create(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                serial_no=s_no,
                                production_date=ledger_production_date,
                                status="in_stock",
                            )

                logger.info(
                    f"InventoryService.increase_stock: tenant={tenant_id} material={material_id} "
                    f"qty={quantity} warehouse={warehouse_id} batch={batch_no} source={source_type}"
                )
            else:
                # 线边仓处理
                from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

                wh_name = str(wh.name if wh else "").strip()
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
                    if work_order_id and not inv.work_order_id:
                        inv.work_order_id = work_order_id
                        inv.work_order_code = work_order_code
                    if wh_name and not str(inv.warehouse_name or "").strip():
                        inv.warehouse_name = wh_name
                    await inv.save()
                else:
                    mat = material or await Material.get_or_none(id=material_id)
                    await LineSideInventory.create(
                        tenant_id=tenant_id,
                        warehouse_id=warehouse_id,
                        warehouse_name=wh_name or None,
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
                        work_order_id=work_order_id,
                        work_order_code=work_order_code,
                    )
            from apps.kuaizhizao.services.work_order_readiness_service import notify_inventory_changed

            notify_inventory_changed(tenant_id, material_id)
            return True
        except Exception as e:
            logger.error(f"InventoryService.increase_stock 失败: {e}")
            raise

    @staticmethod
    @atomic()
    async def increase_stock(
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        serial_nos: Optional[list[str]] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        work_order_id: Optional[int] = None,
        work_order_code: Optional[str] = None,
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        customer_name: Optional[str] = None,
        ledger_production_date: Optional[date] = None,
    ) -> bool:
        """
        增加库存（独立事务包装）。
        """
        return await InventoryService._increase_stock_no_atomic(
            tenant_id=tenant_id,
            material_id=material_id,
            quantity=quantity,
            warehouse_id=warehouse_id,
            batch_no=batch_no,
            serial_nos=serial_nos,
            source_type=source_type,
            source_doc_id=source_doc_id,
            source_doc_code=source_doc_code,
            work_order_id=work_order_id,
            work_order_code=work_order_code,
            ownership_type=ownership_type,
            customer_id=customer_id,
            customer_name=customer_name,
            ledger_production_date=ledger_production_date,
        )

    @staticmethod
    async def _decrease_stock_no_atomic(
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        enforce_fifo: bool = False,
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> bool:
        """
        扣减库存（不开启独立事务）。见 `_increase_stock_no_atomic` 说明。
        """
        try:
            quantity = Decimal(str(quantity or 0))
            if quantity <= 0:
                raise ValueError(f"扣减数量必须大于0: {quantity}")

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

                own = InventoryService._ownership_filter(ownership_type, customer_id)
                if batch_no:
                    ledger_bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
                    batch = await InventoryService._find_in_stock_material_batch(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        batch_no=batch_no,
                        ownership_type=ownership_type,
                        customer_id=customer_id,
                        for_update=True,
                    )
                    if not batch or (batch.quantity or 0) < quantity:
                        available_rows = await MaterialBatch.filter(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            deleted_at__isnull=True,
                            status="in_stock",
                            quantity__gt=0,
                            **own,
                        ).values_list("batch_no", "quantity")
                        available_hint = "、".join(
                            f"{InventoryService._normalize_batch_no_for_ledger(str(bn))}({qty})"
                            for bn, qty in available_rows
                        ) or "无"
                        raise ValueError(
                            f"库存不足: material={material_id} batch={ledger_bn} "
                            f"need={quantity} have={batch.quantity if batch else 0}；"
                            f"可用批号: {available_hint}"
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
                    next_qty = (batch.quantity or Decimal(0)) - quantity
                    if next_qty < 0:
                        raise ValueError(
                            f"并发扣减导致库存不足: material={material_id} batch={ledger_bn} "
                            f"need={quantity} have={batch.quantity or 0}"
                        )
                    batch.quantity = next_qty
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
                            **own,
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
                next_qty = (inv.quantity or Decimal(0)) - quantity
                if next_qty < 0:
                    raise ValueError(
                        f"并发扣减导致线边仓负库存: warehouse={warehouse_id} material={material_id} "
                        f"need={quantity} have={inv.quantity or 0}"
                    )
                inv.quantity = next_qty
                await inv.save()
                logger.info(
                    f"InventoryService.decrease_stock(line_side): tenant={tenant_id} "
                    f"warehouse={warehouse_id} material={material_id} qty={quantity}"
                )
            from apps.kuaizhizao.services.work_order_readiness_service import notify_inventory_changed

            notify_inventory_changed(tenant_id, material_id)
            return True
        except Exception as e:
            logger.error(f"InventoryService.decrease_stock 失败: {e}")
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
        扣减库存（独立事务包装）。

        若调用方已在 `in_transaction()` 内，请改用 `_decrease_stock_no_atomic`。
        """
        return await InventoryService._decrease_stock_no_atomic(
            tenant_id=tenant_id,
            material_id=material_id,
            quantity=quantity,
            warehouse_id=warehouse_id,
            batch_no=batch_no,
            source_type=source_type,
            source_doc_id=source_doc_id,
            source_doc_code=source_doc_code,
            enforce_fifo=enforce_fifo,
        )

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
                await InventoryService._material_batch_adjust_set(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=batch_no or "DEFAULT",
                    quantity=quantity,
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
            from apps.kuaizhizao.services.work_order_readiness_service import notify_inventory_changed

            notify_inventory_changed(tenant_id, material_id)
            return True
        except Exception as e:
            logger.error(f"InventoryService.adjust_inventory 失败: {e}")
            raise
