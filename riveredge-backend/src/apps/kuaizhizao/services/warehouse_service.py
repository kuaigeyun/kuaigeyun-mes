"""
仓储管理服务模块

提供仓储管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
import json
import time
import uuid
from pathlib import Path
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger


def _agent_debug_ndjson(location: str, message: str, data: dict, hypothesis_id: str, run_id: str = "pre-fix") -> None:
    # #region agent log
    try:
        p = Path(__file__).resolve().parents[5] / "debug-2f32a1.log"
        line = {
            "sessionId": "2f32a1",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(p, "a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
    except Exception:
        pass
    # #endregion


from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.production_return_item import ProductionReturnItem
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
from apps.kuaizhizao.models.sales_return import SalesReturn
from apps.kuaizhizao.models.sales_return_item import SalesReturnItem
from apps.kuaizhizao.models.purchase_return import PurchaseReturn
from apps.kuaizhizao.models.purchase_return_item import PurchaseReturnItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.models.material_borrow import MaterialBorrow
from apps.kuaizhizao.models.material_borrow_item import MaterialBorrowItem
from apps.kuaizhizao.models.material_return import MaterialReturn
from apps.kuaizhizao.models.material_return_item import MaterialReturnItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

from apps.kuaizhizao.schemas.warehouse import (
    # 生产领料单
    ProductionPickingCreate, ProductionPickingUpdate, ProductionPickingResponse, ProductionPickingListResponse,
    ProductionPickingWithItemsResponse,
    ProductionPickingItemCreate, ProductionPickingItemUpdate, ProductionPickingItemResponse,
    # 成品入库单
    FinishedGoodsReceiptCreate, FinishedGoodsReceiptUpdate, FinishedGoodsReceiptResponse,
    FinishedGoodsReceiptWithItemsResponse,
    FinishedGoodsReceiptItemCreate, FinishedGoodsReceiptItemUpdate, FinishedGoodsReceiptItemResponse,
    # 销售出库单
    SalesDeliveryCreate, SalesDeliveryUpdate, SalesDeliveryResponse,
    SalesDeliveryWithItemsResponse,
    SalesDeliveryItemCreate, SalesDeliveryItemUpdate, SalesDeliveryItemResponse,
    SalesDeliveryConfirmItemBatch,
    # 销售退货单
    SalesReturnCreate, SalesReturnUpdate, SalesReturnResponse,
    SalesReturnItemCreate, SalesReturnItemUpdate, SalesReturnItemResponse,
    # 采购退货单
    PurchaseReturnCreate, PurchaseReturnUpdate, PurchaseReturnResponse,
    PurchaseReturnItemCreate, PurchaseReturnItemUpdate, PurchaseReturnItemResponse,
    # 采购入库单
    PurchaseReceiptCreate, PurchaseReceiptUpdate, PurchaseReceiptResponse,
    PurchaseReceiptWithItemsResponse,
    PurchaseReceiptItemCreate, PurchaseReceiptItemUpdate, PurchaseReceiptItemResponse,
    # 生产退料单
    ProductionReturnCreate, ProductionReturnUpdate, ProductionReturnResponse,
    ProductionReturnListResponse, ProductionReturnWithItemsResponse,
    ProductionReturnItemCreate, ProductionReturnItemUpdate, ProductionReturnItemResponse,
    # 其他入库/出库单
    OtherInboundCreate, OtherInboundUpdate, OtherInboundResponse, OtherInboundListResponse,
    OtherInboundWithItemsResponse, OtherInboundItemCreate, OtherInboundItemUpdate,
    OtherInboundItemResponse,
    OtherOutboundCreate, OtherOutboundUpdate, OtherOutboundResponse, OtherOutboundListResponse,
    OtherOutboundWithItemsResponse, OtherOutboundItemCreate, OtherOutboundItemUpdate,
    OtherOutboundItemResponse,
    MaterialBorrowCreate, MaterialBorrowUpdate, MaterialBorrowResponse, MaterialBorrowListResponse,
    MaterialBorrowWithItemsResponse, MaterialBorrowItemCreate, MaterialBorrowItemUpdate,
    MaterialBorrowItemResponse,
    MaterialReturnCreate, MaterialReturnUpdate, MaterialReturnResponse, MaterialReturnListResponse,
    MaterialReturnWithItemsResponse, MaterialReturnItemCreate, MaterialReturnItemUpdate,
    MaterialReturnItemResponse,
    MaterialPrepReminderResponse, MaterialPrepReminderItem,
    InboundConfirmationRequest,
)

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.services.inspection_policy_service import assert_oqc_before_sales_delivery_confirm
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from infra.models.user import User


def _parse_serial_numbers(serial_numbers: Any) -> List[str]:
    """标准化序列号输入（list/json-string）。"""
    if serial_numbers is None:
        return []
    if isinstance(serial_numbers, list):
        return [str(x).strip() for x in serial_numbers if str(x).strip()]
    if isinstance(serial_numbers, str):
        text = serial_numbers.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            # 兼容逗号分隔输入
            return [seg.strip() for seg in text.split(",") if seg.strip()]
    return []


def _resolve_unit_conversion_factor(material_units: Any, unit_name: Optional[str]) -> Decimal:
    """从物料多单位配置中解析“业务单位 -> 基础单位”换算因子。"""
    if not unit_name:
        return Decimal("1")
    if not isinstance(material_units, dict):
        return Decimal("1")
    units = material_units.get("units")
    if not isinstance(units, list):
        return Decimal("1")

    target = str(unit_name).strip()
    if not target:
        return Decimal("1")

    for unit_cfg in units:
        if not isinstance(unit_cfg, dict):
            continue
        if str(unit_cfg.get("unit", "")).strip() != target:
            continue
        try:
            numerator = Decimal(str(unit_cfg.get("numerator", 1) or 1))
            denominator = Decimal(str(unit_cfg.get("denominator", 1) or 1))
            if numerator <= 0 or denominator <= 0:
                return Decimal("1")
            return numerator / denominator
        except Exception:
            return Decimal("1")
    return Decimal("1")


def _to_base_quantity(
    *,
    quantity: Decimal,
    material_unit: Optional[str],
    material: Optional[Any],
) -> Decimal:
    """把业务数量按物料多单位规则换算为基础单位数量。"""
    qty = Decimal(str(quantity or 0))
    if qty <= 0 or not material:
        return qty

    base_unit = str(getattr(material, "base_unit", "") or "").strip()
    unit_name = str(material_unit or "").strip()
    if not unit_name or not base_unit or unit_name == base_unit:
        return qty

    factor = _resolve_unit_conversion_factor(
        getattr(material, "units", None),
        unit_name,
    )
    if factor <= 0:
        factor = Decimal("1")
    return qty * factor


async def _validate_batch_serial_policy(
    tenant_id: int,
    material: Any,
    batch_number: Optional[str],
    serial_numbers: Any,
    quantity: Optional[Any],
    scene: str,
) -> None:
    """按业务配置校验批号/序列号要求。"""
    cfg = await BusinessConfigService().get_business_config(tenant_id)
    wh = cfg.get("parameters", {}).get("warehouse", {})
    batch_enabled = bool(wh.get("batch_management", False))
    serial_enabled = bool(wh.get("serial_management", False))

    material_code = getattr(material, "main_code", None) or getattr(material, "code", "")

    if batch_enabled and getattr(material, "batch_managed", False):
        if not (batch_number and str(batch_number).strip()):
            raise ValidationError(
                f"{scene}失败：物料 {material.name}（{material_code}）启用了批号管理，必须提供批号"
            )

    if serial_enabled and getattr(material, "serial_managed", False):
        normalized = _parse_serial_numbers(serial_numbers)
        if not normalized:
            raise ValidationError(
                f"{scene}失败：物料 {material.name}（{material_code}）启用了序列号管理，必须提供序列号"
            )
        if quantity is not None and Decimal(str(quantity or 0)) > 0 and len(normalized) <= 0:
            raise ValidationError(
                f"{scene}失败：物料 {material.name}（{material_code}）序列号数量不足"
            )


def _coerce_sales_delivery_item_serials(serial_numbers: Any) -> Any:
    """将明细表中的序列号字段解析为列表（供确认出库校验）。"""
    if serial_numbers is None:
        return None
    if isinstance(serial_numbers, list):
        return serial_numbers
    if isinstance(serial_numbers, str):
        s = serial_numbers.strip()
        if not s:
            return None
        try:
            parsed = json.loads(s)
            return parsed if isinstance(parsed, list) else None
        except Exception:
            return None
    return serial_numbers


async def _get_warehouse_policy_flags(tenant_id: int) -> tuple[bool, bool]:
    """读取仓储策略开关（库位管理、自动出库）。"""
    cfg = await BusinessConfigService().get_business_config(tenant_id)
    wh = cfg.get("parameters", {}).get("warehouse", {})
    return bool(wh.get("location_management", False)), bool(wh.get("auto_outbound", False))


def _validate_location_if_required(
    location_required: bool,
    location_id: Optional[int],
    location_code: Optional[str],
    scene: str,
    material_label: str,
) -> None:
    if not location_required:
        return
    if location_id is None and not (location_code and str(location_code).strip()):
        raise ValidationError(f"{scene}失败：物料 {material_label} 启用库位管理后必须提供库位")


async def _validate_purchase_line_warehouse_location_match(
    tenant_id: int,
    *,
    warehouse_id: Optional[int],
    location_id: Optional[int],
    material_label: str,
) -> None:
    """行上同时填写仓库与库位时，校验库位属于该仓库。"""
    if not location_id or not warehouse_id:
        return
    from apps.master_data.models.warehouse import StorageArea, StorageLocation

    loc = await StorageLocation.get_or_none(id=int(location_id), tenant_id=tenant_id, deleted_at__isnull=True)
    if not loc:
        raise ValidationError(f"采购入库失败：物料 {material_label} 的库位不存在")
    area = await StorageArea.get_or_none(id=loc.storage_area_id, tenant_id=tenant_id, deleted_at__isnull=True)
    if not area:
        raise ValidationError(f"采购入库失败：物料 {material_label} 的库位所属库区不存在")
    if int(area.warehouse_id) != int(warehouse_id):
        raise ValidationError(f"采购入库失败：物料 {material_label} 所选库位不属于所选仓库")


async def _resolve_purchase_receipt_line_warehouse_id_for_stock(
    tenant_id: int,
    item: Any,
    receipt: Any,
) -> Optional[int]:
    """确认入库过账：优先行仓库，其次由库位反查仓库，最后表头仓库。"""
    wid = getattr(item, "warehouse_id", None)
    if wid is not None and int(wid) > 0:
        return int(wid)
    lid = getattr(item, "location_id", None)
    if lid is not None and int(lid) > 0:
        from apps.master_data.models.warehouse import StorageArea, StorageLocation

        loc = await StorageLocation.get_or_none(id=int(lid), tenant_id=tenant_id, deleted_at__isnull=True)
        if loc:
            area = await StorageArea.get_or_none(id=loc.storage_area_id, tenant_id=tenant_id, deleted_at__isnull=True)
            if area and getattr(area, "warehouse_id", None):
                return int(area.warehouse_id)
    rid = getattr(receipt, "warehouse_id", None)
    if rid is not None and int(rid) > 0:
        return int(rid)
    return None


def _validate_sales_return_batch_traceability(
    *,
    source_batch_number: Optional[str],
    return_batch_number: Optional[str],
    material_label: str,
) -> None:
    """
    P1-S-010: 销售退货批次追溯门禁。
    关联原销售出库明细且存在原批次时，退货必须录入且与原批次一致。
    """
    source_batch = str(source_batch_number or "").strip()
    if not source_batch:
        return

    return_batch = str(return_batch_number or "").strip()
    if not return_batch:
        raise ValidationError(f"销售退货失败：物料 {material_label} 必须录入原出库批次号")
    if return_batch != source_batch:
        raise ValidationError(
            f"销售退货失败：物料 {material_label} 的退货批次号 {return_batch} 与原出库批次号 {source_batch} 不一致"
        )


def _validate_purchase_receipt_tolerance(
    ordered_quantity: Decimal,
    already_received_quantity: Decimal,
    incoming_quantity: Decimal,
    tolerance_percentage: float,
    material_label: str,
) -> None:
    """校验采购入库是否超过配置容差。"""
    if ordered_quantity <= 0:
        return
    tolerance_ratio = Decimal(str(max(0.0, tolerance_percentage))) / Decimal("100")
    max_receivable = ordered_quantity * (Decimal("1") + tolerance_ratio)
    after_receipt = already_received_quantity + incoming_quantity
    if after_receipt > max_receivable:
        raise BusinessLogicError(
            f"采购入库超容差：物料 {material_label} 入库后累计 {after_receipt}，"
            f"超过允许上限 {max_receivable}（订单数量 {ordered_quantity}，容差 {tolerance_percentage}%）"
        )


def _resolve_purchase_item_quality_fields(
    *,
    receipt_quantity: Decimal,
    qualified_quantity: Optional[Any],
    unqualified_quantity: Optional[Any],
    quality_status: Optional[str],
    require_incoming_inspection: bool,
) -> tuple[Decimal, Decimal, str]:
    """
    P2-W-003: 来料检验必需时，禁止在入库单明细手工自判质量结果。
    开启后统一置为“待检 + 0/0”，实际判定以来料检验单为准。
    """
    if require_incoming_inspection:
        return Decimal("0"), Decimal("0"), "待检"

    q = (
        Decimal(str(qualified_quantity))
        if qualified_quantity is not None
        else Decimal(str(receipt_quantity or 0))
    )
    uq = (
        Decimal(str(unqualified_quantity))
        if unqualified_quantity is not None
        else Decimal("0")
    )
    qs = str(quality_status or "合格")
    return q, uq, qs


class ProductionPickingService(AppBaseService[ProductionPicking]):
    """生产领料单服务"""

    def __init__(self):
        super().__init__(ProductionPicking)

    async def _get_user_role_codes(self, user_id: int) -> set[str]:
        user = await User.get_or_none(id=user_id, deleted_at__isnull=True).prefetch_related("roles")
        if not user:
            return set()
        role_codes = set()
        for role in getattr(user, "roles", []) or []:
            code = getattr(role, "code", None)
            if code:
                role_codes.add(str(code).strip().upper())
        return role_codes

    async def _assert_can_confirm_picking(self, tenant_id: int, user_id: int) -> None:
        policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
        allowed_role_codes = set(policy.get("effective_allowed_role_codes", []))
        user_role_codes = await self._get_user_role_codes(user_id)

        if not user_role_codes & allowed_role_codes:
            mode_text = "仅仓库角色可确认" if policy.get("picking_confirm_warehouse_only", True) else "角色未在允许名单"
            raise BusinessLogicError(f"无权限确认领料：{mode_text}")

    async def can_user_confirm_picking(self, tenant_id: int, user_id: int) -> tuple[bool, set[str]]:
        policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
        allowed_role_codes = set(policy.get("effective_allowed_role_codes", []))
        user_role_codes = await self._get_user_role_codes(user_id)
        return bool(user_role_codes & allowed_role_codes), user_role_codes

    async def create_production_picking(self, tenant_id: int, picking_data: ProductionPickingCreate, created_by: int) -> ProductionPickingResponse:
        """创建生产领料单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")

            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **picking_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )

            # 建立工单→生产领料 的 DocumentRelation（支持单据追溯）
            work_order_id = getattr(picking, "work_order_id", None) or getattr(picking_data, "work_order_id", None)
            if work_order_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                    from apps.kuaizhizao.models.work_order import WorkOrder

                    wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True)
                    if wo:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=work_order_id,
                                source_code=wo.code,
                                source_name=wo.name,
                                target_type="production_picking",
                                target_id=picking.id,
                                target_code=picking.picking_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单创建生产领料单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立工单→生产领料 单据关联失败: %s", e)

            return ProductionPickingResponse.model_validate(picking)

    async def get_production_picking_by_id(self, tenant_id: int, picking_id: int) -> ProductionPickingWithItemsResponse:
        """根据ID获取生产领料单（含明细）"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        items = await ProductionPickingItem.filter(tenant_id=tenant_id, picking_id=picking_id).all()
        resp = ProductionPickingWithItemsResponse.model_validate(picking)
        resp.items = [ProductionPickingItemResponse.model_validate(i) for i in items]
        return resp

    async def list_production_pickings(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ProductionPickingListResponse]:
        """获取生产领料单列表"""
        query = ProductionPicking.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])

        pickings = await query.offset(skip).limit(limit).order_by('-created_at')
        rows = [ProductionPickingListResponse.model_validate(picking) for picking in pickings]

        if rows:
            from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

            score_svc = WorkOrderScoreService()
            if await score_svc.is_score_enabled(tenant_id):
                wo_ids = [p.work_order_id for p in rows if p.work_order_id]
                score_map = await score_svc.batch_ensure_scores(
                    tenant_id, wo_ids, "picking", include_kitting=True
                )
                enriched: List[ProductionPickingListResponse] = []
                for row in rows:
                    cached = score_map.get(row.work_order_id)
                    if cached:
                        enriched.append(
                            row.model_copy(
                                update={
                                    "picking_score": cached.composite_score,
                                    "picking_rank_band": cached.rank_band,
                                    "picking_score_breakdown": cached.breakdown,
                                }
                            )
                        )
                    else:
                        enriched.append(row)
                return enriched

        return rows

    async def update_production_picking(self, tenant_id: int, picking_id: int, picking_data: ProductionPickingUpdate, updated_by: int) -> ProductionPickingResponse:
        """更新生产领料单"""
        async with in_transaction():
            picking = await self.get_production_picking_by_id(tenant_id, picking_id)
            update_data = picking_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(**update_data)
            updated_picking = await self.get_production_picking_by_id(tenant_id, picking_id)
            return updated_picking

    async def get_material_prep_reminders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 50
    ) -> MaterialPrepReminderResponse:
        """
        获取物料备料提醒列表

        逻辑：
        1. 筛选状态为“已下达”或“已发布”，且实际未开始（actual_start_date 为空）的工单
        2. 排除已完全领料的工单
        3. 对每个工单执行齐套性分析
        4. 返回分析结果中物料相对充裕且需要备料的项
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

        wo_svc = WorkOrderService()
        score_svc = WorkOrderScoreService()

        # 1. 基础工单筛选
        released_statuses = ["released", "dispatched", "confirmed", "已下达", "已确认"]

        query = WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=released_statuses,
            actual_start_date__isnull=True,
            deleted_at__isnull=True,
        )

        work_orders = await query.all()
        total_count = len(work_orders)

        if not work_orders:
            return MaterialPrepReminderResponse(items=[], total_count=0)

        wo_ids = [wo.id for wo in work_orders]
        score_map = await score_svc.batch_get_or_compute(
            tenant_id,
            wo_ids,
            "picking",
            refresh_if_stale=True,
            include_kitting=False,
        )

        def _sort_key(wo: WorkOrder) -> tuple:
            score = score_map.get(wo.id, 0.0)
            start = wo.planned_start_date or datetime.max
            return (-score, start)

        work_orders.sort(key=_sort_key)
        page_orders = work_orders[skip : skip + limit]

        reminders = []
        cached_scores = await score_svc.batch_get_scores(tenant_id, [wo.id for wo in page_orders], "picking")
        for wo in page_orders:
            kitting = await wo_svc.get_work_order_kitting_analysis(tenant_id, wo.id)
            cached = cached_scores.get(wo.id)
            picking_score = cached.composite_score if cached else score_map.get(wo.id)
            if kitting.kitting_rate > 0 and kitting.status != "fully_picked":
                reminders.append(MaterialPrepReminderItem(
                    work_order_id=wo.id,
                    work_order_code=wo.code,
                    product_name=wo.product_name,
                    quantity=float(wo.quantity),
                    planned_start_date=wo.planned_start_date,
                    priority=wo.priority or "normal",
                    kitting_rate=float(kitting.kitting_rate),
                    kitting_status=kitting.status,
                    composite_score=picking_score,
                    score_breakdown=cached.breakdown if cached else None,
                ))

        return MaterialPrepReminderResponse(
            items=reminders,
            total_count=total_count
        )

    async def delete_production_picking(self, tenant_id: int, picking_id: int) -> bool:
        """删除生产领料单"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")

        if picking.status not in ['待领料', '已取消']:
            raise BusinessLogicError("只能删除待领料或已取消状态的生产领料单")

        await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def confirm_picking(self, tenant_id: int, picking_id: int, confirmed_by: int) -> ProductionPickingResponse:
        """确认领料"""
        async with in_transaction():
            await self._assert_can_confirm_picking(tenant_id=tenant_id, user_id=confirmed_by)
            picking = await self.get_production_picking_by_id(tenant_id, picking_id)

            if picking.status != '待领料':
                raise BusinessLogicError("只有待领料状态的生产领料单才能确认领料")

            confirmer_name = await self.get_user_name(confirmed_by)

            await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
                status='已领料',
                picker_id=confirmed_by,
                picker_name=confirmer_name,
                picking_time=datetime.now(),
                updated_by=confirmed_by
            )

            # 更新库存（扣减）及其前置的【防超发拦截】闭环
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService
                from apps.kuaizhizao.models.production_picking import ProductionPicking
                from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem

                picking_items = await ProductionPickingItem.filter(
                    tenant_id=tenant_id, picking_id=picking_id
                ).all()
                picking = await ProductionPicking.get(tenant_id=tenant_id, id=picking_id)
                
                # 防超发逻辑验证 1.1 (Core Foundation Verification)
                if picking.work_order_id:
                    from apps.kuaizhizao.models.work_order import WorkOrder
                    from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
                    from tortoise.functions import Sum
                    wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=picking.work_order_id)
                    if wo:
                        try:
                            # 1. 拿取目标 BOM 需求上限
                            reqs = await calculate_material_requirements_from_bom(
                                tenant_id=tenant_id,
                                material_id=wo.product_id,
                                required_quantity=float(wo.quantity),
                                only_approved=True
                            )
                            limit_map = {r.component_id: r.gross_requirement for r in reqs}
                            
                            # 2. 统计已领过多少（明细表无 FK 至领料单，不可使用 picking__；先查本工单已领料状态的领料单 id）
                            wo_picking_ids = await ProductionPicking.filter(
                                tenant_id=tenant_id,
                                work_order_id=picking.work_order_id,
                                deleted_at__isnull=True,
                                status="已领料",
                            ).values_list("id", flat=True)
                            wo_pid_list = list(wo_picking_ids) if wo_picking_ids else []
                            if not wo_pid_list:
                                past_items = []
                            else:
                                past_items = await ProductionPickingItem.filter(
                                    tenant_id=tenant_id,
                                    picking_id__in=wo_pid_list,
                                ).group_by("material_id").annotate(total_picked=Sum("picked_quantity")).values("material_id", "total_picked")
                            past_map = {item["material_id"]: item["total_picked"] or 0 for item in past_items}
                            
                            # 3. 计算本期即将领用的
                            current_map = {}
                            for item in picking_items:
                                qty = item.picked_quantity or item.required_quantity or Decimal(0)
                                current_map[item.material_id] = current_map.get(item.material_id, 0) + float(qty)
                                
                            # 4. 严苛防超发出库比对
                            for mat_id, current_qty in current_map.items():
                                past_qty = float(past_map.get(mat_id, 0))
                                total_attempt = past_qty + current_qty
                                allowed = limit_map.get(mat_id)
                                if allowed is not None:
                                    # 允许 1% 浮点误差或容损
                                    if total_attempt > float(allowed) * 1.01:
                                        raise BusinessLogicError(f"防超发拦截生效：物料[ID:{mat_id}]试图总领用量({total_attempt:.2f}) 超出了当前工单配方上限额度({float(allowed):.2f})，禁止强行出库！")
                        except BusinessLogicError:
                            raise
                        except Exception as calc_e:
                            logger.warning(f"防超发校验过程发生错误，可能是缺少BOM，跳过强制拦截: {calc_e}")
                picking = await ProductionPicking.get(tenant_id=tenant_id, id=picking_id)
                biz_config = await BusinessConfigService().get_business_config(tenant_id)
                enforce_fifo = (
                    biz_config.get("parameters", {})
                    .get("warehouse", {})
                    .get("fifo", False)
                )
                for item in picking_items:
                    qty = item.required_quantity or item.picked_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="production_picking",
                        source_doc_id=picking_id,
                        source_doc_code=picking.picking_code,
                        enforce_fifo=enforce_fifo,
                    )
            except Exception as inv_e:
                logger.error("生产领料确认-更新库存失败: %s", inv_e)
                raise

            updated_picking = await self.get_production_picking_by_id(tenant_id, picking_id)
            if picking.work_order_id:
                try:
                    from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                        dispatch_work_order_score_recalc,
                    )
                    await dispatch_work_order_score_recalc(
                        int(picking.work_order_id),
                        include_kitting=True,
                    )
                except Exception as e:
                    logger.warning(
                        "领料确认后工单 %s 打分重算投递失败: %s",
                        picking.work_order_id,
                        e,
                    )
            return updated_picking

    async def quick_pick_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> ProductionPickingResponse:
        """
        一键领料：从工单下推，根据BOM自动生成领料需求
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选，如果不提供则使用物料默认仓库）
            warehouse_name: 仓库名称（可选）
            
        Returns:
            ProductionPickingResponse: 创建的生产领料单
            
        Raises:
            NotFoundError: 工单不存在或BOM不存在
            ValidationError: 数据验证失败
        """
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from decimal import Decimal
        
        async with in_transaction():
            # 1. 获取工单信息
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")
            
            # 检查工单状态
            if work_order.status not in ['已下达', '进行中']:
                raise BusinessLogicError(f"工单状态为 {work_order.status}，无法创建领料单")
            
            # 2. 从master_data获取产品的BOM并计算物料需求
            try:
                material_requirements = await calculate_material_requirements_from_bom(
                    tenant_id=tenant_id,
                    material_id=work_order.product_id,
                    required_quantity=float(work_order.quantity),
                    only_approved=True
                )
            except NotFoundError as e:
                raise NotFoundError(f"产品 {work_order.product_code} 的BOM不存在或未审核: {e}")
            
            if not material_requirements:
                raise ValidationError("BOM中没有物料明细，无法生成领料单")
            
            # 4. 生成领料单编码
            today = datetime.now().strftime("%Y%m%d")
            picking_code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")
            
            # 5. 创建生产领料单
            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=picking_code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                workshop_id=work_order.workshop_id,
                workshop_name=work_order.workshop_name,
                status='待领料',
                created_by=created_by,
                updated_by=created_by
            )
            
            # 6. 创建领料单明细
            for req in material_requirements:
                # 获取物料默认仓库（如果未指定仓库）
                final_warehouse_id = warehouse_id
                final_warehouse_name = warehouse_name
                
                # TODO: 从物料主数据获取默认仓库
                # 暂时使用传入的仓库或使用第一个仓库
                if not final_warehouse_id:
                    # 这里应该从物料主数据获取默认仓库
                    # 暂时跳过，后续完善
                    logger.warning(f"物料 {req.component_code} 未指定仓库，跳过")
                    continue
                
                await ProductionPickingItem.create(
                    tenant_id=tenant_id,
                    picking_id=picking.id,
                    material_id=req.component_id,
                    material_code=req.component_code,
                    material_name=req.component_name,
                    material_unit=req.unit,
                    required_quantity=Decimal(str(req.gross_requirement)),
                    picked_quantity=Decimal('0'),
                    remaining_quantity=Decimal(str(req.gross_requirement)),
                    warehouse_id=final_warehouse_id,
                    warehouse_name=final_warehouse_name or '',
                    status='待领料'
                )

            # 建立工单→生产领料 的 DocumentRelation（支持单据追溯）
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="production_picking",
                        target_id=picking.id,
                        target_code=picking.picking_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单一键领料创建生产领料单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→生产领料 单据关联失败: %s", e)
            
            return ProductionPickingResponse.model_validate(picking)
    
    async def batch_pick_from_work_orders(
        self,
        tenant_id: int,
        work_order_ids: List[int],
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> List[ProductionPickingResponse]:
        """
        批量领料：从多个工单下推，批量创建领料单
        
        Args:
            tenant_id: 租户ID
            work_order_ids: 工单ID列表
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选）
            warehouse_name: 仓库名称（可选）
            
        Returns:
            List[ProductionPickingResponse]: 创建的生产领料单列表
        """
        results = []
        for work_order_id in work_order_ids:
            try:
                picking = await self.quick_pick_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    created_by=created_by,
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name
                )
                results.append(picking)
            except Exception as e:
                logger.error(f"批量领料失败，工单ID: {work_order_id}, 错误: {str(e)}")
                # 继续处理其他工单，不中断整个流程
                continue
        
        return results


class ProductionReturnService(AppBaseService[ProductionReturn]):
    """生产退料单服务"""

    def __init__(self):
        super().__init__(ProductionReturn)

    async def create_production_return(
        self,
        tenant_id: int,
        return_data: ProductionReturnCreate,
        created_by: int
    ) -> ProductionReturnResponse:
        """创建生产退料单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PRODUCTION_RETURN_CODE", prefix=f"PR{today}")

            dump = return_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "return_code"})
            if return_data.return_code:
                code = return_data.return_code

            ret = await ProductionReturn.create(
                tenant_id=tenant_id,
                return_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(return_data, "items", None) or []
            for item_data in items:
                await ProductionReturnItem.create(
                    tenant_id=tenant_id,
                    return_id=ret.id,
                    **item_data.model_dump(exclude_unset=True)
                )

            # 建立工单→生产退料 的 DocumentRelation（支持单据追溯）
            work_order_id = getattr(ret, "work_order_id", None) or getattr(return_data, "work_order_id", None)
            if work_order_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                    from apps.kuaizhizao.models.work_order import WorkOrder

                    wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True)
                    if wo:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=work_order_id,
                                source_code=wo.code,
                                source_name=wo.name,
                                target_type="production_return",
                                target_id=ret.id,
                                target_code=ret.return_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单创建生产退料单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立工单→生产退料 单据关联失败: %s", e)

            # 建立领料单→生产退料 的 DocumentRelation（当有 picking_id 时）
            picking_id = getattr(ret, "picking_id", None) or getattr(return_data, "picking_id", None)
            if picking_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                    picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
                    if picking:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="production_picking",
                                source_id=picking_id,
                                source_code=picking.picking_code,
                                source_name=None,
                                target_type="production_return",
                                target_id=ret.id,
                                target_code=ret.return_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="领料单创建生产退料单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立领料单→生产退料 单据关联失败: %s", e)

            return ProductionReturnResponse.model_validate(ret)

    async def get_production_return_by_id(
        self,
        tenant_id: int,
        return_id: int
    ) -> ProductionReturnWithItemsResponse:
        """根据ID获取生产退料单（含明细）"""
        ret = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not ret:
            raise NotFoundError(f"生产退料单不存在: {return_id}")

        items = await ProductionReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
        response = ProductionReturnWithItemsResponse.model_validate(ret)
        response.items = [ProductionReturnItemResponse.model_validate(i) for i in items]
        return response

    async def list_production_returns(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[ProductionReturnListResponse]:
        """获取生产退料单列表"""
        query = ProductionReturn.filter(tenant_id=tenant_id)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("work_order_id"):
            query = query.filter(work_order_id=filters["work_order_id"])
        if filters.get("picking_id"):
            query = query.filter(picking_id=filters["picking_id"])

        rets = await query.offset(skip).limit(limit).order_by("-created_at")
        return [ProductionReturnListResponse.model_validate(r) for r in rets]

    async def update_production_return(
        self,
        tenant_id: int,
        return_id: int,
        return_data: ProductionReturnUpdate,
        updated_by: int
    ) -> ProductionReturnResponse:
        """更新生产退料单"""
        async with in_transaction():
            await self.get_production_return_by_id(tenant_id, return_id)
            dump = return_data.model_dump(exclude_unset=True, exclude={"return_code"})
            dump["updated_by"] = updated_by
            await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(**dump)
            return ProductionReturnResponse.model_validate(
                await ProductionReturn.get(tenant_id=tenant_id, id=return_id)
            )

    async def delete_production_return(self, tenant_id: int, return_id: int) -> bool:
        """删除生产退料单"""
        ret = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not ret:
            raise NotFoundError(f"生产退料单不存在: {return_id}")
        if ret.status not in ("待退料", "已取消"):
            raise BusinessLogicError("只能删除待退料或已取消状态的生产退料单")

        await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def confirm_return(
        self,
        tenant_id: int,
        return_id: int,
        confirmed_by: int,
        confirmation_data: Optional[InboundConfirmationRequest] = None,
    ) -> ProductionReturnResponse:
        """确认退料"""
        async with in_transaction():
            ret = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=return_id)
            if not ret:
                raise NotFoundError(f"生产退料单不存在: {return_id}")

            if ret.status != "待退料":
                raise BusinessLogicError("只有待退料状态的生产退料单才能确认退料")

            # 1. 更新确认数据
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = confirmation_data.warehouse_name or f"仓库{confirmation_data.warehouse_id}"
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                
                if update_dict:
                    await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(**update_dict)
                    ret = await ProductionReturn.get(tenant_id=tenant_id, id=return_id)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        if item_data.warehouse_id:
                            item_update["warehouse_id"] = item_data.warehouse_id
                            item_update["warehouse_name"] = item_data.warehouse_name or f"仓库{item_data.warehouse_id}"
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.expiry_date:
                            item_update["expiry_date"] = item_data.expiry_date
                        
                        if item_update:
                            await ProductionReturnItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, return_id=return_id
                            ).update(**item_update)

            # 2. 补齐批号/序列号
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item, ensure_serial_nos_for_item

            items = await ProductionReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if not material:
                    continue
                if material.batch_managed and not item.batch_number:
                    batch_no = await ensure_batch_no_for_item(tenant_id, material, item)
                    if batch_no:
                        item.batch_number = batch_no
                        await item.save()
                # 序列号同理 (生产退料可能也需要序列号)
                if material.serial_managed:
                    count = int(item.return_quantity or 0)
                    serial_nos = await ensure_serial_nos_for_item(tenant_id, material, item, count)
                    if serial_nos and hasattr(item, "serial_numbers"):
                        setattr(item, "serial_numbers", json.dumps(serial_nos))
                        await item.save()

            returner_name = await self.get_user_name(confirmed_by)
            receipt_time = (confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None) or datetime.now()

            await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status="已退料",
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=receipt_time,
                updated_by=confirmed_by
            )
            await ProductionReturnItem.filter(tenant_id=tenant_id, return_id=return_id).update(
                status="已退料", 
                return_time=receipt_time
            )

            # 4. 更新库存（增加）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService
                # 重新获取 items 以确保获得最新批号
                reload_items = await ProductionReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
                for item in reload_items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    wh_id = item.warehouse_id if item.warehouse_id else ret.warehouse_id
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="production_return",
                        source_doc_id=return_id,
                        source_doc_code=ret.return_code,
                    )
            except Exception as inv_e:
                logger.error("生产退料确认-更新库存失败: %s", inv_e)
                raise

            return ProductionReturnResponse.model_validate(
                await ProductionReturn.get(tenant_id=tenant_id, id=return_id)
            )

    async def withdraw_return_confirmation(
        self,
        tenant_id: int,
        return_id: int,
        updated_by: int,
    ) -> ProductionReturnResponse:
        """撤回已确认的生产退料：冲减即时库存，单据回到待退料。"""
        async with in_transaction():
            ret = await self.get_production_return_by_id(tenant_id, return_id)
            if ret.status != "已退料":
                raise BusinessLogicError("只有已退料状态的生产退料单才能撤回退料")

            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                ret_obj = await ProductionReturn.get(tenant_id=tenant_id, id=return_id)
                for item in ret.items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=getattr(item, "batch_number", None) or None,
                        source_type="production_return_revoke",
                        source_doc_id=return_id,
                        source_doc_code=ret_obj.return_code,
                    )

                await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(
                    status="待退料",
                    returner_id=None,
                    returner_name=None,
                    return_time=None,
                    updated_by=updated_by,
                )
                await ProductionReturnItem.filter(tenant_id=tenant_id, return_id=return_id).update(
                    status="待退料",
                    return_time=None,
                )
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回生产退料-库存冲减失败: %s", e)
                raise BusinessLogicError(f"撤回失败: {str(e)}")

            return ProductionReturnResponse.model_validate(
                await ProductionReturn.get(tenant_id=tenant_id, id=return_id)
            )


class FinishedGoodsReceiptService(AppBaseService[FinishedGoodsReceipt]):
    """成品入库单服务"""

    def __init__(self):
        super().__init__(FinishedGoodsReceipt)

    async def resolve_default_inbound_warehouse_for_work_order(
        self,
        tenant_id: int,
        work_order: WorkOrder,
    ) -> Optional[Tuple[int, str]]:
        """
        为工单解析成品入库默认仓库（用于末道工序自动入库等场景）。

        优先级：工单成品物料 defaults 默认仓库（按 priority）> 关联工作中心的启用仓库
        > 关联车间的启用仓库 > 首个启用的普通仓 > 任意启用仓库。
        """
        from apps.master_data.models.warehouse import Warehouse
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )

        product_id = getattr(work_order, "product_id", None)
        if product_id:
            material_wh = await resolve_primary_default_warehouse_from_material(
                tenant_id,
                material_id=product_id,
            )
            if material_wh:
                return material_wh

        base = Warehouse.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        )

        wc_id = getattr(work_order, "work_center_id", None)
        if wc_id:
            wh = await base.filter(work_center_id=wc_id).order_by("id").first()
            if wh:
                return (wh.id, wh.name)

        ws_id = getattr(work_order, "workshop_id", None)
        if ws_id:
            wh = await base.filter(workshop_id=ws_id).order_by("id").first()
            if wh:
                return (wh.id, wh.name)

        wh = await base.filter(warehouse_type="normal").order_by("id").first()
        if wh:
            return (wh.id, wh.name)

        wh = await base.order_by("id").first()
        if wh:
            return (wh.id, wh.name)
        return None

    async def create_finished_goods_receipt(self, tenant_id: int, receipt_data: FinishedGoodsReceiptCreate, created_by: int, items: Optional[List[FinishedGoodsReceiptItemCreate]] = None) -> FinishedGoodsReceiptResponse:
        """创建成品入库单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供receipt_code，则自动生成
            if receipt_data.receipt_code:
                code = receipt_data.receipt_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", prefix=f"FGR{today}")
            
            # 从参数或receipt_data中提取items（如果存在）
            if items is None:
                items = getattr(receipt_data, 'items', None) or []
            
            # 计算总数量
            total_quantity = sum(item.receipt_quantity for item in items) if items else 0
            
            # 创建入库单
            receipt = await FinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                receipt_code=code,
                work_order_id=receipt_data.work_order_id,
                work_order_code=receipt_data.work_order_code,
                sales_order_id=receipt_data.sales_order_id,
                sales_order_code=receipt_data.sales_order_code,
                warehouse_id=receipt_data.warehouse_id,
                warehouse_name=receipt_data.warehouse_name,
                receipt_time=receipt_data.receipt_time,
                receiver_id=receipt_data.receiver_id,
                receiver_name=receipt_data.receiver_name,
                reviewer_id=receipt_data.reviewer_id,
                reviewer_name=receipt_data.reviewer_name,
                review_time=receipt_data.review_time,
                review_status=receipt_data.review_status,
                review_remarks=receipt_data.review_remarks,
                status=receipt_data.status,
                total_quantity=total_quantity,
                notes=receipt_data.notes,
                created_by=user_info.get("id"),
                created_by_name=user_info.get("name", ""),
            )
            
            # 创建入库单明细
            if items:
                from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
                from apps.master_data.models.material import Material
                from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item
                location_required, _ = await _get_warehouse_policy_flags(tenant_id)
                
                for item_data in items:
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=item_data.material_id,
                        deleted_at__isnull=True,
                    )
                    batch_number = getattr(item_data, 'batch_number', None)
                    if material:
                        batch_number = await ensure_batch_no_for_item(
                            tenant_id=tenant_id,
                            material=material,
                            item_data=item_data,
                            supplier_code=None,
                        ) or batch_number
                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        scene="成品入库",
                        material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                    )
                    
                    await FinishedGoodsReceiptItem.create(
                        tenant_id=tenant_id,
                        receipt_id=receipt.id,
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        receipt_quantity=item_data.receipt_quantity,
                        qualified_quantity=item_data.qualified_quantity,
                        unqualified_quantity=item_data.unqualified_quantity,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=batch_number,
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        quality_status=getattr(item_data, 'quality_status', '合格'),
                        quality_inspection_id=getattr(item_data, 'quality_inspection_id', None),
                        status=getattr(item_data, 'status', '待入库'),
                        receipt_time=getattr(item_data, 'receipt_time', None),
                        notes=getattr(item_data, 'notes', None),
                    )

            # 建立工单→成品入库 的 DocumentRelation（支持单据追溯）
            work_order_id = getattr(receipt, "work_order_id", None) or getattr(receipt_data, "work_order_id", None)
            if work_order_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                    from apps.kuaizhizao.models.work_order import WorkOrder

                    wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True)
                    if wo:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=work_order_id,
                                source_code=wo.code,
                                source_name=wo.name,
                                target_type="finished_goods_receipt",
                                target_id=receipt.id,
                                target_code=receipt.receipt_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单创建成品入库单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立工单→成品入库 单据关联失败: %s", e)
            
            return FinishedGoodsReceiptResponse.model_validate(receipt)

    async def get_finished_goods_receipt_by_id(self, tenant_id: int, receipt_id: int) -> FinishedGoodsReceiptWithItemsResponse:
        """根据ID获取成品入库单（含明细）"""
        receipt = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            raise NotFoundError(f"成品入库单不存在: {receipt_id}")
        items = await FinishedGoodsReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).all()
        resp = FinishedGoodsReceiptWithItemsResponse.model_validate(receipt)
        resp.items = [FinishedGoodsReceiptItemResponse.model_validate(i) for i in items]
        return resp

    async def list_finished_goods_receipts(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[FinishedGoodsReceiptResponse]:
        """获取成品入库单列表"""
        query = FinishedGoodsReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])

        receipts = await query.offset(skip).limit(limit).order_by('-created_at')
        return [FinishedGoodsReceiptResponse.model_validate(receipt) for receipt in receipts]

    async def confirm_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        confirmed_by: int,
        confirmation_data: Optional[InboundConfirmationRequest] = None,
    ) -> FinishedGoodsReceiptResponse:
        """确认入库"""
        async with in_transaction():
            receipt = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
            if not receipt:
                raise NotFoundError(f"成品入库单不存在: {receipt_id}")

            if receipt.status != '待入库':
                raise BusinessLogicError("只有待入库状态的成品入库单才能确认入库")

            # 1. 如果提供了确认数据，先更新表头和明细
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = confirmation_data.warehouse_name or f"仓库{confirmation_data.warehouse_id}"
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                
                if update_dict:
                    await FinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(**update_dict)
                    # 重新加载 receipt 以获取最新仓库信息
                    receipt = await FinishedGoodsReceipt.get(tenant_id=tenant_id, id=receipt_id)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        # FinishedGoodsReceiptItem has no warehouse_id; the warehouse is stored on the header.
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.expiry_date:
                            item_update["expiry_date"] = item_data.expiry_date
                        if item_data.serial_numbers and hasattr(FinishedGoodsReceiptItem, "serial_numbers"):
                            item_update["serial_numbers"] = json.dumps(item_data.serial_numbers)
                        
                        if item_update:
                            await FinishedGoodsReceiptItem.filter(
                                tenant_id=tenant_id, receipt_id=receipt_id, id=item_data.item_id
                            ).update(**item_update)

            # 2. 补齐缺失的批号/序列号 (根据物料配置自动生成)
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import (
                ensure_batch_no_for_item,
                ensure_serial_nos_for_item,
            )

            items = await FinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt_id
            ).all()
            
            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if not material:
                    continue
                
                # 自动生成批号
                if material.batch_managed and not item.batch_number:
                    batch_no = await ensure_batch_no_for_item(tenant_id, material, item)
                    if batch_no:
                        item.batch_number = batch_no
                        await item.save()
                
                # 自动生成序列号
                if material.serial_managed:
                    count = int(item.receipt_quantity or item.qualified_quantity or 0)
                    existing_serials = []
                    item_serials = getattr(item, "serial_numbers", None)
                    if item_serials:
                        try:
                            existing_serials = json.loads(item_serials)
                        except:
                            pass
                    
                    if len(existing_serials) < count:
                        serial_nos = await ensure_serial_nos_for_item(tenant_id, material, item, count)
                        if serial_nos and hasattr(item, "serial_numbers"):
                            setattr(item, "serial_numbers", json.dumps(serial_nos))
                            await item.save()

            from apps.kuaizhizao.services.inspection_policy_service import assert_fqc_for_finished_goods_receipt

            await assert_fqc_for_finished_goods_receipt(
                tenant_id,
                receipt_id,
                receipt.work_order_id,
                items,
            )

            # 3. 执行入库确认（更新状态和时间）
            confirmer_name = await self.get_user_name(confirmed_by)
            receipt_time = (confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None) or datetime.now()

            await FinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                status='已入库',
                receiver_id=confirmed_by,
                receiver_name=confirmer_name,
                receipt_time=receipt_time,
                updated_by=confirmed_by
            )
            
            # 同时更新明细状态
            await FinishedGoodsReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).update(
                status='已入库',
                receipt_time=receipt_time,
            )

            # 4. 更新库存（增加）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                # 重新加载明细以获取最新的批号
                items = await FinishedGoodsReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).all()
                
                for item in items:
                    qty = item.receipt_quantity or item.qualified_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    
                    # 优先使用行仓库，若无则使用表头仓库
                    wh_id = item.warehouse_id if getattr(item, "warehouse_id", None) else receipt.warehouse_id
                    
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="finished_goods_receipt",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt.receipt_code,
                    )
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                await InventoryCostService().apply_finished_goods_receipt_cost(
                    tenant_id, receipt_id, receipt.work_order_id
                )
            except Exception as inv_e:
                logger.error("成品入库确认-更新库存失败: %s", inv_e)
                raise

            updated_receipt = await self.get_finished_goods_receipt_by_id(tenant_id, receipt_id)
            return updated_receipt

    async def withdraw_receipt_confirmation(
        self,
        tenant_id: int,
        receipt_id: int,
        updated_by: int,
    ) -> FinishedGoodsReceiptWithItemsResponse:
        """撤回已确认的成品入库：冲减即时库存，单据回到待入库。"""
        async with in_transaction():
            receipt = await FinishedGoodsReceipt.get_or_none(
                tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
            )
            if not receipt:
                raise NotFoundError(f"成品入库单不存在: {receipt_id}")
            if receipt.status != "已入库":
                raise BusinessLogicError("只有已入库状态的成品入库单才能撤回入库")

            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                items = await FinishedGoodsReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).all()
                wh_id = receipt.warehouse_id if receipt.warehouse_id else None
                for item in items:
                    qty = item.receipt_quantity or item.qualified_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="finished_goods_receipt_revoke",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt.receipt_code,
                    )

                await FinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                    status="待入库",
                    receiver_id=None,
                    receiver_name=None,
                    receipt_time=None,
                    updated_by=updated_by,
                )
                await FinishedGoodsReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).update(status="待入库", receipt_time=None)
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回成品入库-库存冲减失败: %s", e)
                raise BusinessLogicError(f"撤回失败: {str(e)}")

            return await self.get_finished_goods_receipt_by_id(tenant_id, receipt_id)

    async def delete_finished_goods_receipt(self, tenant_id: int, receipt_id: int) -> bool:
        """
        软删除成品入库单（仅草稿/待入库；未确认入库不影响库存）。
        若存在未删除的装箱绑定则禁止删除。
        """
        deletable_statuses = ("草稿", "draft", "DRAFT", "待入库")
        async with in_transaction():
            receipt = await FinishedGoodsReceipt.get_or_none(
                tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
            )
            if not receipt:
                raise NotFoundError(f"成品入库单不存在: {receipt_id}")
            if receipt.status not in deletable_statuses:
                raise BusinessLogicError(
                    f"仅草稿或待入库状态的成品入库单可删除，当前状态：{receipt.status}"
                )

            from apps.kuaizhizao.models.packing_binding import PackingBinding

            pb_count = await PackingBinding.filter(
                tenant_id=tenant_id,
                finished_goods_receipt_id=receipt_id,
                deleted_at__isnull=True,
            ).count()
            if pb_count > 0:
                raise BusinessLogicError("已存在装箱绑定记录，请先删除绑定后再删除成品入库单")

            from apps.kuaizhizao.models.document_relation import DocumentRelation

            await DocumentRelation.filter(
                tenant_id=tenant_id,
                target_type="finished_goods_receipt",
                target_id=receipt_id,
            ).delete()
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="finished_goods_receipt",
                source_id=receipt_id,
            ).delete()

            await FinishedGoodsReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).delete()
            now = datetime.now()
            await FinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                deleted_at=now,
                is_active=False,
            )
        return True

    # 未确认入库前可与末道报工联动调整数量（与 delete_finished_goods_receipt 可删状态一致）
    _PENDING_FINISHED_GOODS_RECEIPT_STATUSES = ("待入库", "草稿", "draft", "DRAFT")

    async def sync_pending_finished_goods_receipts_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> None:
        """
        末道工序已审核报工的合格数变化后，将关联工单、且尚未确认入库的成品入库单单头/主行数量对齐。

        目标数量 = 末道工序上所有「已审核」报工记录的合格数量之和（与一键入库缺省口径一致）。
        目标为 0 时按规则尝试软删除此类入库单（若存在装箱绑定等则跳过并打日志）。
        """
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.kuaizhizao.models.reporting_record import ReportingRecord

        work_order = await WorkOrder.get_or_none(
            id=work_order_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not work_order:
            return

        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        if not operations:
            return

        last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
        approved_last = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=last_op.operation_id,
            status="approved",
            deleted_at__isnull=True,
        ).all()
        target_qty = sum(
            (Decimal(str(r.qualified_quantity or 0)) for r in approved_last),
            start=Decimal("0"),
        )

        receipts = await FinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status__in=self._PENDING_FINISHED_GOODS_RECEIPT_STATUSES,
        ).all()
        if not receipts:
            return

        product_id = work_order.product_id
        for receipt in receipts:
            if receipt.status not in self._PENDING_FINISHED_GOODS_RECEIPT_STATUSES:
                continue
            if target_qty <= 0:
                try:
                    await self.delete_finished_goods_receipt(tenant_id, receipt.id)
                    logger.info(
                        "末道报工合格数为 0，已删除待入库成品入库单 receipt_id=%s work_order_id=%s",
                        receipt.id,
                        work_order_id,
                    )
                except BusinessLogicError as e:
                    logger.warning(
                        "末道报工合格数为 0，但无法删除成品入库单 receipt_id=%s：%s",
                        receipt.id,
                        e,
                    )
                continue

            items = await FinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id,
                receipt_id=receipt.id,
            ).all()
            if not items:
                continue

            primary = None
            product_lines = [it for it in items if int(it.material_id) == int(product_id)]
            if len(product_lines) == 1:
                primary = product_lines[0]
            elif len(items) == 1:
                primary = items[0]
            else:
                logger.warning(
                    "成品入库单 receipt_id=%s 明细行数=%s 且无法唯一匹配工单成品，跳过报工联动同步",
                    receipt.id,
                    len(items),
                )
                continue

            others_sum = sum(
                (Decimal(str(it.receipt_quantity or 0)) for it in items if it.id != primary.id),
                start=Decimal("0"),
            )
            new_total = target_qty + others_sum

            await FinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id,
                id=primary.id,
            ).update(
                receipt_quantity=target_qty,
                qualified_quantity=target_qty,
            )
            await FinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt.id).update(
                total_quantity=new_total
            )
            logger.info(
                "已同步待入库成品入库单 receipt_id=%s work_order_id=%s total=%s 主行合格=%s",
                receipt.id,
                work_order_id,
                new_total,
                target_qty,
            )

    async def quick_receipt_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        receipt_quantity: Optional[float] = None
    ) -> FinishedGoodsReceiptResponse:
        """
        一键入库：从工单下推，根据报工记录自动生成入库单
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选，如果不提供则使用物料默认仓库）
            warehouse_name: 仓库名称（可选）
            receipt_quantity: 入库数量（可选，如果不提供则优先质检合格数，否则使用末道工序合格数量）
            
        Returns:
            FinishedGoodsReceiptResponse: 创建的成品入库单
            
        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
        """
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
        from decimal import Decimal
        from apps.kuaizhizao.services.work_order_inbound_bom_role import (
            is_semi_finished_product_by_bom_role,
        )

        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        if await is_semi_finished_product_by_bom_role(tenant_id, work_order.product_id):
            from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                SemiFinishedGoodsReceiptService,
            )

            semi = await SemiFinishedGoodsReceiptService().quick_receipt_from_work_order(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                created_by=created_by,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                receipt_quantity=receipt_quantity,
            )
            payload = semi.model_dump()
            payload["inbound_doc_kind"] = "semi_finished_goods"
            return FinishedGoodsReceiptResponse.model_validate(payload)

        async with in_transaction():
            # 1. 获取工单信息（成品入库路径）
            
            # 检查工单状态（库内工单状态为英文枚举，兼容历史中文）
            if work_order.status not in ("in_progress", "completed", "进行中", "已完成"):
                raise BusinessLogicError(f"工单状态为 {work_order.status}，无法创建入库单")
            
            # 2. 获取入库数量（优先从成品检验单获取合格数量）
            if receipt_quantity is None:
                from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
                
                # 检查是否存在已合格的成品检验单
                qc_records = await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    quality_status='合格'
                ).all()
                
                if qc_records:
                    total_qc_qualified = sum(float(qc.qualified_quantity or 0) for qc in qc_records)
                    # 检查是否已有入库记录，避免超入（简化处理：暂不进行复杂的已入库扣减，后续可增强）
                    if total_qc_qualified > 0:
                        receipt_quantity = total_qc_qualified
                        logger.info(f"工单一键入库：自动从成品检验单获取合格数量 {receipt_quantity}")
                
                if receipt_quantity is None:
                    # 如果没有合格的质检单，回退到末道工序合格数量（与工单头 qualified_quantity、报工逻辑一致），不按全工序报工相加
                    from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

                    operations = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=work_order_id,
                        deleted_at__isnull=True,
                    ).all()
                    if not operations:
                        raise ValidationError("工单无工序记录，无法自动获取入库数量")

                    last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
                    lo_q = float(last_op.qualified_quantity or 0)
                    if lo_q > 0:
                        receipt_quantity = lo_q
                        logger.info(
                            f"工单一键入库：未找到质检单，使用末道工序「{last_op.operation_name}」累计合格数量 {receipt_quantity}"
                        )
                    else:
                        # ReportingRecord.operation_id 为主数据工序 ID，与 WorkOrderOperation.operation_id 一致
                        reporting_records = await ReportingRecord.filter(
                            tenant_id=tenant_id,
                            work_order_id=work_order_id,
                            operation_id=last_op.operation_id,
                            status="approved",
                            deleted_at__isnull=True,
                        ).all()
                        if not reporting_records:
                            raise ValidationError(
                                "工单没有质检合格记录，且末道工序无已审核报工记录，无法自动获取入库数量"
                            )
                        total_qualified = sum(
                            float(record.qualified_quantity or 0) for record in reporting_records
                        )
                        if total_qualified <= 0:
                            raise ValidationError("末道工序报工合格数量为0，无法创建入库单")
                        receipt_quantity = total_qualified
                        logger.info(
                            f"工单一键入库：未找到质检单，从末道工序已审核报工汇总合格数量 {receipt_quantity}"
                        )
            else:
                receipt_quantity = float(receipt_quantity)
            
            # 3. 获取仓库信息（如果未指定：按工单工作中心/车间/普通仓解析）
            if not warehouse_id:
                resolved = await self.resolve_default_inbound_warehouse_for_work_order(
                    tenant_id=tenant_id,
                    work_order=work_order,
                )
                if not resolved:
                    raise ValidationError(
                        "请指定入库仓库，或在主数据中维护与工单工作中心/车间关联的启用仓库"
                    )
                warehouse_id, warehouse_name = resolved[0], resolved[1]
            
            # 4. 生成入库单编码
            today = datetime.now().strftime("%Y%m%d")
            receipt_code = await self.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", prefix=f"FG{today}")
            
            # 5. 创建成品入库单
            receipt = await FinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                receipt_code=receipt_code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                sales_order_id=work_order.sales_order_id,
                sales_order_code=work_order.sales_order_code,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name or '',
                status='待入库',
                total_quantity=Decimal(str(receipt_quantity)),
                created_by=created_by,
                updated_by=created_by
            )
            
            # 6. 创建入库单明细（批号管理物料自动生成批号）
            batch_number = None
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item
            material = await Material.get_or_none(
                tenant_id=tenant_id,
                id=work_order.product_id,
                deleted_at__isnull=True,
            )
            if material:
                class _ItemData:
                    batch_number = None
                batch_number = await ensure_batch_no_for_item(
                    tenant_id=tenant_id,
                    material=material,
                    item_data=_ItemData(),
                    supplier_code=None,
                )
            material_unit = (getattr(material, "base_unit", None) or "个") if material else "个"
            await FinishedGoodsReceiptItem.create(
                tenant_id=tenant_id,
                receipt_id=receipt.id,
                material_id=work_order.product_id,
                material_code=work_order.product_code,
                material_name=work_order.product_name,
                material_unit=material_unit,
                receipt_quantity=Decimal(str(receipt_quantity)),
                qualified_quantity=Decimal(str(receipt_quantity)),
                unqualified_quantity=Decimal('0'),
                batch_number=batch_number,
                status='待入库'
            )

            # 建立工单→成品入库 的 DocumentRelation（支持单据追溯）
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="finished_goods_receipt",
                        target_id=receipt.id,
                        target_code=receipt.receipt_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单一键入库创建成品入库单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→成品入库 单据关联失败: %s", e)
            
            return FinishedGoodsReceiptResponse.model_validate(receipt)
    
    async def batch_receipt_from_work_orders(
        self,
        tenant_id: int,
        work_order_ids: List[int],
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> List[FinishedGoodsReceiptResponse]:
        """
        批量入库：从多个工单下推，批量创建入库单
        
        Args:
            tenant_id: 租户ID
            work_order_ids: 工单ID列表
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选）
            warehouse_name: 仓库名称（可选）
            
        Returns:
            List[FinishedGoodsReceiptResponse]: 创建的成品入库单列表
        """
        results = []
        for work_order_id in work_order_ids:
            try:
                receipt = await self.quick_receipt_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    created_by=created_by,
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name
                )
                results.append(receipt)
            except Exception as e:
                logger.error(f"批量入库失败，工单ID: {work_order_id}, 错误: {str(e)}")
                # 继续处理其他工单，不中断整个流程
                continue
        
        return results



class SalesDeliveryService(AppBaseService[SalesDelivery]):
    """销售出库单服务"""

    def __init__(self):
        super().__init__(SalesDelivery)
        self.business_config_service = BusinessConfigService()

    async def create_sales_delivery(
        self,
        tenant_id: int,
        delivery_data: SalesDeliveryCreate,
        created_by: int,
        *,
        require_batch_serial_on_create: bool = True,
    ) -> SalesDeliveryResponse:
        """创建销售出库单

        require_batch_serial_on_create:
            为 False 时跳过明细上的批号/序列号策略校验（如发货通知「通知仓库」下推出库单，
            批号在仓库「确认出库」前补录）。HTTP 创建接口始终为默认 True。
            此时即使开启「自动出库」也不会在创建后立即 confirm，否则会因无批号再次失败。
        """
        # 1. 检查模块是否启用
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "sales_delivery")
        if not is_enabled:
            raise BusinessLogicError("销售发货模块未启用，无法创建出库单")
        location_required, auto_outbound_enabled = await _get_warehouse_policy_flags(tenant_id)
        created_delivery_id: Optional[int] = None

        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            
            # 2. 检查是否需要审核
            audit_required = await self.business_config_service.check_audit_required(tenant_id, "sales_delivery")
            
            # 确定初始状态
            initial_status = delivery_data.status
            initial_review_status = delivery_data.review_status
            
            if not audit_required and initial_status in [None, "待审核", "草稿"]:
                # 如果不需要审核，且未指定状态或指定为草稿/待审核，则直接设为待出库（即已通过审核，等待执行）
                initial_status = "待出库"
                initial_review_status = "已通过"
            
            # 如果未提供delivery_code，则自动生成
            if delivery_data.delivery_code:
                code = delivery_data.delivery_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "SALES_DELIVERY_CODE", prefix=f"SD{today}")

            # 从delivery_data中提取items（如果存在）
            items = getattr(delivery_data, 'items', None) or []
            
            # 计算总数量和总金额
            total_quantity = sum(item.delivery_quantity for item in items) if items else 0
            total_amount = sum(item.total_amount for item in items) if items else 0

            # MTS模式下，sales_order_id可以为None（销售出库与需求关联功能增强）
            sales_order_id = delivery_data.sales_order_id if delivery_data.sales_order_id and delivery_data.sales_order_id > 0 else None
            sales_order_code = delivery_data.sales_order_code if sales_order_id else None
            
            # 销售预测信息（MTS模式）（销售出库与需求关联功能增强）
            sales_forecast_id = getattr(delivery_data, 'sales_forecast_id', None)
            sales_forecast_code = getattr(delivery_data, 'sales_forecast_code', None)
            
            # 统一需求关联（销售出库与需求关联功能增强）
            demand_id = getattr(delivery_data, 'demand_id', None)
            demand_code = getattr(delivery_data, 'demand_code', None)
            demand_type = getattr(delivery_data, 'demand_type', None)
            
            # 如果提供了demand_id但没有demand_type，根据sales_order_id或sales_forecast_id判断
            if demand_id and not demand_type:
                if sales_order_id:
                    demand_type = "sales_order"
                elif sales_forecast_id:
                    demand_type = "sales_forecast"
            
            delivery = await SalesDelivery.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                delivery_code=code,
                sales_order_id=sales_order_id,
                sales_order_code=sales_order_code or "",
                sales_forecast_id=sales_forecast_id,
                sales_forecast_code=sales_forecast_code or "",
                demand_id=demand_id,
                demand_code=demand_code or "",
                demand_type=demand_type,
                customer_id=delivery_data.customer_id,
                customer_name=delivery_data.customer_name,
                warehouse_id=delivery_data.warehouse_id,
                warehouse_name=delivery_data.warehouse_name,
                delivery_time=delivery_data.delivery_time,
                deliverer_id=delivery_data.deliverer_id,
                deliverer_name=delivery_data.deliverer_name,
                reviewer_id=delivery_data.reviewer_id,
                reviewer_name=delivery_data.reviewer_name,
                review_time=delivery_data.review_time,
                review_status=initial_review_status,
                review_remarks=delivery_data.review_remarks,
                status=initial_status,
                total_quantity=total_quantity,
                total_amount=total_amount,
                shipping_method=delivery_data.shipping_method,
                tracking_number=delivery_data.tracking_number,
                shipping_address=getattr(delivery_data, 'shipping_address', None),
                notes=delivery_data.notes,
                created_by=user_info.get("id"),
                created_by_name=user_info.get("name", ""),
            )
            
            # 创建出库单明细
            if items:
                from apps.master_data.models.material import Material
                
                for item_data in items:
                    # 配置驱动的批号/序列号校验
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=item_data.material_id
                    )
                    batch_number = getattr(item_data, 'batch_number', None)
                    serial_numbers = getattr(item_data, 'serial_numbers', None)
                    if material and require_batch_serial_on_create:
                        await _validate_batch_serial_policy(
                            tenant_id=tenant_id,
                            material=material,
                            batch_number=batch_number,
                            serial_numbers=serial_numbers,
                            quantity=getattr(item_data, "delivery_quantity", None),
                            scene="销售出库",
                        )
                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        scene="销售出库",
                        material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                    )
                    
                    # 序列号信息（批号和序列号选择功能增强）
                    # 如果serial_numbers是列表，转换为JSON格式存储
                    if serial_numbers and isinstance(serial_numbers, list):
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        # 如果已经是字符串格式的JSON，直接使用
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None
                    
                    # 需求关联（销售出库与需求关联功能增强）
                    item_demand_id = getattr(item_data, 'demand_id', None) or demand_id
                    demand_item_id = getattr(item_data, 'demand_item_id', None)
                    
                    await SalesDeliveryItem.create(
                        tenant_id=tenant_id,
                        delivery_id=delivery.id,
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        delivery_quantity=item_data.delivery_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=getattr(item_data, 'batch_number', None),
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        serial_numbers=serial_numbers_json,  # 批号和序列号选择功能增强
                        demand_id=item_demand_id,  # 销售出库与需求关联功能增强
                        demand_item_id=demand_item_id,  # 销售出库与需求关联功能增强
                        status=getattr(item_data, 'status', '待出库'),
                        delivery_time=getattr(item_data, 'delivery_time', None),
                        notes=getattr(item_data, 'notes', None),
                    )

            # 建立销售订单→销售出库 的 DocumentRelation
            if sales_order_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                    from apps.kuaizhizao.models.sales_order import SalesOrder

                    so = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True)
                    if so:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="sales_order",
                                source_id=sales_order_id,
                                source_code=so.order_code,
                                source_name=so.order_name,
                                target_type="sales_delivery",
                                target_id=delivery.id,
                                target_code=delivery.delivery_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="销售订单创建销售出库单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立销售订单→销售出库 单据关联失败: %s", e)

            # 建立销售预测→销售出库 的 DocumentRelation（MTS 模式）
            if sales_forecast_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                    from apps.kuaizhizao.models.sales_forecast import SalesForecast

                    sf = await SalesForecast.get_or_none(tenant_id=tenant_id, id=sales_forecast_id, deleted_at__isnull=True)
                    if sf:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="sales_forecast",
                                source_id=sales_forecast_id,
                                source_code=sf.forecast_code,
                                source_name=sf.forecast_name,
                                target_type="sales_delivery",
                                target_id=delivery.id,
                                target_code=delivery.delivery_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="销售预测创建销售出库单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立销售预测→销售出库 单据关联失败: %s", e)
            created_delivery_id = delivery.id

        if created_delivery_id:
            from apps.kuaizhizao.services.quality_automation_service import QualityAutomationService

            await QualityAutomationService().maybe_auto_create_oqc_from_sales_delivery(
                tenant_id=tenant_id,
                delivery_id=created_delivery_id,
                user_id=created_by,
            )

        # 未在创建时校验批号的单据（如发货通知下推）不能自动确认出库，否则 confirm 会因缺批号失败
        if (
            auto_outbound_enabled
            and created_delivery_id
            and require_batch_serial_on_create
        ):
            delivery_obj = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=created_delivery_id)
            if delivery_obj and delivery_obj.status == "待出库":
                return await self.confirm_delivery(
                    tenant_id=tenant_id,
                    delivery_id=created_delivery_id,
                    confirmed_by=created_by,
                )
        return SalesDeliveryResponse.model_validate(
            await SalesDelivery.get(tenant_id=tenant_id, id=created_delivery_id)
        )

    async def get_sales_delivery_by_id(self, tenant_id: int, delivery_id: int) -> SalesDeliveryWithItemsResponse:
        """根据ID获取销售出库单（含明细）"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_delivery_lifecycle

        delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=delivery_id)
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        items = await SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id=delivery_id).all()
        resp = SalesDeliveryWithItemsResponse.model_validate(delivery)
        resp.lifecycle = get_sales_delivery_lifecycle(delivery)
        resp.items = [SalesDeliveryItemResponse.model_validate(i) for i in items]
        return resp

    async def list_sales_deliveries(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesDeliveryResponse]:
        """获取销售出库单列表"""
        query = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('sales_order_id'):
            query = query.filter(sales_order_id=filters['sales_order_id'])
        if filters.get("scoped_sales_order_ids") is not None:
            query = query.filter(
                Q(sales_order_id__isnull=True)
                | Q(sales_order_id__in=filters["scoped_sales_order_ids"])
            )

        deliveries = await query.offset(skip).limit(limit).order_by('-created_at')
        return [SalesDeliveryResponse.model_validate(delivery) for delivery in deliveries]

    async def update_sales_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        delivery_data: SalesDeliveryUpdate,
        updated_by: int,
    ) -> SalesDeliveryResponse:
        """更新销售出库单（仅待出库可改）。"""
        async with in_transaction():
            delivery = await SalesDelivery.get_or_none(
                id=delivery_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not delivery:
                raise NotFoundError(f"销售出库单不存在: {delivery_id}")
            if delivery.status not in ["待出库", "draft", "草稿"]:
                raise ValidationError(f"销售出库单状态为{delivery.status}，不能修改")

            user_info = await self.get_user_info(updated_by)
            if delivery_data.delivery_time is not None:
                delivery.delivery_time = delivery_data.delivery_time
            if delivery_data.shipping_method is not None:
                delivery.shipping_method = delivery_data.shipping_method
            if delivery_data.tracking_number is not None:
                delivery.tracking_number = delivery_data.tracking_number
            if delivery_data.shipping_address is not None:
                delivery.shipping_address = delivery_data.shipping_address
            if delivery_data.notes is not None:
                delivery.notes = delivery_data.notes
            if delivery_data.warehouse_id is not None:
                delivery.warehouse_id = delivery_data.warehouse_id
            if delivery_data.warehouse_name is not None:
                delivery.warehouse_name = delivery_data.warehouse_name
            delivery.updated_by = updated_by
            delivery.updated_by_name = user_info.get("name", "")
            await delivery.save()
            return SalesDeliveryResponse.model_validate(delivery)

    async def delete_sales_delivery(self, tenant_id: int, delivery_id: int) -> None:
        """删除销售出库单（软删除，仅待出库可删）。"""
        delivery = await SalesDelivery.get_or_none(
            id=delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        if delivery.status not in ["待出库", "draft", "草稿", "已取消", "cancelled"]:
            raise BusinessLogicError("只有待出库或已取消状态的销售出库单才能删除")
        delivery.deleted_at = datetime.now()
        await delivery.save()

    async def withdraw_delivery_confirmation(
        self,
        tenant_id: int,
        delivery_id: int,
        updated_by: int,
    ) -> SalesDeliveryResponse:
        """撤回销售出库确认（库存回冲并恢复待出库）。"""
        async with in_transaction():
            delivery = await SalesDelivery.get_or_none(
                id=delivery_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not delivery:
                raise NotFoundError(f"销售出库单不存在: {delivery_id}")
            if delivery.status != "已出库":
                raise ValidationError("只有已出库状态的销售出库单才能撤回")

            items = await SalesDeliveryItem.filter(
                tenant_id=tenant_id,
                delivery_id=delivery_id,
                deleted_at__isnull=True,
            ).all()
            from apps.kuaizhizao.services.inventory_service import InventoryService
            from apps.master_data.models.material import Material

            material_ids = list({it.material_id for it in items if getattr(it, "material_id", None)})
            materials = await Material.filter(
                tenant_id=tenant_id,
                id__in=material_ids,
                deleted_at__isnull=True,
            ).all() if material_ids else []
            material_by_id = {m.id: m for m in materials}

            for item in items:
                qty = item.delivery_quantity or Decimal(0)
                if qty <= 0:
                    continue
                base_qty = _to_base_quantity(
                    quantity=Decimal(str(qty)),
                    material_unit=getattr(item, "material_unit", None),
                    material=material_by_id.get(item.material_id),
                )
                await InventoryService.increase_stock(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=base_qty,
                    warehouse_id=delivery.warehouse_id,
                    batch_no=item.batch_number or None,
                    source_type="sales_delivery_withdraw",
                    source_doc_id=delivery_id,
                    source_doc_code=delivery.delivery_code,
                )
                item.status = "待出库"
                item.delivery_time = None
                await item.save()

            if getattr(delivery, "sales_order_id", None):
                await self._rollback_confirmed_delivery_from_sales_order_items(
                    tenant_id=tenant_id,
                    sales_order_id=int(delivery.sales_order_id),
                    delivery_items=items,
                )

            user_info = await self.get_user_info(updated_by)
            delivery.status = "待出库"
            delivery.deliverer_id = None
            delivery.deliverer_name = None
            delivery.delivery_time = None
            delivery.updated_by = updated_by
            delivery.updated_by_name = user_info.get("name", "")
            await delivery.save()
            return SalesDeliveryResponse.model_validate(delivery)

    async def pull_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> SalesDeliveryResponse:
        """
        从销售订单上拉生成销售出库单（销售出库单上拉功能）
        
        从销售订单上拉，自动生成销售出库单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            created_by: 创建人ID
            delivery_quantities: 出库数量字典 {item_id: quantity}，如果不提供则使用订单剩余数量
            warehouse_id: 出库仓库ID（可选）
            warehouse_name: 出库仓库名称（可选）
            
        Returns:
            SalesDeliveryResponse: 创建的销售出库单信息
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单未审核或已全部出库
        """
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from apps.kuaizhizao.schemas.warehouse import SalesDeliveryItemCreate
        from decimal import Decimal
        
        # 获取销售订单
        sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id)
        if not sales_order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        
        # 检查订单状态（只有已审核或已确认的订单才能上拉生成出库单，兼容中英文状态）
        audited_ok = ("已审核", "已确认", "AUDITED", "CONFIRMED")
        if sales_order.status not in audited_ok:
            raise BusinessLogicError("只有已审核或已确认的销售订单才能上拉生成销售出库单")
        
        # 获取订单明细
        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        ).all()
        
        if not order_items:
            raise BusinessLogicError("销售订单没有明细，无法生成销售出库单")
        
        # 如果没有指定仓库，需要从订单或其他地方获取默认仓库
        if not warehouse_id:
            # TODO: 从配置或其他地方获取默认仓库
            raise ValidationError("必须指定出库仓库")
        
        # 如果没有指定仓库名称，尝试从仓库服务获取
        if not warehouse_name:
            # TODO: 从仓库服务获取仓库名称
            warehouse_name = f"仓库{warehouse_id}"
        
        # 准备出库单明细
        delivery_items = []
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        
        for item in order_items:
            # 计算出库数量
            if delivery_quantities and item.id in delivery_quantities:
                delivery_qty = Decimal(str(delivery_quantities[item.id]))
            else:
                # 使用剩余数量
                delivery_qty = item.remaining_quantity or item.order_quantity
            
            if delivery_qty <= 0:
                continue  # 跳过数量为0或负数的情况
            
            # 检查是否超出剩余数量
            if delivery_qty > (item.remaining_quantity or item.order_quantity):
                raise BusinessLogicError(f"物料 {item.material_code} 的出库数量 {delivery_qty} 超过剩余数量 {item.remaining_quantity}")
            
            # 计算金额
            item_total_amount = delivery_qty * item.unit_price
            
            delivery_items.append(
                SalesDeliveryItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    delivery_quantity=float(delivery_qty),
                    unit_price=float(item.unit_price),
                    total_amount=float(item_total_amount),
                    demand_id=None,  # 可以后续关联到统一需求表
                    demand_item_id=None,  # 可以后续关联到需求明细
                )
            )
            
            total_quantity += delivery_qty
            total_amount += item_total_amount
        
        if not delivery_items:
            raise BusinessLogicError("没有可出库的物料")
        
        # 创建销售出库单
        delivery_data = SalesDeliveryCreate(
            sales_order_id=sales_order_id,
            sales_order_code=sales_order.order_code,
            demand_type="sales_order",  # 销售出库与需求关联功能增强
            customer_id=sales_order.customer_id,
            customer_name=sales_order.customer_name,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            status="待出库",
            total_quantity=float(total_quantity),
            total_amount=float(total_amount),
            shipping_address=sales_order.shipping_address,
            shipping_method=sales_order.shipping_method,
            notes=f"从销售订单 {sales_order.order_code} 上拉生成",
            items=delivery_items
        )
        
        # 创建出库单
        delivery = await self.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by
        )
        
        # 已交货/剩余数量在「确认出库」时按实发数量回写订单明细（见 confirm_delivery）
        
        return delivery

    async def pull_from_sales_forecast(
        self,
        tenant_id: int,
        sales_forecast_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> SalesDeliveryResponse:
        """
        从销售预测上拉生成销售出库单（销售出库单上拉功能）
        
        从销售预测上拉，自动生成销售出库单（MTS模式）
        
        Args:
            tenant_id: 租户ID
            sales_forecast_id: 销售预测ID
            created_by: 创建人ID
            delivery_quantities: 出库数量字典 {item_id: quantity}，如果不提供则使用预测数量
            warehouse_id: 出库仓库ID（可选）
            warehouse_name: 出库仓库名称（可选）
            
        Returns:
            SalesDeliveryResponse: 创建的销售出库单信息
            
        Raises:
            NotFoundError: 销售预测不存在
            BusinessLogicError: 销售预测未审核
        """
        from apps.kuaizhizao.models.sales_forecast import SalesForecast
        from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
        from apps.kuaizhizao.schemas.warehouse import SalesDeliveryItemCreate
        from decimal import Decimal
        
        # 获取销售预测
        sales_forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=sales_forecast_id)
        if not sales_forecast:
            raise NotFoundError(f"销售预测不存在: {sales_forecast_id}")
        
        # 检查预测状态（只有已审核的预测才能上拉生成出库单）
        if sales_forecast.status != "已审核":
            raise BusinessLogicError("只有已审核的销售预测才能上拉生成销售出库单")
        
        # 获取预测明细
        forecast_items = await SalesForecastItem.filter(
            tenant_id=tenant_id,
            forecast_id=sales_forecast_id
        ).all()
        
        if not forecast_items:
            raise BusinessLogicError("销售预测没有明细，无法生成销售出库单")
        
        # 如果没有指定仓库，需要从订单或其他地方获取默认仓库
        if not warehouse_id:
            # TODO: 从配置或其他地方获取默认仓库
            raise ValidationError("必须指定出库仓库")
        
        # 如果没有指定仓库名称，尝试从仓库服务获取
        if not warehouse_name:
            # TODO: 从仓库服务获取仓库名称
            warehouse_name = f"仓库{warehouse_id}"
        
        # 准备出库单明细
        delivery_items = []
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        
        # MTS模式下，没有客户信息，需要从其他配置获取默认客户或设置为空
        # 这里暂时使用一个默认客户ID（实际应该从配置获取）
        default_customer_id = None  # TODO: 从配置获取默认客户
        default_customer_name = "MTS默认客户"  # TODO: 从配置获取默认客户名称
        
        for item in forecast_items:
            # 计算出库数量
            if delivery_quantities and item.id in delivery_quantities:
                delivery_qty = Decimal(str(delivery_quantities[item.id]))
            else:
                # 使用预测数量
                delivery_qty = item.forecast_quantity
            
            if delivery_qty <= 0:
                continue  # 跳过数量为0或负数的情况
            
            # MTS模式下，没有单价，需要从物料默认价格获取
            # TODO: 从物料默认价格获取单价
            unit_price = Decimal("0")  # 默认价格为0
            
            # 计算金额
            item_total_amount = delivery_qty * unit_price
            
            delivery_items.append(
                SalesDeliveryItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    delivery_quantity=float(delivery_qty),
                    unit_price=float(unit_price),
                    total_amount=float(item_total_amount),
                    demand_id=None,  # 可以后续关联到统一需求表
                    demand_item_id=None,  # 可以后续关联到需求明细
                )
            )
            
            total_quantity += delivery_qty
            total_amount += item_total_amount
        
        if not delivery_items:
            raise BusinessLogicError("没有可出库的物料")
        
        # 创建销售出库单
        delivery_data = SalesDeliveryCreate(
            sales_forecast_id=sales_forecast_id,
            sales_forecast_code=sales_forecast.forecast_code,
            demand_type="sales_forecast",  # 销售出库与需求关联功能增强
            customer_id=default_customer_id or 0,
            customer_name=default_customer_name,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            status="待出库",
            total_quantity=float(total_quantity),
            total_amount=float(total_amount),
            notes=f"从销售预测 {sales_forecast.forecast_code} 上拉生成",
            items=delivery_items
        )
        
        # 创建出库单
        delivery = await self.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by
        )
        
        return delivery

    async def _consume_shipment_notice_reservation_after_delivery(
        self,
        *,
        tenant_id: int,
        delivery: SalesDelivery,
        delivery_items: List[SalesDeliveryItem],
        updated_by: int,
    ) -> None:
        """
        P2-W-004: 发货通知与库存锁定闭环。
        出库确认后，按数量消费可匹配的“已通知”发货通知并置为“已出库”，释放预占。
        """
        sales_order_id = getattr(delivery, "sales_order_id", None)
        if not sales_order_id:
            return

        delivery_remaining: Dict[int, Decimal] = {}
        for item in delivery_items:
            material_id = int(getattr(item, "material_id", 0) or 0)
            qty = Decimal(str(getattr(item, "delivery_quantity", 0) or 0))
            if material_id <= 0 or qty <= 0:
                continue
            delivery_remaining[material_id] = delivery_remaining.get(material_id, Decimal("0")) + qty
        if not delivery_remaining:
            return

        notice_query = ShipmentNotice.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            status="已通知",
            deleted_at__isnull=True,
            sales_delivery_id__isnull=True,
        )
        if getattr(delivery, "warehouse_id", None):
            notice_query = notice_query.filter(warehouse_id=delivery.warehouse_id)
        notices = await notice_query.order_by("notified_at", "id").all()
        if not notices:
            return

        consumed_notice_ids: List[int] = []
        for notice in notices:
            notice_items = await ShipmentNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id=notice.id,
            ).all()
            if not notice_items:
                continue

            required_pairs: List[tuple[int, Decimal]] = []
            can_consume = True
            for n_item in notice_items:
                material_id = int(getattr(n_item, "material_id", 0) or 0)
                req_qty = Decimal(str(getattr(n_item, "notice_quantity", 0) or 0))
                if material_id <= 0 or req_qty <= 0:
                    continue
                if delivery_remaining.get(material_id, Decimal("0")) < req_qty:
                    can_consume = False
                    break
                required_pairs.append((material_id, req_qty))

            if can_consume and required_pairs:
                for material_id, req_qty in required_pairs:
                    delivery_remaining[material_id] = delivery_remaining.get(material_id, Decimal("0")) - req_qty
                consumed_notice_ids.append(int(notice.id))

        if consumed_notice_ids:
            await ShipmentNotice.filter(
                tenant_id=tenant_id,
                id__in=consumed_notice_ids,
            ).update(
                status="已出库",
                sales_delivery_id=delivery.id,
                sales_delivery_code=delivery.delivery_code,
                updated_by=updated_by,
            )

    async def _apply_confirmed_delivery_to_sales_order_items(
        self,
        *,
        tenant_id: int,
        sales_order_id: int,
        delivery_items: List[SalesDeliveryItem],
    ) -> None:
        """
        销售出库确认后，将本单实发数量按物料匹配并累加到销售订单明细的已交货数量。
        订单列表/详情中的 delivery_progress 与生命周期「发货出库」阶段依赖该字段。
        """
        if not sales_order_id or not delivery_items:
            return
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        ).order_by("id").all()
        if not order_items:
            return

        by_material: Dict[int, List[SalesOrderItem]] = {}
        for oi in order_items:
            mid = int(oi.material_id or 0)
            if mid <= 0:
                continue
            by_material.setdefault(mid, []).append(oi)

        for d_item in sorted(delivery_items, key=lambda x: int(x.id or 0)):
            qty = Decimal(str(d_item.delivery_quantity or 0))
            if qty <= 0:
                continue
            mid = int(d_item.material_id or 0)
            if mid <= 0:
                continue
            candidates = by_material.get(mid) or []
            for oi in candidates:
                if qty <= 0:
                    break
                order_qty = Decimal(str(oi.order_quantity or 0))
                delivered = Decimal(str(oi.delivered_quantity or 0))
                room = order_qty - delivered
                if room <= 0:
                    continue
                take = min(room, qty)
                new_delivered = delivered + take
                oi.delivered_quantity = new_delivered
                oi.remaining_quantity = order_qty - new_delivered
                if oi.remaining_quantity < 0:
                    oi.remaining_quantity = Decimal("0")
                oi.delivery_status = "已交货" if oi.remaining_quantity <= 0 else "部分交货"
                await oi.save()
                qty -= take
            if qty > 0:
                logger.warning(
                    "销售出库确认：仍有 %s 数量未能匹配到销售订单行 (material_id=%s, sales_order_id=%s)",
                    qty,
                    mid,
                    sales_order_id,
                )

    async def _rollback_confirmed_delivery_from_sales_order_items(
        self,
        *,
        tenant_id: int,
        sales_order_id: int,
        delivery_items: List[SalesDeliveryItem],
    ) -> None:
        """销售出库撤回后，将本单已交数量从销售订单明细中回退。"""
        if not sales_order_id or not delivery_items:
            return
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True,
        ).order_by("id").all()
        if not order_items:
            return

        by_material: Dict[int, List[SalesOrderItem]] = {}
        for oi in order_items:
            mid = int(oi.material_id or 0)
            if mid > 0:
                by_material.setdefault(mid, []).append(oi)

        # 逆序回退，尽量对应确认时的分摊顺序
        for d_item in sorted(delivery_items, key=lambda x: int(x.id or 0), reverse=True):
            qty = Decimal(str(d_item.delivery_quantity or 0))
            if qty <= 0:
                continue
            mid = int(d_item.material_id or 0)
            if mid <= 0:
                continue
            candidates = list(by_material.get(mid) or [])
            candidates.reverse()
            for oi in candidates:
                if qty <= 0:
                    break
                delivered = Decimal(str(oi.delivered_quantity or 0))
                if delivered <= 0:
                    continue
                take = min(delivered, qty)
                new_delivered = delivered - take
                order_qty = Decimal(str(oi.order_quantity or 0))
                oi.delivered_quantity = new_delivered
                oi.remaining_quantity = max(order_qty - new_delivered, Decimal("0"))
                oi.delivery_status = "待交货" if new_delivered <= 0 else "部分交货"
                await oi.save()
                qty -= take

    async def confirm_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        confirmed_by: int,
        *,
        item_batches: Optional[List[SalesDeliveryConfirmItemBatch]] = None,
    ) -> SalesDeliveryResponse:
        """确认出库"""
        async with in_transaction():
            delivery = await self.get_sales_delivery_by_id(tenant_id, delivery_id)

            if delivery.status != '待出库':
                raise BusinessLogicError("只有待出库状态的销售出库单才能确认出库")

            await assert_oqc_before_sales_delivery_confirm(
                tenant_id,
                sales_order_id=delivery.sales_order_id,
                customer_id=delivery.customer_id,
                delivery_items=list(delivery.items or []),
                sales_delivery_id=delivery_id,
            )

            from apps.kuaicaiwu.services.credit_limit_service import CreditLimitService
            await CreditLimitService().validate_customer_exposure(
                tenant_id=tenant_id,
                customer_id=delivery.customer_id,
                customer_name=delivery.customer_name,
                additional_amount=Decimal(str(delivery.total_amount or 0)),
                scene="销售出库确认",
            )

            if item_batches is not None:
                line_rows = await SalesDeliveryItem.filter(
                    tenant_id=tenant_id, delivery_id=delivery_id
                ).all()
                active_ids = {
                    it.id
                    for it in line_rows
                    if Decimal(str(it.delivery_quantity or 0)) > Decimal("0")
                }
                patch = {row.item_id: (row.batch_no or "").strip() for row in item_batches}
                if active_ids and set(patch.keys()) != active_ids:
                    raise ValidationError(
                        "确认出库须逐行提交批号（需与所有出库数量大于 0 的明细 id 一一对应）"
                    )
                # 仅在有非空批号时写入；避免前端表格内控件未同步到 Form 时提交空串，把库内已有批号清空，
                # 进而导致批号管理物料扣库校验失败并整单事务回滚（单据仍为待出库）。
                for it in line_rows:
                    if it.id not in patch:
                        continue
                    bn = patch[it.id]
                    if bn:
                        it.batch_number = bn
                        await it.save()

            confirmer_name = await self.get_user_name(confirmed_by)
            confirm_time = datetime.now()

            # 使用 ORM save 更新表头，避免部分环境下 QuerySet.update 命中异常或与事务交互问题
            sd_row = await SalesDelivery.get_or_none(
                tenant_id=tenant_id,
                id=delivery_id,
                deleted_at__isnull=True,
            )
            if not sd_row:
                raise NotFoundError(f"销售出库单不存在或已删除: {delivery_id}")
            sd_row.status = "已出库"
            sd_row.deliverer_id = confirmed_by
            sd_row.deliverer_name = confirmer_name
            sd_row.delivery_time = confirm_time
            sd_row.updated_by = confirmed_by
            await sd_row.save()

            # 更新库存（扣减）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService
                from apps.master_data.models.material import Material

                delivery = await SalesDelivery.get(tenant_id=tenant_id, id=delivery_id)
                items = await SalesDeliveryItem.filter(
                    tenant_id=tenant_id, delivery_id=delivery_id
                ).all()
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                await InventoryCostService().apply_sales_delivery_outbound_costs(tenant_id, items)
                material_ids = list({it.material_id for it in items if getattr(it, "material_id", None)})
                materials = await Material.filter(
                    tenant_id=tenant_id,
                    id__in=material_ids,
                    deleted_at__isnull=True,
                ).all() if material_ids else []
                material_by_id = {m.id: m for m in materials}
                for item in items:
                    qty = item.delivery_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    mat = material_by_id.get(item.material_id)
                    if mat:
                        await _validate_batch_serial_policy(
                            tenant_id=tenant_id,
                            material=mat,
                            batch_number=getattr(item, "batch_number", None),
                            serial_numbers=_coerce_sales_delivery_item_serials(
                                getattr(item, "serial_numbers", None)
                            ),
                            quantity=qty,
                            scene="销售出库确认",
                        )
                biz_config = await BusinessConfigService().get_business_config(tenant_id)
                enforce_fifo = (
                    biz_config.get("parameters", {})
                    .get("warehouse", {})
                    .get("fifo", False)
                )
                wh_id = delivery.warehouse_id if delivery.warehouse_id else None
                for item in items:
                    qty = item.delivery_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _to_base_quantity(
                        quantity=Decimal(str(qty)),
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="sales_delivery",
                        source_doc_id=delivery_id,
                        source_doc_code=delivery.delivery_code,
                        enforce_fifo=enforce_fifo,
                    )
            except Exception as inv_e:
                logger.error("销售出库确认-更新库存失败: %s", inv_e)
                raise

            await self._consume_shipment_notice_reservation_after_delivery(
                tenant_id=tenant_id,
                delivery=delivery,
                delivery_items=items,
                updated_by=confirmed_by,
            )

            so_id = getattr(delivery, "sales_order_id", None)
            if so_id:
                await self._apply_confirmed_delivery_to_sales_order_items(
                    tenant_id=tenant_id,
                    sales_order_id=int(so_id),
                    delivery_items=items,
                )

            for line in items:
                qty = line.delivery_quantity or Decimal(0)
                if qty <= 0:
                    continue
                line.status = "已出库"
                line.delivery_time = confirm_time
                await line.save()

        updated_delivery = await self.get_sales_delivery_by_id(tenant_id, delivery_id)

        # 自动生成应收单：必须在出库主事务提交之后执行。create_receivable 内部另有 in_transaction()，
        # 与外层嵌套时部分环境下会导致出库/库存更新被回滚，但接口仍返回成功体（用户看到成功提示但单据未过账）。
        # 收入确认策略为「以开票为准」时不在此处生成应收，避免与销项发票路径重复记账。
        _cust_id = getattr(updated_delivery, "customer_id", None)
        if not await self.business_config_service.should_auto_generate_receivable_on_sales_delivery(
            tenant_id, int(_cust_id) if _cust_id is not None else None
        ):
            return updated_delivery
        try:
            from apps.kuaicaiwu.services.finance_service import ReceivableService
            from apps.kuaicaiwu.schemas.finance import ReceivableCreate
            from apps.kuaizhizao.models.sales_order import SalesOrder
            from apps.kuaizhizao.services.contract_milestone_billing_service import ContractMilestoneBillingService

            receivable_service = ReceivableService()
            delivery_row = await SalesDelivery.get(tenant_id=tenant_id, id=delivery_id)
            if delivery_row.sales_order_id:
                so = await SalesOrder.get_or_none(
                    tenant_id=tenant_id, id=int(delivery_row.sales_order_id), deleted_at__isnull=True
                )
                if so and getattr(so, "contract_id", None):
                    if await ContractMilestoneBillingService().should_skip_shipment_receivable_for_order(
                        tenant_id, so.customer_id, int(so.contract_id)
                    ):
                        return updated_delivery
            total_amount = Decimal(str(delivery_row.total_amount))
            receivable_data = ReceivableCreate(
                source_type="销售出库",
                source_id=delivery_id,
                source_code=delivery_row.delivery_code,
                customer_id=delivery_row.customer_id,
                customer_name=delivery_row.customer_name,
                total_amount=float(total_amount),
                received_amount=0.0,
                remaining_amount=float(total_amount),
                due_date=(datetime.now() + timedelta(days=30)).date(),
                business_date=datetime.now().date(),
                status="未收款",
                notes=f"由销售出库单 {delivery_row.delivery_code} 自动生成",
            )
            receivable = await receivable_service.create_receivable(
                tenant_id=tenant_id,
                receivable_data=receivable_data,
                created_by=confirmed_by,
            )
            try:
                from apps.kuaicaiwu.services.finance_integration_hooks import (
                    link_finance_document_relation,
                    record_finance_accounting_event,
                )

                await link_finance_document_relation(
                    tenant_id=tenant_id,
                    source_type="sales_delivery",
                    source_id=delivery_id,
                    source_code=delivery_row.delivery_code,
                    target_type="receivable",
                    target_id=receivable.id,
                    target_code=getattr(receivable, "receivable_code", None),
                    relation_desc="销售出库确认自动生成应收单",
                    created_by=confirmed_by,
                )
                await record_finance_accounting_event(
                    tenant_id=tenant_id,
                    event_type="SALES_DELIVERY_TO_RECEIVABLE",
                    business_type="receivable",
                    source_doc_type="sales_delivery",
                    source_doc_id=delivery_id,
                    source_doc_code=delivery_row.delivery_code,
                    target_doc_type="Receivable",
                    target_doc_id=receivable.id,
                    target_doc_code=receivable.receivable_code,
                    amount=total_amount,
                    operator_id=confirmed_by,
                    notes=f"销售出库单 {delivery_row.delivery_code} 自动生成应收单",
                )
            except Exception as rel_e:
                logger.warning("创建销售出库→应收单 单据关联/会计事件失败: %s", rel_e)
        except Exception as e:
            logger.error("自动生成应收单失败: %s", e)

        return updated_delivery

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入销售出库单
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建销售出库单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '销售订单编号': 'sales_order_code',
            '*销售订单编号': 'sales_order_code',
            'sales_order_code': 'sales_order_code',
            '*sales_order_code': 'sales_order_code',
            '客户名称': 'customer_name',
            'customer_name': 'customer_name',
            '仓库名称': 'warehouse_name',
            'warehouse_name': 'warehouse_name',
            '出库时间': 'delivery_time',
            'delivery_time': 'delivery_time',
            '发货方式': 'shipping_method',
            'shipping_method': 'shipping_method',
            '物流单号': 'tracking_number',
            'tracking_number': 'tracking_number',
            '收货地址': 'shipping_address',
            'shipping_address': 'shipping_address',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['sales_order_code']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        # 获取销售订单信息（用于填充客户信息）
        from apps.kuaizhizao.models.sales_order import SalesOrder
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                delivery_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field == 'delivery_time':
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                delivery_data[field] = dt.strptime(value_str, fmt)
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    delivery_data[field] = value_str
                
                # 验证必填字段
                if not delivery_data.get('sales_order_code'):
                    errors.append({
                        "row": row_idx,
                        "error": "销售订单编号为空"
                    })
                    failure_count += 1
                    continue
                
                # 查找销售订单
                sales_order = await SalesOrder.get_or_none(
                    tenant_id=tenant_id,
                    order_code=delivery_data['sales_order_code']
                )
                if not sales_order:
                    errors.append({
                        "row": row_idx,
                        "error": f"销售订单不存在：{delivery_data['sales_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建创建数据
                from apps.kuaizhizao.schemas.warehouse import SalesDeliveryCreate, SalesDeliveryItemCreate
                
                # 获取订单明细（用于创建出库单明细）
                from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
                order_items = await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id=sales_order.id
                ).all()
                
                if not order_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"销售订单没有明细：{delivery_data['sales_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建出库单明细
                delivery_items = []
                for item in order_items:
                    if item.remaining_quantity > 0:
                        delivery_items.append(SalesDeliveryItemCreate(
                            material_id=item.material_id,
                            material_code=item.material_code,
                            material_name=item.material_name,
                            material_unit=item.material_unit,
                            delivery_quantity=item.remaining_quantity,
                            unit_price=item.unit_price,
                            total_amount=item.remaining_quantity * item.unit_price
                        ))
                
                if not delivery_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"销售订单没有可出库的明细：{delivery_data['sales_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 创建出库单
                delivery_create_data = SalesDeliveryCreate(
                    sales_order_id=sales_order.id,
                    sales_order_code=sales_order.order_code,
                    customer_id=sales_order.customer_id,
                    customer_name=sales_order.customer_name,
                    warehouse_id=1,  # TODO: 从仓库名称查找仓库ID
                    warehouse_name=delivery_data.get('warehouse_name', '默认仓库'),
                    delivery_time=delivery_data.get('delivery_time') or datetime.now(),
                    items=delivery_items,
                    shipping_method=delivery_data.get('shipping_method'),
                    tracking_number=delivery_data.get('tracking_number'),
                    shipping_address=delivery_data.get('shipping_address'),
                    notes=delivery_data.get('notes')
                )
                
                await self.create_sales_delivery(
                    tenant_id=tenant_id,
                    delivery_data=delivery_create_data,
                    created_by=created_by
                )
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": row_idx,
                    "error": f"导入失败：{str(e)}"
                })
                failure_count += 1
                logger.error(f"导入销售出库单失败（第{row_idx}行）：{str(e)}")
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "data": {
                "success_count": success_count,
                "failure_count": failure_count,
                "errors": errors
            }
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出销售出库单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的销售出库单（不分页）
        deliveries = await self.list_sales_deliveries(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"sales_deliveries_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '出库单编号', '销售订单编号', '客户名称', '仓库名称',
                '出库时间', '状态', '总数量', '总金额',
                '发货方式', '物流单号', '收货地址', '备注', '创建时间'
            ])
            
            # 写入数据
            for delivery in deliveries:
                writer.writerow([
                    delivery.delivery_code,
                    delivery.sales_order_code or '',
                    delivery.customer_name or '',
                    delivery.warehouse_name or '',
                    delivery.delivery_time.strftime('%Y-%m-%d %H:%M:%S') if delivery.delivery_time else '',
                    delivery.status,
                    str(delivery.total_quantity) if delivery.total_quantity else '0',
                    str(delivery.total_amount) if delivery.total_amount else '0',
                    delivery.shipping_method or '',
                    delivery.tracking_number or '',
                    delivery.shipping_address or '',
                    delivery.notes or '',
                    delivery.created_at.strftime('%Y-%m-%d %H:%M:%S') if delivery.created_at else '',
                ])
        
        return file_path


class PurchaseReceiptService(AppBaseService[PurchaseReceipt]):
    """采购入库单服务"""

    def __init__(self):
        super().__init__(PurchaseReceipt)
        self.business_config_service = BusinessConfigService()

    async def create_purchase_receipt(self, tenant_id: int, receipt_data: PurchaseReceiptCreate, created_by: int) -> PurchaseReceiptResponse:
        """创建采购入库单"""
        created_receipt_id: Optional[int] = None
        response: Optional[PurchaseReceiptResponse] = None
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PURCHASE_RECEIPT_CODE", prefix=f"PR{today}")

            # 创建入库单头
            receipt_dict = receipt_data.model_dump(exclude_unset=True, exclude={'items', 'created_by', 'receipt_code'})
            receipt_dict.update({
                'tenant_id': tenant_id,
                'receipt_code': code,  # 使用生成的编码
                'created_by': created_by,
                'created_by_name': user_info.get("name", ""),
            })
            
            receipt = await PurchaseReceipt.create(**receipt_dict)
            
            # 创建入库单明细
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            
            # 获取供应商编码（用于批号规则变量）
            supplier_code = None
            location_required, _ = await _get_warehouse_policy_flags(tenant_id)
            tolerance_percentage = await self.business_config_service.get_purchase_tolerance_percentage(tenant_id)
            config = await self.business_config_service.get_business_config(tenant_id)
            quality_params = config.get("parameters", {}).get("quality", {})
            require_incoming_inspection = bool(quality_params.get("require_incoming_inspection_for_receipt"))
            supplier_id = getattr(receipt_data, "supplier_id", None)
            if supplier_id:
                from apps.master_data.models.supplier import Supplier
                supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=supplier_id, deleted_at__isnull=True)
                if supplier:
                    supplier_code = supplier.code

            for item_data in receipt_data.items or []:
                item_dict = item_data.model_dump(exclude_unset=True)
                # 确保数量字段是Decimal类型
                receipt_quantity = Decimal(str(item_data.receipt_quantity))
                unit_price = Decimal(str(item_data.unit_price))

                purchase_order_item_id = int(getattr(item_data, "purchase_order_item_id", 0) or 0)
                if purchase_order_item_id > 0:
                    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

                    # PurchaseOrderItem 无 deleted_at 字段，勿使用 deleted_at__isnull
                    po_item = await PurchaseOrderItem.filter(
                        tenant_id=tenant_id,
                        id=purchase_order_item_id,
                    ).select_for_update().first()
                    if not po_item:
                        raise ValidationError(f"采购订单明细不存在: {purchase_order_item_id}")

                    # PurchaseReceiptItem 无 deleted_at 字段
                    historical_items = await PurchaseReceiptItem.filter(
                        tenant_id=tenant_id,
                        purchase_order_item_id=purchase_order_item_id,
                    ).all()
                    already_received_qty = Decimal("0")
                    for historical in historical_items:
                        historical_receipt = await PurchaseReceipt.get_or_none(
                            tenant_id=tenant_id,
                            id=historical.receipt_id,
                            deleted_at__isnull=True,
                        )
                        if historical_receipt and historical_receipt.status not in ("已作废", "作废", "void", "VOID", "cancelled", "CANCELLED"):
                            already_received_qty += Decimal(str(historical.receipt_quantity or 0))

                    _validate_purchase_receipt_tolerance(
                        ordered_quantity=Decimal(str(po_item.ordered_quantity or 0)),
                        already_received_quantity=already_received_qty,
                        incoming_quantity=receipt_quantity,
                        tolerance_percentage=tolerance_percentage,
                        material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                    )
                
                # 批号管理物料：未填写批号时自动生成
                from apps.master_data.models.material import Material
                from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item
                material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id, deleted_at__isnull=True)
                if material:
                    batch_no = await ensure_batch_no_for_item(
                        tenant_id=tenant_id,
                        material=material,
                        item_data=item_data,
                        supplier_code=supplier_code,
                    )
                    if batch_no is not None:
                        item_dict["batch_number"] = batch_no
                _validate_location_if_required(
                    location_required=location_required,
                    location_id=getattr(item_data, 'location_id', None),
                    location_code=getattr(item_data, 'location_code', None),
                    scene="采购入库",
                    material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                )
                await _validate_purchase_line_warehouse_location_match(
                    tenant_id,
                    warehouse_id=getattr(item_data, "warehouse_id", None),
                    location_id=getattr(item_data, "location_id", None),
                    material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                )
                
                item_dict.update({
                    'tenant_id': tenant_id,
                    'receipt_id': receipt.id,
                    'receipt_quantity': receipt_quantity,
                    'unit_price': unit_price,
                    'total_amount': receipt_quantity * unit_price,
                })
                resolved_qualified_qty, resolved_unqualified_qty, resolved_quality_status = _resolve_purchase_item_quality_fields(
                    receipt_quantity=receipt_quantity,
                    qualified_quantity=getattr(item_data, "qualified_quantity", None),
                    unqualified_quantity=getattr(item_data, "unqualified_quantity", None),
                    quality_status=getattr(item_data, "quality_status", None),
                    require_incoming_inspection=require_incoming_inspection,
                )
                item_dict["qualified_quantity"] = resolved_qualified_qty
                item_dict["unqualified_quantity"] = resolved_unqualified_qty
                item_dict["quality_status"] = resolved_quality_status
                
                await PurchaseReceiptItem.create(**item_dict)
                
                total_quantity += receipt_quantity
                total_amount += item_dict['total_amount']
            
            # 更新入库单总数量和总金额
            await PurchaseReceipt.filter(id=receipt.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )

            # 建立采购订单→采购入库 的 DocumentRelation
            purchase_order_id = getattr(receipt, "purchase_order_id", None) or getattr(receipt_data, "purchase_order_id", None)
            if purchase_order_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                    from apps.kuaizhizao.models.purchase_order import PurchaseOrder

                    po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=purchase_order_id)
                    if po:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="purchase_order",
                                source_id=purchase_order_id,
                                source_code=po.order_code,
                                source_name=po.order_name,
                                target_type="purchase_receipt",
                                target_id=receipt.id,
                                target_code=receipt.receipt_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="采购订单创建采购入库单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立采购订单→采购入库 单据关联失败: %s", e)
            
            created_receipt_id = receipt.id
            response = PurchaseReceiptResponse.model_validate(receipt)

        if created_receipt_id is not None:
            from apps.kuaizhizao.services.quality_automation_service import QualityAutomationService

            await QualityAutomationService().maybe_auto_create_iqc_from_purchase_receipt(
                tenant_id=tenant_id,
                purchase_receipt_id=created_receipt_id,
                created_by=created_by,
            )
        return response

    async def get_purchase_receipt_by_id(self, tenant_id: int, receipt_id: int) -> PurchaseReceiptWithItemsResponse:
        """根据ID获取采购入库单（含明细）"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_receipt_lifecycle, get_document_milestones

        receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            raise NotFoundError(f"采购入库单不存在: {receipt_id}")
        await receipt.refresh_from_db()
        # 库内真实状态（独立 SELECT）：避免实例缓存/validate_assignment 导致响应 status 仍为旧值
        _st_rows = await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).values("status")
        if _st_rows and _st_rows[0].get("status") is not None:
            receipt.status = _st_rows[0]["status"]
        items = await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).all()
        resp = PurchaseReceiptWithItemsResponse.model_validate(receipt)
        milestones = await get_document_milestones(receipt.tenant_id, "purchase_receipt", receipt.id)
        resp.lifecycle = get_purchase_receipt_lifecycle(receipt, milestones=milestones)
        resp.items = [PurchaseReceiptItemResponse.model_validate(i) for i in items]
        if _st_rows and _st_rows[0].get("status") is not None:
            resp = resp.model_copy(update={"status": _st_rows[0]["status"]})
        # #region agent log
        _agent_debug_ndjson(
            "get_purchase_receipt_by_id:status_sync",
            "db_vs_resp_status",
            {
                "receipt_id": receipt_id,
                "from_values": (_st_rows[0]["status"] if _st_rows else None),
                "resp_status_final": getattr(resp, "status", None),
            },
            "H10",
            run_id="post-fix",
        )
        # #endregion
        return resp

    async def update_purchase_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        receipt_data: PurchaseReceiptUpdate,
        updated_by: int,
    ) -> PurchaseReceiptResponse:
        """更新采购入库单（草稿/待入库可编辑明细数量）。"""
        async with in_transaction():
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True)
            if not receipt:
                raise NotFoundError(f"采购入库单不存在: {receipt_id}")
            if receipt.status not in ("草稿", "draft", "DRAFT", "待入库"):
                raise BusinessLogicError("只有草稿或待入库状态的采购入库单可修改")

            # 更新入库单头
            receipt_dict = receipt_data.model_dump(exclude_unset=True, exclude={"items", "receipt_code"})
            receipt_dict["updated_by"] = updated_by
            await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(**receipt_dict)

            # 全量替换明细（前端会传完整明细）
            if receipt_data.items is not None:
                await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).delete()
                total_quantity = Decimal(0)
                total_amount = Decimal(0)
                tolerance_percentage = await self.business_config_service.get_purchase_tolerance_percentage(tenant_id)
                config = await self.business_config_service.get_business_config(tenant_id)
                quality_params = config.get("parameters", {}).get("quality", {})
                require_incoming_inspection = bool(quality_params.get("require_incoming_inspection_for_receipt"))
                supplier_code = None
                supplier_id = getattr(receipt, "supplier_id", None) or getattr(receipt_data, "supplier_id", None)
                if supplier_id:
                    from apps.master_data.models.supplier import Supplier

                    supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=supplier_id, deleted_at__isnull=True)
                    if supplier:
                        supplier_code = supplier.code
                location_required, _ = await _get_warehouse_policy_flags(tenant_id)
                for item_data in receipt_data.items:
                    qty = Decimal(str(item_data.receipt_quantity or 0))
                    if qty <= 0:
                        raise ValidationError(f"物料 {item_data.material_code} 的实际数量必须大于 0")
                    unit_price = Decimal(str(item_data.unit_price or 0))
                    line_amount = qty * unit_price

                    purchase_order_item_id = int(getattr(item_data, "purchase_order_item_id", 0) or 0)
                    if purchase_order_item_id > 0:
                        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

                        po_item = await PurchaseOrderItem.filter(
                            tenant_id=tenant_id,
                            id=purchase_order_item_id,
                        ).select_for_update().first()
                        if not po_item:
                            raise ValidationError(f"采购订单明细不存在: {purchase_order_item_id}")

                        historical_items = await PurchaseReceiptItem.filter(
                            tenant_id=tenant_id,
                            purchase_order_item_id=purchase_order_item_id,
                        ).all()
                        already_received_qty = Decimal("0")
                        for historical in historical_items:
                            historical_receipt = await PurchaseReceipt.get_or_none(
                                tenant_id=tenant_id,
                                id=historical.receipt_id,
                                deleted_at__isnull=True,
                            )
                            if historical_receipt and int(historical_receipt.id) != int(receipt_id) and historical_receipt.status not in (
                                "已作废",
                                "作废",
                                "void",
                                "VOID",
                                "cancelled",
                                "CANCELLED",
                            ):
                                already_received_qty += Decimal(str(historical.receipt_quantity or 0))

                        _validate_purchase_receipt_tolerance(
                            ordered_quantity=Decimal(str(po_item.ordered_quantity or 0)),
                            already_received_quantity=already_received_qty,
                            incoming_quantity=qty,
                            tolerance_percentage=tolerance_percentage,
                            material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                        )

                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, "location_id", None),
                        location_code=getattr(item_data, "location_code", None),
                        scene="采购入库",
                        material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                    )
                    await _validate_purchase_line_warehouse_location_match(
                        tenant_id,
                        warehouse_id=getattr(item_data, "warehouse_id", None),
                        location_id=getattr(item_data, "location_id", None),
                        material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                    )

                    from apps.master_data.models.material import Material
                    from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item

                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=getattr(item_data, "material_id", None),
                        deleted_at__isnull=True,
                    )
                    auto_batch_no = None
                    if material:
                        auto_batch_no = await ensure_batch_no_for_item(
                            tenant_id=tenant_id,
                            material=material,
                            item_data=item_data,
                            supplier_code=supplier_code,
                        )

                    item_dict = item_data.model_dump(exclude_unset=True)
                    item_dict.update({
                        "tenant_id": tenant_id,
                        "receipt_id": receipt_id,
                        "receipt_quantity": qty,
                        "unit_price": unit_price,
                        "total_amount": line_amount,
                    })
                    resolved_qualified_qty, resolved_unqualified_qty, resolved_quality_status = _resolve_purchase_item_quality_fields(
                        receipt_quantity=qty,
                        qualified_quantity=getattr(item_data, "qualified_quantity", None),
                        unqualified_quantity=getattr(item_data, "unqualified_quantity", None),
                        quality_status=getattr(item_data, "quality_status", None),
                        require_incoming_inspection=require_incoming_inspection,
                    )
                    item_dict["qualified_quantity"] = resolved_qualified_qty
                    item_dict["unqualified_quantity"] = resolved_unqualified_qty
                    item_dict["quality_status"] = resolved_quality_status
                    if auto_batch_no is not None:
                        item_dict["batch_number"] = auto_batch_no
                    await PurchaseReceiptItem.create(**item_dict)
                    total_quantity += qty
                    total_amount += line_amount

                await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                    total_quantity=total_quantity,
                    total_amount=total_amount,
                )

            return PurchaseReceiptResponse.model_validate(
                await PurchaseReceipt.get(tenant_id=tenant_id, id=receipt_id)
            )

    async def list_purchase_receipts(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[PurchaseReceiptResponse]:
        """获取采购入库单列表"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_receipt_lifecycle

        query = PurchaseReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('purchase_order_id'):
            query = query.filter(purchase_order_id=filters['purchase_order_id'])
        if filters.get("scoped_purchase_order_ids") is not None:
            query = query.filter(purchase_order_id__in=filters["scoped_purchase_order_ids"])

        receipts = await query.offset(skip).limit(limit).order_by('-created_at')
        out: List[PurchaseReceiptResponse] = []
        for receipt in receipts:
            resp = PurchaseReceiptResponse.model_validate(receipt)
            # 列表与详情共用生命周期计算，避免前端仅按 status 兜底时与「已入库」不一致
            resp.lifecycle = get_purchase_receipt_lifecycle(receipt, milestones=[])
            out.append(resp)
        return out

    async def confirm_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        confirmed_by: int,
        confirmation_data: Optional[InboundConfirmationRequest] = None,
    ) -> PurchaseReceiptResponse:
        """确认入库"""
        async with in_transaction():
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
            if not receipt:
                raise NotFoundError(f"采购入库单不存在: {receipt_id}")

            if receipt.status not in ("待入库", "草稿", "draft", "DRAFT"):
                raise BusinessLogicError("只有草稿或待入库状态的采购入库单才能确认入库")

            # #region agent log
            _agent_debug_ndjson(
                "warehouse_service.confirm_receipt:entry",
                "confirm_start",
                {
                    "receipt_id": receipt_id,
                    "tenant_id": tenant_id,
                    "status": getattr(receipt, "status", None),
                    "n_confirm_items": len(confirmation_data.items) if confirmation_data and confirmation_data.items else 0,
                    "header_wh_in_body": getattr(confirmation_data, "warehouse_id", None) if confirmation_data else None,
                },
                "H2",
            )
            # #endregion

            # 1. 如果提供了确认数据，先更新表头和明细
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = confirmation_data.warehouse_name or f"仓库{confirmation_data.warehouse_id}"
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                
                if update_dict:
                    await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(**update_dict)
                    # 重新加载 receipt 以获取最新仓库信息
                    receipt = await PurchaseReceipt.get(tenant_id=tenant_id, id=receipt_id)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        if item_data.warehouse_id:
                            item_update["warehouse_id"] = item_data.warehouse_id
                            item_update["warehouse_name"] = item_data.warehouse_name or f"仓库{item_data.warehouse_id}"
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.serial_numbers:
                            item_update["serial_numbers"] = _parse_serial_numbers(item_data.serial_numbers)
                        if item_data.expiry_date:
                            item_update["expiry_date"] = item_data.expiry_date
                        if item_data.manufacturing_date:
                            item_update["manufacturing_date"] = item_data.manufacturing_date
                        
                        if item_update:
                            await PurchaseReceiptItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, receipt_id=receipt_id
                            ).update(**item_update)

            # #region agent log
            if confirmation_data and confirmation_data.items:
                _db_rows = await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).all()
                _db_ids = [int(x.id) for x in _db_rows]
                _req_ids = [int(x.item_id) for x in confirmation_data.items]
                _agent_debug_ndjson(
                    "warehouse_service.confirm_receipt:after_item_patch",
                    "item_id_alignment",
                    {
                        "db_ids": _db_ids,
                        "req_ids": _req_ids,
                        "req_subset_db": set(_req_ids).issubset(set(_db_ids)),
                    },
                    "H1",
                )
            # #endregion

            # 2. 补齐缺失的批号 (根据物料配置自动生成)
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item

            items = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt_id
            ).all()
            
            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if not material:
                    continue
                
                if material.batch_managed and not item.batch_number:
                    batch_no = await ensure_batch_no_for_item(tenant_id, material, item)
                    if batch_no:
                        item.batch_number = batch_no
                        await item.save()

        # 质检合格才入库：按行物料 IQC 策略 + 组织门禁
            items_for_iqc = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt_id
            ).all()
            from apps.kuaizhizao.services.inspection_policy_service import assert_iqc_for_purchase_receipt_lines

            await assert_iqc_for_purchase_receipt_lines(tenant_id, receipt_id, items_for_iqc)

            confirmer_name = await self.get_user_name(confirmed_by)

            now = (confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None) or datetime.now()
            _hdr_upd_rows = await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                status='已入库',
                receiver_id=confirmed_by,
                receiver_name=confirmer_name,
                receipt_time=now,
                updated_by=confirmed_by
            )
            _it_upd_rows = await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).update(
                status='已入库',
                receipt_time=now,
            )
            # #region agent log
            _st_after = await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).values("status")
            _agent_debug_ndjson(
                "warehouse_service.confirm_receipt:status_update",
                "header_item_rowcount_and_db_status",
                {
                    "hdr_upd_rows": int(_hdr_upd_rows),
                    "it_upd_rows": int(_it_upd_rows),
                    "db_status_after_update": (_st_after[0]["status"] if _st_after else None),
                },
                "H9",
                run_id="pre-fix",
            )
            # #endregion

            # 过账前重载表头，避免仅内存对象与库内表头仓库等不一致
            receipt = await PurchaseReceipt.get(tenant_id=tenant_id, id=receipt_id)

            # 更新库存（增加）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                # 重新加载明细以获取最新的批号
                items = await PurchaseReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).all()
                _stock_snap = []
                for item in items:
                    qty = item.receipt_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    line_wh = await _resolve_purchase_receipt_line_warehouse_id_for_stock(
                        tenant_id, item, receipt
                    )
                    _stock_snap.append(
                        {
                            "item_id": int(item.id),
                            "material_id": int(item.material_id),
                            "qty": str(qty),
                            "resolved_wh": line_wh,
                            "item_wh": getattr(item, "warehouse_id", None),
                            "header_wh": getattr(receipt, "warehouse_id", None),
                        }
                    )
                    if line_wh is None:
                        # #region agent log
                        _agent_debug_ndjson(
                            "warehouse_service.confirm_receipt:stock",
                            "warehouse_unresolved",
                            {"snap": _stock_snap[-3:]},
                            "H4",
                        )
                        # #endregion
                        raise BusinessLogicError(
                            f"无法确定入库仓库：物料 {getattr(item, 'material_name', '') or getattr(item, 'material_code', '')} "
                            "请为明细指定行仓库或库位，或为入库单指定表头仓库"
                        )
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=line_wh,
                        batch_no=item.batch_number or None,
                        serial_nos=getattr(item, "serial_numbers", None),
                        source_type="purchase_receipt",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt.receipt_code,
                    )
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                await InventoryCostService().on_purchase_receipt_confirmed(tenant_id, receipt_id)
                # #region agent log
                _agent_debug_ndjson(
                    "warehouse_service.confirm_receipt:stock",
                    "stock_loop_ok",
                    {"lines": _stock_snap[:20], "n_lines": len(_stock_snap)},
                    "H5",
                )
                # #endregion
            except Exception as inv_e:
                # #region agent log
                _agent_debug_ndjson(
                    "warehouse_service.confirm_receipt:stock",
                    "stock_failed",
                    {"exc_type": type(inv_e).__name__, "exc": str(inv_e)[:800]},
                    "H5",
                )
                # #endregion
                logger.error("采购入库确认-更新库存失败: %s", inv_e)
                raise

        # 详单/生命周期组装在事务提交之后：避免 model_validate 或里程碑查询失败导致整笔入库与库存回滚

        # 自动生成应付单（在事务提交后执行，避免嵌套 in_transaction() 干扰外层事务）
        # 应付确认策略为「以采购发票为准」时不在此处生成应付，避免与进项发票路径重复记账。
        receipt_for_payable = await PurchaseReceipt.get(tenant_id=tenant_id, id=receipt_id)
        _sup_id = getattr(receipt_for_payable, "supplier_id", None)
        if await self.business_config_service.should_auto_generate_payable_on_purchase_receipt(
            tenant_id, int(_sup_id) if _sup_id is not None else None
        ):
            try:
                from apps.kuaicaiwu.services.finance_service import PayableService
                from apps.kuaicaiwu.schemas.finance import PayableCreate

                payable_service = PayableService()

                # 创建应付单
                total_amount = Decimal(str(receipt_for_payable.total_amount or 0))
                if total_amount > 0:
                    payable_data = PayableCreate(
                        source_type="采购入库",
                        source_id=receipt_id,
                        source_code=receipt_for_payable.receipt_code,
                        supplier_id=receipt_for_payable.supplier_id,
                        supplier_name=receipt_for_payable.supplier_name,
                        total_amount=float(total_amount),
                        paid_amount=0.0,
                        remaining_amount=float(total_amount),
                        due_date=(datetime.now() + timedelta(days=30)).date(),
                        business_date=datetime.now().date(),
                        status="未付款",
                        notes=f"由采购入库单 {receipt_for_payable.receipt_code} 自动生成"
                    )

                    payable = await payable_service.create_payable(
                        tenant_id=tenant_id,
                        payable_data=payable_data,
                        created_by=confirmed_by
                    )
                    try:
                        from apps.kuaicaiwu.services.finance_integration_hooks import (
                            link_finance_document_relation,
                            record_finance_accounting_event,
                        )

                        await link_finance_document_relation(
                            tenant_id=tenant_id,
                            source_type="purchase_receipt",
                            source_id=receipt_id,
                            source_code=receipt_for_payable.receipt_code,
                            target_type="payable",
                            target_id=payable.id,
                            target_code=getattr(payable, "payable_code", None),
                            relation_desc="采购入库确认自动生成应付单",
                            created_by=confirmed_by,
                        )
                        await record_finance_accounting_event(
                            tenant_id=tenant_id,
                            event_type="PURCHASE_RECEIPT_TO_PAYABLE",
                            business_type="payable",
                            source_doc_type="purchase_receipt",
                            source_doc_id=receipt_id,
                            source_doc_code=receipt_for_payable.receipt_code,
                            target_doc_type="Payable",
                            target_doc_id=payable.id,
                            target_doc_code=payable.payable_code,
                            amount=total_amount,
                            operator_id=confirmed_by,
                            notes=f"采购入库单 {receipt_for_payable.receipt_code} 自动生成应付单",
                        )
                    except Exception as rel_e:
                        logger.warning("创建采购入库→应付单 单据关联/会计事件失败: %s", rel_e)
            except Exception as e:
                logger.warning(f"自动生成应付单失败（不影响入库确认结果）: {str(e)}")
        # #region agent log
        _agent_debug_ndjson(
            "warehouse_service.confirm_receipt:after_tx",
            "tx_committed_before_detail_fetch",
            {"receipt_id": receipt_id},
            "H7",
            run_id="post-fix",
        )
        # #endregion
        updated_receipt = await self.get_purchase_receipt_by_id(tenant_id, receipt_id)
        # #region agent log
        _agent_debug_ndjson(
            "warehouse_service.confirm_receipt:exit",
            "confirm_return_ok",
            {"receipt_id": receipt_id, "status": getattr(updated_receipt, "status", None)},
            "H7",
            run_id="post-fix",
        )
        # #endregion
        return updated_receipt

    async def withdraw_receipt_confirmation(
        self,
        tenant_id: int,
        receipt_id: int,
        updated_by: int,
    ) -> PurchaseReceiptWithItemsResponse:
        """撤回已确认的采购入库：按明细冲减即时库存，单据回到待入库。"""
        async with in_transaction():
            receipt = await PurchaseReceipt.get_or_none(
                tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
            )
            if not receipt:
                raise NotFoundError(f"采购入库单不存在: {receipt_id}")
            if receipt.status not in ("已入库", "已完成", "completed"):
                raise BusinessLogicError("只有已入库状态的采购入库单才能撤回入库")

            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                receipt_obj = await PurchaseReceipt.get(tenant_id=tenant_id, id=receipt_id)
                items = await PurchaseReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).all()
                for item in items:
                    qty = item.receipt_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    line_wh = await _resolve_purchase_receipt_line_warehouse_id_for_stock(
                        tenant_id, item, receipt_obj
                    )
                    if line_wh is None:
                        raise BusinessLogicError(
                            "撤回失败：无法解析明细行仓库，请检查原入库单仓库/库位配置"
                        )
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=line_wh,
                        batch_no=item.batch_number or None,
                        source_type="purchase_receipt_revoke",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt_obj.receipt_code,
                    )

                await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                    status="待入库",
                    receiver_id=None,
                    receiver_name=None,
                    receipt_time=None,
                    updated_by=updated_by,
                )
                await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).update(
                    status="待入库",
                    receipt_time=None,
                )
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回采购入库-库存冲减失败: %s", e)
                raise BusinessLogicError(f"撤回失败: {str(e)}")

            return await self.get_purchase_receipt_by_id(tenant_id, receipt_id)

    async def delete_purchase_receipt(self, tenant_id: int, receipt_id: int) -> bool:
        """
        软删除采购入库单（仅草稿/待入库；未确认入库不影响库存）。
        若已创建未删除的来料检验单则禁止删除。
        """
        deletable_statuses = ("草稿", "draft", "DRAFT", "待入库")
        async with in_transaction():
            receipt = await PurchaseReceipt.get_or_none(
                tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
            )
            if not receipt:
                raise NotFoundError(f"采购入库单不存在: {receipt_id}")
            if receipt.status not in deletable_statuses:
                raise BusinessLogicError(
                    f"仅草稿或待入库状态的采购入库单可删除，当前状态：{receipt.status}"
                )

            from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

            ins_count = await IncomingInspection.filter(
                tenant_id=tenant_id,
                purchase_receipt_id=receipt_id,
                deleted_at__isnull=True,
            ).count()
            if ins_count > 0:
                raise BusinessLogicError("已存在关联的来料检验单，请先处理检验单后再删除入库单")

            from apps.kuaizhizao.models.document_relation import DocumentRelation

            await DocumentRelation.filter(
                tenant_id=tenant_id,
                target_type="purchase_receipt",
                target_id=receipt_id,
            ).delete()
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="purchase_receipt",
                source_id=receipt_id,
            ).delete()

            await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).delete()
            now = datetime.now()
            await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                deleted_at=now,
                is_active=False,
            )
        return True

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入采购入库单
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建采购入库单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '采购订单编号': 'purchase_order_code',
            '*采购订单编号': 'purchase_order_code',
            'purchase_order_code': 'purchase_order_code',
            '*purchase_order_code': 'purchase_order_code',
            '供应商名称': 'supplier_name',
            'supplier_name': 'supplier_name',
            '仓库名称': 'warehouse_name',
            'warehouse_name': 'warehouse_name',
            '入库时间': 'receipt_time',
            'receipt_time': 'receipt_time',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['purchase_order_code']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        # 获取采购订单信息（用于填充供应商信息）
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                receipt_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field == 'receipt_time':
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                receipt_data[field] = dt.strptime(value_str, fmt)
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    receipt_data[field] = value_str
                
                # 验证必填字段
                if not receipt_data.get('purchase_order_code'):
                    errors.append({
                        "row": row_idx,
                        "error": "采购订单编号为空"
                    })
                    failure_count += 1
                    continue
                
                # 查找采购订单
                purchase_order = await PurchaseOrder.get_or_none(
                    tenant_id=tenant_id,
                    order_code=receipt_data['purchase_order_code']
                )
                if not purchase_order:
                    errors.append({
                        "row": row_idx,
                        "error": f"采购订单不存在：{receipt_data['purchase_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建创建数据
                from apps.kuaizhizao.schemas.warehouse import PurchaseReceiptCreate, PurchaseReceiptItemCreate
                
                # 获取订单明细（用于创建入库单明细）
                from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
                order_items = await PurchaseOrderItem.filter(
                    tenant_id=tenant_id,
                    order_id=purchase_order.id
                ).all()
                
                if not order_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"采购订单没有明细：{receipt_data['purchase_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建入库单明细
                receipt_items = []
                for item in order_items:
                    if item.outstanding_quantity > 0:
                        receipt_items.append(PurchaseReceiptItemCreate(
                            purchase_order_item_id=item.id,
                            material_id=item.material_id,
                            material_code=item.material_code,
                            material_name=item.material_name,
                            material_unit=item.unit,
                            receipt_quantity=item.outstanding_quantity,
                            unit_price=item.unit_price,
                            total_amount=item.outstanding_quantity * item.unit_price
                        ))
                
                if not receipt_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"采购订单没有可入库的明细：{receipt_data['purchase_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 创建入库单
                receipt_create_data = PurchaseReceiptCreate(
                    purchase_order_id=purchase_order.id,
                    purchase_order_code=purchase_order.order_code,
                    supplier_id=purchase_order.supplier_id,
                    supplier_name=purchase_order.supplier_name,
                    warehouse_id=1,  # TODO: 从仓库名称查找仓库ID
                    warehouse_name=receipt_data.get('warehouse_name', '默认仓库'),
                    receipt_time=receipt_data.get('receipt_time') or datetime.now(),
                    items=receipt_items,
                    notes=receipt_data.get('notes')
                )
                
                await self.create_purchase_receipt(
                    tenant_id=tenant_id,
                    receipt_data=receipt_create_data,
                    created_by=created_by
                )
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": row_idx,
                    "error": f"导入失败：{str(e)}"
                })
                failure_count += 1
                logger.error(f"导入采购入库单失败（第{row_idx}行）：{str(e)}")
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "data": {
                "success_count": success_count,
                "failure_count": failure_count,
                "errors": errors
            }
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出采购入库单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的采购入库单（不分页）
        receipts = await self.list_purchase_receipts(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"purchase_receipts_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '入库单编号', '采购订单编号', '供应商名称', '仓库名称',
                '入库时间', '状态', '总数量', '总金额',
                '备注', '创建时间'
            ])
            
            # 写入数据
            for receipt in receipts:
                writer.writerow([
                    receipt.receipt_code,
                    receipt.purchase_order_code or '',
                    receipt.supplier_name or '',
                    receipt.warehouse_name or '',
                    receipt.receipt_time.strftime('%Y-%m-%d %H:%M:%S') if receipt.receipt_time else '',
                    receipt.status,
                    str(receipt.total_quantity) if receipt.total_quantity else '0',
                    str(receipt.total_amount) if receipt.total_amount else '0',
                    receipt.notes or '',
                    receipt.created_at.strftime('%Y-%m-%d %H:%M:%S') if receipt.created_at else '',
                ])
        
        return file_path
class SalesReturnService(AppBaseService[SalesReturn]):
    """销售退货单服务"""

    def __init__(self):
        super().__init__(SalesReturn)

    async def create_sales_return(self, tenant_id: int, return_data: SalesReturnCreate, created_by: int) -> SalesReturnResponse:
        """创建销售退货单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供return_code，则自动生成
            if return_data.return_code:
                code = return_data.return_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "SALES_RETURN_CODE", prefix=f"SR{today}")

            # 从return_data中提取items（如果存在）
            items = getattr(return_data, 'items', None) or []
            
            # 计算总数量和总金额
            total_quantity = sum(item.return_quantity for item in items) if items else 0
            total_amount = sum(item.total_amount for item in items) if items else 0

            # 如果关联了销售出库单，获取相关信息
            sales_delivery_id = return_data.sales_delivery_id
            sales_delivery_code = return_data.sales_delivery_code
            sales_order_id = return_data.sales_order_id
            sales_order_code = return_data.sales_order_code
            
            # 如果提供了sales_delivery_id但没有sales_delivery_code，尝试获取
            if sales_delivery_id and not sales_delivery_code:
                delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=sales_delivery_id)
                if delivery:
                    sales_delivery_code = delivery.delivery_code
                    if not sales_order_id:
                        sales_order_id = delivery.sales_order_id
                        sales_order_code = delivery.sales_order_code
            
            return_obj = await SalesReturn.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                return_code=code,
                sales_delivery_id=sales_delivery_id,
                sales_delivery_code=sales_delivery_code or "",
                sales_order_id=sales_order_id,
                sales_order_code=sales_order_code or "",
                customer_id=return_data.customer_id,
                customer_name=return_data.customer_name,
                warehouse_id=return_data.warehouse_id,
                warehouse_name=return_data.warehouse_name,
                return_time=return_data.return_time,
                returner_id=return_data.returner_id,
                returner_name=return_data.returner_name,
                reviewer_id=return_data.reviewer_id,
                reviewer_name=return_data.reviewer_name,
                review_time=return_data.review_time,
                review_status=return_data.review_status,
                review_remarks=return_data.review_remarks,
                return_reason=return_data.return_reason,
                return_type=return_data.return_type,
                status=return_data.status,
                total_quantity=total_quantity,
                total_amount=total_amount,
                shipping_method=return_data.shipping_method,
                tracking_number=return_data.tracking_number,
                shipping_address=getattr(return_data, 'shipping_address', None),
                notes=return_data.notes,
                created_by=user_info.get("id"),
            )
            
            # 创建退货单明细
            if items:
                from apps.master_data.models.material import Material
                location_required, _ = await _get_warehouse_policy_flags(tenant_id)
                for item_data in items:
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=item_data.material_id
                    )
                    batch_number = getattr(item_data, 'batch_number', None)
                    sales_delivery_item_id = getattr(item_data, "sales_delivery_item_id", None)
                    if sales_delivery_id and sales_delivery_item_id:
                        source_item = await SalesDeliveryItem.get_or_none(
                            tenant_id=tenant_id,
                            delivery_id=sales_delivery_id,
                            id=sales_delivery_item_id,
                            deleted_at__isnull=True,
                        )
                        if not source_item:
                            raise ValidationError(
                                f"销售退货失败：未找到关联的销售出库明细 {sales_delivery_item_id}"
                            )
                        _validate_sales_return_batch_traceability(
                            source_batch_number=getattr(source_item, "batch_number", None),
                            return_batch_number=batch_number,
                            material_label=getattr(item_data, "material_name", None)
                            or getattr(item_data, "material_code", "未知物料"),
                        )
                    # 序列号信息（批号和序列号选择功能增强）
                    serial_numbers = getattr(item_data, 'serial_numbers', None)
                    if material:
                        await _validate_batch_serial_policy(
                            tenant_id=tenant_id,
                            material=material,
                            batch_number=batch_number,
                            serial_numbers=serial_numbers,
                            quantity=getattr(item_data, "return_quantity", None),
                            scene="销售退货",
                        )
                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        scene="销售退货",
                        material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                    )
                    # 如果serial_numbers是列表，转换为JSON格式存储
                    if serial_numbers and isinstance(serial_numbers, list):
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        # 如果已经是字符串格式的JSON，直接使用
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None
                    
                    await SalesReturnItem.create(
                        tenant_id=tenant_id,
                        return_id=return_obj.id,
                        sales_delivery_item_id=getattr(item_data, 'sales_delivery_item_id', None),
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        return_quantity=item_data.return_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=getattr(item_data, 'batch_number', None),
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        serial_numbers=serial_numbers_json,  # 批号和序列号选择功能增强
                        status=getattr(item_data, 'status', '待退货'),
                        return_time=getattr(item_data, 'return_time', None),
                        notes=getattr(item_data, 'notes', None),
                    )

            # 建立销售出库→销售退货 的 DocumentRelation
            if sales_delivery_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                    delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=sales_delivery_id)
                    if delivery:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="sales_delivery",
                                source_id=sales_delivery_id,
                                source_code=delivery.delivery_code,
                                source_name=None,
                                target_type="sales_return",
                                target_id=return_obj.id,
                                target_code=return_obj.return_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="销售出库创建销售退货单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立销售出库→销售退货 单据关联失败: %s", e)
            
            return SalesReturnResponse.model_validate(return_obj)

    async def pull_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        warehouse_id: int,
        warehouse_name: Optional[str] = None,
        return_quantities: Optional[Dict[int, float]] = None,
    ) -> SalesReturnResponse:
        """从销售订单下推生成销售退货单。"""
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from apps.kuaizhizao.schemas.warehouse import SalesReturnItemCreate

        sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id)
        if not sales_order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")

        order_items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=sales_order_id).all()
        if not order_items:
            raise BusinessLogicError("销售订单没有明细，无法下推销售退货单")

        return_items: List[SalesReturnItemCreate] = []
        for item in order_items:
            delivered_qty = Decimal(str(item.delivered_quantity or 0))
            if delivered_qty <= 0:
                continue
            selected_qty = Decimal(str(return_quantities.get(item.id, delivered_qty))) if return_quantities and item.id in return_quantities else delivered_qty
            if selected_qty <= 0:
                continue
            if selected_qty > delivered_qty:
                raise BusinessLogicError(f"物料 {item.material_code or item.material_name} 的退货数量不能超过可退数量 {delivered_qty}")
            unit_price = Decimal(str(item.unit_price or 0))
            total_amount = selected_qty * unit_price
            return_items.append(
                SalesReturnItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    return_quantity=float(selected_qty),
                    unit_price=float(unit_price),
                    total_amount=float(total_amount),
                    status="待退货",
                )
            )

        if not return_items:
            raise BusinessLogicError("没有可退货的明细")

        return_data = SalesReturnCreate(
            sales_order_id=sales_order.id,
            sales_order_code=sales_order.order_code,
            customer_id=sales_order.customer_id,
            customer_name=sales_order.customer_name,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name or f"仓库{warehouse_id}",
            status="待退货",
            return_reason="订单退货",
            notes=f"从销售订单 {sales_order.order_code} 下推生成",
            items=return_items,
        )
        created = await self.create_sales_return(tenant_id=tenant_id, return_data=return_data, created_by=created_by)

        try:
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sales_order",
                    source_id=sales_order.id,
                    source_code=sales_order.order_code,
                    target_type="sales_return",
                    target_id=created.id,
                    target_code=created.return_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="销售订单下推销售退货单",
                ),
                created_by=created_by,
            )
        except Exception as rel_err:
            logger.warning("建立销售订单→销售退货关联失败: %s", rel_err)

        return created

    async def get_sales_return_by_id(self, tenant_id: int, return_id: int) -> SalesReturnResponse:
        """根据ID获取销售退货单"""
        return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")
        response = SalesReturnResponse.model_validate(return_obj)
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_return_lifecycle, get_document_milestones
        milestones = await get_document_milestones(tenant_id, "sales_return", return_id)
        response.lifecycle = get_sales_return_lifecycle(return_obj, milestones=milestones)
        return response

    async def list_sales_returns(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesReturnResponse]:
        """获取销售退货单列表"""
        query = SalesReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('sales_delivery_id'):
            query = query.filter(sales_delivery_id=filters['sales_delivery_id'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=filters['customer_id'])

        returns = await query.offset(skip).limit(limit).order_by('-created_at')
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_return_lifecycle
        out: List[SalesReturnResponse] = []
        for return_obj in returns:
            resp = SalesReturnResponse.model_validate(return_obj)
            resp.lifecycle = get_sales_return_lifecycle(return_obj)
            out.append(resp)
        return out

    async def confirm_return(
        self,
        tenant_id: int,
        return_id: int,
        confirmed_by: int,
        confirmation_data: Optional[InboundConfirmationRequest] = None,
    ) -> SalesReturnResponse:
        """确认退货"""
        async with in_transaction():
            return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id)
            if not return_obj:
                raise NotFoundError(f"销售退货单不存在: {return_id}")

            if return_obj.status != '待退货':
                raise BusinessLogicError("只有待退货状态的销售退货单才能确认退货")

            # 1. 更新确认数据
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = confirmation_data.warehouse_name or f"仓库{confirmation_data.warehouse_id}"
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                
                if update_dict:
                    await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(**update_dict)
                    return_obj = await SalesReturn.get(tenant_id=tenant_id, id=return_id)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        # SalesReturnItem has no warehouse_id; the warehouse is stored on the header.
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.expiry_date:
                            item_update["expiry_date"] = item_data.expiry_date
                        if item_data.serial_numbers:
                            item_update["serial_numbers"] = json.dumps(item_data.serial_numbers)
                        
                        if item_update:
                            await SalesReturnItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, return_id=return_id
                            ).update(**item_update)

            # 2. 补齐批号/序列号
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item, ensure_serial_nos_for_item

            items = await SalesReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if not material:
                    continue
                if material.batch_managed and not item.batch_number:
                    batch_no = await ensure_batch_no_for_item(tenant_id, material, item)
                    if batch_no:
                        item.batch_number = batch_no
                        await item.save()
                if material.serial_managed:
                    count = int(item.return_quantity or 0)
                    serial_nos = await ensure_serial_nos_for_item(tenant_id, material, item, count)
                    if serial_nos:
                        item.serial_numbers = json.dumps(serial_nos)
                        await item.save()

            returner_name = await self.get_user_name(confirmed_by)
            receipt_time = (confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None) or datetime.now()

            await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status='已退货',
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=receipt_time,
                updated_by=confirmed_by
            )
            await SalesReturnItem.filter(tenant_id=tenant_id, return_id=return_id).update(
                status='已退货', 
                return_time=receipt_time
            )

            # 4. 更新库存（增加）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService
                # 重新加载明细
                reload_items = await SalesReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
                for item in reload_items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    wh_id = item.warehouse_id if item.warehouse_id else return_obj.warehouse_id
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="sales_return",
                        source_doc_id=return_id,
                        source_doc_code=return_obj.return_code,
                    )
            except Exception as inv_e:
                logger.error("销售退货确认-更新库存失败: %s", inv_e)
                raise

            try:
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                await InventoryCostService().on_sales_return_confirmed(tenant_id, return_id)
            except Exception as cost_e:
                logger.warning("销售退货确认-成本处理失败: %s", cost_e)

            # 创建红字应收单（销售退货冲减）
            try:
                from apps.kuaicaiwu.services.finance_service import ReceivableService
                from apps.kuaicaiwu.schemas.finance import ReceivableCreate

                ret_obj = await SalesReturn.get(tenant_id=tenant_id, id=return_id)
                total_amount = float(ret_obj.total_amount or 0)
                if total_amount > 0 and ret_obj.customer_id:
                    receivable_service = ReceivableService()
                    receivable_data = ReceivableCreate(
                        source_type="销售退货",
                        source_id=return_id,
                        source_code=ret_obj.return_code,
                        customer_id=ret_obj.customer_id,
                        customer_name=ret_obj.customer_name,
                        total_amount=total_amount,
                        received_amount=0.0,
                        remaining_amount=total_amount,
                        due_date=(datetime.now() + timedelta(days=30)).date(),
                        business_date=datetime.now().date(),
                        status="已冲减",
                        notes=f"销售退货冲减-由销售退货单 {ret_obj.return_code} 自动生成",
                    )
                    receivable = await receivable_service.create_receivable(
                        tenant_id=tenant_id,
                        receivable_data=receivable_data,
                        created_by=confirmed_by,
                    )
                    try:
                        from apps.kuaicaiwu.services.finance_integration_hooks import (
                            link_finance_document_relation,
                            record_finance_accounting_event,
                        )

                        await link_finance_document_relation(
                            tenant_id=tenant_id,
                            source_type="sales_return",
                            source_id=return_id,
                            source_code=ret_obj.return_code,
                            target_type="receivable",
                            target_id=receivable.id,
                            target_code=getattr(receivable, "receivable_code", None),
                            relation_desc="销售退货确认自动生成红字应收单",
                            created_by=confirmed_by,
                        )
                        await record_finance_accounting_event(
                            tenant_id=tenant_id,
                            event_type="SALES_RETURN_TO_RECEIVABLE",
                            business_type="receivable",
                            source_doc_type="sales_return",
                            source_doc_id=return_id,
                            source_doc_code=ret_obj.return_code,
                            target_doc_type="Receivable",
                            target_doc_id=receivable.id,
                            target_doc_code=receivable.receivable_code,
                            amount=Decimal(str(total_amount)),
                            operator_id=confirmed_by,
                            notes=f"销售退货单 {ret_obj.return_code} 自动生成红字应收单",
                        )
                    except Exception as rel_e:
                        logger.warning("销售退货确认-创建应收单关联/会计事件失败: %s", rel_e)
            except Exception as fin_e:
                logger.warning("销售退货确认-创建红字应收单失败: %s", fin_e)

            updated_return = await self.get_sales_return_by_id(tenant_id, return_id)
            return updated_return

    async def update_sales_return(
        self,
        tenant_id: int,
        return_id: int,
        return_data: Any,
        updated_by: int,
    ) -> SalesReturnResponse:
        """更新销售退货单（仅待退货/草稿，且未进入已退货）。"""
        from apps.kuaizhizao.schemas.warehouse import SalesReturnUpdate
        from apps.master_data.models.material import Material

        async with in_transaction():
            return_obj = await SalesReturn.get_or_none(
                tenant_id=tenant_id, id=return_id, deleted_at__isnull=True
            )
            if not return_obj:
                raise NotFoundError(f"销售退货单不存在: {return_id}")
            if return_obj.status not in ("待退货", "草稿"):
                raise BusinessLogicError("仅「待退货」或「草稿」状态的销售退货单可编辑")

            if not isinstance(return_data, SalesReturnUpdate):
                return_data = SalesReturnUpdate.model_validate(return_data)

            payload = return_data.model_dump(exclude_unset=True, exclude={"items"})
            for key, val in payload.items():
                if key in ("id", "tenant_id", "uuid", "created_at", "updated_at"):
                    continue
                if hasattr(return_obj, key):
                    setattr(return_obj, key, val)

            items = getattr(return_data, "items", None)
            if items is not None:
                await SalesReturnItem.filter(tenant_id=tenant_id, return_id=return_id).delete()
                total_quantity = Decimal(0)
                total_amount = Decimal(0)
                location_required, _ = await _get_warehouse_policy_flags(tenant_id)
                for item_data in items:
                    material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id)
                    batch_number = getattr(item_data, "batch_number", None)
                    serial_numbers = getattr(item_data, "serial_numbers", None)
                    if material:
                        await _validate_batch_serial_policy(
                            tenant_id=tenant_id,
                            material=material,
                            batch_number=batch_number,
                            serial_numbers=serial_numbers,
                            quantity=getattr(item_data, "return_quantity", None),
                            scene="销售退货",
                        )
                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, "location_id", None),
                        location_code=getattr(item_data, "location_code", None),
                        scene="销售退货",
                        material_label=getattr(item_data, "material_name", None)
                        or getattr(item_data, "material_code", "未知物料"),
                    )
                    if serial_numbers and isinstance(serial_numbers, list):
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None

                    await SalesReturnItem.create(
                        tenant_id=tenant_id,
                        return_id=return_obj.id,
                        sales_delivery_item_id=getattr(item_data, "sales_delivery_item_id", None),
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, "material_spec", None),
                        material_unit=item_data.material_unit,
                        return_quantity=item_data.return_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, "location_id", None),
                        location_code=getattr(item_data, "location_code", None),
                        batch_number=batch_number,
                        expiry_date=getattr(item_data, "expiry_date", None),
                        serial_numbers=serial_numbers_json,
                        status=getattr(item_data, "status", "待退货"),
                        return_time=getattr(item_data, "return_time", None),
                        notes=getattr(item_data, "notes", None),
                    )
                    total_quantity += Decimal(str(item_data.return_quantity or 0))
                    total_amount += Decimal(str(item_data.total_amount or 0))
                return_obj.total_quantity = total_quantity
                return_obj.total_amount = total_amount

            return_obj.updated_by = updated_by
            await return_obj.save()
            return await self.get_sales_return_by_id(tenant_id, return_id)

    async def delete_sales_return(self, tenant_id: int, return_id: int) -> bool:
        """删除销售退货单（软删除，仅待退货状态可删）"""
        return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")
        if return_obj.status != "待退货":
            raise BusinessLogicError("只有待退货状态的销售退货单才能删除")
        await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
            deleted_at=datetime.now()
        )
        return True

    async def withdraw_confirmation(self, tenant_id: int, return_id: int, updated_by: int) -> SalesReturnResponse:
        """撤回退货确认（已退货 -> 待退货），并回滚库存增加。"""
        async with in_transaction():
            return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
            if not return_obj:
                raise NotFoundError(f"销售退货单不存在: {return_id}")
            if return_obj.status != "已退货":
                raise BusinessLogicError("只有已退货状态的销售退货单才能撤回")

            from apps.kuaizhizao.services.inventory_service import InventoryService
            items = await SalesReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
            for item in items:
                qty = item.return_quantity or Decimal(0)
                if qty <= 0:
                    continue
                await InventoryService._decrease_stock_no_atomic(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=qty,
                    warehouse_id=return_obj.warehouse_id if return_obj.warehouse_id else None,
                    batch_no=item.batch_number or None,
                    source_type="sales_return_withdraw",
                    source_doc_id=return_id,
                    source_doc_code=return_obj.return_code,
                )

            await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status="待退货",
                return_time=None,
                returner_id=None,
                returner_name=None,
                updated_by=updated_by,
            )
            return await self.get_sales_return_by_id(tenant_id, return_id)


class PurchaseReturnService(AppBaseService[PurchaseReturn]):
    """采购退货单服务"""

    def __init__(self):
        super().__init__(PurchaseReturn)

    async def create_purchase_return(self, tenant_id: int, return_data: PurchaseReturnCreate, created_by: int) -> PurchaseReturnResponse:
        """创建采购退货单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供return_code，则自动生成
            if return_data.return_code:
                code = return_data.return_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "PURCHASE_RETURN_CODE", prefix=f"PRT{today}")

            # 从return_data中提取items（如果存在）
            items = getattr(return_data, 'items', None) or []
            
            # 计算总数量和总金额
            total_quantity = sum(item.return_quantity for item in items) if items else 0
            total_amount = sum(item.total_amount for item in items) if items else 0

            # 如果关联了采购入库单，获取相关信息
            purchase_receipt_id = return_data.purchase_receipt_id
            purchase_receipt_code = return_data.purchase_receipt_code
            purchase_order_id = return_data.purchase_order_id
            purchase_order_code = return_data.purchase_order_code
            
            # 如果提供了purchase_receipt_id但没有purchase_receipt_code，尝试获取
            if purchase_receipt_id and not purchase_receipt_code:
                receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
                if receipt:
                    purchase_receipt_code = receipt.receipt_code
                    if not purchase_order_id:
                        purchase_order_id = receipt.purchase_order_id
                        purchase_order_code = receipt.purchase_order_code
            
            return_obj = await PurchaseReturn.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                return_code=code,
                purchase_receipt_id=purchase_receipt_id,
                purchase_receipt_code=purchase_receipt_code or "",
                purchase_order_id=purchase_order_id,
                purchase_order_code=purchase_order_code or "",
                supplier_id=return_data.supplier_id,
                supplier_name=return_data.supplier_name,
                warehouse_id=return_data.warehouse_id,
                warehouse_name=return_data.warehouse_name,
                return_time=return_data.return_time,
                returner_id=return_data.returner_id,
                returner_name=return_data.returner_name,
                reviewer_id=return_data.reviewer_id,
                reviewer_name=return_data.reviewer_name,
                review_time=return_data.review_time,
                review_status=return_data.review_status,
                review_remarks=return_data.review_remarks,
                return_reason=return_data.return_reason,
                return_type=return_data.return_type,
                status=return_data.status,
                total_quantity=total_quantity,
                total_amount=total_amount,
                shipping_method=return_data.shipping_method,
                tracking_number=return_data.tracking_number,
                shipping_address=getattr(return_data, 'shipping_address', None),
                notes=return_data.notes,
                created_by=user_info.get("id"),
            )
            
            # 创建退货单明细
            if items:
                from apps.master_data.models.material import Material
                location_required, _ = await _get_warehouse_policy_flags(tenant_id)
                for item_data in items:
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=item_data.material_id
                    )
                    batch_number = getattr(item_data, 'batch_number', None)
                    # 序列号信息（批号和序列号选择功能增强）
                    serial_numbers = getattr(item_data, 'serial_numbers', None)
                    if material:
                        await _validate_batch_serial_policy(
                            tenant_id=tenant_id,
                            material=material,
                            batch_number=batch_number,
                            serial_numbers=serial_numbers,
                            quantity=getattr(item_data, "return_quantity", None),
                            scene="采购退货",
                        )
                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        scene="采购退货",
                        material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                    )
                    # 如果serial_numbers是列表，转换为JSON格式存储
                    if serial_numbers and isinstance(serial_numbers, list):
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        # 如果已经是字符串格式的JSON，直接使用
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None
                    
                    await PurchaseReturnItem.create(
                        tenant_id=tenant_id,
                        return_id=return_obj.id,
                        purchase_receipt_item_id=getattr(item_data, 'purchase_receipt_item_id', None),
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        return_quantity=item_data.return_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=getattr(item_data, 'batch_number', None),
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        serial_numbers=serial_numbers_json,  # 批号和序列号选择功能增强
                        status=getattr(item_data, 'status', '待退货'),
                        return_time=getattr(item_data, 'return_time', None),
                        notes=getattr(item_data, 'notes', None),
                    )

            # 建立采购入库→采购退货 的 DocumentRelation
            if purchase_receipt_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                    receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
                    if receipt:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="purchase_receipt",
                                source_id=purchase_receipt_id,
                                source_code=receipt.receipt_code,
                                source_name=None,
                                target_type="purchase_return",
                                target_id=return_obj.id,
                                target_code=return_obj.return_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="采购入库创建采购退货单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立采购入库→采购退货 单据关联失败: %s", e)
            
            return PurchaseReturnResponse.model_validate(return_obj)

    async def pull_from_purchase_order(
        self,
        tenant_id: int,
        purchase_order_id: int,
        created_by: int,
        warehouse_id: int,
        warehouse_name: Optional[str] = None,
        return_quantities: Optional[Dict[int, float]] = None,
    ) -> PurchaseReturnResponse:
        """从采购订单下推生成采购退货单。"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
        from apps.kuaizhizao.schemas.warehouse import PurchaseReturnItemCreate

        purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=purchase_order_id)
        if not purchase_order:
            raise NotFoundError(f"采购订单不存在: {purchase_order_id}")

        order_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, purchase_order_id=purchase_order_id).all()
        if not order_items:
            raise BusinessLogicError("采购订单没有明细，无法下推采购退货单")

        return_items: List[PurchaseReturnItemCreate] = []
        for item in order_items:
            received_qty = Decimal(str(item.received_quantity or 0))
            if received_qty <= 0:
                continue
            selected_qty = Decimal(str(return_quantities.get(item.id, received_qty))) if return_quantities and item.id in return_quantities else received_qty
            if selected_qty <= 0:
                continue
            if selected_qty > received_qty:
                raise BusinessLogicError(f"物料 {item.material_code or item.material_name} 的退货数量不能超过可退数量 {received_qty}")
            unit_price = Decimal(str(item.unit_price or 0))
            total_amount = selected_qty * unit_price
            return_items.append(
                PurchaseReturnItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.unit,
                    return_quantity=float(selected_qty),
                    unit_price=float(unit_price),
                    total_amount=float(total_amount),
                    status="待退货",
                )
            )

        if not return_items:
            raise BusinessLogicError("没有可退货的明细")

        return_data = PurchaseReturnCreate(
            purchase_order_id=purchase_order.id,
            purchase_order_code=purchase_order.order_code,
            supplier_id=purchase_order.supplier_id,
            supplier_name=purchase_order.supplier_name,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name or f"仓库{warehouse_id}",
            status="待退货",
            return_reason="订单退货",
            notes=f"从采购订单 {purchase_order.order_code} 下推生成",
            items=return_items,
        )
        created = await self.create_purchase_return(tenant_id=tenant_id, return_data=return_data, created_by=created_by)

        try:
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="purchase_order",
                    source_id=purchase_order.id,
                    source_code=purchase_order.order_code,
                    target_type="purchase_return",
                    target_id=created.id,
                    target_code=created.return_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="采购订单下推采购退货单",
                ),
                created_by=created_by,
            )
        except Exception as rel_err:
            logger.warning("建立采购订单→采购退货关联失败: %s", rel_err)

        return created

    async def get_purchase_return_by_id(self, tenant_id: int, return_id: int) -> PurchaseReturnResponse:
        """根据ID获取采购退货单"""
        return_obj = await PurchaseReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not return_obj:
            raise NotFoundError(f"采购退货单不存在: {return_id}")
        return PurchaseReturnResponse.model_validate(return_obj)

    async def get_purchase_return_statistics(self, tenant_id: int) -> Dict[str, Any]:
        """采购退货列表页指标：状态计数 + 近 7 日按创建日分布（用于趋势图）"""
        from datetime import date, timedelta

        base = PurchaseReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        total_count = await base.count()
        pending_count = await base.filter(status="待退货").count()
        done_count = await base.filter(status="已退货").count()
        cancelled_count = await base.filter(status="已取消").count()

        today = date.today()
        trend_total: List[int] = []
        trend_pending: List[int] = []
        trend_done: List[int] = []
        trend_cancelled: List[int] = []
        for offset in range(6, -1, -1):
            d = today - timedelta(days=offset)
            day_start = datetime.combine(d, datetime.min.time())
            day_end = datetime.combine(d, datetime.max.time())
            day_q = base.filter(created_at__gte=day_start, created_at__lte=day_end)
            trend_total.append(await day_q.count())
            trend_pending.append(await day_q.filter(status="待退货").count())
            trend_done.append(await day_q.filter(status="已退货").count())
            trend_cancelled.append(await day_q.filter(status="已取消").count())

        return {
            "total_count": total_count,
            "pending_count": pending_count,
            "done_count": done_count,
            "cancelled_count": cancelled_count,
            "trend_total": trend_total,
            "trend_pending": trend_pending,
            "trend_done": trend_done,
            "trend_cancelled": trend_cancelled,
        }

    async def list_purchase_returns(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[PurchaseReturnResponse]:
        """获取采购退货单列表"""
        query = PurchaseReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('purchase_receipt_id'):
            query = query.filter(purchase_receipt_id=filters['purchase_receipt_id'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])

        returns = await query.offset(skip).limit(limit).order_by('-created_at')
        return [PurchaseReturnResponse.model_validate(return_obj) for return_obj in returns]

    async def confirm_return(self, tenant_id: int, return_id: int, confirmed_by: int) -> PurchaseReturnResponse:
        """确认退货"""
        async with in_transaction():
            return_obj = await self.get_purchase_return_by_id(tenant_id, return_id)

            if return_obj.status != '待退货':
                raise BusinessLogicError("只有待退货状态的采购退货单才能确认退货")

            returner_name = await self.get_user_name(confirmed_by)

            await PurchaseReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status='已退货',
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=datetime.now(),
                updated_by=confirmed_by
            )

            # 更新库存（扣减，采购退货出库）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                ret_obj = await PurchaseReturn.get(tenant_id=tenant_id, id=return_id)
                items = await PurchaseReturnItem.filter(
                    tenant_id=tenant_id, return_id=return_id
                ).all()
                biz_config = await BusinessConfigService().get_business_config(tenant_id)
                enforce_fifo = (
                    biz_config.get("parameters", {})
                    .get("warehouse", {})
                    .get("fifo", False)
                )
                wh_id = ret_obj.warehouse_id if ret_obj.warehouse_id else None
                for item in items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="purchase_return",
                        source_doc_id=return_id,
                        source_doc_code=ret_obj.return_code,
                        enforce_fifo=enforce_fifo,
                    )
            except Exception as inv_e:
                logger.error("采购退货确认-更新库存失败: %s", inv_e)
                raise

            try:
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                await InventoryCostService().on_purchase_return_confirmed(tenant_id, return_id)
            except Exception as cost_e:
                logger.warning("采购退货确认-成本处理失败: %s", cost_e)

            # 创建红字应付单（采购退货冲减）
            try:
                from apps.kuaicaiwu.services.finance_service import PayableService
                from apps.kuaicaiwu.schemas.finance import PayableCreate

                ret_obj = await PurchaseReturn.get(tenant_id=tenant_id, id=return_id)
                total_amount = float(ret_obj.total_amount or 0)
                if total_amount > 0 and ret_obj.supplier_id:
                    payable_service = PayableService()
                    payable_data = PayableCreate(
                        source_type="采购退货",
                        source_id=return_id,
                        source_code=ret_obj.return_code,
                        supplier_id=ret_obj.supplier_id,
                        supplier_name=ret_obj.supplier_name,
                        total_amount=total_amount,
                        paid_amount=0.0,
                        remaining_amount=total_amount,
                        due_date=(datetime.now() + timedelta(days=30)).date(),
                        business_date=datetime.now().date(),
                        status="已冲减",
                        notes=f"采购退货冲减-由采购退货单 {ret_obj.return_code} 自动生成",
                    )
                    payable = await payable_service.create_payable(
                        tenant_id=tenant_id,
                        payable_data=payable_data,
                        created_by=confirmed_by,
                    )
                    try:
                        from apps.kuaicaiwu.services.finance_integration_hooks import (
                            link_finance_document_relation,
                            record_finance_accounting_event,
                        )

                        await link_finance_document_relation(
                            tenant_id=tenant_id,
                            source_type="purchase_return",
                            source_id=return_id,
                            source_code=ret_obj.return_code,
                            target_type="payable",
                            target_id=payable.id,
                            target_code=getattr(payable, "payable_code", None),
                            relation_desc="采购退货确认自动生成红字应付单",
                            created_by=confirmed_by,
                        )
                        await record_finance_accounting_event(
                            tenant_id=tenant_id,
                            event_type="PURCHASE_RETURN_TO_PAYABLE",
                            business_type="payable",
                            source_doc_type="purchase_return",
                            source_doc_id=return_id,
                            source_doc_code=ret_obj.return_code,
                            target_doc_type="Payable",
                            target_doc_id=payable.id,
                            target_doc_code=payable.payable_code,
                            amount=Decimal(str(total_amount)),
                            operator_id=confirmed_by,
                            notes=f"采购退货单 {ret_obj.return_code} 自动生成红字应付单",
                        )
                    except Exception as rel_e:
                        logger.warning("采购退货确认-创建应付单关联/会计事件失败: %s", rel_e)
            except Exception as fin_e:
                logger.warning("采购退货确认-创建红字应付单失败: %s", fin_e)

            updated_return = await self.get_purchase_return_by_id(tenant_id, return_id)
            return updated_return

    async def update_purchase_return(
        self,
        tenant_id: int,
        return_id: int,
        return_data: Any,
        updated_by: int,
    ) -> PurchaseReturnResponse:
        """更新采购退货单（仅待退货/草稿状态）。"""
        from apps.kuaizhizao.schemas.warehouse import PurchaseReturnUpdate
        from apps.master_data.models.material import Material

        async with in_transaction():
            return_obj = await PurchaseReturn.get_or_none(
                tenant_id=tenant_id, id=return_id, deleted_at__isnull=True
            )
            if not return_obj:
                raise NotFoundError(f"采购退货单不存在: {return_id}")
            if return_obj.status not in ("待退货", "草稿"):
                raise BusinessLogicError("仅「待退货」或「草稿」状态的采购退货单可编辑")

            if not isinstance(return_data, PurchaseReturnUpdate):
                return_data = PurchaseReturnUpdate.model_validate(return_data)

            payload = return_data.model_dump(exclude_unset=True, exclude={"items"})
            for key, val in payload.items():
                if key in ("id", "tenant_id", "uuid", "created_at", "updated_at"):
                    continue
                if hasattr(return_obj, key):
                    setattr(return_obj, key, val)

            items = getattr(return_data, "items", None)
            if items is not None:
                await PurchaseReturnItem.filter(tenant_id=tenant_id, return_id=return_id).delete()
                total_quantity = Decimal(0)
                total_amount = Decimal(0)
                location_required, _ = await _get_warehouse_policy_flags(tenant_id)
                for item_data in items:
                    material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id)
                    batch_number = getattr(item_data, "batch_number", None)
                    serial_numbers = getattr(item_data, "serial_numbers", None)
                    if material:
                        await _validate_batch_serial_policy(
                            tenant_id=tenant_id,
                            material=material,
                            batch_number=batch_number,
                            serial_numbers=serial_numbers,
                            quantity=getattr(item_data, "return_quantity", None),
                            scene="采购退货",
                        )
                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, "location_id", None),
                        location_code=getattr(item_data, "location_code", None),
                        scene="采购退货",
                        material_label=getattr(item_data, "material_name", None)
                        or getattr(item_data, "material_code", "未知物料"),
                    )
                    if serial_numbers and isinstance(serial_numbers, list):
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None

                    await PurchaseReturnItem.create(
                        tenant_id=tenant_id,
                        return_id=return_obj.id,
                        purchase_receipt_item_id=getattr(item_data, "purchase_receipt_item_id", None),
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, "material_spec", None),
                        material_unit=item_data.material_unit,
                        return_quantity=item_data.return_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, "location_id", None),
                        location_code=getattr(item_data, "location_code", None),
                        batch_number=batch_number,
                        expiry_date=getattr(item_data, "expiry_date", None),
                        serial_numbers=serial_numbers_json,
                        status=getattr(item_data, "status", "待退货"),
                        return_time=getattr(item_data, "return_time", None),
                        notes=getattr(item_data, "notes", None),
                    )
                    total_quantity += Decimal(str(item_data.return_quantity or 0))
                    total_amount += Decimal(str(item_data.total_amount or 0))
                return_obj.total_quantity = total_quantity
                return_obj.total_amount = total_amount

            return_obj.updated_by = updated_by
            await return_obj.save()
            return await self.get_purchase_return_by_id(tenant_id, return_id)

    async def withdraw_confirmation(self, tenant_id: int, return_id: int, updated_by: int) -> PurchaseReturnResponse:
        """撤回采购退货确认（已退货 -> 待退货），并回滚库存扣减。"""
        async with in_transaction():
            return_obj = await PurchaseReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
            if not return_obj:
                raise NotFoundError(f"采购退货单不存在: {return_id}")
            if return_obj.status != "已退货":
                raise BusinessLogicError("只有已退货状态的采购退货单才能撤回")

            from apps.kuaizhizao.services.inventory_service import InventoryService
            items = await PurchaseReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
            for item in items:
                qty = item.return_quantity or Decimal(0)
                if qty <= 0:
                    continue
                await InventoryService._increase_stock_no_atomic(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=qty,
                    warehouse_id=return_obj.warehouse_id if return_obj.warehouse_id else None,
                    batch_no=item.batch_number or None,
                    source_type="purchase_return_withdraw",
                    source_doc_id=return_id,
                    source_doc_code=return_obj.return_code,
                )

            await PurchaseReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status="待退货",
                return_time=None,
                returner_id=None,
                returner_name=None,
                updated_by=updated_by,
            )
            return await self.get_purchase_return_by_id(tenant_id, return_id)

    async def delete_purchase_return(self, tenant_id: int, return_id: int) -> bool:
        """删除采购退货单（软删除，仅待退货状态可删）"""
        return_obj = await PurchaseReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"采购退货单不存在: {return_id}")
        if return_obj.status != "待退货":
            raise BusinessLogicError("只有待退货状态的采购退货单才能删除")
        await PurchaseReturn.filter(tenant_id=tenant_id, id=return_id).update(
            deleted_at=datetime.now()
        )
        return True


class OtherInboundService(AppBaseService[OtherInbound]):
    """其他入库单服务"""

    def __init__(self):
        super().__init__(OtherInbound)
        self.business_config_service = BusinessConfigService()

    async def create_other_inbound(
        self,
        tenant_id: int,
        inbound_data: OtherInboundCreate,
        created_by: int
    ) -> OtherInboundResponse:
        """创建其他入库单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "inbound")
        if not is_enabled:
            raise BusinessLogicError("入库管理节点未启用，无法创建其他入库单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "OTHER_INBOUND_CODE", prefix=f"OI{today}")

            dump = inbound_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "inbound_code"})
            if inbound_data.inbound_code:
                code = inbound_data.inbound_code

            inbound = await OtherInbound.create(
                tenant_id=tenant_id,
                inbound_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(inbound_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item
            for item_data in items:
                qty = Decimal(str(item_data.inbound_quantity))
                price = Decimal(str(item_data.unit_price))
                amt = qty * price
                item_dict = item_data.model_dump(exclude_unset=True, exclude={"inbound_quantity", "unit_price", "total_amount"})
                material = await Material.get_or_none(
                    tenant_id=tenant_id,
                    id=item_data.material_id,
                    deleted_at__isnull=True,
                )
                if material:
                    batch_no = await ensure_batch_no_for_item(
                        tenant_id=tenant_id,
                        material=material,
                        item_data=item_data,
                        supplier_code=None,
                    )
                    if batch_no is not None:
                        item_dict["batch_number"] = batch_no
                await OtherInboundItem.create(
                    tenant_id=tenant_id,
                    inbound_id=inbound.id,
                    inbound_quantity=qty,
                    unit_price=price,
                    total_amount=amt,
                    **item_dict
                )
                total_quantity += qty
                total_amount += amt

            await OtherInbound.filter(tenant_id=tenant_id, id=inbound.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            inbound = await OtherInbound.get(tenant_id=tenant_id, id=inbound.id)
            return OtherInboundResponse.model_validate(inbound)

    async def get_other_inbound_by_id(
        self,
        tenant_id: int,
        inbound_id: int
    ) -> OtherInboundWithItemsResponse:
        """根据ID获取其他入库单（含明细）"""
        inbound = await OtherInbound.get_or_none(tenant_id=tenant_id, id=inbound_id)
        if not inbound:
            raise NotFoundError(f"其他入库单不存在: {inbound_id}")

        items = await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id).all()
        from apps.kuaizhizao.services.document_lifecycle_service import get_other_inbound_lifecycle, get_document_milestones

        response = OtherInboundWithItemsResponse.model_validate(inbound)
        milestones = await get_document_milestones(inbound.tenant_id, "other_inbound", inbound.id)
        response.lifecycle = get_other_inbound_lifecycle(inbound, milestones=milestones)
        response.items = [OtherInboundItemResponse.model_validate(i) for i in items]
        return response

    async def list_other_inbounds(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[OtherInboundListResponse]:
        """获取其他入库单列表"""
        query = OtherInbound.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("reason_type"):
            query = query.filter(reason_type=filters["reason_type"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        inbounds = await query.offset(skip).limit(limit).order_by("-created_at")
        return [OtherInboundListResponse.model_validate(r) for r in inbounds]

    async def update_other_inbound(
        self,
        tenant_id: int,
        inbound_id: int,
        inbound_data: OtherInboundUpdate,
        updated_by: int
    ) -> OtherInboundResponse:
        """更新其他入库单"""
        async with in_transaction():
            await self.get_other_inbound_by_id(tenant_id, inbound_id)
            dump = inbound_data.model_dump(exclude_unset=True, exclude={"inbound_code"})
            dump["updated_by"] = updated_by
            await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(**dump)
            return OtherInboundResponse.model_validate(
                await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
            )

    async def delete_other_inbound(self, tenant_id: int, inbound_id: int) -> bool:
        """删除其他入库单"""
        inbound = await OtherInbound.get_or_none(tenant_id=tenant_id, id=inbound_id)
        if not inbound:
            raise NotFoundError(f"其他入库单不存在: {inbound_id}")
        if inbound.status not in ("待入库", "已取消"):
            raise BusinessLogicError("只能删除待入库或已取消状态的其他入库单")

        await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def repair_deleted_other_inbound_inventory(
        self,
        tenant_id: int,
        inbound_id: int,
        updated_by: int,
    ) -> OtherInboundResponse:
        """
        数据修复：其他入库单已软删除（deleted_at 有值）但仍为「已入库」时，库存曾加账未冲回。

        按明细执行与「撤回确认」相同的扣减逻辑，并将头状态改为「已取消」、明细回到待入库，避免重复执行。
        """
        async with in_transaction():
            inbound = await OtherInbound.get_or_none(tenant_id=tenant_id, id=inbound_id)
            if not inbound:
                raise NotFoundError(f"其他入库单不存在: {inbound_id}")
            if inbound.deleted_at is None:
                raise BusinessLogicError(
                    "该单据未删除。若需冲减库存请先使用「撤回入库确认」；未确认入库的单据删除不会影响库存。"
                )
            if inbound.status != "已入库":
                raise BusinessLogicError(
                    f"单据状态为「{inbound.status}」，无需冲减库存（未确认入库或已执行过本修复）。"
                )

            from apps.kuaizhizao.services.inventory_service import InventoryService

            inbound_obj = await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
            wh_id = inbound_obj.warehouse_id if inbound_obj.warehouse_id else None
            items = await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id)

            for item in items:
                qty = Decimal(str(item.inbound_quantity or 0))
                if qty <= 0:
                    continue
                await InventoryService._decrease_stock_no_atomic(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=qty,
                    warehouse_id=wh_id,
                    batch_no=item.batch_number or None,
                    source_type="other_inbound_delete_cleanup",
                    source_doc_id=inbound_id,
                    source_doc_code=inbound_obj.inbound_code,
                )

            suffix = "\n[库存修复] 已对软删已入库单冲减即时库存"
            notes = (inbound_obj.notes or "").rstrip()
            new_notes = f"{notes}{suffix}" if notes else suffix.strip()

            await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(
                status="已取消",
                receiver_id=None,
                receiver_name=None,
                receipt_time=None,
                notes=new_notes,
                updated_by=updated_by,
            )
            await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id).update(
                status="待入库",
                receipt_time=None,
            )

            return OtherInboundResponse.model_validate(
                await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
            )

    async def confirm_inbound(
        self,
        tenant_id: int,
        inbound_id: int,
        confirmed_by: int,
        confirmation_data: Optional[InboundConfirmationRequest] = None,
    ) -> OtherInboundResponse:
        """确认入库"""
        async with in_transaction():
            inbound = await OtherInbound.get_or_none(tenant_id=tenant_id, id=inbound_id)
            if not inbound:
                raise NotFoundError(f"其他入库单不存在: {inbound_id}")

            if inbound.status != "待入库":
                raise BusinessLogicError("只有待入库状态的其他入库单才能确认入库")

            # 1. 更新确认数据
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = confirmation_data.warehouse_name or f"仓库{confirmation_data.warehouse_id}"
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                
                if update_dict:
                    await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(**update_dict)
                    inbound = await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        # OtherInboundItem has no warehouse_id; the warehouse is stored on the header.
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.expiry_date:
                            item_update["expiry_date"] = item_data.expiry_date
                        
                        if item_update:
                            await OtherInboundItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, inbound_id=inbound_id
                            ).update(**item_update)

            # 2. 补齐批号/序列号
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item, ensure_serial_nos_for_item

            items = await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id).all()
            if not items or all((item.inbound_quantity or Decimal(0)) <= 0 for item in items):
                raise BusinessLogicError("请至少添加一条有效入库明细（数量大于0）")

            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if not material:
                    continue
                if material.batch_managed and not item.batch_number:
                    batch_no = await ensure_batch_no_for_item(tenant_id, material, item)
                    if batch_no:
                        item.batch_number = batch_no
                        await item.save()
                if material.serial_managed:
                    count = int(item.inbound_quantity or 0)
                    serial_nos = await ensure_serial_nos_for_item(tenant_id, material, item, count)
                    if serial_nos and hasattr(item, "serial_numbers"):
                        setattr(item, "serial_numbers", json.dumps(serial_nos))
                        await item.save()

            receiver_name = await self.get_user_name(confirmed_by)
            receipt_time = (confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None) or datetime.now()

            await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(
                status="已入库",
                receiver_id=confirmed_by,
                receiver_name=receiver_name,
                receipt_time=receipt_time,
                updated_by=confirmed_by
            )
            await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id).update(
                status="已入库", 
                receipt_time=receipt_time
            )

            # 4. 更新库存（增加）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService
                # 重新加载明细
                reload_items = await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id).all()
                for item in reload_items:
                    qty = Decimal(str(item.inbound_quantity or 0))
                    if qty <= 0:
                        continue
                    wh_id = getattr(item, "warehouse_id", None) or inbound.warehouse_id
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="other_inbound",
                        source_doc_id=inbound_id,
                        source_doc_code=inbound.inbound_code,
                    )
            except Exception as inv_e:
                logger.error("其他入库确认-更新库存失败: %s", inv_e)
                raise

            try:
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                await InventoryCostService().on_other_inbound_confirmed(tenant_id, inbound_id)
            except Exception as cost_e:
                logger.warning("其他入库确认-成本处理失败: %s", cost_e)

            return OtherInboundResponse.model_validate(
                await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
            )


    async def withdraw_confirmation(
        self,
        tenant_id: int,
        inbound_id: int,
        updated_by: int
    ) -> OtherInboundResponse:
        """撤回确认入库"""
        async with in_transaction():
            inbound = await self.get_other_inbound_by_id(tenant_id, inbound_id)
            if inbound.status != "已入库":
                raise BusinessLogicError("只有已入库状态的其他入库单才能撤回确认")

            # 校验并反转库存
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService
                
                # 手动获取明细（模型定义中没有外键关系，只能用 filter）
                inbound_obj = await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
                wh_id = inbound_obj.warehouse_id if inbound_obj.warehouse_id else None
                items = await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id)
                
                for item in items:
                    qty = Decimal(str(item.inbound_quantity or 0))
                    if qty <= 0:
                        continue
                    
                    # 反向扣减库存（decrease_stock 内部会校验余量，如果已被领用，这里会报错拦截）
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="other_inbound_revoke", 
                        source_doc_id=inbound_id,
                        source_doc_code=inbound_obj.inbound_code,
                    )
                
                # 状态回归并清空接收人和接收时间
                await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(
                    status="待入库",
                    receiver_id=None,
                    receiver_name=None,
                    receipt_time=None,
                    updated_by=updated_by
                )
                await OtherInboundItem.filter(
                    tenant_id=tenant_id,
                    inbound_id=inbound_id
                ).update(status="待入库", receipt_time=None)
                
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回其他入库确认-未知错误: %s", e)
                raise BusinessLogicError(f"系统错误: {str(e)}")

            return OtherInboundResponse.model_validate(
                await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
            )


class OtherOutboundService(AppBaseService[OtherOutbound]):
    """其他出库单服务"""

    def __init__(self):
        super().__init__(OtherOutbound)
        self.business_config_service = BusinessConfigService()

    async def create_other_outbound(
        self,
        tenant_id: int,
        outbound_data: OtherOutboundCreate,
        created_by: int
    ) -> OtherOutboundResponse:
        """创建其他出库单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "outbound")
        if not is_enabled:
            raise BusinessLogicError("出库管理节点未启用，无法创建其他出库单")
        location_required, auto_outbound_enabled = await _get_warehouse_policy_flags(tenant_id)
        created_outbound_id: Optional[int] = None
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "OTHER_OUTBOUND_CODE", prefix=f"OO{today}")

            dump = outbound_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "outbound_code"})
            if outbound_data.outbound_code:
                code = outbound_data.outbound_code

            outbound = await OtherOutbound.create(
                tenant_id=tenant_id,
                outbound_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(outbound_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.outbound_quantity))
                _validate_location_if_required(
                    location_required=location_required,
                    location_id=getattr(item_data, 'location_id', None),
                    location_code=getattr(item_data, 'location_code', None),
                    scene="其他出库",
                    material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                )
                price = Decimal(str(item_data.unit_price))
                amt = qty * price
                await OtherOutboundItem.create(
                    tenant_id=tenant_id,
                    outbound_id=outbound.id,
                    outbound_quantity=qty,
                    unit_price=price,
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"outbound_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await OtherOutbound.filter(tenant_id=tenant_id, id=outbound.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            created_outbound_id = outbound.id

        if auto_outbound_enabled and created_outbound_id:
            outbound_obj = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=created_outbound_id)
            if outbound_obj and outbound_obj.status == "待出库":
                return await self.confirm_outbound(
                    tenant_id=tenant_id,
                    outbound_id=created_outbound_id,
                    confirmed_by=created_by,
                )
        return OtherOutboundResponse.model_validate(
            await OtherOutbound.get(tenant_id=tenant_id, id=created_outbound_id)
        )

    async def get_other_outbound_by_id(
        self,
        tenant_id: int,
        outbound_id: int
    ) -> OtherOutboundWithItemsResponse:
        """根据ID获取其他出库单（含明细）"""
        outbound = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=outbound_id)
        if not outbound:
            raise NotFoundError(f"其他出库单不存在: {outbound_id}")

        items = await OtherOutboundItem.filter(tenant_id=tenant_id, outbound_id=outbound_id).all()
        from apps.kuaizhizao.services.document_lifecycle_service import get_other_outbound_lifecycle

        response = OtherOutboundWithItemsResponse.model_validate(outbound)
        response.items = [OtherOutboundItemResponse.model_validate(i) for i in items]
        response.lifecycle = get_other_outbound_lifecycle(outbound)
        return response

    async def list_other_outbounds(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[OtherOutboundListResponse]:
        """获取其他出库单列表"""
        query = OtherOutbound.filter(tenant_id=tenant_id)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("reason_type"):
            query = query.filter(reason_type=filters["reason_type"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        outbounds = await query.offset(skip).limit(limit).order_by("-created_at")
        return [OtherOutboundListResponse.model_validate(r) for r in outbounds]

    async def update_other_outbound(
        self,
        tenant_id: int,
        outbound_id: int,
        outbound_data: OtherOutboundUpdate,
        updated_by: int
    ) -> OtherOutboundResponse:
        """更新其他出库单"""
        async with in_transaction():
            await self.get_other_outbound_by_id(tenant_id, outbound_id)
            dump = outbound_data.model_dump(exclude_unset=True, exclude={"outbound_code"})
            dump["updated_by"] = updated_by
            await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(**dump)
            return OtherOutboundResponse.model_validate(
                await OtherOutbound.get(tenant_id=tenant_id, id=outbound_id)
            )

    async def delete_other_outbound(self, tenant_id: int, outbound_id: int) -> bool:
        """删除其他出库单"""
        outbound = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=outbound_id)
        if not outbound:
            raise NotFoundError(f"其他出库单不存在: {outbound_id}")
        if outbound.status not in ("待出库", "已取消"):
            raise BusinessLogicError("只能删除待出库或已取消状态的其他出库单")

        await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def confirm_outbound(
        self,
        tenant_id: int,
        outbound_id: int,
        confirmed_by: int
    ) -> OtherOutboundResponse:
        """确认出库"""
        async with in_transaction():
            outbound = await self.get_other_outbound_by_id(tenant_id, outbound_id)
            if outbound.status != "待出库":
                raise BusinessLogicError("只有待出库状态的其他出库单才能确认出库")
            if not outbound.items or all((item.outbound_quantity or Decimal(0)) <= 0 for item in outbound.items):
                raise BusinessLogicError("请至少添加一条有效出库明细（数量大于0）")

            deliverer_name = await self.get_user_name(confirmed_by)
            await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(
                status="已出库",
                deliverer_id=confirmed_by,
                deliverer_name=deliverer_name,
                delivery_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in outbound.items:
                await OtherOutboundItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已出库", delivery_time=datetime.now())

            # 更新库存（扣减库存）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                outbound_obj = await OtherOutbound.get(tenant_id=tenant_id, id=outbound_id)
                biz_config = await BusinessConfigService().get_business_config(tenant_id)
                enforce_fifo = (
                    biz_config.get("parameters", {})
                    .get("warehouse", {})
                    .get("fifo", False)
                )
                wh_id = outbound_obj.warehouse_id if outbound_obj.warehouse_id else None
                for item in outbound.items:
                    qty = Decimal(str(item.outbound_quantity or 0))
                    if qty <= 0:
                        continue
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="other_outbound",
                        source_doc_id=outbound_id,
                        source_doc_code=outbound_obj.outbound_code,
                        enforce_fifo=enforce_fifo,
                    )
            except ValueError as inv_e:
                logger.error("其他出库确认-更新库存失败: %s", inv_e)
                raise BusinessLogicError(str(inv_e) or "库存不足，无法出库")
            except Exception as inv_e:
                logger.error("其他出库确认-更新库存失败: %s", inv_e)
                raise

            try:
                from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                fresh_items = await OtherOutboundItem.filter(
                    tenant_id=tenant_id, outbound_id=outbound_id
                ).all()
                await InventoryCostService().apply_other_outbound_costs(tenant_id, fresh_items)
            except Exception as cost_e:
                logger.error("其他出库确认-成本回写失败: %s", cost_e)
                raise BusinessLogicError(f"出库成本回写失败: {cost_e}")

            return OtherOutboundResponse.model_validate(
                await OtherOutbound.get(tenant_id=tenant_id, id=outbound_id)
            )


class MaterialBorrowService(AppBaseService[MaterialBorrow]):
    """借料单服务"""

    def __init__(self):
        super().__init__(MaterialBorrow)

    async def create_material_borrow(
        self,
        tenant_id: int,
        borrow_data: MaterialBorrowCreate,
        created_by: int
    ) -> MaterialBorrowResponse:
        """创建借料单"""
        location_required, auto_outbound_enabled = await _get_warehouse_policy_flags(tenant_id)
        created_borrow_id: Optional[int] = None
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "MATERIAL_BORROW_CODE", prefix=f"MB{today}")

            dump = borrow_data.model_dump(exclude_unset=True, exclude={"items", "borrow_code"})
            if borrow_data.borrow_code:
                code = borrow_data.borrow_code

            borrow = await MaterialBorrow.create(
                tenant_id=tenant_id,
                borrow_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(borrow_data, "items", None) or []
            total_quantity = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.borrow_quantity))
                _validate_location_if_required(
                    location_required=location_required,
                    location_id=getattr(item_data, 'location_id', None),
                    location_code=getattr(item_data, 'location_code', None),
                    scene="借料",
                    material_label=getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                )
                await MaterialBorrowItem.create(
                    tenant_id=tenant_id,
                    borrow_id=borrow.id,
                    borrow_quantity=qty,
                    returned_quantity=Decimal(0),
                    **item_data.model_dump(exclude_unset=True, exclude={"borrow_quantity", "returned_quantity"})
                )
                total_quantity += qty

            await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow.id).update(total_quantity=total_quantity)
            created_borrow_id = borrow.id

        if auto_outbound_enabled and created_borrow_id:
            borrow_obj = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=created_borrow_id, deleted_at__isnull=True)
            if borrow_obj and borrow_obj.status == "待借出":
                return await self.confirm_borrow(
                    tenant_id=tenant_id,
                    borrow_id=created_borrow_id,
                    confirmed_by=created_by,
                )
        return MaterialBorrowResponse.model_validate(
            await MaterialBorrow.get(tenant_id=tenant_id, id=created_borrow_id)
        )

    async def get_material_borrow_by_id(
        self,
        tenant_id: int,
        borrow_id: int
    ) -> MaterialBorrowWithItemsResponse:
        """根据ID获取借料单（含明细）"""
        borrow = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=borrow_id, deleted_at__isnull=True)
        if not borrow:
            raise NotFoundError(f"借料单不存在: {borrow_id}")

        items = await MaterialBorrowItem.filter(tenant_id=tenant_id, borrow_id=borrow_id).all()
        from apps.kuaizhizao.services.document_lifecycle_service import get_material_borrow_lifecycle

        response = MaterialBorrowWithItemsResponse.model_validate(borrow)
        response.items = [MaterialBorrowItemResponse.model_validate(i) for i in items]
        response.lifecycle = get_material_borrow_lifecycle(borrow)
        return response

    async def list_material_borrows(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[MaterialBorrowListResponse]:
        """获取借料单列表"""
        query = MaterialBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        borrows = await query.offset(skip).limit(limit).order_by("-created_at")
        return [MaterialBorrowListResponse.model_validate(r) for r in borrows]

    async def update_material_borrow(
        self,
        tenant_id: int,
        borrow_id: int,
        borrow_data: MaterialBorrowUpdate,
        updated_by: int
    ) -> MaterialBorrowResponse:
        """更新借料单"""
        borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)
        if borrow.status != "待借出":
            raise BusinessLogicError("只能更新待借出状态的借料单")

        async with in_transaction():
            dump = borrow_data.model_dump(exclude_unset=True, exclude={"borrow_code"})
            dump["updated_by"] = updated_by
            await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(**dump)
            return MaterialBorrowResponse.model_validate(
                await MaterialBorrow.get(tenant_id=tenant_id, id=borrow_id)
            )

    async def delete_material_borrow(self, tenant_id: int, borrow_id: int) -> bool:
        """删除借料单"""
        borrow = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=borrow_id, deleted_at__isnull=True)
        if not borrow:
            raise NotFoundError(f"借料单不存在: {borrow_id}")
        if borrow.status != "待借出":
            raise BusinessLogicError("只能删除待借出状态的借料单")

        await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(
            deleted_at=datetime.now()
        )
        return True

    async def confirm_borrow(
        self,
        tenant_id: int,
        borrow_id: int,
        confirmed_by: int
    ) -> MaterialBorrowResponse:
        """确认借出"""
        async with in_transaction():
            borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)
            if borrow.status != "待借出":
                raise BusinessLogicError("只有待借出状态的借料单才能确认借出")

            borrower_name = await self.get_user_name(confirmed_by)
            await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(
                status="已借出",
                borrower_id=confirmed_by,
                borrower_name=borrower_name,
                borrow_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in borrow.items:
                await MaterialBorrowItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已借出", borrow_time=datetime.now())

            # 更新库存（扣减仓库库存）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                borrow_obj = await MaterialBorrow.get(tenant_id=tenant_id, id=borrow_id)
                biz_config = await BusinessConfigService().get_business_config(tenant_id)
                enforce_fifo = (
                    biz_config.get("parameters", {})
                    .get("warehouse", {})
                    .get("fifo", False)
                )
                for item in borrow.items:
                    qty = item.borrow_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="material_borrow",
                        source_doc_id=borrow_id,
                        source_doc_code=borrow_obj.borrow_code,
                        enforce_fifo=enforce_fifo,
                    )
            except ValueError as inv_e:
                logger.error("借料确认-更新库存失败: %s", inv_e)
                raise BusinessLogicError(str(inv_e) or "库存不足，无法借出")
            except Exception as inv_e:
                logger.error("借料确认-更新库存失败: %s", inv_e)
                raise

            return MaterialBorrowResponse.model_validate(
                await MaterialBorrow.get(tenant_id=tenant_id, id=borrow_id)
            )


class MaterialReturnService(AppBaseService[MaterialReturn]):
    """还料单服务"""

    def __init__(self):
        super().__init__(MaterialReturn)

    async def create_material_return(
        self,
        tenant_id: int,
        return_data: MaterialReturnCreate,
        created_by: int
    ) -> MaterialReturnResponse:
        """创建还料单"""
        async with in_transaction():
            borrow = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=return_data.borrow_id, deleted_at__isnull=True)
            if not borrow:
                raise NotFoundError(f"借料单不存在: {return_data.borrow_id}")

            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "MATERIAL_RETURN_CODE", prefix=f"MR{today}")

            dump = return_data.model_dump(exclude_unset=True, exclude={"items", "return_code", "borrow_code"})
            if return_data.return_code:
                code = return_data.return_code

            return_obj = await MaterialReturn.create(
                tenant_id=tenant_id,
                return_code=code,
                borrow_id=borrow.id,
                borrow_code=borrow.borrow_code,
                created_by=created_by,
                **dump
            )

            items = getattr(return_data, "items", None) or []
            total_quantity = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.return_quantity))
                await MaterialReturnItem.create(
                    tenant_id=tenant_id,
                    return_id=return_obj.id,
                    return_quantity=qty,
                    **item_data.model_dump(exclude_unset=True, exclude={"return_quantity"})
                )
                total_quantity += qty

            await MaterialReturn.filter(tenant_id=tenant_id, id=return_obj.id).update(total_quantity=total_quantity)
            return_obj = await MaterialReturn.get(tenant_id=tenant_id, id=return_obj.id)
            return MaterialReturnResponse.model_validate(return_obj)

    async def get_material_return_by_id(
        self,
        tenant_id: int,
        return_id: int
    ) -> MaterialReturnWithItemsResponse:
        """根据ID获取还料单（含明细）"""
        return_obj = await MaterialReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"还料单不存在: {return_id}")

        items = await MaterialReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
        response = MaterialReturnWithItemsResponse.model_validate(return_obj)
        response.items = [MaterialReturnItemResponse.model_validate(i) for i in items]
        return response

    async def list_material_returns(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[MaterialReturnListResponse]:
        """获取还料单列表"""
        query = MaterialReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("borrow_id"):
            query = query.filter(borrow_id=filters["borrow_id"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        returns = await query.offset(skip).limit(limit).order_by("-created_at")
        return [MaterialReturnListResponse.model_validate(r) for r in returns]

    async def update_material_return(
        self,
        tenant_id: int,
        return_id: int,
        return_data: MaterialReturnUpdate,
        updated_by: int
    ) -> MaterialReturnResponse:
        """更新还料单"""
        return_obj = await self.get_material_return_by_id(tenant_id, return_id)
        if return_obj.status != "待归还":
            raise BusinessLogicError("只能更新待归还状态的还料单")

        async with in_transaction():
            dump = return_data.model_dump(exclude_unset=True, exclude={"return_code"})
            dump["updated_by"] = updated_by
            await MaterialReturn.filter(tenant_id=tenant_id, id=return_id).update(**dump)
            return MaterialReturnResponse.model_validate(
                await MaterialReturn.get(tenant_id=tenant_id, id=return_id)
            )

    async def delete_material_return(self, tenant_id: int, return_id: int) -> bool:
        """删除还料单"""
        return_obj = await MaterialReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"还料单不存在: {return_id}")
        if return_obj.status != "待归还":
            raise BusinessLogicError("只能删除待归还状态的还料单")

        await MaterialReturn.filter(tenant_id=tenant_id, id=return_id).update(
            deleted_at=datetime.now()
        )
        return True

    async def confirm_return(
        self,
        tenant_id: int,
        return_id: int,
        confirmed_by: int
    ) -> MaterialReturnResponse:
        """确认归还"""
        async with in_transaction():
            return_obj = await self.get_material_return_by_id(tenant_id, return_id)
            if return_obj.status != "待归还":
                raise BusinessLogicError("只有待归还状态的还料单才能确认归还")

            returner_name = await self.get_user_name(confirmed_by)
            await MaterialReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status="已归还",
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in return_obj.items:
                await MaterialReturnItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已归还", return_time=datetime.now())

            # 更新借料单明细的已归还数量
            for item in return_obj.items:
                borrow_item = await MaterialBorrowItem.get_or_none(
                    tenant_id=tenant_id,
                    borrow_id=return_obj.borrow_id,
                    material_id=item.material_id
                )
                if borrow_item:
                    new_returned = (borrow_item.returned_quantity or Decimal(0)) + Decimal(str(item.return_quantity))
                    await MaterialBorrowItem.filter(tenant_id=tenant_id, id=borrow_item.id).update(
                        returned_quantity=new_returned
                    )

            # 更新库存（增加仓库库存）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                return_entity = await MaterialReturn.get(tenant_id=tenant_id, id=return_id)
                for item in return_obj.items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="material_return",
                        source_doc_id=return_id,
                        source_doc_code=return_entity.return_code,
                    )
            except Exception as inv_e:
                logger.error("还料确认-更新库存失败: %s", inv_e)
                raise

            return MaterialReturnResponse.model_validate(
                await MaterialReturn.get(tenant_id=tenant_id, id=return_id)
            )

