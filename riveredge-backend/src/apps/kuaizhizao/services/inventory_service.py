"""
统一库存服务

为领料、退料、入库、出库、盘点、调拨、组装、拆解等业务提供统一的库存增减接口。

业务逻辑：
- 主仓（normal/wip，如原材料仓、成品仓）：使用 MaterialBatch（按 warehouse_id 拆分余额）
- 线边仓（line_side）：使用 LineSideInventory，仅发料/配料时写入

采购入库、成品入库等入库操作 → 主仓 MaterialBatch（写入单据仓库）
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

from apps.kuaizhizao.models.material_stock_movement import (
    MaterialStockMovement,
)
from apps.kuaizhizao.utils.inventory_helper import get_material_inventory_info
from apps.master_data.constants.batch_quality_status import QUALIFIED
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
    async def _get_allow_negative_inventory(tenant_id: int) -> bool:
        """租户仓存参数：是否允许出库将账面扣为负数。"""
        cfg = await BusinessConfigService().get_business_config(tenant_id)
        wh = cfg.get("parameters", {}).get("warehouse", {})
        return bool(wh.get("allow_negative_inventory", False))

    @staticmethod
    def _sync_material_batch_status_after_qty_change(batch) -> None:
        qty = batch.quantity or Decimal(0)
        if qty > 0:
            batch.status = "in_stock"
        elif qty == 0:
            batch.status = "out_stock"
        else:
            batch.status = "in_stock"

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
    def format_batch_no_for_display(batch_no: Optional[str]) -> Optional[str]:
        """用户可见批号：空值与过账占位 DEFAULT 不展示。"""
        bn = str(batch_no or "").strip()
        if not bn or bn.upper() == "DEFAULT":
            return None
        return bn

    @staticmethod
    async def _resolve_warehouse_name(warehouse_id: Optional[int]) -> Optional[str]:
        if warehouse_id is None:
            return None
        from apps.master_data.models.warehouse import Warehouse

        wh = await Warehouse.get_or_none(id=warehouse_id, deleted_at__isnull=True)
        return (wh.name or "").strip() or None if wh else None

    @staticmethod
    async def _resolve_operator_name(
        tenant_id: int,
        operator_id: Optional[int],
        operator_name: Optional[str],
    ) -> tuple[Optional[int], Optional[str]]:
        name = (operator_name or "").strip() or None
        oid = int(operator_id) if operator_id is not None else None
        if oid is not None and oid <= 0:
            oid = None
        if oid is not None and not name:
            from infra.models.user import User

            user = await User.get_or_none(id=oid, tenant_id=tenant_id)
            if user is None:
                user = await User.get_or_none(id=oid)
            if user is not None:
                name = (
                    (getattr(user, "full_name", None) or "").strip()
                    or (getattr(user, "username", None) or "").strip()
                    or None
                )
        return oid, name

    @staticmethod
    async def _record_stock_movement(
        *,
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        qty_before: Optional[Decimal],
        qty_after: Optional[Decimal],
        batch_no: Optional[str] = None,
        movement_type: Optional[str] = None,
        from_warehouse_id: Optional[int] = None,
        from_warehouse_name: Optional[str] = None,
        to_warehouse_id: Optional[int] = None,
        to_warehouse_name: Optional[str] = None,
        balance_warehouse_id: Optional[int] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        work_order_id: Optional[int] = None,
        work_order_code: Optional[str] = None,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        remark: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> None:
        """余额变更后追加流水；幂等键冲突时跳过（视为已过账）。"""
        from infra.exceptions.exceptions import ValidationError
        from apps.master_data.models.material import Material

        mt = (movement_type or "").strip()
        if not mt:
            raise ValidationError(
                f"库存流水缺少 movement_type: material={material_id} "
                f"source={source_type}/{source_doc_id}"
            )
        if not material_id:
            raise ValidationError(
                f"库存流水缺少 material_id: source={source_type}/{source_doc_id}"
            )

        operator_id, operator_name = await InventoryService._resolve_operator_name(
            tenant_id, operator_id, operator_name
        )
        if source_doc_id is not None and operator_id is None and not operator_name:
            raise ValidationError(
                f"单据库存过账必须指定操作人: source={source_type}/{source_doc_id} "
                f"doc={source_doc_code or ''}"
            )

        if idempotency_key:
            exists = await MaterialStockMovement.filter(
                tenant_id=tenant_id, idempotency_key=idempotency_key
            ).exists()
            if exists:
                return

        mat = await Material.get_or_none(
            tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
        )
        if mat is None:
            raise ValidationError(
                f"库存过账物料不存在或已删除: material_id={material_id} "
                f"source={source_type}/{source_doc_id}"
            )
        material_code = (
            (getattr(mat, "main_code", None) or getattr(mat, "code", None) or "")
        ).strip()
        material_name = (getattr(mat, "name", None) or "").strip()
        if not material_code or not material_name:
            raise ValidationError(
                f"物料主数据缺少编码或名称: material_id={material_id} "
                f"code={material_code!r} name={material_name!r}"
            )

        if from_warehouse_id is not None and not from_warehouse_name:
            from_warehouse_name = await InventoryService._resolve_warehouse_name(
                from_warehouse_id
            )
        if to_warehouse_id is not None and not to_warehouse_name:
            to_warehouse_name = await InventoryService._resolve_warehouse_name(
                to_warehouse_id
            )

        try:
            await MaterialStockMovement.create(
                tenant_id=tenant_id,
                material_id=material_id,
                material_code=material_code,
                material_name=material_name,
                batch_no=batch_no,
                movement_type=mt,
                quantity=Decimal(str(quantity)),
                qty_before=qty_before,
                qty_after=qty_after,
                from_warehouse_id=from_warehouse_id,
                from_warehouse_name=from_warehouse_name,
                to_warehouse_id=to_warehouse_id,
                to_warehouse_name=to_warehouse_name,
                balance_warehouse_id=balance_warehouse_id,
                source_doc_type=source_type,
                source_doc_id=source_doc_id,
                source_doc_code=source_doc_code,
                work_order_id=work_order_id,
                work_order_code=work_order_code,
                operator_id=operator_id,
                operator_name=operator_name,
                remark=remark,
                idempotency_key=idempotency_key,
                created_by=operator_id,
                created_by_name=operator_name,
            )
        except IntegrityError:
            logger.info(
                f"MaterialStockMovement idempotent skip key={idempotency_key} "
                f"tenant={tenant_id}"
            )

    @staticmethod
    def _material_batch_no_lookup_q(batch_no: Optional[str]):
        from tortoise.expressions import Q

        bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
        if bn == "DEFAULT":
            return Q(batch_no="DEFAULT") | Q(batch_no="")
        return Q(batch_no=bn)

    @staticmethod
    def _normalize_main_warehouse_id(warehouse_id: Optional[int]) -> int:
        """主仓余额键：未传仓记为 0（报表展示为未配置仓库）。"""
        try:
            wid = int(warehouse_id) if warehouse_id is not None else 0
        except (TypeError, ValueError):
            return 0
        return wid if wid > 0 else 0

    @staticmethod
    def _main_warehouse_balance_q(warehouse_id: Optional[int]):
        """主仓扣减/查找：精确仓 + 历史未归属(0)。"""
        from tortoise.expressions import Q

        wh_id = InventoryService._normalize_main_warehouse_id(warehouse_id)
        if wh_id > 0:
            return Q(warehouse_id=wh_id) | Q(warehouse_id=0)
        return Q(warehouse_id=0)

    @staticmethod
    async def _find_in_stock_material_batch(
        tenant_id: int,
        material_id: int,
        batch_no: Optional[str],
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        *,
        for_update: bool = False,
        include_unassigned: bool = False,
        quality_status: str = QUALIFIED,
    ):
        from apps.master_data.models.material_batch import MaterialBatch

        own = InventoryService._ownership_filter(ownership_type, customer_id)
        q = InventoryService._material_batch_no_lookup_q(batch_no)
        filters = dict(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            status="in_stock",
            quality_status=quality_status,
            **own,
        )
        query = MaterialBatch.filter(**filters).filter(q)
        if warehouse_id is not None:
            wh_id = InventoryService._normalize_main_warehouse_id(warehouse_id)
            if include_unassigned and wh_id > 0:
                query = query.filter(InventoryService._main_warehouse_balance_q(wh_id))
            else:
                query = query.filter(warehouse_id=wh_id)
            # 优先精确仓，再历史未归属
            query = query.order_by("-warehouse_id")
        if for_update:
            query = query.select_for_update()
        return await query.first()

    @staticmethod
    async def _resolve_ledger_production_date(
        tenant_id: int,
        material_id: int,
        batch_no: Optional[str],
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
    ) -> Optional[date]:
        """
        出库撤回等回冲场景：未显式传入入库日期时，从既有批次台账读取 production_date。
        批号行在扣至 0 后仍为 out_stock，production_date 保留原入库确认日。
        """
        if not batch_no or not str(batch_no).strip():
            return None
        bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
        if bn == "DEFAULT":
            return None
        from apps.master_data.models.material_batch import MaterialBatch

        own = InventoryService._ownership_filter(ownership_type, customer_id)
        q = InventoryService._material_batch_no_lookup_q(batch_no)
        filters = dict(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            **own,
        )
        if warehouse_id is not None:
            filters["warehouse_id"] = InventoryService._normalize_main_warehouse_id(warehouse_id)
        batch = await MaterialBatch.filter(**filters).filter(q).first()
        if batch and batch.production_date is not None:
            return batch.production_date
        return None

    @staticmethod
    async def _apply_batch_ledger_dates(
        batch,
        *,
        material,
        ledger_production_date: Optional[date],
        ledger_expiry_date: Optional[date],
    ) -> None:
        """首次写入生产日/有效期至；已有值不覆盖。有效期按单据显式值、同批号已维护值或物料保质期解析。"""
        from apps.master_data.services.material_batch_service import MaterialBatchService

        if ledger_production_date is not None and batch.production_date is None:
            batch.production_date = ledger_production_date
        if batch.expiry_date is None:
            explicit_expiry = MaterialBatchService.coerce_optional_date(ledger_expiry_date)
            if explicit_expiry is None and material is not None:
                sibling = await MaterialBatchService.lookup_sibling_batch_expiry(
                    int(batch.tenant_id),
                    int(batch.material_id),
                    str(batch.batch_no or ""),
                    exclude_batch_id=int(batch.id) if getattr(batch, "id", None) else None,
                )
                explicit_expiry = sibling
            resolved = MaterialBatchService.resolve_inbound_item_expiry_date(
                material=material,
                production_date=batch.production_date,
                explicit_expiry=explicit_expiry,
            )
            if resolved is not None:
                batch.expiry_date = resolved

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
        ledger_expiry_date: Optional[date] = None,
        material=None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        quality_status: str = QUALIFIED,
    ) -> None:
        """
        主仓批次数量增加（按 warehouse_id 拆分）。包含软删行：若唯一键已存在但 deleted_at 有值，
        仅查未删行会误判为不存在，insert 会撞唯一约束。
        """
        from apps.master_data.models.material_batch import MaterialBatch
        from apps.master_data.models.material import Material
        from apps.master_data.services.material_batch_service import MaterialBatchService

        bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
        own = InventoryService._ownership_filter(ownership_type, customer_id)
        wh_id = InventoryService._normalize_main_warehouse_id(warehouse_id)
        wh_name = (str(warehouse_name or "").strip() or None)
        if wh_id > 0 and not wh_name:
            wh_name = await InventoryService._resolve_warehouse_name(wh_id)
        if material is None:
            material = await Material.get_or_none(
                tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
            )

        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            batch_no=bn,
            warehouse_id=wh_id,
            quality_status=quality_status,
            **own,
        ).select_for_update().first()
        # 历史未归属行（warehouse_id=0）：首次带仓入库时认领，避免同批双行
        if not batch and wh_id > 0:
            batch = await MaterialBatch.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                batch_no=bn,
                warehouse_id=0,
                quality_status=quality_status,
                **own,
            ).select_for_update().first()
            if batch:
                batch.warehouse_id = wh_id
                batch.warehouse_name = wh_name
        if batch:
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = (batch.quantity or Decimal(0)) + quantity
            batch.status = "in_stock"
            if wh_name and not str(batch.warehouse_name or "").strip():
                batch.warehouse_name = wh_name
            if customer_name:
                batch.customer_name = customer_name
            if source_doc_id:
                batch.source_doc_id = source_doc_id
            if source_doc_code:
                batch.source_doc_code = source_doc_code
            await InventoryService._apply_batch_ledger_dates(
                batch,
                material=material,
                ledger_production_date=ledger_production_date,
                ledger_expiry_date=ledger_expiry_date,
            )
            await batch.save()
            return
        create_production_date = ledger_production_date
        explicit_create_expiry = MaterialBatchService.coerce_optional_date(ledger_expiry_date)
        if explicit_create_expiry is None and material is not None and bn:
            explicit_create_expiry = await MaterialBatchService.lookup_sibling_batch_expiry(
                tenant_id,
                material_id,
                bn,
            )
        create_expiry_date = MaterialBatchService.resolve_inbound_item_expiry_date(
            material=material,
            production_date=create_production_date,
            explicit_expiry=explicit_create_expiry,
        )
        try:
            await MaterialBatch.create(
                tenant_id=tenant_id,
                material_id=material_id,
                batch_no=bn,
                quantity=quantity,
                status="in_stock",
                quality_status=quality_status,
                production_date=create_production_date,
                expiry_date=create_expiry_date,
                ownership_type=own["ownership_type"],
                customer_id=own["customer_id"],
                customer_name=customer_name,
                source_doc_id=source_doc_id,
                source_doc_code=source_doc_code,
                warehouse_id=wh_id,
                warehouse_name=wh_name,
            )
        except IntegrityError:
            batch = await MaterialBatch.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                batch_no=bn,
                warehouse_id=wh_id,
                quality_status=quality_status,
                **own,
            ).select_for_update().first()
            if not batch:
                from infra.exceptions.exceptions import BusinessLogicError

                legacy = await MaterialBatch.filter(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=bn,
                    warehouse_id=wh_id,
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
                        f"请执行数据库迁移 396/490（批次归属与仓库唯一索引）。"
                    )
                raise
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = (batch.quantity or Decimal(0)) + quantity
            batch.status = "in_stock"
            if wh_name and not str(batch.warehouse_name or "").strip():
                batch.warehouse_name = wh_name
            await InventoryService._apply_batch_ledger_dates(
                batch,
                material=material,
                ledger_production_date=ledger_production_date,
                ledger_expiry_date=ledger_expiry_date,
            )
            await batch.save()

    @staticmethod
    async def _material_batch_adjust_set(
        tenant_id: int,
        material_id: int,
        batch_no: str,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
    ) -> None:
        """盘点等场景直接设定批次数量；与 increase 相同需处理软删行与并发 insert。"""
        from apps.master_data.models.material_batch import MaterialBatch

        bn = InventoryService._normalize_batch_no_for_ledger(batch_no)
        wh_id = InventoryService._normalize_main_warehouse_id(warehouse_id)
        wh_name = (str(warehouse_name or "").strip() or None)
        if wh_id > 0 and not wh_name:
            wh_name = await InventoryService._resolve_warehouse_name(wh_id)
        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            batch_no=bn,
            warehouse_id=wh_id,
        ).select_for_update().first()
        if batch:
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = quantity
            batch.status = "in_stock" if quantity > 0 else "out_stock"
            if wh_name and not str(batch.warehouse_name or "").strip():
                batch.warehouse_name = wh_name
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
                    warehouse_id=wh_id,
                    warehouse_name=wh_name,
                )
        except IntegrityError:
            batch = await MaterialBatch.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                batch_no=bn,
                warehouse_id=wh_id,
            ).select_for_update().first()
            if not batch:
                raise
            if batch.deleted_at is not None:
                batch.deleted_at = None
            batch.quantity = quantity
            batch.status = "in_stock" if quantity > 0 else "out_stock"
            if wh_name and not str(batch.warehouse_name or "").strip():
                batch.warehouse_name = wh_name
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
        ledger_expiry_date: Optional[date] = None,
        movement_type: Optional[str] = None,
        from_warehouse_id: Optional[int] = None,
        from_warehouse_name: Optional[str] = None,
        to_warehouse_id: Optional[int] = None,
        to_warehouse_name: Optional[str] = None,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        remark: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        quality_status: str = QUALIFIED,
    ) -> bool:
        """
        增加库存（不开启独立事务）。
        """
        try:
            from apps.master_data.services.material_batch_service import MaterialBatchService

            quantity = Decimal(str(quantity or 0))
            to_wh_id = to_warehouse_id if to_warehouse_id is not None else warehouse_id
            to_wh_name = to_warehouse_name
            from_wh_id = from_warehouse_id
            from_wh_name = from_warehouse_name
            ledger_expiry_date = MaterialBatchService.coerce_optional_date(ledger_expiry_date)
            # 根据 warehouse_type 决定写入目标
            use_line_side = False
            wh = None
            if warehouse_id is not None:
                from apps.master_data.models.warehouse import Warehouse
                wh = await Warehouse.get_or_none(
                    id=warehouse_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
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

            if (
                material
                and getattr(material, "batch_managed", False)
                and not (batch_no and str(batch_no).strip())
            ):
                batch_no = await MaterialBatchService.generate_batch_no(
                    tenant_id=tenant_id,
                    material_uuid=str(material.uuid),
                )

            if ledger_production_date is None and batch_no:
                ledger_production_date = await InventoryService._resolve_ledger_production_date(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=batch_no,
                    ownership_type=ownership_type,
                    customer_id=customer_id,
                    warehouse_id=warehouse_id,
                )

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

                main_wh_id = InventoryService._normalize_main_warehouse_id(warehouse_id)
                main_wh_name = to_wh_name or await InventoryService._resolve_warehouse_name(
                    main_wh_id if main_wh_id > 0 else None
                )
                logger.info(f"Adding stock for material_id={material_id}, batch_no={batch_no}, qty={quantity}")
                bn_norm = InventoryService._normalize_batch_no_for_ledger(batch_no or "DEFAULT")
                existing_batch = await InventoryService._find_in_stock_material_batch(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=bn_norm,
                    ownership_type=ownership_type,
                    customer_id=customer_id,
                    warehouse_id=main_wh_id,
                    for_update=True,
                    quality_status=quality_status,
                )
                qty_before = Decimal(str(existing_batch.quantity or 0)) if existing_batch else Decimal(0)
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
                    ledger_expiry_date=ledger_expiry_date,
                    material=material,
                    warehouse_id=main_wh_id,
                    warehouse_name=main_wh_name,
                    quality_status=quality_status,
                )
                qty_after = qty_before + quantity
                await InventoryService._record_stock_movement(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    quantity=quantity,
                    qty_before=qty_before,
                    qty_after=qty_after,
                    batch_no=bn_norm,
                    movement_type=movement_type,
                    from_warehouse_id=from_wh_id,
                    from_warehouse_name=from_wh_name,
                    to_warehouse_id=to_wh_id if to_wh_id is not None else (main_wh_id or None),
                    to_warehouse_name=to_wh_name or main_wh_name,
                    balance_warehouse_id=main_wh_id or warehouse_id,
                    source_type=source_type,
                    source_doc_id=source_doc_id,
                    source_doc_code=source_doc_code,
                    work_order_id=work_order_id,
                    work_order_code=work_order_code,
                    operator_id=operator_id,
                    operator_name=operator_name,
                    remark=remark,
                    idempotency_key=idempotency_key,
                )

                # 记录序列号
                if serial_nos:
                    from apps.master_data.models.material_serial import MaterialSerial

                    for s_no in serial_nos:
                        existing = await MaterialSerial.filter(tenant_id=tenant_id, serial_no=s_no).first()
                        if existing:
                            if existing.status == "in_stock":
                                if source_type and str(source_type).endswith("_withdraw"):
                                    continue
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
                qty_before = Decimal(str(inv.quantity or 0)) if inv else Decimal(0)
                if inv:
                    inv.quantity = qty_before + quantity
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
                await InventoryService._record_stock_movement(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    quantity=quantity,
                    qty_before=qty_before,
                    qty_after=qty_before + quantity,
                    batch_no=batch_no,
                    movement_type=movement_type,
                    from_warehouse_id=from_wh_id,
                    from_warehouse_name=from_wh_name,
                    to_warehouse_id=to_wh_id if to_wh_id is not None else warehouse_id,
                    to_warehouse_name=to_wh_name or wh_name or None,
                    balance_warehouse_id=warehouse_id,
                    source_type=source_type,
                    source_doc_id=source_doc_id,
                    source_doc_code=source_doc_code,
                    work_order_id=work_order_id,
                    work_order_code=work_order_code,
                    operator_id=operator_id,
                    operator_name=operator_name,
                    remark=remark,
                    idempotency_key=idempotency_key,
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
        ledger_expiry_date: Optional[date] = None,
        movement_type: Optional[str] = None,
        from_warehouse_id: Optional[int] = None,
        from_warehouse_name: Optional[str] = None,
        to_warehouse_id: Optional[int] = None,
        to_warehouse_name: Optional[str] = None,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        remark: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        quality_status: str = QUALIFIED,
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
            ledger_expiry_date=ledger_expiry_date,
            movement_type=movement_type,
            from_warehouse_id=from_warehouse_id,
            from_warehouse_name=from_warehouse_name,
            to_warehouse_id=to_warehouse_id,
            to_warehouse_name=to_warehouse_name,
            operator_id=operator_id,
            operator_name=operator_name,
            remark=remark,
            idempotency_key=idempotency_key,
            quality_status=quality_status,
        )

    @staticmethod
    async def _mark_serials_out_stock(
        tenant_id: int,
        material_id: int,
        serial_nos: Optional[list[str]],
    ) -> None:
        """出库扣减后同步序列号台账为已出库。"""
        if not serial_nos:
            return
        from apps.master_data.models.material_serial import MaterialSerial

        for s_no in serial_nos:
            sn = str(s_no or "").strip()
            if not sn:
                continue
            existing = await MaterialSerial.filter(
                tenant_id=tenant_id,
                serial_no=sn,
                deleted_at__isnull=True,
            ).first()
            if not existing:
                raise BusinessLogicError(f"序列号 {sn} 不存在，无法出库")
            if int(existing.material_id) != int(material_id):
                raise BusinessLogicError(f"序列号 {sn} 不属于当前物料，无法出库")
            if existing.status != "in_stock":
                raise BusinessLogicError(f"序列号 {sn} 不在库，无法出库")
            existing.status = "out_stock"
            await existing.save()

    @staticmethod
    async def _decrease_stock_no_atomic(
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        warehouse_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        serial_nos: Optional[list[str]] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        enforce_fifo: bool = False,
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        work_order_code: Optional[str] = None,
        movement_type: Optional[str] = None,
        from_warehouse_id: Optional[int] = None,
        from_warehouse_name: Optional[str] = None,
        to_warehouse_id: Optional[int] = None,
        to_warehouse_name: Optional[str] = None,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        remark: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        stock_quality_status: str = QUALIFIED,
    ) -> bool:
        """
        扣减库存（不开启独立事务）。见 `_increase_stock_no_atomic` 说明。
        """
        try:
            from infra.exceptions.exceptions import BusinessLogicError

            quantity = Decimal(str(quantity or 0))
            if quantity <= 0:
                raise BusinessLogicError(f"扣减数量必须大于0: {quantity}")

            from_wh_id = from_warehouse_id if from_warehouse_id is not None else warehouse_id
            from_wh_name = from_warehouse_name
            to_wh_id = to_warehouse_id
            to_wh_name = to_warehouse_name

            # 根据 warehouse_type 决定扣减目标：line_side → LineSideInventory，否则 → MaterialBatch
            use_line_side = False
            if warehouse_id is not None:
                from apps.master_data.models.warehouse import Warehouse
                wh = await Warehouse.get_or_none(
                    id=warehouse_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if wh and wh.warehouse_type == "line_side":
                    use_line_side = True

            allow_negative = await InventoryService._get_allow_negative_inventory(tenant_id)

            if warehouse_id is not None and not allow_negative:
                from apps.kuaizhizao.utils.inventory_helper import (
                    assert_outbound_warehouse_stock_available,
                )

                await assert_outbound_warehouse_stock_available(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    warehouse_id=int(warehouse_id),
                    quantity=quantity,
                    batch_no=batch_no,
                    ownership_type=ownership_type,
                    customer_id=customer_id,
                )

            if not use_line_side:
                from apps.master_data.models.material_batch import MaterialBatch
                from apps.master_data.models.material import Material

                batch_management_enabled, _ = await InventoryService._get_warehouse_management_flags(tenant_id)
                cfg = await BusinessConfigService().get_business_config(tenant_id)
                wh_cfg = cfg.get("parameters", {}).get("warehouse", {})
                lifo_enabled = bool(wh_cfg.get("lifo", False))
                from apps.kuaizhizao.services.fifo_policy import (
                    fifo_mode_label,
                    normalize_fifo_mode,
                    pick_blocking_older_batch,
                    batch_fifo_sort_key,
                )

                fifo_mode = normalize_fifo_mode(wh_cfg.get("fifo_mode"))
                material = await Material.get_or_none(
                    tenant_id=tenant_id,
                    id=material_id,
                    deleted_at__isnull=True,
                )
                is_batch_managed = bool(
                    batch_management_enabled
                    and material
                    and getattr(material, "batch_managed", False)
                )
                raw_batch = str(batch_no or "").strip()
                if is_batch_managed and not raw_batch:
                    material_code = getattr(material, "main_code", None) or getattr(material, "code", "")
                    raise BusinessLogicError(
                        f"物料 {material.name}（{material_code}）启用了批号管理，出库必须指定批号"
                    )

                own = InventoryService._ownership_filter(ownership_type, customer_id)
                main_wh_id = InventoryService._normalize_main_warehouse_id(warehouse_id)
                stock_qs_filter = {"quality_status": stock_quality_status}
                # 非批号管理物料：空批号或 DEFAULT 表示未指定，按 FIFO/LIFO 跨批扣减。
                # 禁止把 DEFAULT 当成真实批号去查（前端曾把空串 normalize 成 DEFAULT 导致误报库存不足）。
                ledger_bn = InventoryService._normalize_batch_no_for_ledger(raw_batch) if raw_batch else ""
                use_specific_batch = bool(raw_batch) and (
                    is_batch_managed or ledger_bn != "DEFAULT"
                )
                if use_specific_batch:
                    batch = await InventoryService._find_in_stock_material_batch(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        batch_no=raw_batch,
                        ownership_type=ownership_type,
                        customer_id=customer_id,
                        warehouse_id=main_wh_id,
                        for_update=True,
                        include_unassigned=True,
                        quality_status=stock_quality_status,
                    )
                    if batch and int(getattr(batch, "warehouse_id", 0) or 0) == 0 and main_wh_id > 0:
                        batch.warehouse_id = main_wh_id
                        batch.warehouse_name = (
                            from_wh_name
                            or await InventoryService._resolve_warehouse_name(main_wh_id)
                        )
                    if not batch:
                        if not allow_negative:
                            available_rows = await MaterialBatch.filter(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                deleted_at__isnull=True,
                                status="in_stock",
                                quantity__gt=0,
                                **own,
                                **stock_qs_filter,
                            ).filter(
                                InventoryService._main_warehouse_balance_q(main_wh_id)
                            ).values_list("batch_no", "quantity")
                            available_hint = "、".join(
                                f"{InventoryService._normalize_batch_no_for_ledger(str(bn))}({qty})"
                                for bn, qty in available_rows
                            ) or "无"
                            raise BusinessLogicError(
                                f"库存不足：批号 {ledger_bn} 需求 {quantity}，可用 0；"
                                f"其他可用：{available_hint}"
                            )
                        wh_name = (
                            from_wh_name
                            or await InventoryService._resolve_warehouse_name(main_wh_id)
                        )
                        qty_before = Decimal(0)
                        next_qty = -quantity
                        await MaterialBatch.create(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            batch_no=ledger_bn,
                            quantity=next_qty,
                            status="in_stock",
                            quality_status=stock_quality_status,
                            ownership_type=own["ownership_type"],
                            customer_id=own["customer_id"],
                            warehouse_id=main_wh_id,
                            warehouse_name=wh_name,
                        )
                        await InventoryService._record_stock_movement(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            quantity=-quantity,
                            qty_before=qty_before,
                            qty_after=next_qty,
                            batch_no=ledger_bn,
                            movement_type=movement_type,
                            from_warehouse_id=from_wh_id,
                            from_warehouse_name=from_wh_name,
                            to_warehouse_id=to_wh_id,
                            to_warehouse_name=to_wh_name,
                            balance_warehouse_id=main_wh_id or warehouse_id,
                            source_type=source_type,
                            source_doc_id=source_doc_id,
                            source_doc_code=source_doc_code,
                            work_order_id=work_order_id,
                            work_order_code=work_order_code,
                            operator_id=operator_id,
                            operator_name=operator_name,
                            remark=remark,
                            idempotency_key=idempotency_key,
                        )
                    elif (batch.quantity or 0) < quantity and not allow_negative:
                        available_rows = await MaterialBatch.filter(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            deleted_at__isnull=True,
                            status="in_stock",
                            quantity__gt=0,
                            **own,
                            **stock_qs_filter,
                        ).filter(
                            InventoryService._main_warehouse_balance_q(main_wh_id)
                        ).values_list("batch_no", "quantity")
                        available_hint = "、".join(
                            f"{InventoryService._normalize_batch_no_for_ledger(str(bn))}({qty})"
                            for bn, qty in available_rows
                        ) or "无"
                        raise BusinessLogicError(
                            f"库存不足：批号 {ledger_bn} 需求 {quantity}，可用 "
                            f"{batch.quantity if batch else 0}；其他可用：{available_hint}"
                        )
                    else:
                        
                        # 阶段2：强制先进先出 (FIFO Strict Enforcement) 拦截网
                        if enforce_fifo:
                            siblings = await MaterialBatch.filter(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                deleted_at__isnull=True,
                                status="in_stock",
                                quantity__gt=0,
                                **stock_qs_filter,
                            ).filter(
                                InventoryService._main_warehouse_balance_q(main_wh_id)
                            ).all()
                            older_batch = pick_blocking_older_batch(batch, siblings, fifo_mode)
                            if older_batch:
                                raise BusinessLogicError(
                                    f"【防呆拦截】当前物料不符合先入先出"
                                    f"（判定：{fifo_mode_label(fifo_mode)}）！"
                                    f"系统内仍存在应优先领用的批次 (批号:{older_batch.batch_no}) 未用完！"
                                    f"请优先领用该批次以防产品滞留过期。"
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
                                **stock_qs_filter,
                            ).filter(
                                InventoryService._main_warehouse_balance_q(main_wh_id)
                            ).order_by("-id").first()
                            if newer_batch:
                                raise BusinessLogicError(
                                    f"【防呆拦截】当前物料不符合后进先出！"
                                    f"系统内仍存在更新批次 (批号:{newer_batch.batch_no}) 未用完！"
                                    f"请优先领用最新批次。"
                                )
                        qty_before = Decimal(str(batch.quantity or 0))
                        next_qty = qty_before - quantity
                        if next_qty < 0 and not allow_negative:
                            raise BusinessLogicError(
                                f"并发扣减导致库存不足: material={material_id} batch={ledger_bn} "
                                f"need={quantity} have={batch.quantity or 0}"
                            )
                        batch.quantity = next_qty
                        InventoryService._sync_material_batch_status_after_qty_change(batch)
                        await batch.save()
                        await InventoryService._record_stock_movement(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            quantity=-quantity,
                            qty_before=qty_before,
                            qty_after=next_qty,
                            batch_no=ledger_bn,
                            movement_type=movement_type,
                            from_warehouse_id=from_wh_id,
                            from_warehouse_name=from_wh_name,
                            to_warehouse_id=to_wh_id,
                            to_warehouse_name=to_wh_name,
                            balance_warehouse_id=main_wh_id or warehouse_id,
                            source_type=source_type,
                            source_doc_id=source_doc_id,
                            source_doc_code=source_doc_code,
                            work_order_id=work_order_id,
                            work_order_code=work_order_code,
                            operator_id=operator_id,
                            operator_name=operator_name,
                            remark=remark,
                            idempotency_key=idempotency_key,
                        )
                else:
                    # 默认 FIFO（按 fifo_mode）；若开启 LIFO 且未开启 FIFO，则按最新批次扣减
                    # 同仓优先于历史未归属(warehouse_id=0)
                    batches = (
                        await MaterialBatch.filter(
                            tenant_id=tenant_id,
                            material_id=material_id,
                            deleted_at__isnull=True,
                            status="in_stock",
                            quantity__gt=0,
                            **own,
                            **stock_qs_filter,
                        )
                        .filter(InventoryService._main_warehouse_balance_q(main_wh_id))
                        .select_for_update()
                        .all()
                    )
                    if lifo_enabled and not enforce_fifo:
                        batches = sorted(
                            batches,
                            key=lambda b: (
                                0 if int(getattr(b, "warehouse_id", 0) or 0) == int(main_wh_id or 0) else 1,
                                -int(getattr(b, "id", 0) or 0),
                            ),
                        )
                    else:
                        batches = sorted(
                            batches,
                            key=lambda b: (
                                0 if int(getattr(b, "warehouse_id", 0) or 0) == int(main_wh_id or 0) else 1,
                                batch_fifo_sort_key(b, fifo_mode),
                            ),
                        )
                    remaining = quantity
                    have_before = sum((b.quantity or Decimal(0)) for b in batches)
                    available_hint = "、".join(
                        f"{InventoryService._normalize_batch_no_for_ledger(str(b.batch_no))}({b.quantity})"
                        for b in batches
                    ) or "无"
                    part_idx = 0
                    for b in batches:
                        if remaining <= 0:
                            break
                        if int(getattr(b, "warehouse_id", 0) or 0) == 0 and main_wh_id > 0:
                            b.warehouse_id = main_wh_id
                            b.warehouse_name = (
                                from_wh_name
                                or await InventoryService._resolve_warehouse_name(main_wh_id)
                            )
                        deduct = min(remaining, b.quantity or Decimal(0))
                        if deduct > 0:
                            qty_before = Decimal(str(b.quantity or 0))
                            b.quantity = qty_before - deduct
                            InventoryService._sync_material_batch_status_after_qty_change(b)
                            await b.save()
                            key = idempotency_key
                            if key and part_idx > 0:
                                key = f"{key}#p{part_idx}"
                            await InventoryService._record_stock_movement(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                quantity=-deduct,
                                qty_before=qty_before,
                                qty_after=Decimal(str(b.quantity or 0)),
                                batch_no=InventoryService._normalize_batch_no_for_ledger(
                                    str(b.batch_no)
                                ),
                                movement_type=movement_type,
                                from_warehouse_id=from_wh_id,
                                from_warehouse_name=from_wh_name,
                                to_warehouse_id=to_wh_id,
                                to_warehouse_name=to_wh_name,
                                balance_warehouse_id=main_wh_id or warehouse_id,
                                source_type=source_type,
                                source_doc_id=source_doc_id,
                                source_doc_code=source_doc_code,
                                work_order_id=work_order_id,
                                work_order_code=work_order_code,
                                operator_id=operator_id,
                                operator_name=operator_name,
                                remark=remark,
                                idempotency_key=key,
                            )
                            remaining -= deduct
                            part_idx += 1
                    if remaining > 0:
                        if not allow_negative:
                            raise BusinessLogicError(
                                f"库存不足：需求 {quantity}，可用 {have_before}"
                                + (f"（{available_hint}）" if available_hint != "无" else "")
                            )
                        tail = batches[-1] if batches else None
                        if not tail:
                            tail = await InventoryService._find_in_stock_material_batch(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                batch_no="DEFAULT",
                                ownership_type=own["ownership_type"],
                                customer_id=own["customer_id"],
                                warehouse_id=main_wh_id,
                                for_update=True,
                                include_unassigned=True,
                                quality_status=stock_quality_status,
                            )
                        wh_name = (
                            from_wh_name
                            or await InventoryService._resolve_warehouse_name(main_wh_id)
                        )
                        if tail:
                            if int(getattr(tail, "warehouse_id", 0) or 0) == 0 and main_wh_id > 0:
                                tail.warehouse_id = main_wh_id
                                tail.warehouse_name = wh_name
                            qty_before = Decimal(str(tail.quantity or 0))
                            tail.quantity = qty_before - remaining
                            InventoryService._sync_material_batch_status_after_qty_change(tail)
                            await tail.save()
                            tail_bn = InventoryService._normalize_batch_no_for_ledger(
                                str(tail.batch_no)
                            )
                            await InventoryService._record_stock_movement(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                quantity=-remaining,
                                qty_before=qty_before,
                                qty_after=Decimal(str(tail.quantity or 0)),
                                batch_no=tail_bn,
                                movement_type=movement_type,
                                from_warehouse_id=from_wh_id,
                                from_warehouse_name=from_wh_name,
                                to_warehouse_id=to_wh_id,
                                to_warehouse_name=to_wh_name,
                                balance_warehouse_id=main_wh_id or warehouse_id,
                                source_type=source_type,
                                source_doc_id=source_doc_id,
                                source_doc_code=source_doc_code,
                                work_order_id=work_order_id,
                                work_order_code=work_order_code,
                                operator_id=operator_id,
                                operator_name=operator_name,
                                remark=remark,
                                idempotency_key=(
                                    f"{idempotency_key}#neg{part_idx}"
                                    if idempotency_key
                                    else None
                                ),
                            )
                        else:
                            qty_before = Decimal(0)
                            next_qty = -remaining
                            await MaterialBatch.create(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                batch_no="DEFAULT",
                                quantity=next_qty,
                                status="in_stock",
                                quality_status=stock_quality_status,
                                ownership_type=own["ownership_type"],
                                customer_id=own["customer_id"],
                                warehouse_id=main_wh_id,
                                warehouse_name=wh_name,
                            )
                            await InventoryService._record_stock_movement(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                quantity=-remaining,
                                qty_before=qty_before,
                                qty_after=next_qty,
                                batch_no="DEFAULT",
                                movement_type=movement_type,
                                from_warehouse_id=from_wh_id,
                                from_warehouse_name=from_wh_name,
                                to_warehouse_id=to_wh_id,
                                to_warehouse_name=to_wh_name,
                                balance_warehouse_id=main_wh_id or warehouse_id,
                                source_type=source_type,
                                source_doc_id=source_doc_id,
                                source_doc_code=source_doc_code,
                                work_order_id=work_order_id,
                                work_order_code=work_order_code,
                                operator_id=operator_id,
                                operator_name=operator_name,
                                remark=remark,
                                idempotency_key=(
                                    f"{idempotency_key}#neg{part_idx}"
                                    if idempotency_key
                                    else None
                                ),
                            )
                logger.info(
                    f"InventoryService.decrease_stock: tenant={tenant_id} material={material_id} "
                    f"qty={quantity} warehouse={warehouse_id} batch={batch_no}"
                )
                await InventoryService._mark_serials_out_stock(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    serial_nos=serial_nos,
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
                    if not allow_negative:
                        raise BusinessLogicError(
                            f"线边仓无库存: warehouse={warehouse_id} material={material_id}"
                        )
                    from apps.master_data.models.material import Material

                    mat = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=material_id,
                        deleted_at__isnull=True,
                    )
                    wh_name = (
                        from_wh_name
                        or await InventoryService._resolve_warehouse_name(warehouse_id)
                    )
                    qty_before = Decimal(0)
                    next_qty = -quantity
                    await LineSideInventory.create(
                        tenant_id=tenant_id,
                        warehouse_id=warehouse_id,
                        warehouse_name=wh_name,
                        material_id=material_id,
                        material_code=(
                            (getattr(mat, "main_code", None) or getattr(mat, "code", ""))
                            if mat
                            else ""
                        ),
                        material_name=getattr(mat, "name", "") if mat else "",
                        batch_no=batch_no or "",
                        quantity=next_qty,
                        reserved_quantity=Decimal(0),
                        status="available",
                        source_type=source_type or "direct",
                        source_doc_id=source_doc_id,
                        source_doc_code=source_doc_code or "",
                        work_order_id=work_order_id,
                        work_order_code=work_order_code,
                    )
                    await InventoryService._record_stock_movement(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        quantity=-quantity,
                        qty_before=qty_before,
                        qty_after=next_qty,
                        batch_no=batch_no,
                        movement_type=movement_type,
                        from_warehouse_id=from_wh_id,
                        from_warehouse_name=from_wh_name,
                        to_warehouse_id=to_wh_id,
                        to_warehouse_name=to_wh_name,
                        balance_warehouse_id=warehouse_id,
                        source_type=source_type,
                        source_doc_id=source_doc_id,
                        source_doc_code=source_doc_code,
                        work_order_id=work_order_id,
                        work_order_code=work_order_code,
                        operator_id=operator_id,
                        operator_name=operator_name,
                        remark=remark,
                        idempotency_key=idempotency_key,
                    )
                else:
                    available = (inv.quantity or Decimal(0)) - (
                        inv.reserved_quantity or Decimal(0)
                    )
                    if available < quantity and not allow_negative:
                        raise BusinessLogicError(
                            f"线边仓库存不足: warehouse={warehouse_id} material={material_id} "
                            f"need={quantity} available={available}"
                        )
                    qty_before = Decimal(str(inv.quantity or 0))
                    next_qty = qty_before - quantity
                    if next_qty < 0 and not allow_negative:
                        raise BusinessLogicError(
                            f"并发扣减导致线边仓负库存: warehouse={warehouse_id} material={material_id} "
                            f"need={quantity} have={inv.quantity or 0}"
                        )
                    inv.quantity = next_qty
                    await inv.save()
                    await InventoryService._record_stock_movement(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        quantity=-quantity,
                        qty_before=qty_before,
                        qty_after=next_qty,
                        batch_no=batch_no or getattr(inv, "batch_no", None),
                        movement_type=movement_type,
                        from_warehouse_id=from_wh_id,
                        from_warehouse_name=from_wh_name,
                        to_warehouse_id=to_wh_id,
                        to_warehouse_name=to_wh_name,
                        balance_warehouse_id=warehouse_id,
                        source_type=source_type,
                        source_doc_id=source_doc_id,
                        source_doc_code=source_doc_code,
                        work_order_id=work_order_id,
                        work_order_code=work_order_code,
                        operator_id=operator_id,
                        operator_name=operator_name,
                        remark=remark,
                        idempotency_key=idempotency_key,
                    )
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
        serial_nos: Optional[list[str]] = None,
        source_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        enforce_fifo: bool = False,
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        work_order_code: Optional[str] = None,
        movement_type: Optional[str] = None,
        from_warehouse_id: Optional[int] = None,
        from_warehouse_name: Optional[str] = None,
        to_warehouse_id: Optional[int] = None,
        to_warehouse_name: Optional[str] = None,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        remark: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        stock_quality_status: str = QUALIFIED,
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
            serial_nos=serial_nos,
            source_type=source_type,
            source_doc_id=source_doc_id,
            source_doc_code=source_doc_code,
            enforce_fifo=enforce_fifo,
            ownership_type=ownership_type,
            customer_id=customer_id,
            work_order_id=work_order_id,
            work_order_code=work_order_code,
            movement_type=movement_type,
            from_warehouse_id=from_warehouse_id,
            from_warehouse_name=from_warehouse_name,
            to_warehouse_id=to_warehouse_id,
            to_warehouse_name=to_warehouse_name,
            operator_id=operator_id,
            operator_name=operator_name,
            remark=remark,
            idempotency_key=idempotency_key,
            stock_quality_status=stock_quality_status,
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
                wh = await Warehouse.get_or_none(
                    id=warehouse_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if wh and wh.warehouse_type == "line_side":
                    use_line_side = True

            if not use_line_side:
                await InventoryService._material_batch_adjust_set(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    batch_no=batch_no or "DEFAULT",
                    quantity=quantity,
                    warehouse_id=warehouse_id,
                )
                logger.info(
                    f"InventoryService.adjust_inventory: tenant={tenant_id} "
                    f"material={material_id} qty={quantity} warehouse={warehouse_id} reason={reason}"
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
