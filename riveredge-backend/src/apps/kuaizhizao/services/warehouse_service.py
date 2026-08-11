"""
仓储管理服务模块

提供仓储管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal
import json
import time
import uuid
from pathlib import Path
from types import SimpleNamespace
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from core.utils.timezone_utils import resolve_business_datetime, to_site_date, today_site_str
from apps.common.audit_actor import audit_response_fields
from apps.kuaizhizao.utils.material_unit_utils import convert_to_base_quantity


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
    SalesDeliveryConfirmRequest,
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
    OutboundConfirmationRequest,
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


def _normalize_optional_datetime(value: Any) -> Optional[datetime]:
    """兼容 DateField/字符串/datetime，统一为可序列化 datetime。"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _build_purchase_receipt_item_response(item: Any) -> PurchaseReceiptItemResponse:
    """统一采购入库明细响应，兼容历史 serial_numbers/date 存储格式。"""
    payload = {
        "id": int(getattr(item, "id")),
        "tenant_id": int(getattr(item, "tenant_id")),
        "receipt_id": int(getattr(item, "receipt_id")),
        "purchase_order_item_id": int(getattr(item, "purchase_order_item_id", 0) or 0),
        "material_id": int(getattr(item, "material_id")),
        "material_code": str(getattr(item, "material_code", "") or ""),
        "material_name": str(getattr(item, "material_name", "") or ""),
        "material_spec": getattr(item, "material_spec", None),
        "material_unit": str(getattr(item, "material_unit", "") or ""),
        "receipt_quantity": float(getattr(item, "receipt_quantity", 0) or 0),
        "unit_price": float(getattr(item, "unit_price", 0) or 0),
        "total_amount": float(getattr(item, "total_amount", 0) or 0),
        "qualified_quantity": float(getattr(item, "qualified_quantity", 0) or 0),
        "unqualified_quantity": float(getattr(item, "unqualified_quantity", 0) or 0),
        "quality_status": str(getattr(item, "quality_status", "合格") or "合格"),
        "warehouse_id": getattr(item, "warehouse_id", None),
        "warehouse_name": getattr(item, "warehouse_name", None),
        "location_id": getattr(item, "location_id", None),
        "location_code": getattr(item, "location_code", None),
        "batch_number": getattr(item, "batch_number", None),
        "serial_numbers": _parse_serial_numbers(getattr(item, "serial_numbers", None)) or None,
        "expiry_date": _normalize_optional_datetime(getattr(item, "expiry_date", None)),
        "manufacturing_date": _normalize_optional_datetime(getattr(item, "manufacturing_date", None)),
        "status": str(getattr(item, "status", "待入库") or "待入库"),
        "receipt_time": _normalize_optional_datetime(getattr(item, "receipt_time", None)),
        "notes": getattr(item, "notes", None),
        "created_at": getattr(item, "created_at"),
        "updated_at": getattr(item, "updated_at"),
        **audit_response_fields(item),
    }
    return PurchaseReceiptItemResponse.model_validate(payload)


def _resolve_material_snapshot_fields(
    material: Optional[Any],
    item_data: Any,
) -> tuple[str, str, str, Optional[str]]:
    """从明细入参 + 主数据解析物料快照（编码/名称/单位/规格）。空值才回填，不覆盖已有值。"""
    code = str(getattr(item_data, "material_code", None) or "").strip()
    name = str(getattr(item_data, "material_name", None) or "").strip()
    unit = str(getattr(item_data, "material_unit", None) or "").strip()
    spec = getattr(item_data, "material_spec", None)
    if material is not None:
        if not code:
            code = str(
                getattr(material, "main_code", None) or getattr(material, "code", None) or ""
            ).strip()
        if not name:
            name = str(getattr(material, "name", None) or "").strip()
        if not unit:
            unit = str(getattr(material, "base_unit", None) or "pcs").strip()
        if not (str(spec or "").strip()):
            spec = getattr(material, "specification", None)
    return code, name, unit or "pcs", spec


def _build_sales_return_item_response(item: Any) -> SalesReturnItemResponse:
    """统一销售退货明细响应，兼容历史 serial_numbers/date 存储格式。"""
    payload = {
        "id": int(getattr(item, "id")),
        "tenant_id": int(getattr(item, "tenant_id")),
        "return_id": int(getattr(item, "return_id")),
        "sales_delivery_item_id": getattr(item, "sales_delivery_item_id", None),
        "material_id": int(getattr(item, "material_id")),
        "material_code": str(getattr(item, "material_code", "") or ""),
        "material_name": str(getattr(item, "material_name", "") or ""),
        "material_spec": getattr(item, "material_spec", None),
        "material_unit": str(getattr(item, "material_unit", "") or ""),
        "return_quantity": float(getattr(item, "return_quantity", 0) or 0),
        "unit_price": float(getattr(item, "unit_price", 0) or 0),
        "total_amount": float(getattr(item, "total_amount", 0) or 0),
        "location_id": getattr(item, "location_id", None),
        "location_code": getattr(item, "location_code", None),
        "batch_number": getattr(item, "batch_number", None),
        "expiry_date": _normalize_optional_datetime(getattr(item, "expiry_date", None)),
        "serial_numbers": _parse_serial_numbers(getattr(item, "serial_numbers", None)) or None,
        "status": str(getattr(item, "status", "待退货") or "待退货"),
        "return_time": _normalize_optional_datetime(getattr(item, "return_time", None)),
        "notes": getattr(item, "notes", None),
        "created_at": getattr(item, "created_at"),
        "updated_at": getattr(item, "updated_at"),
        **audit_response_fields(item),
    }
    return SalesReturnItemResponse.model_validate(payload)


def _convert_line_quantity_to_base(
    *,
    quantity: Decimal,
    material_unit: Optional[str],
    material: Optional[Any],
) -> Decimal:
    """把业务行数量按物料多单位规则换算为基础单位数量。"""
    qty = Decimal(str(quantity or 0))
    if qty <= 0 or not material:
        return qty
    return convert_to_base_quantity(
        material,
        qty,
        from_unit=material_unit,
    )


async def _load_materials_by_ids(
    tenant_id: int,
    material_ids: List[int],
) -> Dict[int, Any]:
    """批量加载物料，供入库/出库过账前换算为基础单位。"""
    if not material_ids:
        return {}
    from apps.master_data.models.material import Material

    materials = await Material.filter(
        tenant_id=tenant_id,
        id__in=material_ids,
        deleted_at__isnull=True,
    ).all()
    return {int(m.id): m for m in materials}


def _aggregate_warehouse_from_picking_item_rows(
    rows: List[Dict[str, Any]],
) -> Tuple[Optional[int], Optional[str]]:
    """从生产领料明细汇总出库仓库：单仓取该仓；多仓名称用「 / 」拼接，id 置空。"""
    ordered: List[Tuple[Optional[int], str]] = []
    seen: set[Tuple[Optional[int], str]] = set()
    for row in rows:
        wid_raw = row.get("warehouse_id")
        wid: Optional[int] = None
        if wid_raw is not None and str(wid_raw).strip() != "":
            try:
                wid = int(wid_raw)
            except (TypeError, ValueError):
                wid = None
        name = str(row.get("warehouse_name") or "").strip()
        if wid is None and not name:
            continue
        key = (wid, name)
        if key in seen:
            continue
        seen.add(key)
        ordered.append(key)
    if not ordered:
        return None, None
    if len(ordered) == 1:
        return ordered[0][0], ordered[0][1] or None
    names = [n for _, n in ordered if n]
    return None, " / ".join(names) if names else None


async def _resolve_warehouse_name_by_id(
    tenant_id: int,
    warehouse_id: Any,
    preferred_name: Optional[str] = None,
) -> str:
    """按仓库ID解析仓库名称；若传入名称则优先使用。"""
    preferred = str(preferred_name or "").strip()
    if preferred:
        return preferred
    if warehouse_id is None or str(warehouse_id).strip() == "":
        raise ValidationError("缺少仓库ID，无法解析仓库名称")
    try:
        wid = int(warehouse_id)
    except (TypeError, ValueError):
        raise ValidationError(f"仓库ID无效: {warehouse_id}")
    from apps.master_data.models.warehouse import Warehouse

    wh = await Warehouse.get_or_none(
        tenant_id=tenant_id,
        id=wid,
        is_active=True,
        deleted_at__isnull=True,
    )
    if not wh:
        raise ValidationError(f"仓库不存在或未启用: {wid}")
    name = str(getattr(wh, "name", "") or "").strip()
    if not name:
        raise ValidationError(f"仓库名称未配置: {wid}")
    return name


async def _resolve_warehouse_identity(
    tenant_id: int,
    warehouse_id: Optional[Any] = None,
    warehouse_name: Optional[str] = None,
) -> Tuple[int, str]:
    """统一解析仓库ID与名称（支持传ID或名称）。"""
    if warehouse_id is not None and str(warehouse_id).strip() != "":
        try:
            wid = int(warehouse_id)
        except (TypeError, ValueError):
            raise ValidationError(f"仓库ID无效: {warehouse_id}")
        wname = await _resolve_warehouse_name_by_id(tenant_id, wid, warehouse_name)
        return wid, wname

    name = str(warehouse_name or "").strip()
    if not name:
        raise ValidationError("必须指定仓库ID或仓库名称")

    from apps.master_data.models.warehouse import Warehouse

    wh = await Warehouse.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    ).filter(Q(name=name) | Q(code=name)).first()
    if not wh:
        raise ValidationError(f"仓库不存在或未启用: {name}")
    resolved_name = str(getattr(wh, "name", "") or "").strip()
    if not resolved_name:
        raise ValidationError(f"仓库名称未配置: {wh.id}")
    return int(wh.id), resolved_name


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


def _build_production_picking_item_response(item: Any) -> ProductionPickingItemResponse:
    """统一生产领料明细响应，兼容 serial_numbers JSON 存储格式。"""
    payload = {
        "id": int(getattr(item, "id")),
        "tenant_id": int(getattr(item, "tenant_id")),
        "picking_id": int(getattr(item, "picking_id")),
        "material_id": int(getattr(item, "material_id")),
        "material_code": str(getattr(item, "material_code", "") or ""),
        "material_name": str(getattr(item, "material_name", "") or ""),
        "material_spec": getattr(item, "material_spec", None),
        "material_unit": str(getattr(item, "material_unit", "") or ""),
        "required_quantity": float(getattr(item, "required_quantity", 0) or 0),
        "picked_quantity": float(getattr(item, "picked_quantity", 0) or 0),
        "remaining_quantity": float(getattr(item, "remaining_quantity", 0) or 0),
        "warehouse_id": int(getattr(item, "warehouse_id")),
        "warehouse_name": str(getattr(item, "warehouse_name", "") or ""),
        "location_id": getattr(item, "location_id", None),
        "location_code": getattr(item, "location_code", None),
        "status": str(getattr(item, "status", "待领料") or "待领料"),
        "picking_time": _normalize_optional_datetime(getattr(item, "picking_time", None)),
        "batch_number": getattr(item, "batch_number", None),
        "expiry_date": _normalize_optional_datetime(getattr(item, "expiry_date", None)),
        "serial_numbers": _parse_serial_numbers(getattr(item, "serial_numbers", None)) or None,
        "notes": getattr(item, "notes", None),
        "created_at": getattr(item, "created_at"),
        "updated_at": getattr(item, "updated_at"),
    }
    return ProductionPickingItemResponse.model_validate(payload)


async def _get_warehouse_policy_flags(tenant_id: int) -> tuple[bool, bool]:
    """读取仓储策略开关（库位管理、自动出库）。库位管理不表示单据必填库位。"""
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
    """库位管理仅启用库位能力（主数据、UI、库存维度），不强制业务单据必须填写库位。"""
    del location_required, location_id, location_code, scene, material_label


async def _hydrate_item_material_snapshot(tenant_id: int, items: List[Any]) -> None:
    """
    按 material_id 回填明细上的物料快照字段（编码/名称/单位）。

    - 仅回填空值，不覆盖已有值；
    - 优先从主数据读取（含已停用/已删除物料，保证历史单据可展示）；
    - 主数据缺失时给出最小可读占位，避免详情出现整列空白。
    """
    if not items:
        return

    candidate_ids = {
        int(getattr(item, "material_id"))
        for item in items
        if getattr(item, "material_id", None)
        and (
            not str(getattr(item, "material_code", "") or "").strip()
            or not str(getattr(item, "material_name", "") or "").strip()
            or not str(getattr(item, "material_unit", "") or "").strip()
        )
    }
    if not candidate_ids:
        return

    from apps.master_data.models.material import Material

    materials = await Material.filter(
        tenant_id=tenant_id,
        id__in=list(candidate_ids),
    ).all()
    material_map = {int(m.id): m for m in materials}

    for item in items:
        material_id = getattr(item, "material_id", None)
        if not material_id:
            continue
        material = material_map.get(int(material_id))

        changed = False
        if not str(getattr(item, "material_code", "") or "").strip():
            fallback_code = (
                getattr(material, "main_code", None)
                or getattr(material, "code", None)
                or f"MAT-{material_id}"
            )
            item.material_code = str(fallback_code or "")
            changed = True
        if not str(getattr(item, "material_name", "") or "").strip():
            fallback_name = getattr(material, "name", None) or f"物料#{material_id}"
            item.material_name = str(fallback_name or "")
            changed = True
        if not str(getattr(item, "material_unit", "") or "").strip():
            item.material_unit = str(getattr(material, "base_unit", None) or "pcs")
            changed = True

        if changed:
            await item.save(update_fields=["material_code", "material_name", "material_unit"])


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


_SALES_OUTBOUND_CLOSED_STATUSES = frozenset(
    {"已出库", "已完成", "completed", "COMPLETED", "done", "DONE"}
)


async def _list_sales_order_material_outbound_batches(
    tenant_id: int,
    sales_order_id: int,
    material_id: int,
) -> List[Dict[str, Any]]:
    """列出销售订单某物料在已出库明细上的批次（按出库明细倒序，批号去重）。"""
    delivery_ids = await SalesDelivery.filter(
        tenant_id=tenant_id,
        sales_order_id=sales_order_id,
        deleted_at__isnull=True,
        status__in=list(_SALES_OUTBOUND_CLOSED_STATUSES),
    ).order_by("-id").values_list("id", flat=True)
    if not delivery_ids:
        return []

    items = await SalesDeliveryItem.filter(
        tenant_id=tenant_id,
        delivery_id__in=list(delivery_ids),
        material_id=material_id,
        deleted_at__isnull=True,
    ).order_by("-id")

    result: List[Dict[str, Any]] = []
    seen_batches: set[str] = set()
    for item in items:
        batch = str(getattr(item, "batch_number", None) or "").strip()
        entry = {
            "batch_number": batch or None,
            "sales_delivery_id": int(item.delivery_id),
            "sales_delivery_item_id": int(item.id),
        }
        if batch:
            if batch in seen_batches:
                continue
            seen_batches.add(batch)
        result.append(entry)
    return result


async def _sum_returned_qty_by_delivery_item_ids(
    tenant_id: int,
    delivery_item_ids: List[int],
) -> Dict[int, float]:
    """按销售出库明细统计已退货数量（含草稿/待退货，占用可退余量）。"""
    if not delivery_item_ids:
        return {}
    return_items = await SalesReturnItem.filter(
        tenant_id=tenant_id,
        sales_delivery_item_id__in=list(delivery_item_ids),
    ).all()
    if not return_items:
        return {}
    return_ids = list({int(ri.return_id) for ri in return_items if ri.return_id})
    active_return_ids: set[int] = set()
    if return_ids:
        returns = await SalesReturn.filter(
            tenant_id=tenant_id,
            id__in=return_ids,
            deleted_at__isnull=True,
        ).all()
        active_return_ids = {int(r.id) for r in returns}
    totals: Dict[int, float] = {}
    for ri in return_items:
        if int(ri.return_id) not in active_return_ids:
            continue
        item_id = int(ri.sales_delivery_item_id or 0)
        if item_id <= 0:
            continue
        totals[item_id] = totals.get(item_id, 0.0) + float(ri.return_quantity or 0)
    return totals


def _coerce_id_str_map(raw: Optional[Dict[Any, Any]]) -> Optional[Dict[int, str]]:
    if not raw:
        return None
    out: Dict[int, str] = {}
    for key, value in raw.items():
        try:
            out[int(key)] = str(value or "").strip()
        except (TypeError, ValueError):
            continue
    return out


def _coerce_id_float_map(raw: Optional[Dict[Any, Any]]) -> Optional[Dict[int, float]]:
    if not raw:
        return None
    out: Dict[int, float] = {}
    for key, value in raw.items():
        try:
            out[int(key)] = float(value)
        except (TypeError, ValueError):
            continue
    return out


def _resolve_outbound_link_for_batch(
    outbound_batches: List[Dict[str, Any]],
    batch_number: Optional[str],
) -> Optional[Dict[str, Any]]:
    """按退货批号匹配原销售出库明细；未指定批号时取最近一条出库明细。"""
    bn = str(batch_number or "").strip()
    if bn:
        for row in outbound_batches:
            if str(row.get("batch_number") or "").strip() == bn:
                return row
        return None
    return outbound_batches[0] if outbound_batches else None


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


_PURCHASE_RECEIPT_VOID_STATUSES = frozenset(
    {"已作废", "作废", "void", "VOID", "cancelled", "CANCELLED"}
)
_PURCHASE_RECEIPT_CONFIRMED_STATUSES = frozenset(
    {"已入库", "已完成", "completed", "COMPLETED"}
)


async def _sum_confirmed_purchase_receipt_qty_for_po_item(
    tenant_id: int,
    purchase_order_item_id: int,
    *,
    exclude_receipt_id: Optional[int] = None,
    extra_pending_qty: Decimal = Decimal("0"),
) -> Decimal:
    """
    统计采购订单行已确认入库数量。
    仅计入已入库/已完成入库单；草稿/待入库不计入，避免重复占用订单余量。
    extra_pending_qty：同一请求内已校验通过、尚未落库的同订单行数量（防一单多行重复累计）。
    """
    total = extra_pending_qty
    historical_items = await PurchaseReceiptItem.filter(
        tenant_id=tenant_id,
        purchase_order_item_id=purchase_order_item_id,
    ).all()
    if not historical_items:
        return total

    receipt_ids = {int(h.receipt_id) for h in historical_items}
    if exclude_receipt_id is not None:
        receipt_ids.discard(int(exclude_receipt_id))
    if not receipt_ids:
        return total

    receipts = await PurchaseReceipt.filter(
        tenant_id=tenant_id,
        id__in=list(receipt_ids),
        deleted_at__isnull=True,
    ).values("id", "status")
    confirmed_receipt_ids: set[int] = set()
    for row in receipts:
        rid = row.get("id")
        if rid is None:
            continue
        status = str(row.get("status") or "").strip()
        if status in _PURCHASE_RECEIPT_VOID_STATUSES:
            continue
        if status in _PURCHASE_RECEIPT_CONFIRMED_STATUSES:
            confirmed_receipt_ids.add(int(rid))

    for historical in historical_items:
        rid = int(historical.receipt_id)
        if rid not in confirmed_receipt_ids:
            continue
        total += Decimal(str(historical.receipt_quantity or 0))
    return total


async def _sum_confirmed_purchase_receipt_qty_by_po_item_ids(
    tenant_id: int,
    purchase_order_item_ids: List[int],
) -> dict[int, Decimal]:
    """批量统计多个采购订单行的已确认入库数量（一次查明细 + 一次查单头）。"""
    result: dict[int, Decimal] = {int(i): Decimal("0") for i in purchase_order_item_ids}
    if not purchase_order_item_ids:
        return result

    historical_items = await PurchaseReceiptItem.filter(
        tenant_id=tenant_id,
        purchase_order_item_id__in=list(result.keys()),
    ).all()
    if not historical_items:
        return result

    receipt_ids = {int(h.receipt_id) for h in historical_items}
    receipts = await PurchaseReceipt.filter(
        tenant_id=tenant_id,
        id__in=list(receipt_ids),
        deleted_at__isnull=True,
    ).values("id", "status")
    confirmed_receipt_ids: set[int] = set()
    for row in receipts:
        rid = row.get("id")
        if rid is None:
            continue
        status = str(row.get("status") or "").strip()
        if status in _PURCHASE_RECEIPT_VOID_STATUSES:
            continue
        if status in _PURCHASE_RECEIPT_CONFIRMED_STATUSES:
            confirmed_receipt_ids.add(int(rid))

    for historical in historical_items:
        rid = int(historical.receipt_id)
        if rid not in confirmed_receipt_ids:
            continue
        po_item_id = int(historical.purchase_order_item_id)
        if po_item_id not in result:
            continue
        result[po_item_id] += Decimal(str(historical.receipt_quantity or 0))
    return result


async def _sum_pending_purchase_receipt_qty_for_po_item(
    tenant_id: int,
    purchase_order_item_id: int,
    *,
    exclude_receipt_id: Optional[int] = None,
) -> Decimal:
    """统计采购订单行被其他未完成入库单占用的数量（草稿/待入库，不含已入库与作废）。"""
    historical_items = await PurchaseReceiptItem.filter(
        tenant_id=tenant_id,
        purchase_order_item_id=purchase_order_item_id,
    ).all()
    if not historical_items:
        return Decimal("0")

    receipt_ids = {int(h.receipt_id) for h in historical_items}
    if exclude_receipt_id is not None:
        receipt_ids.discard(int(exclude_receipt_id))
    if not receipt_ids:
        return Decimal("0")

    receipts = await PurchaseReceipt.filter(
        tenant_id=tenant_id,
        id__in=list(receipt_ids),
        deleted_at__isnull=True,
    ).values("id", "status")
    pending_receipt_ids: set[int] = set()
    for row in receipts:
        rid = row.get("id")
        if rid is None:
            continue
        status = str(row.get("status") or "").strip()
        if status in _PURCHASE_RECEIPT_VOID_STATUSES:
            continue
        if status in _PURCHASE_RECEIPT_CONFIRMED_STATUSES:
            continue
        pending_receipt_ids.add(int(rid))

    total = Decimal("0")
    for historical in historical_items:
        rid = int(historical.receipt_id)
        if rid not in pending_receipt_ids:
            continue
        total += Decimal(str(historical.receipt_quantity or 0))
    return total


async def occupied_purchase_receipt_qty_by_po_item_ids(
    tenant_id: int,
    order_ids: List[int],
) -> dict[int, Decimal]:
    """
    统计采购订单行被未完成入库单占用的数量（草稿/待入库等，不含已入库与作废）。
    对齐销售出库下推预览：避免重复下推生成多张占用同一余量的入库草稿。
    除表头 purchase_order_id 外，亦按明细 purchase_order_item_id 关联，避免表头丢链后重复下推。
    """
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

    if not order_ids:
        return {}

    po_item_ids = [
        int(x)
        for x in await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id__in=order_ids,
        ).values_list("id", flat=True)
    ]
    if not po_item_ids:
        return {}

    receipt_id_set: set[int] = set()
    header_rows = await PurchaseReceipt.filter(
        tenant_id=tenant_id,
        purchase_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values("id", "status")
    item_linked_rows = await PurchaseReceiptItem.filter(
        tenant_id=tenant_id,
        purchase_order_item_id__in=po_item_ids,
    ).values_list("receipt_id", flat=True)
    receipt_id_set.update(int(x) for x in item_linked_rows if x is not None)

    status_by_receipt_id: dict[int, str] = {}
    for row in header_rows:
        rid = row.get("id")
        if rid is None:
            continue
        receipt_id_set.add(int(rid))
        status_by_receipt_id[int(rid)] = str(row.get("status") or "").strip()

    missing_ids = receipt_id_set - set(status_by_receipt_id)
    if missing_ids:
        extra_rows = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            id__in=list(missing_ids),
            deleted_at__isnull=True,
        ).values("id", "status")
        for row in extra_rows:
            rid = row.get("id")
            if rid is None:
                continue
            status_by_receipt_id[int(rid)] = str(row.get("status") or "").strip()

    occupying_receipt_ids: List[int] = []
    for rid in receipt_id_set:
        status = status_by_receipt_id.get(rid, "")
        if status in _PURCHASE_RECEIPT_VOID_STATUSES:
            continue
        if status in _PURCHASE_RECEIPT_CONFIRMED_STATUSES:
            continue
        occupying_receipt_ids.append(rid)

    if not occupying_receipt_ids:
        return {}

    occupied_by_po_item: dict[int, Decimal] = {}
    item_rows = await PurchaseReceiptItem.filter(
        tenant_id=tenant_id,
        receipt_id__in=occupying_receipt_ids,
        purchase_order_item_id__in=po_item_ids,
    ).values("purchase_order_item_id", "receipt_quantity")
    for row in item_rows:
        po_item_id = int(row.get("purchase_order_item_id") or 0)
        if po_item_id <= 0:
            continue
        qty = Decimal(str(row.get("receipt_quantity") or 0))
        if qty <= 0:
            continue
        occupied_by_po_item[po_item_id] = occupied_by_po_item.get(po_item_id, Decimal("0")) + qty
    return occupied_by_po_item


_RECEIPT_NOTICE_VOID_STATUSES = frozenset({"已取消", "cancelled", "CANCELLED"})


async def noticed_qty_by_po_item_ids(
    tenant_id: int,
    order_ids: List[int],
) -> dict[int, Decimal]:
    """
    统计采购订单行已被有效收货通知占用的数量（未删除、非取消的通知单明细合计）。
    用于分批下推收货通知时扣减已通知量。
    """
    from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
    from apps.kuaizhizao.models.receipt_notice_item import ReceiptNoticeItem

    if not order_ids:
        return {}

    notices = await ReceiptNotice.filter(
        tenant_id=tenant_id,
        purchase_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values("id", "status")
    active_notice_ids: List[int] = []
    for row in notices:
        nid = row.get("id")
        if nid is None:
            continue
        status = str(row.get("status") or "").strip()
        if status in _RECEIPT_NOTICE_VOID_STATUSES:
            continue
        active_notice_ids.append(int(nid))
    if not active_notice_ids:
        return {}

    noticed_by_po_item: dict[int, Decimal] = {}
    item_rows = await ReceiptNoticeItem.filter(
        tenant_id=tenant_id,
        notice_id__in=active_notice_ids,
    ).values("purchase_order_item_id", "notice_quantity")
    for row in item_rows:
        po_item_id = int(row.get("purchase_order_item_id") or 0)
        if po_item_id <= 0:
            continue
        qty = Decimal(str(row.get("notice_quantity") or 0))
        if qty <= 0:
            continue
        noticed_by_po_item[po_item_id] = noticed_by_po_item.get(po_item_id, Decimal("0")) + qty
    return noticed_by_po_item


async def sync_purchase_order_receipt_quantities(
    tenant_id: int,
    purchase_order_id: int,
) -> None:
    """
    按已确认采购入库单回写采购订单行的已到货/未到货数量。

    避免入库确认后 PO 行 outstanding 未更新，导致重复下推入库触发容差校验失败。
    """
    if not purchase_order_id:
        return

    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

    order_items = await PurchaseOrderItem.filter(
        tenant_id=tenant_id,
        order_id=purchase_order_id,
    ).all()
    if not order_items:
        return

    confirmed_by_item = await _sum_confirmed_purchase_receipt_qty_by_po_item_ids(
        tenant_id,
        [int(po_item.id) for po_item in order_items],
    )
    for po_item in order_items:
        confirmed_qty = confirmed_by_item.get(int(po_item.id), Decimal("0"))
        ordered = Decimal(str(po_item.ordered_quantity or 0))
        received = min(confirmed_qty, ordered) if ordered > 0 else confirmed_qty
        outstanding = max(ordered - received, Decimal("0"))
        current_received = Decimal(str(po_item.received_quantity or 0))
        current_outstanding = Decimal(str(po_item.outstanding_quantity or 0))
        if current_received != received or current_outstanding != outstanding:
            await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                id=po_item.id,
            ).update(
                received_quantity=received,
                outstanding_quantity=outstanding,
            )


def _validate_purchase_receipt_tolerance(
    ordered_quantity: Decimal,
    already_received_quantity: Decimal,
    incoming_quantity: Decimal,
    tolerance_percentage: float,
    material_label: str,
    *,
    confirmed_quantity: Optional[Decimal] = None,
    pending_other_quantity: Optional[Decimal] = None,
) -> None:
    """校验采购入库是否超过配置容差。"""
    if ordered_quantity <= 0:
        return
    tolerance_ratio = Decimal(str(max(0.0, tolerance_percentage))) / Decimal("100")
    max_receivable = ordered_quantity * (Decimal("1") + tolerance_ratio)
    after_receipt = already_received_quantity + incoming_quantity
    if after_receipt > max_receivable:
        detail_parts: List[str] = []
        if confirmed_quantity is not None and confirmed_quantity > 0:
            detail_parts.append(f"已确认入库 {confirmed_quantity}")
        if pending_other_quantity is not None and pending_other_quantity > 0:
            detail_parts.append(f"其他待入库占用 {pending_other_quantity}")
        detail_parts.append(f"本次入库 {incoming_quantity}")
        detail_suffix = f"（{'，'.join(detail_parts)}）" if detail_parts else ""
        raise BusinessLogicError(
            f"采购入库超容差：物料 {material_label} 入库后累计 {after_receipt}，"
            f"超过允许上限 {max_receivable}（订单数量 {ordered_quantity}，容差 {tolerance_percentage}%）"
            f"{detail_suffix}。请检查是否已有其他采购入库单占用了该采购订单行。"
        )


async def _assert_purchase_receipt_tolerance_for_po_item(
    tenant_id: int,
    purchase_order_item_id: int,
    incoming_quantity: Decimal,
    tolerance_percentage: float,
    material_label: str,
    *,
    exclude_receipt_id: Optional[int] = None,
    extra_pending_qty: Decimal = Decimal("0"),
) -> None:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

    po_item = await PurchaseOrderItem.filter(
        tenant_id=tenant_id,
        id=purchase_order_item_id,
        deleted_at__isnull=True,
    ).select_for_update().first()
    if not po_item:
        raise ValidationError(f"采购订单明细不存在: {purchase_order_item_id}")

    confirmed_qty = await _sum_confirmed_purchase_receipt_qty_for_po_item(
        tenant_id,
        purchase_order_item_id,
        exclude_receipt_id=exclude_receipt_id,
    )
    pending_other_qty = await _sum_pending_purchase_receipt_qty_for_po_item(
        tenant_id,
        purchase_order_item_id,
        exclude_receipt_id=exclude_receipt_id,
    )
    committed_qty = confirmed_qty + pending_other_qty + extra_pending_qty
    _validate_purchase_receipt_tolerance(
        ordered_quantity=Decimal(str(po_item.ordered_quantity or 0)),
        already_received_quantity=committed_qty,
        incoming_quantity=incoming_quantity,
        tolerance_percentage=tolerance_percentage,
        material_label=material_label,
        confirmed_quantity=confirmed_qty,
        pending_other_quantity=pending_other_qty + extra_pending_qty,
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


# 工单下推拦截：未完结的生产领料（含待审核）
_PRODUCTION_PICKING_OPEN_STATUSES = frozenset({
    "待领料", "待审核", "草稿", "draft", "pending",
})


class ProductionPickingService(AppBaseService[ProductionPicking]):
    """生产领料单服务"""

    def __init__(self):
        super().__init__(ProductionPicking)

    async def _resolve_picking_create_status(self, tenant_id: int) -> tuple[str, str]:
        """创建时初始业务态/审核态（与 sales_delivery 一致：开审核→待审核，否则→待领料+已通过）。"""
        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "production_picking"
        )
        if audit_required:
            return "待审核", "待审核"
        return "待领料", "已通过"

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

    async def _get_user_functional_domains(self, user_id: int) -> set[str]:
        user = await User.get_or_none(id=user_id, deleted_at__isnull=True).prefetch_related("roles")
        if not user:
            return set()
        domains: set[str] = set()
        for role in getattr(user, "roles", []) or []:
            raw = getattr(role, "functional_domain", None)
            if not raw:
                continue
            normalized = str(raw).strip().lower()
            if normalized:
                domains.add(normalized)
        return domains

    async def _user_bypasses_picking_confirm_role_policy(self, tenant_id: int, user_id: int) -> bool:
        from core.services.authorization.user_permission_service import UserPermissionService

        user = await User.get_or_none(id=user_id, deleted_at__isnull=True)
        if not user:
            return False
        return await UserPermissionService.is_admin_bypass(user, tenant_id)

    def _picking_confirm_allowed_by_role_policy(
        self,
        policy: Dict[str, Any],
        user_role_codes: set[str],
        user_functional_domains: set[str],
    ) -> bool:
        """职能域优先；角色码白名单为补充（与 business_config 解析结果一致）。"""
        warehouse_only = bool(policy.get("picking_confirm_warehouse_only", True))
        allowed_role_codes = set(policy.get("effective_allowed_role_codes") or [])
        allowed_domains = set(policy.get("effective_allowed_functional_domains") or [])

        if not warehouse_only and not allowed_role_codes and not allowed_domains:
            return True

        domain_ok = bool(allowed_domains) and bool(user_functional_domains & allowed_domains)
        code_ok = bool(allowed_role_codes) and bool(user_role_codes & allowed_role_codes)
        return domain_ok or code_ok

    async def _assert_can_confirm_picking(self, tenant_id: int, user_id: int) -> None:
        if await self._user_bypasses_picking_confirm_role_policy(tenant_id, user_id):
            return
        policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
        user_role_codes = await self._get_user_role_codes(user_id)
        user_functional_domains = await self._get_user_functional_domains(user_id)

        if not self._picking_confirm_allowed_by_role_policy(
            policy,
            user_role_codes,
            user_functional_domains,
        ):
            mode_text = (
                "仅仓库角色可确认"
                if policy.get("picking_confirm_warehouse_only", True)
                else "角色未在允许名单"
            )
            raise BusinessLogicError(f"无权限确认领料：{mode_text}")

    async def can_user_confirm_picking(
        self,
        tenant_id: int,
        user_id: int,
    ) -> tuple[bool, set[str], set[str]]:
        user_role_codes = await self._get_user_role_codes(user_id)
        user_functional_domains = await self._get_user_functional_domains(user_id)
        if await self._user_bypasses_picking_confirm_role_policy(tenant_id, user_id):
            return True, user_role_codes, user_functional_domains
        policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
        allowed = self._picking_confirm_allowed_by_role_policy(
            policy,
            user_role_codes,
            user_functional_domains,
        )
        return allowed, user_role_codes, user_functional_domains

    async def create_production_picking(self, tenant_id: int, picking_data: ProductionPickingCreate, created_by: int) -> ProductionPickingResponse:
        """创建生产领料单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = today_site_str()
            code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")
            initial_status, initial_review = await self._resolve_picking_create_status(tenant_id)
            payload = picking_data.model_dump(exclude_unset=True, exclude={"created_by"})
            payload["status"] = initial_status
            payload["review_status"] = initial_review

            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
                **payload,
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
        from apps.kuaizhizao.services.document_lifecycle_service import get_production_picking_lifecycle

        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        items = await ProductionPickingItem.filter(tenant_id=tenant_id, picking_id=picking_id).all()
        resp = ProductionPickingWithItemsResponse.model_validate(picking)
        resp.lifecycle = get_production_picking_lifecycle(picking)
        resp.items = [_build_production_picking_item_response(i) for i in items]
        wh_id, wh_name = _aggregate_warehouse_from_picking_item_rows(
            [
                {
                    "warehouse_id": getattr(i, "warehouse_id", None),
                    "warehouse_name": getattr(i, "warehouse_name", None),
                }
                for i in items
            ]
        )
        resp.warehouse_id = wh_id
        resp.warehouse_name = wh_name
        from core.services.approval.audit_record_enricher import audit_enabled_for, enrich_record

        audit_required = await audit_enabled_for(tenant_id, "production_picking")
        return await enrich_record(
            tenant_id, "production_picking", resp, audit_enabled=audit_required
        )

    async def list_production_pickings(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ProductionPickingListResponse]:
        """获取生产领料单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import (
            PRODUCTION_PICKING_KEYWORD_FIELDS,
            PRODUCTION_PICKING_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query = ProductionPicking.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])
        if filters.get("warehouse_id"):
            wh_picking_ids = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                warehouse_id=filters["warehouse_id"],
            ).values_list("picking_id", flat=True)
            query = query.filter(id__in=list({int(x) for x in wh_picking_ids}))
        warehouse_name = (filters.get("warehouse_name") or "").strip()
        if warehouse_name:
            wh_picking_ids = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                warehouse_name__icontains=warehouse_name,
            ).values_list("picking_id", flat=True)
            query = query.filter(id__in=list({int(x) for x in wh_picking_ids}))

        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            allowed_fields=PRODUCTION_PICKING_SORTABLE_FIELDS,
            default_order="-created_at",
            keyword_fields=PRODUCTION_PICKING_KEYWORD_FIELDS,
            doc_date_field="picking_time",
            doc_start_date=filters.get("picking_start_date"),
            doc_end_date=filters.get("picking_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        pickings = await query.offset(skip).limit(limit).order_by(order_clause)
        from tortoise.functions import Count, Sum
        from apps.kuaizhizao.services.document_action_policy.enricher import enrich_outbound_hub_list_capabilities
        from apps.kuaizhizao.services.document_lifecycle_service import get_production_picking_lifecycle

        picking_ids = [int(p.id) for p in pickings]
        qty_by_id: Dict[int, Dict[str, float]] = {}
        warehouse_by_id: Dict[int, Dict[str, Any]] = {}
        if picking_ids:
            agg_rows = await (
                ProductionPickingItem.filter(tenant_id=tenant_id, picking_id__in=picking_ids)
                .group_by("picking_id")
                .annotate(
                    c=Count("id"),
                    req=Sum("required_quantity"),
                    picked=Sum("picked_quantity"),
                )
                .values("picking_id", "c", "req", "picked")
            )
            for row in agg_rows:
                pid = int(row["picking_id"])
                req_total = float(row.get("req") or 0)
                picked_total = float(row.get("picked") or 0)
                qty_by_id[pid] = {
                    "total_items": int(row.get("c") or 0),
                    "required_quantity_total": req_total,
                    "picked_quantity_total": picked_total,
                    # 列表总数量取应领合计；加载创建时 issue_quantity 写入 required_quantity
                    "total_quantity": req_total,
                }
            wh_rows = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                picking_id__in=picking_ids,
            ).values("picking_id", "warehouse_id", "warehouse_name")
            wh_grouped: Dict[int, List[Dict[str, Any]]] = {}
            for wh_row in wh_rows:
                pid = int(wh_row["picking_id"])
                wh_grouped.setdefault(pid, []).append(wh_row)
            for pid, rows_for_pid in wh_grouped.items():
                wh_id, wh_name = _aggregate_warehouse_from_picking_item_rows(rows_for_pid)
                warehouse_by_id[pid] = {
                    "warehouse_id": wh_id,
                    "warehouse_name": wh_name,
                }

        list_rows: List[ProductionPickingListResponse] = []
        for picking in pickings:
            resp = ProductionPickingListResponse.model_validate(picking)
            # 列表与详情共用生命周期计算，避免出库 Hub 列表显示「生命周期缺失」
            resp.lifecycle = get_production_picking_lifecycle(picking, milestones=[])
            list_rows.append(resp)
        rows = enrich_outbound_hub_list_capabilities(
            pickings,
            list_rows,
            "production_picking",
            item_counts={pid: v["total_items"] for pid, v in qty_by_id.items()},
        )
        enriched_qty: List[ProductionPickingListResponse] = []
        for picking, row in zip(pickings, rows):
            pid = int(picking.id)
            stats = qty_by_id.get(pid, {
                "total_items": 0,
                "required_quantity_total": 0.0,
                "picked_quantity_total": 0.0,
                "total_quantity": 0.0,
            })
            wh = warehouse_by_id.get(pid, {"warehouse_id": None, "warehouse_name": None})
            enriched_qty.append(row.model_copy(update={**stats, **wh}))
        rows = enriched_qty

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
                rows = enriched

        if rows:
            from core.services.approval.audit_record_enricher import audit_enabled_for, enrich_items

            audit_required = await audit_enabled_for(tenant_id, "production_picking")
            rows = await enrich_items(
                tenant_id, "production_picking", rows, audit_enabled=audit_required
            )
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

        if picking.status not in ["待领料", "待审核", "草稿", "draft", "已取消"]:
            raise BusinessLogicError("只能删除未确认出库或已取消的生产领料单")

        await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
            is_active=False,
            deleted_at=resolve_business_datetime()
        )
        return True

    async def submit_production_picking(
        self,
        tenant_id: int,
        picking_id: int,
        submitted_by: int,
    ) -> ProductionPickingResponse:
        picking = await ProductionPicking.get_or_none(
            id=picking_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        status = str(picking.status or "").strip()
        if status == "待审核":
            return await self.get_production_picking_by_id(tenant_id, picking_id)

        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "production_picking"
        )
        if not audit_required:
            submitter_name = await self.get_user_name(submitted_by)
            await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
                status="待领料",
                review_status="已通过",
                reviewer_id=submitted_by,
                reviewer_name=submitter_name,
                review_time=resolve_business_datetime(),
                updated_by=submitted_by,
            )
            return await self.get_production_picking_by_id(tenant_id, picking_id)

        if status not in ("草稿", "待领料", "draft"):
            raise BusinessLogicError(f"当前状态不可提交审核: {status or '-'}")

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="production_picking",
            entity_type="production_picking",
            entity_id=picking.id,
            entity_uuid=str(picking.uuid),
            title=f"生产领料审批: {picking.picking_code}",
            content=f"工单: {picking.work_order_code}",
        )
        if not instance:
            raise BusinessLogicError(
                "生产领料审核已开启但未找到可用的审批流程，请在配置中心检查 production_picking 审批流程是否已激活"
            )
        await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
            status="待审核",
            review_status="待审核",
            updated_by=submitted_by,
        )
        return await self.get_production_picking_by_id(tenant_id, picking_id)

    async def approve_production_picking(
        self,
        tenant_id: int,
        picking_id: int,
        approver_id: int,
    ) -> ProductionPickingResponse:
        picking = await ProductionPicking.get_or_none(
            id=picking_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        status = str(picking.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能审核待审核状态的生产领料单，当前: {status or '-'}")
        approver_name = await self.get_user_name(approver_id)
        await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
            status="待领料",
            review_status="已通过",
            reviewer_id=approver_id,
            reviewer_name=approver_name,
            review_time=resolve_business_datetime(),
            updated_by=approver_id,
        )
        return await self.get_production_picking_by_id(tenant_id, picking_id)

    async def reject_production_picking(
        self,
        tenant_id: int,
        picking_id: int,
        approver_id: int,
        *,
        rejection_reason: Optional[str] = None,
    ) -> ProductionPickingResponse:
        picking = await ProductionPicking.get_or_none(
            id=picking_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        status = str(picking.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能驳回待审核状态的生产领料单，当前: {status or '-'}")
        await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
            status="草稿",
            review_status="已驳回",
            review_remarks=rejection_reason,
            updated_by=approver_id,
        )
        return await self.get_production_picking_by_id(tenant_id, picking_id)

    async def withdraw_production_picking_submit(
        self,
        tenant_id: int,
        picking_id: int,
        operator_id: int,
    ) -> ProductionPickingResponse:
        picking = await ProductionPicking.get_or_none(
            id=picking_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        status = str(picking.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能撤回待审核状态的生产领料单，当前: {status or '-'}")
        from core.services.approval.approval_instance_service import ApprovalInstanceService

        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type="production_picking",
            entity_id=picking_id,
            operator_id=operator_id,
        )
        await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
            status="草稿",
            review_status="待审核",
            updated_by=operator_id,
        )
        return await self.get_production_picking_by_id(tenant_id, picking_id)

    async def revoke_production_picking_approval(
        self,
        tenant_id: int,
        picking_id: int,
        operator_id: int,
    ) -> ProductionPickingResponse:
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService

        picking = await ProductionPicking.get_or_none(
            id=picking_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        status = str(picking.status or "").strip()
        if status != "待领料":
            raise BusinessLogicError(f"当前状态不可撤销审核: {status or '-'}")
        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "production_picking"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        target_status = "待审核" if landing == "pending" else "草稿"

        async def _do_revoke() -> ProductionPickingResponse:
            await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
                status=target_status,
                review_status="待审核",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                updated_by=operator_id,
            )
            return await self.get_production_picking_by_id(tenant_id, picking_id)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="production_picking",
            entity_id=picking_id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )

    async def confirm_picking(
        self,
        tenant_id: int,
        picking_id: int,
        confirmed_by: int,
        confirmation_data: Optional[OutboundConfirmationRequest] = None,
    ) -> ProductionPickingResponse:
        """确认领料"""
        async with in_transaction():
            await self._assert_can_confirm_picking(tenant_id=tenant_id, user_id=confirmed_by)
            picking = await self.get_production_picking_by_id(tenant_id, picking_id)

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(picking, "confirm", outbound_type="production_picking")

            if picking.status != '待领料':
                raise BusinessLogicError("只有待领料状态的生产领料单才能确认领料")

            if confirmation_data:
                update_dict = {}
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                if update_dict:
                    await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(**update_dict)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        if item_data.warehouse_id:
                            item_update["warehouse_id"] = item_data.warehouse_id
                            item_update["warehouse_name"] = await _resolve_warehouse_name_by_id(
                                tenant_id,
                                item_data.warehouse_id,
                                item_data.warehouse_name,
                            )
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.serial_numbers is not None:
                            item_update["serial_numbers"] = json.dumps(item_data.serial_numbers)
                        if item_update:
                            await ProductionPickingItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, picking_id=picking_id
                            ).update(**item_update)

            confirmer_name = await self.get_user_name(confirmed_by)
            picking_time = resolve_business_datetime(
                confirmation_data.delivery_time if confirmation_data and confirmation_data.delivery_time else None
            )

            # 更新库存（正式发料扣减）及其前置的【防超发拦截】；成功后再回写表头/明细
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService
                from apps.kuaizhizao.utils.picking_posting import (
                    filter_gi_picking_ids,
                    is_staging_transfer_picking_notes,
                )
                from apps.master_data.models.material import Material

                picking_items = await ProductionPickingItem.filter(
                    tenant_id=tenant_id, picking_id=picking_id
                ).all()
                picking = await ProductionPicking.get(tenant_id=tenant_id, id=picking_id)
                if is_staging_transfer_picking_notes(getattr(picking, "notes", None)):
                    raise BusinessLogicError(
                        "该领料单为历史备料转移单据（主仓→线边），不可再按正式发料确认；"
                        "请使用线边备料单/补料完成备料，或新建生产领料单发料"
                    )

                # 本期实发数量：优先已填 picked_quantity，否则按需求数量
                issue_qty_by_item_id = {}
                for item in picking_items:
                    qty = item.picked_quantity if item.picked_quantity and item.picked_quantity > 0 else (
                        item.required_quantity or Decimal(0)
                    )
                    issue_qty_by_item_id[item.id] = qty

                # 防超发：仅累计正式发料领料单（排除备料转移型）
                if picking.work_order_id:
                    from apps.kuaizhizao.models.work_order import WorkOrder
                    from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
                    from tortoise.functions import Sum
                    wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=picking.work_order_id)
                    if wo:
                        try:
                            reqs = await calculate_material_requirements_from_bom(
                                tenant_id=tenant_id,
                                material_id=wo.product_id,
                                required_quantity=float(wo.quantity),
                                only_approved=True
                            )
                            limit_map = {r.component_id: r.gross_requirement for r in reqs}

                            past_pickings = await ProductionPicking.filter(
                                tenant_id=tenant_id,
                                work_order_id=picking.work_order_id,
                                deleted_at__isnull=True,
                                status="已领料",
                            ).all()
                            wo_pid_list = [
                                pid for pid in filter_gi_picking_ids(past_pickings)
                                if pid != picking_id
                            ]
                            if not wo_pid_list:
                                past_items = []
                            else:
                                past_items = await ProductionPickingItem.filter(
                                    tenant_id=tenant_id,
                                    picking_id__in=wo_pid_list,
                                    status__in=["已领料", "已确认", "picked", "confirmed"],
                                ).group_by("material_id").annotate(
                                    total_picked=Sum("picked_quantity")
                                ).values("material_id", "total_picked")
                            past_map = {
                                item["material_id"]: item["total_picked"] or 0
                                for item in past_items
                            }

                            current_map = {}
                            for item in picking_items:
                                qty = issue_qty_by_item_id.get(item.id) or Decimal(0)
                                current_map[item.material_id] = (
                                    current_map.get(item.material_id, 0) + float(qty)
                                )

                            for mat_id, current_qty in current_map.items():
                                past_qty = float(past_map.get(mat_id, 0))
                                total_attempt = past_qty + current_qty
                                allowed = limit_map.get(mat_id)
                                if allowed is not None:
                                    if total_attempt > float(allowed) * 1.01:
                                        raise BusinessLogicError(
                                            f"防超发拦截生效：物料[ID:{mat_id}]试图总领用量({total_attempt:.2f}) "
                                            f"超出了当前工单配方上限额度({float(allowed):.2f})，禁止强行出库！"
                                        )
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
                material_ids = list({it.material_id for it in picking_items if getattr(it, "material_id", None)})
                materials = await Material.filter(
                    tenant_id=tenant_id,
                    id__in=material_ids,
                    deleted_at__isnull=True,
                ).all() if material_ids else []
                material_by_id = {m.id: m for m in materials}
                for item in picking_items:
                    qty = issue_qty_by_item_id.get(item.id) or Decimal(0)
                    if qty <= 0:
                        continue
                    mat = material_by_id.get(item.material_id)
                    if mat:
                        await _validate_batch_serial_policy(
                            tenant_id=tenant_id,
                            material=mat,
                            batch_number=getattr(item, "batch_number", None),
                            serial_numbers=_parse_serial_numbers(getattr(item, "serial_numbers", None)),
                            quantity=qty,
                            scene="生产领料确认",
                        )
                for item in picking_items:
                    qty = issue_qty_by_item_id.get(item.id) or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="production_picking",
                        source_doc_id=picking_id,
                        source_doc_code=picking.picking_code,
                        enforce_fifo=enforce_fifo,
                        work_order_id=picking.work_order_id,
                        work_order_code=picking.work_order_code,
                        movement_type="production_issue",
                        from_warehouse_id=wh_id,
                        idempotency_key=f"production_picking:{picking_id}:dec:{item.id}",
                    )
                    required = item.required_quantity or Decimal(0)
                    remaining = required - qty
                    if remaining < 0:
                        remaining = Decimal(0)
                    await ProductionPickingItem.filter(
                        tenant_id=tenant_id, id=item.id, picking_id=picking_id
                    ).update(
                        picked_quantity=qty,
                        remaining_quantity=remaining,
                        status="已领料",
                        picking_time=picking_time,
                    )

                await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
                    status="已领料",
                    picker_id=confirmed_by,
                    picker_name=confirmer_name,
                    picking_time=picking_time,
                    updated_by=confirmed_by,
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

    async def withdraw_picking_confirmation(
        self,
        tenant_id: int,
        picking_id: int,
        updated_by: int,
    ) -> ProductionPickingResponse:
        """撤回生产领料确认（库存回冲并恢复待领料）。"""
        async with in_transaction():
            picking = await self.get_production_picking_by_id(tenant_id, picking_id)

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(picking, "withdraw", outbound_type="production_picking")

            if picking.status != "已领料":
                raise BusinessLogicError("只有已领料状态的生产领料单才能撤回领料")

            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                picking_obj = await ProductionPicking.get(tenant_id=tenant_id, id=picking_id)
                items = await ProductionPickingItem.filter(
                    tenant_id=tenant_id, picking_id=picking_id
                ).all()
                for item in items:
                    qty = item.picked_quantity if item.picked_quantity and item.picked_quantity > 0 else (
                        item.required_quantity or Decimal(0)
                    )
                    if qty <= 0:
                        continue
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService.increase_stock(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="production_picking_withdraw",
                        source_doc_id=picking_id,
                        source_doc_code=picking_obj.picking_code,
                        work_order_id=picking_obj.work_order_id,
                        work_order_code=picking_obj.work_order_code,
                        movement_type="production_issue",
                        to_warehouse_id=wh_id,
                        remark="撤回生产领料",
                        idempotency_key=f"production_picking:{picking_id}:withdraw:{item.id}",
                    )
                    required = item.required_quantity or Decimal(0)
                    await ProductionPickingItem.filter(
                        tenant_id=tenant_id, id=item.id, picking_id=picking_id
                    ).update(
                        picked_quantity=Decimal(0),
                        remaining_quantity=required,
                        status="待领料",
                        picking_time=None,
                    )

                await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
                    status="待领料",
                    picker_id=None,
                    picker_name=None,
                    picking_time=None,
                    updated_by=updated_by,
                )
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回生产领料确认-库存回冲失败: %s", e)
                raise BusinessLogicError(f"撤回失败: {str(e)}")

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
                        "撤回领料后工单 %s 打分重算投递失败: %s",
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

            from apps.kuaizhizao.services.document_action_policy.work_order import (
                assert_work_order_capability,
            )
            from apps.kuaizhizao.services.document_action_policy.types import CAPABILITY_REASON_MESSAGES

            assert_work_order_capability(work_order, "push_production_picking")

            pending_picking = await ProductionPicking.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
                status__in=list(_PRODUCTION_PICKING_OPEN_STATUSES),
            ).first()
            if pending_picking:
                raise BusinessLogicError(
                    CAPABILITY_REASON_MESSAGES.get(
                        "work_order.push_production_picking.pending_picking",
                        "已存在待领料单，请先处理后再下推",
                    )
                )
            
            # 检查工单状态
            if work_order.status not in ['已下达', '进行中', 'released', 'in_progress']:
                raise BusinessLogicError(f"工单状态为 {work_order.status}，无法创建领料单")
            
            # 2. 从master_data获取产品的BOM并计算物料需求
            # 领料只发一阶物料：自制/委外子件走各自工单或库存，不拆子 BOM
            # （多阶展开会把半成品与其原材料同时列入领料需求，导致双重扣料）
            try:
                material_requirements = await calculate_material_requirements_from_bom(
                    tenant_id=tenant_id,
                    material_id=work_order.product_id,
                    required_quantity=float(work_order.quantity),
                    only_approved=True,
                    for_kitting_analysis=True,
                )
            except NotFoundError as e:
                raise NotFoundError(f"产品 {work_order.product_code} 的BOM不存在或未审核: {e}")
            
            if not material_requirements:
                raise ValidationError("BOM中没有物料明细，无法生成领料单")

            # 领料清单仅含事前领料 (pick)；倒冲由报工从线边扣，不进领料单
            from apps.kuaizhizao.utils.issue_method_resolver import is_pick_list_material

            material_requirements = [
                req
                for req in material_requirements
                if is_pick_list_material(
                    getattr(req, "issue_method", None),
                    getattr(req, "component_type", None),
                )
            ]
            if not material_requirements:
                raise ValidationError("BOM中没有需事前领料的物料明细（倒冲/不发料不进领料单），无法生成领料单")

            if not warehouse_id and not str(warehouse_name or "").strip():
                raise ValidationError("请指定出库仓库后再生成领料单")

            resolved_wh_id, resolved_wh_name = await _resolve_warehouse_identity(
                tenant_id,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
            )

            # 4. 生成领料单编码
            today = today_site_str()
            picking_code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")
            user_info = await self.get_user_info(created_by)
            
            # 5. 创建生产领料单
            initial_status, initial_review = await self._resolve_picking_create_status(tenant_id)
            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=picking_code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                workshop_id=work_order.workshop_id,
                workshop_name=work_order.workshop_name,
                status=initial_status,
                review_status=initial_review,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )
            
            # 6. 创建领料单明细（须至少一行，禁止空头单据）
            created_item_count = 0
            for req in material_requirements:
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
                    warehouse_id=resolved_wh_id,
                    warehouse_name=resolved_wh_name or '',
                    status='待领料'
                )
                created_item_count += 1

            if created_item_count <= 0:
                raise ValidationError("未能生成领料明细，请检查 BOM 事前领料物料后重试")

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

    async def preview_push_work_order_to_production_picking(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> Dict[str, Any]:
        """工单下推生产领料预览：齐套明细的需求/已领/可领数量，不创建领料单。"""
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            assert_work_order_capability,
        )
        from apps.kuaizhizao.services.document_action_policy.types import CAPABILITY_REASON_MESSAGES

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        assert_work_order_capability(work_order, "push_production_picking")

        pending_picking = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status__in=list(_PRODUCTION_PICKING_OPEN_STATUSES),
        ).first()

        from apps.kuaizhizao.utils.issue_method_resolver import is_pick_list_material

        kitting = await WorkOrderService().get_work_order_kitting_analysis(tenant_id, work_order_id)
        from apps.master_data.models.material import Material

        material_ids = [
            int(getattr(item, "material_id", 0) or 0)
            for item in kitting.items or []
            if int(getattr(item, "material_id", 0) or 0) > 0
            and not str(getattr(item, "material_unit", "") or "").strip()
        ]
        unit_by_material: Dict[int, str] = {}
        if material_ids:
            mats = await Material.filter(
                tenant_id=tenant_id,
                id__in=list(set(material_ids)),
                deleted_at__isnull=True,
            ).all()
            unit_by_material = {
                int(m.id): str(getattr(m, "base_unit", "") or "个").strip() or "个"
                for m in mats
            }

        preview_items: List[Dict[str, Any]] = []
        for item in kitting.items or []:
            # 可领范围只看发料方式（pick），与齐套率分母 kitting_applicable 解耦
            if not is_pick_list_material(
                getattr(item, "issue_method", None),
                getattr(item, "source_type", None),
            ):
                continue
            required_qty = Decimal(str(getattr(item, "required_quantity", 0) or 0))
            if required_qty <= 0:
                continue
            picked_qty = Decimal(str(getattr(item, "picked_quantity", 0) or 0))
            # 正式领料可领量 = 需求 − 已正式发料；与厂库 shortage 无关（线边已备仍可领）
            max_push_qty = required_qty - picked_qty
            if max_push_qty < 0:
                max_push_qty = Decimal("0")
            material_id = int(getattr(item, "material_id", 0) or 0)
            material_unit = str(getattr(item, "material_unit", "") or "").strip()
            if not material_unit and material_id in unit_by_material:
                material_unit = unit_by_material[material_id]
            if not material_unit:
                material_unit = "个"
            preview_items.append(
                {
                    "item_id": material_id,
                    "material_code": str(getattr(item, "material_code", "") or ""),
                    "material_name": str(getattr(item, "material_name", "") or ""),
                    "material_unit": material_unit,
                    "quantity": float(required_qty),
                    "pushed_quantity": float(picked_qty),
                    "max_push_quantity": float(max_push_qty),
                }
            )

        blocking_reason: Optional[str] = None
        if pending_picking:
            blocking_reason = CAPABILITY_REASON_MESSAGES.get(
                "work_order.push_production_picking.pending_picking",
                "已存在待领料单，请先处理后再下推",
            )
        elif not preview_items:
            blocking_reason = "BOM 中无可领料明细，无法下推生产领料"
        elif all(float(row.get("max_push_quantity") or 0) <= 0 for row in preview_items):
            blocking_reason = "工单物料已全部领齐，无需再下推生产领料"

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "production_picking",
            "summary": f"工单 {work_order.code}：{pushable_count}/{len(preview_items)} 行可领料"
            if preview_items
            else f"工单 {work_order.code}：无可领料明细",
            "items": preview_items,
            "tip": "确认后将进入生产领料录入页，按齐套明细生成领料单。",
            "has_blocking_issues": bool(blocking_reason),
            "blocking_reason": blocking_reason,
        }

    async def create_production_picking_from_work_order_pull(
        self,
        tenant_id: int,
        created_by: int,
        *,
        work_order_id: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        picker_name: Optional[str] = None,
        notes: Optional[str] = None,
        lines: List[Any],
    ) -> ProductionPickingWithItemsResponse:
        """从工单加载创建生产领料单（单条、按预览可领数量校验）。"""
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            assert_work_order_capability,
        )
        from apps.kuaizhizao.services.document_action_policy.types import CAPABILITY_REASON_MESSAGES
        from decimal import Decimal

        if not lines:
            raise ValidationError("请至少填写一条领料明细")

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        assert_work_order_capability(work_order, "push_production_picking")

        pending_picking = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status__in=list(_PRODUCTION_PICKING_OPEN_STATUSES),
        ).first()
        if pending_picking:
            raise BusinessLogicError(
                CAPABILITY_REASON_MESSAGES.get(
                    "work_order.push_production_picking.pending_picking",
                    "已存在待领料单，请先处理后再下推",
                )
            )

        from apps.kuaizhizao.utils.issue_method_resolver import is_pick_list_material

        kitting = await WorkOrderService().get_work_order_kitting_analysis(tenant_id, work_order_id)
        max_by_material: Dict[int, Decimal] = {}
        meta_by_material: Dict[int, Dict[str, str]] = {}
        for item in kitting.items or []:
            # 可领范围只看发料方式（pick），与齐套率分母 kitting_applicable 解耦（委外 pick 须可领）
            if not is_pick_list_material(
                getattr(item, "issue_method", None),
                getattr(item, "source_type", None),
            ):
                continue
            material_id = int(getattr(item, "material_id", 0) or 0)
            if material_id <= 0:
                continue
            required_qty = Decimal(str(getattr(item, "required_quantity", 0) or 0))
            picked_qty = Decimal(str(getattr(item, "picked_quantity", 0) or 0))
            remaining = required_qty - picked_qty
            if remaining < 0:
                remaining = Decimal("0")
            # 正式领料可领量 = 需求 − 已正式发料（线边已备齐时 shortage 为 0，仍应可领）
            max_by_material[material_id] = remaining
            meta_by_material[material_id] = {
                "material_code": str(getattr(item, "material_code", "") or ""),
                "material_name": str(getattr(item, "material_name", "") or ""),
                "material_unit": str(getattr(item, "material_unit", "") or "个"),
            }

        async with in_transaction():
            today = today_site_str()
            picking_code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")
            user_info = await self.get_user_info(created_by)
            initial_status, initial_review = await self._resolve_picking_create_status(tenant_id)
            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=picking_code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                workshop_id=work_order.workshop_id,
                workshop_name=work_order.workshop_name,
                status=initial_status,
                review_status=initial_review,
                picker_name=picker_name,
                notes=notes,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 同物料可拆多行（多批号各一行）；可领上限按 material_id 累计校验
            issued_by_material: Dict[int, Decimal] = {}
            for line in lines:
                material_id = int(getattr(line, "material_id", 0) or line.get("material_id", 0))
                issue_qty = Decimal(str(getattr(line, "issue_quantity", 0) or line.get("issue_quantity", 0)))
                if material_id <= 0 or issue_qty <= 0:
                    raise ValidationError("领料明细物料或数量无效")
                max_qty = max_by_material.get(material_id)
                if max_qty is None:
                    code = str(
                        getattr(line, "material_code", "")
                        or (line.get("material_code") if isinstance(line, dict) else "")
                        or material_id
                    )
                    name = str(
                        getattr(line, "material_name", "")
                        or (line.get("material_name") if isinstance(line, dict) else "")
                        or ""
                    )
                    label = f"{code} {name}".strip() if name else str(code)
                    raise BusinessLogicError(
                        f"物料 {label}（ID {material_id}）不在工单可领料范围内："
                        f"仅 BOM 中发料方式为「事前领料(pick)」的物料可领；"
                        f"倒冲/不发料不进领料单。请确认该物料来源与发料方式后重试"
                    )
                issued_so_far = issued_by_material.get(material_id, Decimal("0"))
                if issued_so_far + issue_qty > max_qty:
                    code = str(getattr(line, "material_code", "") or line.get("material_code", "") or material_id)
                    raise BusinessLogicError(
                        f"领料数量超过可领数量：{code}（可领 {float(max_qty)}，"
                        f"本单已计 {float(issued_so_far)}，本行 {float(issue_qty)}）"
                    )
                issued_by_material[material_id] = issued_so_far + issue_qty

                line_wh_id = getattr(line, "warehouse_id", None)
                if line_wh_id is None and isinstance(line, dict):
                    line_wh_id = line.get("warehouse_id")
                if line_wh_id is None or str(line_wh_id).strip() == "":
                    line_wh_id = warehouse_id
                if line_wh_id is None or str(line_wh_id).strip() == "":
                    code = str(getattr(line, "material_code", "") or line.get("material_code", "") or material_id)
                    raise ValidationError(f"领料明细须指定出库仓库：{code}")

                line_wh_name = getattr(line, "warehouse_name", None)
                if line_wh_name is None and isinstance(line, dict):
                    line_wh_name = line.get("warehouse_name")
                resolved_wh_id, resolved_wh_name = await _resolve_warehouse_identity(
                    tenant_id,
                    warehouse_id=line_wh_id,
                    warehouse_name=line_wh_name or warehouse_name,
                )

                batch_number = getattr(line, "batch_number", None)
                if batch_number is None and isinstance(line, dict):
                    batch_number = line.get("batch_number")
                batch_number = str(batch_number or "").strip() or None

                serial_raw = getattr(line, "serial_numbers", None)
                if serial_raw is None and isinstance(line, dict):
                    serial_raw = line.get("serial_numbers")
                serial_numbers = _parse_serial_numbers(serial_raw)
                serial_numbers_json = json.dumps(serial_numbers) if serial_numbers else None

                meta = meta_by_material.get(material_id, {})
                await ProductionPickingItem.create(
                    tenant_id=tenant_id,
                    picking_id=picking.id,
                    material_id=material_id,
                    material_code=str(getattr(line, "material_code", "") or line.get("material_code", "") or meta.get("material_code", "")),
                    material_name=str(getattr(line, "material_name", "") or line.get("material_name", "") or meta.get("material_name", "")),
                    material_unit=str(getattr(line, "material_unit", "") or line.get("material_unit", "") or meta.get("material_unit", "个")),
                    required_quantity=issue_qty,
                    picked_quantity=Decimal("0"),
                    remaining_quantity=issue_qty,
                    warehouse_id=resolved_wh_id,
                    warehouse_name=resolved_wh_name,
                    batch_number=batch_number,
                    serial_numbers=serial_numbers_json,
                    status="待领料",
                )

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
                        relation_desc="工单加载创建生产领料单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→生产领料 单据关联失败: %s", e)

            return await self.get_production_picking_by_id(tenant_id, int(picking.id))
    
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


# 生产退料加载：可选取的领料单状态（唯一真源，与 capability / 预览一致）
PRODUCTION_RETURN_PICKING_ELIGIBLE_STATUSES = frozenset(
    {"已领料", "已确认", "confirmed", "picked"}
)


class ProductionReturnService(AppBaseService[ProductionReturn]):
    """生产退料单服务"""

    def __init__(self):
        super().__init__(ProductionReturn)

    async def batch_work_orders_have_returnable_picking(
        self,
        tenant_id: int,
        work_order_ids: List[int],
    ) -> dict[int, bool]:
        if not work_order_ids:
            return {}
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id__in=work_order_ids,
            status__in=list(PRODUCTION_RETURN_PICKING_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        ).values_list("id", "work_order_id")
        picking_ids_by_wo: dict[int, list[int]] = {}
        all_picking_ids: list[int] = []
        for picking_id, work_order_id in pickings:
            picking_ids_by_wo.setdefault(int(work_order_id), []).append(int(picking_id))
            all_picking_ids.append(int(picking_id))
        if not all_picking_ids:
            return {int(wo_id): False for wo_id in work_order_ids}
        item_picking_ids = await ProductionPickingItem.filter(
            tenant_id=tenant_id,
            picking_id__in=all_picking_ids,
            picked_quantity__gt=0,
        ).values_list("picking_id", flat=True)
        picking_ids_with_lines = {int(pid) for pid in item_picking_ids}
        return {
            int(wo_id): any(pid in picking_ids_with_lines for pid in picking_ids_by_wo.get(int(wo_id), []))
            for wo_id in work_order_ids
        }

    async def _returned_quantity_by_picking_item(
        self,
        tenant_id: int,
        picking_item_ids: List[int],
    ) -> dict[int, float]:
        if not picking_item_ids:
            return {}
        confirmed_return_ids = await ProductionReturn.filter(
            tenant_id=tenant_id,
            status="已退料",
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
        if not confirmed_return_ids:
            return {}
        rows = await ProductionReturnItem.filter(
            tenant_id=tenant_id,
            return_id__in=list(confirmed_return_ids),
            picking_item_id__in=picking_item_ids,
        ).values_list("picking_item_id", "return_quantity")
        totals: dict[int, float] = {}
        for item_id, qty in rows:
            if item_id is None:
                continue
            totals[int(item_id)] = totals.get(int(item_id), 0.0) + float(qty or 0)
        return totals

    async def get_production_return_preview(
        self,
        tenant_id: int,
        work_order_id: int,
    ):
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.schemas.warehouse import (
            InboundCreatePreviewLine,
            ProductionReturnPreviewPicking,
            ProductionReturnPreviewResponse,
        )
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            assert_work_order_capability,
        )

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        returnable_map = await self.batch_work_orders_have_returnable_picking(
            tenant_id,
            [work_order_id],
        )
        has_returnable = returnable_map.get(work_order_id, False)
        assert_work_order_capability(
            work_order,
            "push_production_return",
            has_returnable_picking=has_returnable,
        )

        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status__in=list(PRODUCTION_RETURN_PICKING_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        ).order_by("-created_at")
        preview_pickings: list[ProductionReturnPreviewPicking] = []
        for picking in pickings:
            items = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                picking_id=picking.id,
                picked_quantity__gt=0,
            ).all()
            if not items:
                continue
            item_ids = [int(item.id) for item in items if item.id is not None]
            returned_by_item = await self._returned_quantity_by_picking_item(tenant_id, item_ids)
            lines: list[InboundCreatePreviewLine] = []
            for item in items:
                picked = float(item.picked_quantity or 0)
                returned = returned_by_item.get(int(item.id), 0.0)
                returnable = max(0.0, picked - returned)
                if returnable <= 0:
                    continue
                lines.append(
                    InboundCreatePreviewLine(
                        picking_item_id=int(item.id),
                        material_id=int(item.material_id),
                        material_code=str(item.material_code or ""),
                        material_name=str(item.material_name or ""),
                        material_spec=item.material_spec,
                        material_unit=str(item.material_unit or "个"),
                        source_doc_quantity=picked,
                        source_received_quantity=returned,
                        source_pending_quantity=returnable,
                        return_quantity=returnable,
                    )
                )
            if lines:
                preview_pickings.append(
                    ProductionReturnPreviewPicking(
                        picking_id=int(picking.id),
                        picking_code=str(picking.picking_code or picking.id),
                        status=str(picking.status or ""),
                        lines=lines,
                    )
                )

        message = None
        if not preview_pickings:
            message = "work_order.push_production_return.no_returnable_lines"
        return ProductionReturnPreviewResponse(
            work_order_id=work_order_id,
            work_order_code=work_order.code or str(work_order_id),
            pickings=preview_pickings,
            message=message,
        )

    async def create_production_return(
        self,
        tenant_id: int,
        return_data: ProductionReturnCreate,
        created_by: int
    ) -> ProductionReturnResponse:
        """创建生产退料单"""
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            assert_work_order_capability,
        )

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=return_data.work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {return_data.work_order_id}")
        returnable_map = await self.batch_work_orders_have_returnable_picking(
            tenant_id,
            [return_data.work_order_id],
        )
        assert_work_order_capability(
            work_order,
            "push_production_return",
            has_returnable_picking=returnable_map.get(return_data.work_order_id, False),
        )

        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = today_site_str()
            code = await self.generate_code(tenant_id, "PRODUCTION_RETURN_CODE", prefix=f"PR{today}")

            dump = return_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "return_code"})
            if return_data.return_code:
                code = return_data.return_code

            ret = await ProductionReturn.create(
                tenant_id=tenant_id,
                return_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
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
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_inbound_hub_list_capabilities,
        )
        responses = [ProductionReturnListResponse.model_validate(r) for r in rets]
        item_counts = await batch_document_item_counts(
            tenant_id, ProductionReturnItem, "return_id", [r.id for r in rets]
        )
        return enrich_inbound_hub_list_capabilities(
            rets, responses, "production_return", item_counts=item_counts
        )

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
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
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
            deleted_at=resolve_business_datetime()
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

            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                assert_inbound_hub_capability,
            )

            assert_inbound_hub_capability(ret, "confirm", receipt_type="production_return")

            # 1. 更新确认数据
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
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
                            item_update["warehouse_name"] = await _resolve_warehouse_name_by_id(
                                tenant_id,
                                item_data.warehouse_id,
                                item_data.warehouse_name,
                            )
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
            receipt_time = resolve_business_datetime(
                confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None
            )

            await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status="已退料",
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=receipt_time,
                updated_by=confirmed_by,
                updated_by_name=returner_name,
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
                material_ids = list({int(it.material_id) for it in reload_items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in reload_items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    wh_id = item.warehouse_id if item.warehouse_id else ret.warehouse_id
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="production_return",
                        source_doc_id=return_id,
                        source_doc_code=ret.return_code,
                        work_order_id=ret.work_order_id,
                        work_order_code=ret.work_order_code,
                        ledger_production_date=to_site_date(receipt_time),
                        movement_type="production_return",
                        to_warehouse_id=wh_id,
                        idempotency_key=f"production_return:{return_id}:inc:{item.id}",
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
                material_ids = list({int(it.material_id) for it in ret.items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in ret.items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
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


async def enrich_production_receipts_with_customer(
    tenant_id: int,
    receipts: List[Any],
    responses: List[Any],
) -> List[Any]:
    """
    为成品/半成品入库列表补齐客户：优先单据上的 sales_order_id，
    否则回落工单关联销售订单。无销售订单（如纯 MTS）则保持空，前端回落工单号。
    """
    if not receipts or not responses:
        return responses

    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.work_order import WorkOrder

    so_ids: set[int] = set()
    wo_ids_needing_so: set[int] = set()
    for receipt in receipts:
        so_id = getattr(receipt, "sales_order_id", None)
        if so_id:
            so_ids.add(int(so_id))
            continue
        wo_id = getattr(receipt, "work_order_id", None)
        if wo_id:
            wo_ids_needing_so.add(int(wo_id))

    wo_to_so: Dict[int, int] = {}
    if wo_ids_needing_so:
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=list(wo_ids_needing_so),
            deleted_at__isnull=True,
        ).all()
        for wo in work_orders:
            if getattr(wo, "sales_order_id", None):
                wo_to_so[int(wo.id)] = int(wo.sales_order_id)
                so_ids.add(int(wo.sales_order_id))

    customer_by_so: Dict[int, Tuple[Optional[int], str]] = {}
    if so_ids:
        orders = await SalesOrder.filter(
            tenant_id=tenant_id,
            id__in=list(so_ids),
            deleted_at__isnull=True,
        ).all()
        for order in orders:
            name = str(getattr(order, "customer_name", None) or "").strip()
            if not name:
                continue
            cid = getattr(order, "customer_id", None)
            customer_by_so[int(order.id)] = (int(cid) if cid else None, name)

    enriched: List[Any] = []
    for receipt, resp in zip(receipts, responses):
        so_id = getattr(receipt, "sales_order_id", None)
        if not so_id:
            so_id = wo_to_so.get(int(getattr(receipt, "work_order_id", 0) or 0))
        customer = customer_by_so.get(int(so_id)) if so_id else None
        if not customer:
            enriched.append(resp)
            continue
        update = {"customer_id": customer[0], "customer_name": customer[1]}
        if hasattr(resp, "model_copy"):
            enriched.append(resp.model_copy(update=update))
        else:
            enriched.append(resp)
    return enriched


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
                today = today_site_str()
                code = await self.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", prefix=f"FGR{today}")
            
            # 从参数或receipt_data中提取items（如果存在）
            if items is None:
                items = getattr(receipt_data, 'items', None) or []
            
            # 计算总数量
            total_quantity = sum(item.receipt_quantity for item in items) if items else 0

            work_order_id = getattr(receipt_data, "work_order_id", None)
            if work_order_id:
                await self._assert_work_order_inbound_quantity(
                    tenant_id,
                    int(work_order_id),
                    float(total_quantity or 0),
                )
            
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
                updated_by=user_info.get("id"),
                updated_by_name=user_info.get("name", ""),
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
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_inbound_hub_list_capabilities,
        )
        from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem

        responses = [FinishedGoodsReceiptResponse.model_validate(receipt) for receipt in receipts]
        item_counts = await batch_document_item_counts(
            tenant_id, FinishedGoodsReceiptItem, "receipt_id", [r.id for r in receipts]
        )
        responses = enrich_inbound_hub_list_capabilities(
            receipts, responses, "finished_goods", item_counts=item_counts
        )
        return await enrich_production_receipts_with_customer(tenant_id, receipts, responses)

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

            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                assert_inbound_hub_capability,
            )

            assert_inbound_hub_capability(receipt, "confirm", receipt_type="finished_goods")

            # 1. 如果提供了确认数据，先更新表头和明细
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
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
                        if item_data.serial_numbers:
                            parsed_serials = _parse_serial_numbers(item_data.serial_numbers)
                            if parsed_serials:
                                item_update["serial_numbers"] = parsed_serials
                        
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
                    existing_serials = _parse_serial_numbers(getattr(item, "serial_numbers", None))
                    
                    if len(existing_serials) < count:
                        serial_nos = await ensure_serial_nos_for_item(tenant_id, material, item, count)
                        if serial_nos and hasattr(item, "serial_numbers"):
                            setattr(item, "serial_numbers", serial_nos)
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
            receipt_time = resolve_business_datetime(
                confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None
            )

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
                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                
                for item in items:
                    qty = item.receipt_quantity or item.qualified_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    
                    # 优先使用行仓库，若无则使用表头仓库
                    wh_id = item.warehouse_id if getattr(item, "warehouse_id", None) else receipt.warehouse_id
                    serial_nos = _parse_serial_numbers(getattr(item, "serial_numbers", None))
                    
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        serial_nos=serial_nos or None,
                        source_type="finished_goods_receipt",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt.receipt_code,
                        work_order_id=receipt.work_order_id,
                        work_order_code=receipt.work_order_code,
                        ledger_production_date=to_site_date(receipt_time),
                        ledger_expiry_date=getattr(item, "expiry_date", None),
                        movement_type="fg_receipt",
                        to_warehouse_id=wh_id,
                        idempotency_key=f"finished_goods_receipt:{receipt_id}:inc:{item.id}",
                        quality_status="qualified",
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
                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in items:
                    qty = item.receipt_quantity or item.qualified_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
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
            now = resolve_business_datetime()
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

    _WO_INBOUND_RECEIPT_COUNT_STATUSES = ("待入库", "草稿", "draft", "DRAFT", "已入库")

    async def _sum_work_order_inbound_quantity(self, tenant_id: int, work_order_id: int) -> float:
        from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt

        fg_rows = await FinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status__in=self._WO_INBOUND_RECEIPT_COUNT_STATUSES,
        ).all()
        sf_rows = await SemiFinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status__in=self._WO_INBOUND_RECEIPT_COUNT_STATUSES,
        ).all()
        return sum(float(r.total_quantity or 0) for r in fg_rows + sf_rows)

    async def _get_work_order_inbound_quota(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        exclude_finished_receipt_id: Optional[int] = None,
        exclude_semi_receipt_id: Optional[int] = None,
    ) -> Dict[str, float]:
        """工单可入库额度：计划数量（含超报上限）− 已占用入库单数量。"""
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.services.over_report_rules import (
            max_completed_quantity_for_plan,
            tuple_from_model,
        )

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        planned = float(work_order.quantity or 0)
        mode, value = tuple_from_model(work_order)
        max_qty = float(
            max_completed_quantity_for_plan(work_order.quantity, mode, value)
        )
        received = await self._sum_work_order_inbound_quantity(tenant_id, work_order_id)

        if exclude_finished_receipt_id:
            excluded = await FinishedGoodsReceipt.get_or_none(
                tenant_id=tenant_id,
                id=exclude_finished_receipt_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
            )
            if excluded and excluded.status in self._WO_INBOUND_RECEIPT_COUNT_STATUSES:
                received -= float(excluded.total_quantity or 0)

        if exclude_semi_receipt_id:
            from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt

            excluded = await SemiFinishedGoodsReceipt.get_or_none(
                tenant_id=tenant_id,
                id=exclude_semi_receipt_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
            )
            if excluded and excluded.status in self._WO_INBOUND_RECEIPT_COUNT_STATUSES:
                received -= float(excluded.total_quantity or 0)

        received = max(0.0, received)
        pending = max(0.0, max_qty - received)
        fqc_qualified_remaining: Optional[float] = None
        from apps.kuaizhizao.services.inspection_policy_service import (
            get_fqc_inbound_remaining_quantity,
            resolve_inspection_policy,
        )

        eff, _, _ = await resolve_inspection_policy(
            tenant_id, "fqc", material_id=int(work_order.product_id)
        )
        if eff != "none":
            fqc_remaining = await get_fqc_inbound_remaining_quantity(
                tenant_id,
                work_order_id,
                int(work_order.product_id),
                exclude_receipt_id=exclude_finished_receipt_id,
            )
            fqc_qualified_remaining = float(fqc_remaining)
            pending = min(pending, fqc_qualified_remaining)

        return {
            "planned": planned,
            "max_quantity": max_qty,
            "received": received,
            "pending": pending,
            "fqc_qualified_remaining": fqc_qualified_remaining,
        }

    async def _assert_work_order_inbound_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        receipt_quantity: float,
        *,
        exclude_finished_receipt_id: Optional[int] = None,
        exclude_semi_receipt_id: Optional[int] = None,
    ) -> float:
        """校验工单本次入库数量不超过可入库余量。"""
        qty = float(receipt_quantity or 0)
        if qty <= 0:
            raise ValidationError("入库数量必须大于0")

        quota = await self._get_work_order_inbound_quota(
            tenant_id,
            work_order_id,
            exclude_finished_receipt_id=exclude_finished_receipt_id,
            exclude_semi_receipt_id=exclude_semi_receipt_id,
        )
        pending = quota["pending"]
        if pending <= 0:
            raise BusinessLogicError(
                f"工单可入库数量已用尽（计划 {quota['planned']}，已入库 {quota['received']}），无法再次下推入库"
            )
        if qty > pending + 1e-9:
            raise ValidationError(
                f"入库数量 {qty} 超过可入库数量 {pending}（上限 {quota['max_quantity']}，已入库 {quota['received']}）"
            )
        return pending

    async def _resolve_work_order_suggested_receipt_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        receipt_quantity: Optional[float] = None,
        *,
        strict: bool = True,
    ) -> float:
        """
        解析建议入库数量。

        - strict=True（一键入库等）：缺质检/末道已审报工时抛错
        - strict=False（取单预览）：返回 0，由前端让用户手工填数量
        """
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.kuaizhizao.services.inspection_policy_service import (
            get_fqc_inbound_remaining_quantity,
            resolve_inspection_policy,
            sum_fqc_inbound_qualified_quantity,
        )
        from apps.kuaizhizao.models.work_order import WorkOrder

        if receipt_quantity is not None:
            return float(receipt_quantity)

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if work_order:
            eff, _, _ = await resolve_inspection_policy(
                tenant_id, "fqc", material_id=int(work_order.product_id)
            )
            if eff != "none":
                fqc_total = await sum_fqc_inbound_qualified_quantity(
                    tenant_id, work_order_id, int(work_order.product_id)
                )
                if fqc_total > 0:
                    remaining = await get_fqc_inbound_remaining_quantity(
                        tenant_id, work_order_id, int(work_order.product_id)
                    )
                    if remaining > 0:
                        return float(remaining)
                    if not strict:
                        return 0.0
                    raise ValidationError("成品检验合格数量已全部入库，无法再次入库")

        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

        qc_records = await FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            quality_status="合格",
        ).all()
        if qc_records:
            total_qc_qualified = sum(float(qc.qualified_quantity or 0) for qc in qc_records)
            if total_qc_qualified > 0:
                return total_qc_qualified

        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        if not operations:
            if not strict:
                return 0.0
            raise ValidationError("工单无工序记录，无法自动获取入库数量")

        last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
        lo_q = float(last_op.qualified_quantity or 0)
        if lo_q > 0:
            return lo_q

        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=last_op.operation_id,
            status="approved",
            deleted_at__isnull=True,
        ).all()
        if not reporting_records:
            if not strict:
                return 0.0
            raise ValidationError("工单没有质检合格记录，且末道工序无已审核报工记录，无法自动获取入库数量")
        total_qualified = sum(float(record.qualified_quantity or 0) for record in reporting_records)
        if total_qualified <= 0:
            if not strict:
                return 0.0
            raise ValidationError("末道工序报工合格数量为0，无法创建入库单")
        return total_qualified

    async def get_work_order_inbound_preview(
        self,
        tenant_id: int,
        work_order_id: int,
    ):
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.schemas.warehouse import InboundCreatePreviewLine, WorkOrderInboundPreviewResponse
        from apps.kuaizhizao.services.work_order_inbound_bom_role import is_semi_finished_product_by_bom_role
        from apps.master_data.models.material import Material

        from apps.kuaizhizao.services.document_action_policy.work_order import (
            assert_work_order_capability,
        )

        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        assert_work_order_capability(work_order, "push_finished_goods_receipt")

        is_semi = await is_semi_finished_product_by_bom_role(tenant_id, work_order.product_id)
        if is_semi:
            from apps.kuaizhizao.services.semi_finished_goods_receipt_service import SemiFinishedGoodsReceiptService

            return await SemiFinishedGoodsReceiptService().get_work_order_inbound_preview(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
            )

        planned = float(work_order.quantity or 0)
        quota = await self._get_work_order_inbound_quota(tenant_id, work_order_id)
        received = quota["received"]
        pending = quota["pending"]
        suggested = await self._resolve_work_order_suggested_receipt_quantity(
            tenant_id, work_order_id, strict=False
        )
        receipt_qty = min(suggested, pending) if pending > 0 else 0.0
        hint = None
        if pending <= 0:
            if quota.get("fqc_qualified_remaining") is not None and float(quota["fqc_qualified_remaining"]) <= 0:
                hint = "成品检验合格可入数量已用尽，无法再取单入库"
            else:
                hint = "工单可入库数量已用尽，无法再取单入库"
        elif suggested <= 0:
            hint = "暂无质检合格或末道已审报工数量，请手工填写入库数量"
        elif quota.get("fqc_qualified_remaining") is not None:
            fqc_rem = quota["fqc_qualified_remaining"]
            hint = f"本次最多可入 {pending}（FQC 合格剩余 {fqc_rem}）"

        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=work_order.product_id,
            deleted_at__isnull=True,
        )
        material_unit = (getattr(material, "base_unit", None) or "个") if material else "个"
        line = InboundCreatePreviewLine(
            material_id=int(work_order.product_id),
            material_code=(getattr(material, "main_code", None) or getattr(material, "code", None) or work_order.product_code or ""),
            material_name=(getattr(material, "name", None) or work_order.product_name or ""),
            material_spec=getattr(material, "specification", None) or getattr(work_order, "product_spec", None),
            material_unit=material_unit,
            source_doc_quantity=planned,
            source_received_quantity=received,
            source_pending_quantity=pending,
            receipt_quantity=receipt_qty,
        )
        return WorkOrderInboundPreviewResponse(
            work_order_id=work_order_id,
            work_order_code=work_order.code or str(work_order_id),
            inbound_doc_kind="finished_goods",
            lines=[line],
            message=hint,
        )

    async def quick_receipt_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        receipt_quantity: Optional[float] = None,
        receipt_code: Optional[str] = None,
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
                receipt_code=receipt_code,
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
            receipt_quantity = await self._resolve_work_order_suggested_receipt_quantity(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                receipt_quantity=receipt_quantity,
            )
            await self._assert_work_order_inbound_quantity(
                tenant_id,
                work_order_id,
                receipt_quantity,
            )
            
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
            if receipt_code:
                code = receipt_code
            else:
                today = today_site_str()
                code = await self.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", prefix=f"FG{today}")
            
            # 5. 创建成品入库单
            receipt = await FinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                receipt_code=code,
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
            
            # 6. 创建入库单明细（优先继承工单批号/序列号，无值再按规则生成）
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.work_order_tracking_service import WorkOrderTrackingService
            from apps.kuaizhizao.services.batch_serial_helper import (
                ensure_batch_no_for_item,
                ensure_serial_nos_for_item,
            )

            batch_number = WorkOrderTrackingService.effective_batch_no(work_order)
            serial_numbers: Optional[List[str]] = None
            effective_serial = WorkOrderTrackingService.effective_serial_no(work_order)
            if effective_serial:
                serial_numbers = [effective_serial]

            material = await Material.get_or_none(
                tenant_id=tenant_id,
                id=work_order.product_id,
                deleted_at__isnull=True,
            )
            if material:
                class _ItemData:
                    pass
                item_data = _ItemData()
                item_data.batch_number = batch_number
                item_data.serial_numbers = serial_numbers
                if not batch_number:
                    batch_number = await ensure_batch_no_for_item(
                        tenant_id=tenant_id,
                        material=material,
                        item_data=item_data,
                        supplier_code=None,
                    )
                if material.serial_managed and not serial_numbers:
                    serial_numbers = await ensure_serial_nos_for_item(
                        tenant_id=tenant_id,
                        material=material,
                        item_data=item_data,
                        count=1,
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
                serial_numbers=serial_numbers,
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
        warehouse_name: Optional[str] = None,
        receipt_code: Optional[str] = None,
        receipt_quantity: Optional[float] = None,
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
                    warehouse_name=warehouse_name,
                    receipt_code=receipt_code if len(work_order_ids) == 1 else None,
                    receipt_quantity=receipt_quantity if len(work_order_ids) == 1 else None,
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
            
            if audit_required and initial_status in [None, "待审核", "草稿", "待出库"]:
                initial_status = "待审核"
                initial_review_status = "待审核"
            if not audit_required and initial_status in [None, "待审核", "草稿"]:
                # 如果不需要审核，且未指定状态或指定为草稿/待审核，则直接设为待出库（即已通过审核，等待执行）
                initial_status = "待出库"
                initial_review_status = "已通过"
            
            # 如果未提供delivery_code，则自动生成
            if delivery_data.delivery_code:
                code = delivery_data.delivery_code
            else:
                today = today_site_str()
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
                updated_by=user_info.get("id"),
                updated_by_name=user_info.get("name", ""),
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
                        is_gift=bool(getattr(item_data, "is_gift", False)),
                        gift_ref_unit_price=getattr(item_data, "gift_ref_unit_price", None),
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
                                source_name=so.order_code,
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
        delivery_obj = await SalesDelivery.get(tenant_id=tenant_id, id=created_delivery_id)
        if (delivery_obj.status or "").strip() == "待审核":
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=created_by,
                node_key="sales_delivery",
                entity_type="sales_delivery",
                entity_id=delivery_obj.id,
                entity_uuid=str(delivery_obj.uuid),
                title=f"销售出库审批: {delivery_obj.delivery_code}",
                content=f"客户: {delivery_obj.customer_name}, 金额: {delivery_obj.total_amount}",
            )
            if not instance:
                raise BusinessLogicError(
                    "销售出库审核已开启但未找到可用的审批流程，请在配置中心检查 sales_delivery 审批流程是否已激活"
                )
        return SalesDeliveryResponse.model_validate(delivery_obj)

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
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "sales_delivery", resp)

    async def list_sales_deliveries(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesDeliveryResponse]:
        """获取销售出库单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import (
            SALES_DELIVERY_KEYWORD_FIELDS,
            SALES_DELIVERY_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('sales_order_id'):
            query = query.filter(sales_order_id=filters['sales_order_id'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=filters['customer_id'])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        customer_name = (filters.get("customer_name") or "").strip()
        if customer_name:
            query = query.filter(customer_name__icontains=customer_name)
        warehouse_name = (filters.get("warehouse_name") or "").strip()
        if warehouse_name:
            query = query.filter(warehouse_name__icontains=warehouse_name)
        if filters.get("total_quantity") is not None and filters.get("total_quantity") != "":
            query = query.filter(total_quantity=filters["total_quantity"])
        if filters.get("scoped_sales_order_ids") is not None:
            query = query.filter(
                Q(sales_order_id__isnull=True)
                | Q(sales_order_id__in=filters["scoped_sales_order_ids"])
            )

        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            allowed_fields=SALES_DELIVERY_SORTABLE_FIELDS,
            default_order="-created_at",
            keyword_fields=SALES_DELIVERY_KEYWORD_FIELDS,
            doc_date_field="delivery_time",
            doc_start_date=filters.get("delivery_start_date"),
            doc_end_date=filters.get("delivery_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        deliveries = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_outbound_hub_list_capabilities,
        )
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_delivery_lifecycle

        out: List[SalesDeliveryResponse] = []
        for delivery in deliveries:
            resp = SalesDeliveryResponse.model_validate(delivery)
            # 列表与详情共用生命周期计算，避免出库 Hub 列表显示「生命周期缺失」
            resp.lifecycle = get_sales_delivery_lifecycle(delivery, milestones=[])
            out.append(resp)
        item_counts = await batch_document_item_counts(
            tenant_id, SalesDeliveryItem, "delivery_id", [int(d.id) for d in deliveries]
        )
        from core.services.approval.audit_record_enricher import enrich_items

        return await enrich_items(tenant_id, "sales_delivery", enrich_outbound_hub_list_capabilities(
            deliveries, out, "sales_delivery", item_counts=item_counts
        ))

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
            if delivery_data.attachments is not None:
                delivery.attachments = delivery_data.attachments
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
        from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
        from apps.kuaizhizao.models.sales_return import SalesReturn

        delivery = await SalesDelivery.get_or_none(
            id=delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        if delivery.status not in ["待出库", "draft", "草稿", "已取消", "cancelled"]:
            raise BusinessLogicError("只有待出库或已取消状态的销售出库单才能删除")

        if await DeliveryNotice.filter(
            tenant_id=tenant_id,
            sales_delivery_id=delivery_id,
            deleted_at__isnull=True,
        ).exclude(status="待发送").exists():
            raise BusinessLogicError("存在非待发送状态的送货单，请先处理后再删除销售出库单")

        if await SalesReturn.filter(
            tenant_id=tenant_id,
            sales_delivery_id=delivery_id,
            deleted_at__isnull=True,
        ).exclude(status__in=["待退货", "draft", "草稿", "已取消", "cancelled"]).exists():
            raise BusinessLogicError("存在已确认的销售退货单，无法删除销售出库单")

        async with in_transaction():
            now = resolve_business_datetime()
            await ShipmentNotice.filter(
                tenant_id=tenant_id,
                sales_delivery_id=delivery_id,
                deleted_at__isnull=True,
            ).update(
                sales_delivery_id=None,
                sales_delivery_code=None,
                status="待发货",
                notified_at=None,
            )
            await DeliveryNotice.filter(
                tenant_id=tenant_id,
                sales_delivery_id=delivery_id,
                deleted_at__isnull=True,
                status="待发送",
            ).update(deleted_at=now)
            await SalesReturn.filter(
                tenant_id=tenant_id,
                sales_delivery_id=delivery_id,
                deleted_at__isnull=True,
                status__in=["待退货", "draft", "草稿"],
            ).update(deleted_at=now)
            delivery.deleted_at = now
            await delivery.save()

    async def submit_sales_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        submitted_by: int,
    ) -> SalesDeliveryResponse:
        delivery = await SalesDelivery.get_or_none(
            id=delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        status = str(delivery.status or "").strip()
        if status == "待审核":
            return await self.get_sales_delivery_by_id(tenant_id, delivery_id)

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_delivery"
        )
        if not audit_required:
            submitter_name = await self.get_user_name(submitted_by)
            await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(
                status="待出库",
                review_status="已通过",
                reviewer_id=submitted_by,
                reviewer_name=submitter_name,
                review_time=resolve_business_datetime(),
                updated_by=submitted_by,
            )
            return await self.get_sales_delivery_by_id(tenant_id, delivery_id)

        if status not in ("草稿", "待出库"):
            raise BusinessLogicError(f"当前状态不可提交审核: {status or '-'}")

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="sales_delivery",
            entity_type="sales_delivery",
            entity_id=delivery.id,
            entity_uuid=str(delivery.uuid),
            title=f"销售出库审批: {delivery.delivery_code}",
            content=f"客户: {delivery.customer_name}, 金额: {delivery.total_amount}",
        )
        if not instance:
            raise BusinessLogicError(
                "销售出库审核已开启但未找到可用的审批流程，请在配置中心检查 sales_delivery 审批流程是否已激活"
            )
        await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(
            status="待审核",
            review_status="待审核",
            updated_by=submitted_by,
        )
        return await self.get_sales_delivery_by_id(tenant_id, delivery_id)

    async def approve_sales_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        approver_id: int,
    ) -> SalesDeliveryResponse:
        delivery = await SalesDelivery.get_or_none(
            id=delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        status = str(delivery.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能审核待审核状态的销售出库单，当前: {status or '-'}")
        approver_name = await self.get_user_name(approver_id)
        await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(
            status="待出库",
            review_status="已通过",
            reviewer_id=approver_id,
            reviewer_name=approver_name,
            review_time=resolve_business_datetime(),
            updated_by=approver_id,
        )
        return await self.get_sales_delivery_by_id(tenant_id, delivery_id)

    async def reject_sales_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        approver_id: int,
        *,
        rejection_reason: Optional[str] = None,
    ) -> SalesDeliveryResponse:
        delivery = await SalesDelivery.get_or_none(
            id=delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        status = str(delivery.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能驳回待审核状态的销售出库单，当前: {status or '-'}")
        await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(
            status="草稿",
            review_status="已驳回",
            review_remarks=rejection_reason,
            updated_by=approver_id,
        )
        return await self.get_sales_delivery_by_id(tenant_id, delivery_id)

    async def withdraw_sales_delivery_submit(
        self,
        tenant_id: int,
        delivery_id: int,
        operator_id: int,
    ) -> SalesDeliveryResponse:
        delivery = await SalesDelivery.get_or_none(
            id=delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        status = str(delivery.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能撤回待审核状态的销售出库单，当前: {status or '-'}")
        from core.services.approval.approval_instance_service import ApprovalInstanceService

        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type="sales_delivery",
            entity_id=delivery_id,
            operator_id=operator_id,
        )
        await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(
            status="草稿",
            review_status="待审核",
            updated_by=operator_id,
        )
        return await self.get_sales_delivery_by_id(tenant_id, delivery_id)

    async def revoke_sales_delivery_approval(
        self,
        tenant_id: int,
        delivery_id: int,
        operator_id: int,
    ) -> SalesDeliveryResponse:
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService

        delivery = await SalesDelivery.get_or_none(
            id=delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        status = str(delivery.status or "").strip()
        if status != "待出库":
            raise BusinessLogicError(f"当前状态不可撤销审核: {status or '-'}")
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_delivery"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        target_status = "待审核" if landing == "pending" else "草稿"

        async def _do_revoke() -> SalesDeliveryResponse:
            await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(
                status=target_status,
                review_status="待审核",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                updated_by=operator_id,
            )
            return await self.get_sales_delivery_by_id(tenant_id, delivery_id)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="sales_delivery",
            entity_id=delivery_id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )

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

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(delivery, "withdraw", outbound_type="sales_delivery")

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
                base_qty = _convert_line_quantity_to_base(
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
        warehouse_name: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> SalesDeliveryResponse:
        """
        从销售订单加载生成销售出库单（销售出库单加载功能）
        
        从销售订单加载，自动生成销售出库单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            created_by: 创建人ID
            delivery_quantities: 出库数量字典 {item_id: quantity}，如果不提供则使用订单剩余数量
            warehouse_id: 出库仓库ID（可选）
            warehouse_name: 出库仓库名称（可选）
            notes: 用户备注（可选，会与来源说明一并写入出库单备注）
            
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
        
        # 检查订单状态：
        # 销售订单允许在「已审核/已确认/进行中」持续分批下推销售出库（与前端门禁一致）。
        pushable_statuses = ("已审核", "已确认", "进行中", "AUDITED", "CONFIRMED", "IN_PROGRESS")
        if sales_order.status not in pushable_statuses:
            raise BusinessLogicError("只有已审核、已确认或进行中状态的销售订单才能加载生成销售出库单")
        
        # 获取订单明细
        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        ).all()
        
        if not order_items:
            raise BusinessLogicError("销售订单没有明细，无法生成销售出库单")

        # 统计该销售订单已生成但尚未完结的销售出库占用量，避免重复下推导致超量。
        existing_deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True,
        ).exclude(status__in=["已取消", "cancelled", "CANCELLED"]).values("id", "delivery_code", "status")
        closed_statuses = {"已出库", "已完成", "completed", "COMPLETED", "done", "DONE"}
        occupying_deliveries = [
            d for d in existing_deliveries if str(d.get("status") or "").strip() not in closed_statuses
        ]
        occupying_delivery_ids = [int(d["id"]) for d in occupying_deliveries if d.get("id") is not None]
        occupied_qty_by_material: Dict[int, Decimal] = {}
        if occupying_delivery_ids:
            occupying_items = await SalesDeliveryItem.filter(
                tenant_id=tenant_id,
                delivery_id__in=occupying_delivery_ids,
            ).values("material_id", "delivery_quantity")
            for row in occupying_items:
                mid = int(row.get("material_id") or 0)
                if mid <= 0:
                    continue
                qty = Decimal(str(row.get("delivery_quantity") or 0))
                occupied_qty_by_material[mid] = occupied_qty_by_material.get(mid, Decimal("0")) + qty

        existing_delivery_hint = "、".join(
            [str(d.get("delivery_code") or f"#{d.get('id')}") for d in occupying_deliveries[:3]]
        )
        
        # 如果没有指定仓库，需要从订单或其他地方获取默认仓库
        if not warehouse_id:
            # TODO: 从配置或其他地方获取默认仓库
            raise ValidationError("必须指定出库仓库")
        
        # 如果没有指定仓库名称，尝试从仓库服务获取
        if not warehouse_name:
            warehouse_name = await _resolve_warehouse_name_by_id(
                tenant_id,
                warehouse_id,
                warehouse_name,
            )
        
        # 准备出库单明细
        delivery_items = []
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        
        for item in order_items:
            base_remaining = Decimal(str(item.remaining_quantity or item.order_quantity or 0))
            occupied_qty = occupied_qty_by_material.get(int(item.material_id or 0), Decimal("0"))
            max_push_qty = base_remaining - occupied_qty
            if max_push_qty <= 0:
                continue

            # 计算出库数量
            if delivery_quantities and item.id in delivery_quantities:
                delivery_qty = Decimal(str(delivery_quantities[item.id]))
            else:
                # 默认只下推当前可用数量（剩余数量 - 已被待出库单占用）
                delivery_qty = max_push_qty
            
            if delivery_qty <= 0:
                continue  # 跳过数量为0或负数的情况
            
            # 检查是否超出剩余数量
            if delivery_qty > max_push_qty:
                occupied_tip = f"（已被待出库单占用 {occupied_qty}）" if occupied_qty > 0 else ""
                raise BusinessLogicError(
                    f"物料 {item.material_code} 的出库数量 {delivery_qty} 超过可下推数量 {max_push_qty}{occupied_tip}"
                )
            
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
                    is_gift=bool(getattr(item, "is_gift", False)),
                    gift_ref_unit_price=(
                        float(item.gift_ref_unit_price)
                        if getattr(item, "gift_ref_unit_price", None) is not None
                        else None
                    ),
                    demand_id=None,
                    demand_item_id=None,
                )
            )
            
            total_quantity += delivery_qty
            total_amount += item_total_amount
        
        if not delivery_items:
            if existing_delivery_hint:
                raise BusinessLogicError(
                    f"该销售订单已存在销售出库单（{existing_delivery_hint}），当前无可下推数量，请先处理已有出库单"
                )
            raise BusinessLogicError("没有可出库的物料")
        
        source_note = f"从销售订单 {sales_order.order_code} 加载生成"
        user_note = (notes or "").strip()
        delivery_notes = f"{user_note}\n{source_note}" if user_note else source_note

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
            notes=delivery_notes,
            items=delivery_items
        )
        
        # 创建出库单（下推仅生成待出库单，批号/序列号在确认出库时录入）
        delivery = await self.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by,
            require_batch_serial_on_create=False,
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
        从销售预测加载生成销售出库单（销售出库单加载功能）
        
        从销售预测加载，自动生成销售出库单（MTS模式）
        
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
        
        # 检查预测状态（只有已审核的预测才能加载生成出库单）
        if sales_forecast.status != "已审核":
            raise BusinessLogicError("只有已审核的销售预测才能加载生成销售出库单")
        
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
            warehouse_name = await _resolve_warehouse_name_by_id(
                tenant_id,
                warehouse_id,
                warehouse_name,
            )
        
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
            notes=f"从销售预测 {sales_forecast.forecast_code} 加载生成",
            items=delivery_items
        )
        
        # 创建出库单（下推仅生成待出库单，批号/序列号在确认出库时录入）
        delivery = await self.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by,
            require_batch_serial_on_create=False,
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
        # notify 路径生成的出库单在创建时已回填 notice.sales_delivery_id，
        # 下方按数量匹配的查询以 sales_delivery_id__isnull=True 过滤会漏掉它们，
        # 导致通知单永远停留在「已通知」、预占无法释放。先按直接关联关闭。
        direct_closed = await ShipmentNotice.filter(
            tenant_id=tenant_id,
            status="已通知",
            deleted_at__isnull=True,
            sales_delivery_id=delivery.id,
        ).update(
            status="已出库",
            sales_delivery_code=delivery.delivery_code,
            updated_by=updated_by,
        )
        if direct_closed:
            return

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
        confirm_request: Optional[SalesDeliveryConfirmRequest] = None,
        item_batches: Optional[List[SalesDeliveryConfirmItemBatch]] = None,
    ) -> SalesDeliveryResponse:
        """确认出库"""
        async with in_transaction():
            delivery = await self.get_sales_delivery_by_id(tenant_id, delivery_id)

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(delivery, "confirm", outbound_type="sales_delivery")

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

            resolved_item_batches = item_batches
            if confirm_request and confirm_request.item_batches is not None:
                resolved_item_batches = confirm_request.item_batches

            if confirm_request:
                update_dict = {}
                if confirm_request.warehouse_id:
                    update_dict["warehouse_id"] = confirm_request.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirm_request.warehouse_id,
                        confirm_request.warehouse_name,
                    )
                if confirm_request.notes:
                    update_dict["notes"] = confirm_request.notes
                if update_dict:
                    await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(**update_dict)
                    delivery = await self.get_sales_delivery_by_id(tenant_id, delivery_id)

                if confirm_request.items:
                    for item_data in confirm_request.items:
                        item_update = {}
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.serial_numbers is not None:
                            item_update["serial_numbers"] = json.dumps(item_data.serial_numbers)
                        if item_update:
                            await SalesDeliveryItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, delivery_id=delivery_id
                            ).update(**item_update)

            if resolved_item_batches is not None:
                line_rows = await SalesDeliveryItem.filter(
                    tenant_id=tenant_id, delivery_id=delivery_id
                ).all()
                active_ids = {
                    it.id
                    for it in line_rows
                    if Decimal(str(it.delivery_quantity or 0)) > Decimal("0")
                }
                patch = {row.item_id: (row.batch_no or "").strip() for row in resolved_item_batches}
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
            confirm_time = resolve_business_datetime(
                confirm_request.delivery_time if confirm_request and confirm_request.delivery_time else None
            )

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
                    base_qty = _convert_line_quantity_to_base(
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
                        movement_type="sales_delivery",
                        from_warehouse_id=wh_id,
                        idempotency_key=f"sales_delivery:{delivery_id}:dec:{item.id}",
                    )
            except BusinessLogicError:
                raise
            except ValueError as inv_e:
                logger.error("销售出库确认-更新库存失败: {}", inv_e)
                raise BusinessLogicError(str(inv_e) or "库存不足，无法出库")
            except Exception as inv_e:
                logger.error("销售出库确认-更新库存失败: {}", inv_e)
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
            from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date

            biz_date = to_site_date(resolve_business_datetime())
            due_date = await resolve_partner_due_date(
                tenant_id, "customer", int(delivery_row.customer_id), biz_date
            )
            receivable_data = ReceivableCreate(
                source_type="销售出库",
                source_id=delivery_id,
                source_code=delivery_row.delivery_code,
                customer_id=delivery_row.customer_id,
                customer_name=delivery_row.customer_name,
                total_amount=float(total_amount),
                received_amount=0.0,
                remaining_amount=float(total_amount),
                due_date=due_date,
                business_date=biz_date,
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
            logger.exception(
                "销售出库单 %s 自动生成应收单失败: %s",
                getattr(updated_delivery, "delivery_code", delivery_id),
                e,
            )

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
                
                delivery_wh_id, delivery_wh_name = await _resolve_warehouse_identity(
                    tenant_id=tenant_id,
                    warehouse_id=delivery_data.get("warehouse_id"),
                    warehouse_name=delivery_data.get("warehouse_name"),
                )

                # 创建出库单
                delivery_create_data = SalesDeliveryCreate(
                    sales_order_id=sales_order.id,
                    sales_order_code=sales_order.order_code,
                    customer_id=sales_order.customer_id,
                    customer_name=sales_order.customer_name,
                    warehouse_id=delivery_wh_id,
                    warehouse_name=delivery_wh_name,
                    delivery_time=resolve_business_datetime(delivery_data.get('delivery_time')),
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
        timestamp = resolve_business_datetime().strftime('%Y%m%d_%H%M%S')
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
            today = today_site_str()
            code = await self.generate_code(tenant_id, "PURCHASE_RECEIPT_CODE", prefix=f"PR{today}")

            # 创建入库单头
            receipt_dict = receipt_data.model_dump(exclude_unset=True, exclude={'items', 'created_by', 'receipt_code'})
            receipt_dict.update({
                'tenant_id': tenant_id,
                'receipt_code': code,  # 使用生成的编码
                'created_by': created_by,
                'created_by_name': user_info.get("name", ""),
                'updated_by': created_by,
                'updated_by_name': user_info.get("name", ""),
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

            pending_po_received: Dict[int, Decimal] = {}
            for item_data in receipt_data.items or []:
                item_dict = item_data.model_dump(exclude_unset=True)
                # 确保数量字段是Decimal类型
                receipt_quantity = Decimal(str(item_data.receipt_quantity))
                unit_price = Decimal(str(item_data.unit_price))

                purchase_order_item_id = int(getattr(item_data, "purchase_order_item_id", 0) or 0)
                if purchase_order_item_id > 0:
                    await _assert_purchase_receipt_tolerance_for_po_item(
                        tenant_id,
                        purchase_order_item_id,
                        receipt_quantity,
                        tolerance_percentage,
                        getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                        extra_pending_qty=pending_po_received.get(purchase_order_item_id, Decimal("0")),
                    )
                    pending_po_received[purchase_order_item_id] = (
                        pending_po_received.get(purchase_order_item_id, Decimal("0")) + receipt_quantity
                    )
                
                # 批号管理物料：未填写批号时自动生成
                from apps.master_data.models.material import Material
                from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item
                material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id, deleted_at__isnull=True)
                if not material:
                    raise ValidationError(f"物料不存在: {item_data.material_id}")
                if not str(item_dict.get("material_code") or "").strip():
                    item_dict["material_code"] = str(material.main_code or material.code or "").strip()
                if not str(item_dict.get("material_name") or "").strip():
                    item_dict["material_name"] = str(material.name or "").strip()
                if not item_dict.get("material_code") or not item_dict.get("material_name"):
                    raise ValidationError(f"物料 {item_data.material_id} 缺少编码或名称")
                batch_no = await ensure_batch_no_for_item(
                    tenant_id=tenant_id,
                    material=material,
                    item_data=item_data,
                    supplier_code=supplier_code,
                )
                if batch_no is not None:
                    item_dict["batch_number"] = batch_no
                material_label = item_dict.get("material_name") or item_dict.get("material_code") or "未知物料"
                _validate_location_if_required(
                    location_required=location_required,
                    location_id=getattr(item_data, 'location_id', None),
                    location_code=getattr(item_data, 'location_code', None),
                    scene="采购入库",
                    material_label=material_label,
                )
                await _validate_purchase_line_warehouse_location_match(
                    tenant_id,
                    warehouse_id=getattr(item_data, "warehouse_id", None),
                    location_id=getattr(item_data, "location_id", None),
                    material_label=material_label,
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
                                source_name=getattr(po, "order_name", None) or po.order_code,
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
        resp.items = [_build_purchase_receipt_item_response(i) for i in items]
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
            user_info = await self.get_user_info(updated_by)
            receipt_dict = receipt_data.model_dump(exclude_unset=True, exclude={"items", "receipt_code"})
            if not int(receipt_dict.get("purchase_order_id") or 0):
                receipt_dict.pop("purchase_order_id", None)
            if not str(receipt_dict.get("purchase_order_code") or "").strip():
                receipt_dict.pop("purchase_order_code", None)
            receipt_dict["updated_by"] = updated_by
            receipt_dict["updated_by_name"] = user_info.get("name", "")
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
                pending_po_received: Dict[int, Decimal] = {}
                for item_data in receipt_data.items:
                    qty = Decimal(str(item_data.receipt_quantity or 0))
                    if qty <= 0:
                        raise ValidationError(f"物料 {item_data.material_code} 的实际数量必须大于 0")
                    unit_price = Decimal(str(item_data.unit_price or 0))
                    line_amount = qty * unit_price

                    purchase_order_item_id = int(getattr(item_data, "purchase_order_item_id", 0) or 0)
                    if purchase_order_item_id > 0:
                        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

                        await PurchaseOrderItem.filter(
                            tenant_id=tenant_id,
                            id=purchase_order_item_id,
                        ).select_for_update().first()

                        await _assert_purchase_receipt_tolerance_for_po_item(
                            tenant_id,
                            purchase_order_item_id,
                            qty,
                            tolerance_percentage,
                            getattr(item_data, "material_name", None) or getattr(item_data, "material_code", "未知物料"),
                            exclude_receipt_id=receipt_id,
                            extra_pending_qty=pending_po_received.get(purchase_order_item_id, Decimal("0")),
                        )
                        pending_po_received[purchase_order_item_id] = (
                            pending_po_received.get(purchase_order_item_id, Decimal("0")) + qty
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
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_inbound_hub_list_capabilities,
        )
        item_counts = await batch_document_item_counts(
            tenant_id, PurchaseReceiptItem, "receipt_id", [r.id for r in receipts]
        )
        return enrich_inbound_hub_list_capabilities(receipts, out, "purchase", item_counts=item_counts)

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

            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                assert_inbound_hub_capability,
            )

            assert_inbound_hub_capability(receipt, "confirm", receipt_type="purchase")

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
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
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
                            item_update["warehouse_name"] = await _resolve_warehouse_name_by_id(
                                tenant_id,
                                item_data.warehouse_id,
                                item_data.warehouse_name,
                            )
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
                        if item_data.receipt_quantity is not None:
                            qty = Decimal(str(item_data.receipt_quantity))
                            if qty <= 0:
                                raise BusinessLogicError("确认入库数量须大于 0")
                            item_update["receipt_quantity"] = qty
                            existing = await PurchaseReceiptItem.get_or_none(
                                tenant_id=tenant_id, id=item_data.item_id, receipt_id=receipt_id
                            )
                            if existing is not None:
                                unit_price = getattr(existing, "unit_price", None)
                                if unit_price is not None:
                                    item_update["total_amount"] = (
                                        qty * Decimal(str(unit_price))
                                    ).quantize(Decimal("0.01"))

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

            # 过账前重载表头，避免仅内存对象与库内表头仓库等不一致
            receipt = await PurchaseReceipt.get(tenant_id=tenant_id, id=receipt_id)

            receipt_po_id = int(getattr(receipt, "purchase_order_id", 0) or 0)
            if receipt_po_id > 0:
                await sync_purchase_order_receipt_quantities(tenant_id, receipt_po_id)

            tolerance_percentage = await self.business_config_service.get_purchase_tolerance_percentage(tenant_id)
            items_for_tolerance = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt_id
            ).all()
            from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

            pending_po_received: Dict[int, Decimal] = {}
            for item in items_for_tolerance:
                purchase_order_item_id = int(getattr(item, "purchase_order_item_id", 0) or 0)
                if purchase_order_item_id <= 0:
                    continue
                qty = item.receipt_quantity or Decimal(0)
                if qty <= 0:
                    continue
                await PurchaseOrderItem.filter(
                    tenant_id=tenant_id,
                    id=purchase_order_item_id,
                ).select_for_update().first()
                await _assert_purchase_receipt_tolerance_for_po_item(
                    tenant_id,
                    purchase_order_item_id,
                    qty,
                    tolerance_percentage,
                    getattr(item, "material_name", None) or getattr(item, "material_code", "未知物料"),
                    exclude_receipt_id=receipt_id,
                    extra_pending_qty=pending_po_received.get(purchase_order_item_id, Decimal("0")),
                )
                pending_po_received[purchase_order_item_id] = (
                    pending_po_received.get(purchase_order_item_id, Decimal("0")) + qty
                )

            # 先过账库存，成功后再改单据状态，避免库存失败时单据已显示「已入库」
            confirmer_name = await self.get_user_name(confirmed_by)
            receipt_time = resolve_business_datetime(
                confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None
            )
            ledger_production_date = to_site_date(receipt_time)
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                # 重新加载明细以获取最新的批号
                items = await PurchaseReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).all()
                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                _stock_snap = []
                for item in items:
                    qty = item.receipt_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
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
                        quantity=base_qty,
                        warehouse_id=line_wh,
                        batch_no=item.batch_number or None,
                        serial_nos=_parse_serial_numbers(getattr(item, "serial_numbers", None)) or None,
                        source_type="purchase_receipt",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt.receipt_code,
                        ledger_production_date=ledger_production_date,
                        ledger_expiry_date=getattr(item, "expiry_date", None),
                        movement_type="purchase_receipt",
                        to_warehouse_id=line_wh,
                        idempotency_key=f"purchase_receipt:{receipt_id}:inc:{item.id}",
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
                    {
                        "exc_type": type(inv_e).__name__,
                        "exc": str(inv_e)[:800],
                        "cause_type": type(inv_e.__cause__).__name__ if inv_e.__cause__ else None,
                        "cause": str(inv_e.__cause__)[:800] if inv_e.__cause__ else None,
                    },
                    "H5",
                )
                # #endregion
                logger.error("采购入库确认-更新库存失败: %s", inv_e)
                if inv_e.__cause__ is not None:
                    raise inv_e.__cause__ from inv_e
                raise

            _hdr_upd_rows = await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                status='已入库',
                receiver_id=confirmed_by,
                receiver_name=confirmer_name,
                receipt_time=receipt_time,
                updated_by=confirmed_by,
                updated_by_name=confirmer_name,
            )
            _it_upd_rows = await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).update(
                status='已入库',
                receipt_time=receipt_time,
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
                    from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date

                    biz_date = to_site_date(resolve_business_datetime())
                    due_date = await resolve_partner_due_date(
                        tenant_id, "supplier", int(receipt_for_payable.supplier_id), biz_date
                    )
                    payable_data = PayableCreate(
                        source_type="采购入库",
                        source_id=receipt_id,
                        source_code=receipt_for_payable.receipt_code,
                        supplier_id=receipt_for_payable.supplier_id,
                        supplier_name=receipt_for_payable.supplier_name,
                        total_amount=float(total_amount),
                        paid_amount=0.0,
                        remaining_amount=float(total_amount),
                        due_date=due_date,
                        business_date=biz_date,
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
                        logger.exception(
                            "创建采购入库→应付单 单据关联/会计事件失败 receipt_code=%s",
                            receipt_for_payable.receipt_code,
                        )
            except Exception as e:
                logger.exception(
                    "自动生成应付单失败 receipt_code=%s（不影响入库确认结果）",
                    receipt_for_payable.receipt_code,
                )
        # #region agent log
        _agent_debug_ndjson(
            "warehouse_service.confirm_receipt:after_tx",
            "tx_committed_before_detail_fetch",
            {"receipt_id": receipt_id},
            "H7",
            run_id="post-fix",
        )
        # #endregion
        receipt_po_id = int(getattr(receipt_for_payable, "purchase_order_id", 0) or 0)
        if receipt_po_id > 0:
            await sync_purchase_order_receipt_quantities(tenant_id, receipt_po_id)
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
                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in items:
                    qty = item.receipt_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
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
                        quantity=base_qty,
                        warehouse_id=line_wh,
                        batch_no=item.batch_number or None,
                        source_type="purchase_receipt_revoke",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt_obj.receipt_code,
                    )

                user_info = await self.get_user_info(updated_by)
                await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                    status="待入库",
                    receiver_id=None,
                    receiver_name=None,
                    receipt_time=None,
                    updated_by=updated_by,
                    updated_by_name=user_info.get("name", ""),
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

            po_id = int(getattr(receipt, "purchase_order_id", 0) or 0)

        if po_id > 0:
            await sync_purchase_order_receipt_quantities(tenant_id, po_id)
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
            now = resolve_business_datetime()
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
                
                receipt_wh_id, receipt_wh_name = await _resolve_warehouse_identity(
                    tenant_id=tenant_id,
                    warehouse_id=receipt_data.get("warehouse_id"),
                    warehouse_name=receipt_data.get("warehouse_name"),
                )

                # 创建入库单
                receipt_create_data = PurchaseReceiptCreate(
                    purchase_order_id=purchase_order.id,
                    purchase_order_code=purchase_order.order_code,
                    supplier_id=purchase_order.supplier_id,
                    supplier_name=purchase_order.supplier_name,
                    warehouse_id=receipt_wh_id,
                    warehouse_name=receipt_wh_name,
                    receipt_time=resolve_business_datetime(receipt_data.get('receipt_time')),
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
        timestamp = resolve_business_datetime().strftime('%Y%m%d_%H%M%S')
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

SALES_RETURN_SORTABLE_FIELDS = frozenset({
    "return_code",
    "sales_delivery_code",
    "sales_order_code",
    "customer_name",
    "warehouse_name",
    "return_time",
    "total_quantity",
    "total_amount",
    "status",
    "review_status",
    "created_at",
    "updated_at",
})


class SalesReturnService(AppBaseService[SalesReturn]):
    """销售退货单服务"""

    def __init__(self):
        super().__init__(SalesReturn)

    async def _return_has_items_map(self, tenant_id: int, return_ids: List[int]) -> dict[int, bool]:
        counts = await self._return_item_count_map(tenant_id, return_ids)
        return {rid: count > 0 for rid, count in counts.items()}

    async def _return_item_count_map(self, tenant_id: int, return_ids: List[int]) -> dict[int, int]:
        if not return_ids:
            return {}
        from tortoise.functions import Count

        rows = await SalesReturnItem.filter(
            tenant_id=tenant_id,
            return_id__in=return_ids,
        ).annotate(cnt=Count("id")).group_by("return_id").values("return_id", "cnt")
        return {int(r["return_id"]): int(r["cnt"] or 0) for r in rows}

    async def _enrich_return_response(
        self,
        tenant_id: int,
        return_obj: SalesReturn,
        response: SalesReturnResponse,
        *,
        audit_required: bool = False,
    ) -> SalesReturnResponse:
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_sales_return_capabilities_on_response,
        )

        items = await SalesReturnItem.filter(
            tenant_id=tenant_id, return_id=return_obj.id
        ).order_by("id")
        if items:
            await _hydrate_item_material_snapshot(tenant_id, items)
        item_responses = [_build_sales_return_item_response(i) for i in items]
        item_count = len(item_responses)
        enriched = enrich_sales_return_capabilities_on_response(
            return_obj,
            response,
            has_items=item_count > 0,
            audit_required=audit_required,
        )
        if hasattr(enriched, "model_copy"):
            return enriched.model_copy(
                update={"items": item_responses, "total_items": item_count}
            )
        enriched.items = item_responses
        enriched.total_items = item_count
        return enriched

    async def create_sales_return(self, tenant_id: int, return_data: SalesReturnCreate, created_by: int) -> SalesReturnResponse:
        """创建销售退货单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供return_code，则自动生成
            if return_data.return_code:
                code = return_data.return_code
            else:
                today = today_site_str()
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

            resolved_warehouse_id, resolved_warehouse_name = await _resolve_warehouse_identity(
                tenant_id=tenant_id,
                warehouse_id=return_data.warehouse_id,
                warehouse_name=return_data.warehouse_name,
            )
            
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
                warehouse_id=resolved_warehouse_id,
                warehouse_name=resolved_warehouse_name,
                return_time=return_data.return_time,
                returner_id=return_data.returner_id,
                returner_name=return_data.returner_name,
                reviewer_id=return_data.reviewer_id,
                reviewer_name=return_data.reviewer_name,
                review_time=return_data.review_time,
                review_status="草稿",
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
                created_by_name=user_info.get("name", ""),
                updated_by=user_info.get("id"),
                updated_by_name=user_info.get("name", ""),
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
                    if not material:
                        raise ValidationError(f"物料不存在: {item_data.material_id}")
                    material_code, material_name, material_unit, material_spec = (
                        _resolve_material_snapshot_fields(material, item_data)
                    )
                    if not material_code or not material_name:
                        raise ValidationError(f"物料 {item_data.material_id} 缺少编码或名称")
                    batch_number = getattr(item_data, 'batch_number', None)
                    sales_delivery_item_id = getattr(item_data, "sales_delivery_item_id", None)
                    if sales_delivery_item_id:
                        source_item_q = SalesDeliveryItem.filter(
                            tenant_id=tenant_id,
                            id=sales_delivery_item_id,
                            deleted_at__isnull=True,
                        )
                        if sales_delivery_id:
                            source_item_q = source_item_q.filter(delivery_id=sales_delivery_id)
                        source_item = await source_item_q.first()
                        if not source_item:
                            raise ValidationError(
                                f"销售退货失败：未找到关联的销售出库明细 {sales_delivery_item_id}"
                            )
                        _validate_sales_return_batch_traceability(
                            source_batch_number=getattr(source_item, "batch_number", None),
                            return_batch_number=batch_number,
                            material_label=material_name or material_code or "未知物料",
                        )
                    # 序列号信息（批号和序列号选择功能增强）
                    serial_numbers = getattr(item_data, 'serial_numbers', None)
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
                        material_label=material_name or material_code or "未知物料",
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
                        material_code=material_code,
                        material_name=material_name,
                        material_spec=material_spec,
                        material_unit=material_unit,
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
            
            return await self._enrich_return_response(
                tenant_id,
                return_obj,
                SalesReturnResponse.model_validate(return_obj),
            )

    async def get_sales_order_return_preview(
        self,
        tenant_id: int,
        sales_order_id: int,
    ):
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from apps.kuaizhizao.schemas.warehouse import InboundCreatePreviewLine, SalesOrderReturnPreviewResponse

        sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id)
        if not sales_order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")

        order_items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=sales_order_id).all()
        if not order_items:
            raise BusinessLogicError("销售订单没有明细，无法预览退货明细")

        return_ids = await SalesReturn.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
        returned_by_material: Dict[int, float] = {}
        if return_ids:
            return_items = await SalesReturnItem.filter(
                tenant_id=tenant_id,
                return_id__in=list(return_ids),
            ).all()
            for ri in return_items:
                mid = int(ri.material_id)
                returned_by_material[mid] = returned_by_material.get(mid, 0.0) + float(ri.return_quantity or 0)

        await _hydrate_item_material_snapshot(tenant_id, order_items)

        lines: List[InboundCreatePreviewLine] = []
        for item in order_items:
            delivered = float(item.delivered_quantity or 0)
            if delivered <= 0:
                continue
            returned = returned_by_material.get(int(item.material_id), 0.0)
            pending = max(0.0, delivered - returned)
            if pending <= 0:
                continue
            unit_price = float(item.unit_price or 0)
            outbound_batches = await _list_sales_order_material_outbound_batches(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                material_id=int(item.material_id),
            )
            outbound_batch_options: List[str] = []
            suggested_batch: Optional[str] = None
            suggested_delivery_item_id: Optional[int] = None
            for row in outbound_batches:
                batch = str(row.get("batch_number") or "").strip()
                if batch and batch not in outbound_batch_options:
                    outbound_batch_options.append(batch)
                if suggested_batch is None and batch:
                    suggested_batch = batch
                    suggested_delivery_item_id = (
                        int(row["sales_delivery_item_id"])
                        if row.get("sales_delivery_item_id") is not None
                        else None
                    )
            lines.append(
                InboundCreatePreviewLine(
                    sales_order_item_id=int(item.id),
                    sales_delivery_item_id=suggested_delivery_item_id,
                    material_id=int(item.material_id),
                    material_code=item.material_code or "",
                    material_name=item.material_name or "",
                    material_spec=item.material_spec,
                    material_unit=item.material_unit or "个",
                    source_doc_quantity=delivered,
                    source_received_quantity=returned,
                    source_pending_quantity=pending,
                    return_quantity=pending,
                    unit_price=unit_price,
                    batch_number=suggested_batch,
                    outbound_batch_options=outbound_batch_options,
                )
            )

        message = None
        if not lines:
            message = "该销售订单没有可退货的明细（需已发货且未全部退完）"

        return SalesOrderReturnPreviewResponse(
            sales_order_id=sales_order_id,
            sales_order_code=sales_order.order_code or str(sales_order_id),
            lines=lines,
            message=message,
        )

    async def pull_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        warehouse_id: int,
        warehouse_name: Optional[str] = None,
        return_quantities: Optional[Dict[int, float]] = None,
        batch_numbers: Optional[Dict[int, str]] = None,
        return_code: Optional[str] = None,
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

        preview = await self.get_sales_order_return_preview(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
        returnable_by_item_id = {
            int(line.sales_order_item_id): Decimal(str(line.source_pending_quantity or 0))
            for line in preview.lines
            if line.sales_order_item_id is not None
        }

        return_quantities = _coerce_id_float_map(return_quantities)
        batch_numbers = _coerce_id_str_map(batch_numbers)
        qty_keys = set(return_quantities.keys()) if return_quantities else None
        return_items: List[SalesReturnItemCreate] = []
        header_delivery_ids: set[int] = set()
        for item in order_items:
            if qty_keys is not None and int(item.id) not in qty_keys:
                continue
            returnable_qty = returnable_by_item_id.get(int(item.id), Decimal("0"))
            if returnable_qty <= 0:
                continue
            if return_quantities and int(item.id) in return_quantities:
                selected_qty = Decimal(str(return_quantities[int(item.id)]))
            else:
                selected_qty = returnable_qty
            if selected_qty <= 0:
                continue
            if selected_qty > returnable_qty:
                raise BusinessLogicError(
                    f"物料 {item.material_code or item.material_name} 的退货数量不能超过可退数量 {returnable_qty}"
                )
            outbound_batches = await _list_sales_order_material_outbound_batches(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                material_id=int(item.material_id),
            )
            batch_number: Optional[str] = None
            if batch_numbers and int(item.id) in batch_numbers:
                batch_number = str(batch_numbers[int(item.id)] or "").strip() or None
            if not batch_number and outbound_batches:
                for row in outbound_batches:
                    candidate = str(row.get("batch_number") or "").strip()
                    if candidate:
                        batch_number = candidate
                        break
            outbound_link = _resolve_outbound_link_for_batch(outbound_batches, batch_number)
            sales_delivery_item_id = (
                int(outbound_link["sales_delivery_item_id"])
                if outbound_link and outbound_link.get("sales_delivery_item_id")
                else None
            )
            item_delivery_id = (
                int(outbound_link["sales_delivery_id"])
                if outbound_link and outbound_link.get("sales_delivery_id")
                else None
            )
            if item_delivery_id:
                header_delivery_ids.add(item_delivery_id)
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
                    batch_number=batch_number,
                    sales_delivery_item_id=sales_delivery_item_id,
                    status="待退货",
                )
            )

        if not return_items:
            raise BusinessLogicError("没有可退货的明细")

        header_sales_delivery_id: Optional[int] = None
        if len(header_delivery_ids) == 1:
            header_sales_delivery_id = next(iter(header_delivery_ids))

        return_data = SalesReturnCreate(
            return_code=return_code,
            sales_delivery_id=header_sales_delivery_id,
            sales_order_id=sales_order.id,
            sales_order_code=sales_order.order_code,
            customer_id=sales_order.customer_id,
            customer_name=sales_order.customer_name,
            warehouse_id=warehouse_id,
            warehouse_name=await _resolve_warehouse_name_by_id(tenant_id, warehouse_id, warehouse_name),
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

    async def get_sales_delivery_return_preview(
        self,
        tenant_id: int,
        sales_delivery_id: int,
    ):
        """从已出库销售出库单预览可退货明细（含原出库批号）。"""
        from apps.kuaizhizao.schemas.warehouse import (
            InboundCreatePreviewLine,
            SalesDeliveryReturnPreviewResponse,
        )

        delivery = await SalesDelivery.get_or_none(
            tenant_id=tenant_id,
            id=sales_delivery_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {sales_delivery_id}")
        if str(delivery.status or "").strip() not in _SALES_OUTBOUND_CLOSED_STATUSES:
            raise BusinessLogicError("仅已出库的销售出库单可创建销售退货单")

        delivery_items = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id=sales_delivery_id,
            deleted_at__isnull=True,
        ).order_by("id")
        if not delivery_items:
            raise BusinessLogicError("销售出库单没有明细，无法预览退货明细")

        await _hydrate_item_material_snapshot(tenant_id, delivery_items)
        returned_by_item = await _sum_returned_qty_by_delivery_item_ids(
            tenant_id,
            [int(i.id) for i in delivery_items],
        )

        lines: List[InboundCreatePreviewLine] = []
        for item in delivery_items:
            delivered = float(item.delivery_quantity or 0)
            if delivered <= 0:
                continue
            returned = float(returned_by_item.get(int(item.id), 0.0))
            pending = max(0.0, delivered - returned)
            if pending <= 0:
                continue
            batch = str(getattr(item, "batch_number", None) or "").strip() or None
            lines.append(
                InboundCreatePreviewLine(
                    sales_delivery_item_id=int(item.id),
                    material_id=int(item.material_id),
                    material_code=item.material_code or "",
                    material_name=item.material_name or "",
                    material_spec=item.material_spec,
                    material_unit=item.material_unit or "个",
                    source_doc_quantity=delivered,
                    source_received_quantity=returned,
                    source_pending_quantity=pending,
                    return_quantity=pending,
                    unit_price=float(item.unit_price or 0),
                    batch_number=batch,
                    outbound_batch_options=[batch] if batch else [],
                )
            )

        message = None
        if not lines:
            message = "该销售出库单没有可退货的明细（需有出库数量且未全部退完）"

        return SalesDeliveryReturnPreviewResponse(
            sales_delivery_id=sales_delivery_id,
            sales_delivery_code=delivery.delivery_code or str(sales_delivery_id),
            customer_id=delivery.customer_id,
            customer_name=delivery.customer_name,
            warehouse_id=delivery.warehouse_id,
            warehouse_name=delivery.warehouse_name,
            sales_order_id=delivery.sales_order_id,
            sales_order_code=delivery.sales_order_code,
            lines=lines,
            message=message,
        )

    async def pull_from_sales_delivery(
        self,
        tenant_id: int,
        sales_delivery_id: int,
        created_by: int,
        warehouse_id: int,
        warehouse_name: Optional[str] = None,
        return_quantities: Optional[Dict[int, float]] = None,
        return_code: Optional[str] = None,
    ) -> SalesReturnResponse:
        """从销售出库单下推生成销售退货单（带出原出库批号与出库明细追溯）。"""
        from apps.kuaizhizao.schemas.warehouse import SalesReturnItemCreate

        delivery = await SalesDelivery.get_or_none(
            tenant_id=tenant_id,
            id=sales_delivery_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {sales_delivery_id}")

        preview = await self.get_sales_delivery_return_preview(
            tenant_id=tenant_id,
            sales_delivery_id=sales_delivery_id,
        )
        returnable_by_item_id = {
            int(line.sales_delivery_item_id): Decimal(str(line.source_pending_quantity or 0))
            for line in preview.lines
            if line.sales_delivery_item_id is not None
        }
        line_by_item_id = {
            int(line.sales_delivery_item_id): line
            for line in preview.lines
            if line.sales_delivery_item_id is not None
        }

        return_quantities = _coerce_id_float_map(return_quantities)
        qty_keys = set(return_quantities.keys()) if return_quantities else None
        return_items: List[SalesReturnItemCreate] = []
        for item_id, returnable_qty in returnable_by_item_id.items():
            if qty_keys is not None and item_id not in qty_keys:
                continue
            if returnable_qty <= 0:
                continue
            if return_quantities and item_id in return_quantities:
                selected_qty = Decimal(str(return_quantities[item_id]))
            else:
                selected_qty = returnable_qty
            if selected_qty <= 0:
                continue
            if selected_qty > returnable_qty:
                line = line_by_item_id.get(item_id)
                label = (line.material_code or line.material_name) if line else str(item_id)
                raise BusinessLogicError(
                    f"物料 {label} 的退货数量不能超过可退数量 {returnable_qty}"
                )
            line = line_by_item_id[item_id]
            batch_number = str(line.batch_number or "").strip() or None
            unit_price = Decimal(str(line.unit_price or 0))
            total_amount = selected_qty * unit_price
            return_items.append(
                SalesReturnItemCreate(
                    sales_delivery_item_id=item_id,
                    material_id=line.material_id,
                    material_code=line.material_code,
                    material_name=line.material_name,
                    material_spec=line.material_spec,
                    material_unit=line.material_unit,
                    return_quantity=float(selected_qty),
                    unit_price=float(unit_price),
                    total_amount=float(total_amount),
                    batch_number=batch_number,
                    status="待退货",
                )
            )

        if not return_items:
            raise BusinessLogicError("没有可退货的明细")

        return_data = SalesReturnCreate(
            return_code=return_code,
            sales_delivery_id=delivery.id,
            sales_delivery_code=delivery.delivery_code,
            sales_order_id=delivery.sales_order_id,
            sales_order_code=delivery.sales_order_code,
            customer_id=delivery.customer_id,
            customer_name=delivery.customer_name,
            warehouse_id=warehouse_id,
            warehouse_name=await _resolve_warehouse_name_by_id(tenant_id, warehouse_id, warehouse_name),
            status="待退货",
            return_reason="出库退货",
            notes=f"从销售出库单 {delivery.delivery_code} 下推生成",
            items=return_items,
        )
        created = await self.create_sales_return(
            tenant_id=tenant_id,
            return_data=return_data,
            created_by=created_by,
        )

        try:
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sales_delivery",
                    source_id=delivery.id,
                    source_code=delivery.delivery_code,
                    target_type="sales_return",
                    target_id=created.id,
                    target_code=created.return_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="销售出库单下推销售退货单",
                ),
                created_by=created_by,
            )
        except Exception as rel_err:
            logger.warning("建立销售出库→销售退货关联失败: %s", rel_err)

        return created

    async def list_customer_outbound_batches_for_return(
        self,
        tenant_id: int,
        customer_id: int,
        material_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """列出客户已出库且仍有可退数量的批号选项（手工建退货单选用）。"""
        if customer_id <= 0:
            raise ValidationError("必须提供客户ID")

        delivery_ids = await SalesDelivery.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            deleted_at__isnull=True,
            status__in=list(_SALES_OUTBOUND_CLOSED_STATUSES),
        ).order_by("-id").values_list("id", flat=True)
        if not delivery_ids:
            return []

        item_q = SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id__in=list(delivery_ids),
            deleted_at__isnull=True,
        )
        if material_id is not None and int(material_id) > 0:
            item_q = item_q.filter(material_id=int(material_id))
        items = await item_q.order_by("-id")
        if not items:
            return []

        await _hydrate_item_material_snapshot(tenant_id, items)
        returned_by_item = await _sum_returned_qty_by_delivery_item_ids(
            tenant_id,
            [int(i.id) for i in items],
        )
        delivery_code_by_id = {
            int(d.id): (d.delivery_code or str(d.id))
            for d in await SalesDelivery.filter(
                tenant_id=tenant_id,
                id__in=list({int(i.delivery_id) for i in items}),
            )
        }

        result: List[Dict[str, Any]] = []
        for item in items:
            delivered = float(item.delivery_quantity or 0)
            if delivered <= 0:
                continue
            returned = float(returned_by_item.get(int(item.id), 0.0))
            returnable = max(0.0, delivered - returned)
            if returnable <= 0:
                continue
            batch = str(getattr(item, "batch_number", None) or "").strip() or None
            result.append(
                {
                    "batch_number": batch,
                    "sales_delivery_id": int(item.delivery_id),
                    "sales_delivery_code": delivery_code_by_id.get(
                        int(item.delivery_id), str(item.delivery_id)
                    ),
                    "sales_delivery_item_id": int(item.id),
                    "material_id": int(item.material_id),
                    "material_code": item.material_code or "",
                    "material_name": item.material_name or "",
                    "delivery_quantity": delivered,
                    "returned_quantity": returned,
                    "returnable_quantity": returnable,
                }
            )
        return result

    async def submit_sales_return(
        self,
        tenant_id: int,
        return_id: int,
        submitted_by: int,
    ) -> SalesReturnResponse:
        from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

        return_obj = await SalesReturn.get_or_none(
            id=return_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")

        item_count = await SalesReturnItem.filter(tenant_id=tenant_id, return_id=return_id).count()
        audit_required = await BusinessConfigService().check_audit_required(tenant_id, "sales_return")
        assert_sales_return_capability(
            return_obj,
            "submit",
            has_items=item_count > 0,
            audit_required=audit_required,
        )

        review = str(return_obj.review_status or "").strip()
        if review == "待审核":
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            status = await ApprovalInstanceService.get_approval_status(
                tenant_id=tenant_id,
                entity_type="sales_return",
                entity_id=return_id,
            )
            if status.get("has_flow"):
                return await self.get_sales_return_by_id(tenant_id, return_id)

        if not audit_required:
            submitter_name = await self.get_user_name(submitted_by)
            await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
                review_status="审核通过",
                reviewer_id=submitted_by,
                reviewer_name=submitter_name,
                review_time=resolve_business_datetime(),
                updated_by=submitted_by,
            )
            return await self.get_sales_return_by_id(tenant_id, return_id)

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="sales_return",
            entity_type="sales_return",
            entity_id=return_obj.id,
            entity_uuid=str(return_obj.uuid),
            title=f"销售退货审批: {return_obj.return_code}",
            content=f"客户: {return_obj.customer_name}, 金额: {return_obj.total_amount}",
        )
        if not instance:
            raise BusinessLogicError(
                "销售退货审核已开启但未找到可用的审批流程，请在配置中心检查 sales_return 审批流程是否已激活"
            )
        await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
            review_status="待审核",
            updated_by=submitted_by,
        )
        return await self.get_sales_return_by_id(tenant_id, return_id)

    async def approve_sales_return(
        self,
        tenant_id: int,
        return_id: int,
        approver_id: int,
    ) -> SalesReturnResponse:
        from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

        return_obj = await SalesReturn.get_or_none(
            id=return_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")

        audit_required = await BusinessConfigService().check_audit_required(tenant_id, "sales_return")
        assert_sales_return_capability(return_obj, "approve", audit_required=audit_required)

        approver_name = await self.get_user_name(approver_id)
        await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
            review_status="审核通过",
            reviewer_id=approver_id,
            reviewer_name=approver_name,
            review_time=resolve_business_datetime(),
            updated_by=approver_id,
        )
        return await self.get_sales_return_by_id(tenant_id, return_id)

    async def reject_sales_return(
        self,
        tenant_id: int,
        return_id: int,
        approver_id: int,
        *,
        rejection_reason: Optional[str] = None,
    ) -> SalesReturnResponse:
        from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

        return_obj = await SalesReturn.get_or_none(
            id=return_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")

        audit_required = await BusinessConfigService().check_audit_required(tenant_id, "sales_return")
        assert_sales_return_capability(return_obj, "reject", audit_required=audit_required)

        await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
            review_status="审核驳回",
            review_remarks=rejection_reason,
            reviewer_id=approver_id,
            review_time=resolve_business_datetime(),
            updated_by=approver_id,
        )
        return await self.get_sales_return_by_id(tenant_id, return_id)

    async def withdraw_sales_return_submit(
        self,
        tenant_id: int,
        return_id: int,
        operator_id: int,
    ) -> SalesReturnResponse:
        from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

        return_obj = await SalesReturn.get_or_none(
            id=return_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")

        audit_required = await BusinessConfigService().check_audit_required(tenant_id, "sales_return")
        assert_sales_return_capability(return_obj, "withdraw_submit", audit_required=audit_required)

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type="sales_return",
            entity_id=return_id,
            operator_id=operator_id,
        )
        await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
            review_status="草稿",
            reviewer_id=None,
            reviewer_name=None,
            review_time=None,
            review_remarks=None,
            updated_by=operator_id,
        )
        return await self.get_sales_return_by_id(tenant_id, return_id)

    async def revoke_sales_return_approval(
        self,
        tenant_id: int,
        return_id: int,
        operator_id: int,
    ) -> SalesReturnResponse:
        from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService

        return_obj = await SalesReturn.get_or_none(
            id=return_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")

        audit_required = await BusinessConfigService().check_audit_required(tenant_id, "sales_return")
        assert_sales_return_capability(return_obj, "revoke_approval", audit_required=audit_required)

        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        target_review = "待审核" if landing == "pending" else "草稿"

        async def _do_revoke() -> SalesReturnResponse:
            await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
                review_status=target_review,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=operator_id,
            )
            return await self.get_sales_return_by_id(tenant_id, return_id)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="sales_return",
            entity_id=return_id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )

    async def get_sales_return_by_id(self, tenant_id: int, return_id: int) -> SalesReturnResponse:
        """根据ID获取销售退货单"""
        return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")
        response = SalesReturnResponse.model_validate(return_obj)
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_return_lifecycle, get_document_milestones
        milestones = await get_document_milestones(tenant_id, "sales_return", return_id)
        response.lifecycle = get_sales_return_lifecycle(return_obj, milestones=milestones)
        from core.services.approval.audit_record_enricher import audit_enabled_for, enrich_record

        audit_required = await audit_enabled_for(tenant_id, "sales_return")
        response = await enrich_record(
            tenant_id, "sales_return", response, audit_enabled=audit_required
        )
        return await self._enrich_return_response(
            tenant_id, return_obj, response, audit_required=audit_required
        )

    async def list_sales_returns(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取销售退货单列表"""
        from datetime import time as dt_time

        query = SalesReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('sales_delivery_id'):
            query = query.filter(sales_delivery_id=filters['sales_delivery_id'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=int(filters['customer_id']))
        if filters.get('warehouse_id'):
            query = query.filter(warehouse_id=int(filters['warehouse_id']))
        if filters.get('return_start_date'):
            query = query.filter(
                return_time__gte=datetime.combine(filters['return_start_date'], dt_time.min)
            )
        if filters.get('return_end_date'):
            query = query.filter(
                return_time__lte=datetime.combine(filters['return_end_date'], dt_time(23, 59, 59))
            )
        if filters.get('created_start_date'):
            query = query.filter(
                created_at__gte=datetime.combine(filters['created_start_date'], dt_time.min)
            )
        if filters.get('created_end_date'):
            query = query.filter(
                created_at__lte=datetime.combine(filters['created_end_date'], dt_time(23, 59, 59))
            )
        keyword = str(filters.get('keyword') or '').strip()
        if keyword:
            from apps.kuaizhizao.utils.list_item_material_keyword import (
                header_ids_matching_item_material,
            )

            material_return_ids = await header_ids_matching_item_material(
                tenant_id,
                SalesReturnItem,
                "return_id",
                keyword,
            )
            query = query.filter(
                Q(return_code__icontains=keyword)
                | Q(customer_name__icontains=keyword)
                | Q(sales_delivery_code__icontains=keyword)
                | Q(sales_order_code__icontains=keyword)
                | Q(warehouse_name__icontains=keyword)
                | Q(id__in=material_return_ids)
            )
        if filters.get('return_code'):
            code = str(filters['return_code']).strip()
            if code:
                query = query.filter(return_code__icontains=code)
        if filters.get('sales_delivery_code'):
            delivery_code = str(filters['sales_delivery_code']).strip()
            if delivery_code:
                query = query.filter(sales_delivery_code__icontains=delivery_code)
        if filters.get('sales_order_code'):
            order_code = str(filters['sales_order_code']).strip()
            if order_code:
                query = query.filter(sales_order_code__icontains=order_code)

        total = await query.count()
        order_clause = filters.get('order_by') or '-created_at'
        returns = await query.offset(skip).limit(limit).order_by(order_clause, '-id')
        return_ids = [int(r.id) for r in returns]
        include_items = bool(filters.get("include_items"))
        items_by_return: dict[int, list] = {}
        if include_items and return_ids:
            from apps.kuaizhizao.schemas.warehouse import SalesReturnItemResponse

            all_items = (
                await SalesReturnItem.filter(tenant_id=tenant_id, return_id__in=return_ids)
                .order_by("return_id", "id")
                .all()
            )
            for it in all_items:
                rid = int(it.return_id)
                items_by_return.setdefault(rid, []).append(
                    SalesReturnItemResponse.model_validate(it)
                )
        has_items_by_id = await self._return_has_items_map(tenant_id, return_ids)
        item_counts_by_id = await self._return_item_count_map(tenant_id, return_ids)
        from apps.kuaizhizao.services.document_action_policy.enricher import enrich_sales_return_list_capabilities
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_return_lifecycle
        list_responses: List[SalesReturnResponse] = []
        for return_obj in returns:
            resp = SalesReturnResponse.model_validate(return_obj)
            resp.lifecycle = get_sales_return_lifecycle(return_obj)
            if include_items:
                resp.items = items_by_return.get(int(return_obj.id), [])
            list_responses.append(resp)
        from core.services.approval.audit_record_enricher import audit_enabled_for, enrich_items
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_sales_return_capabilities_on_response,
        )

        audit_required = await audit_enabled_for(tenant_id, "sales_return")
        audited = await enrich_items(
            tenant_id, "sales_return", list_responses, audit_enabled=audit_required
        )
        gated: List[SalesReturnResponse] = []
        for return_obj, resp in zip(returns, audited):
            rid = int(return_obj.id)
            with_items = resp.model_copy(update={"total_items": item_counts_by_id.get(rid, 0)})
            gated.append(
                enrich_sales_return_capabilities_on_response(
                    return_obj,
                    with_items,
                    has_items=has_items_by_id.get(rid, True),
                    audit_required=audit_required,
                )
            )
        return {
            'data': [item.model_dump() for item in gated],
            'total': total,
            'success': True,
        }

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

            from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

            item_count = await SalesReturnItem.filter(tenant_id=tenant_id, return_id=return_id).count()
            audit_required = await BusinessConfigService().check_audit_required(tenant_id, "sales_return")
            assert_sales_return_capability(
                return_obj,
                "confirm",
                has_items=item_count > 0,
                audit_required=audit_required,
            )

            # 1. 更新确认数据
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
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
            await _hydrate_item_material_snapshot(tenant_id, items)
            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if not material:
                    raise BusinessLogicError(
                        f"销售退货确认失败：物料不存在（ID={item.material_id}）"
                    )
                if material.batch_managed and not item.batch_number:
                    batch_no = await ensure_batch_no_for_item(tenant_id, material, item)
                    if batch_no:
                        item.batch_number = batch_no
                        await item.save()
                if material.serial_managed:
                    count = int(item.return_quantity or 0)
                    existing_serials = _parse_serial_numbers(getattr(item, "serial_numbers", None))
                    if len(existing_serials) < count:
                        serial_nos = await ensure_serial_nos_for_item(
                            tenant_id, material, item, count
                        )
                        if serial_nos:
                            item.serial_numbers = json.dumps(serial_nos)
                            await item.save()

            returner_name = await self.get_user_name(confirmed_by)
            receipt_time = resolve_business_datetime(
                confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None
            )

            await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status='已退货',
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=receipt_time,
                updated_by=confirmed_by,
                updated_by_name=returner_name,
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
                header = await SalesReturn.get(tenant_id=tenant_id, id=return_id)
                for item in reload_items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    wh_id = header.warehouse_id
                    if wh_id is None:
                        raise BusinessLogicError(
                            f"无法确定入库仓库：物料 "
                            f"{getattr(item, 'material_name', '') or getattr(item, 'material_code', '') or item.material_id}"
                        )
                    serial_nos = _parse_serial_numbers(getattr(item, "serial_numbers", None))
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        serial_nos=serial_nos or None,
                        source_type="sales_return",
                        source_doc_id=return_id,
                        source_doc_code=return_obj.return_code,
                        ledger_production_date=to_site_date(receipt_time),
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
                    from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date

                    receivable_service = ReceivableService()
                    biz_date = to_site_date(resolve_business_datetime())
                    due_date = await resolve_partner_due_date(
                        tenant_id, "customer", int(ret_obj.customer_id), biz_date
                    )
                    receivable_data = ReceivableCreate(
                        source_type="销售退货",
                        source_id=return_id,
                        source_code=ret_obj.return_code,
                        customer_id=ret_obj.customer_id,
                        customer_name=ret_obj.customer_name,
                        total_amount=total_amount,
                        received_amount=0.0,
                        remaining_amount=total_amount,
                        due_date=due_date,
                        business_date=biz_date,
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
            from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

            assert_sales_return_capability(return_obj, "update")

            if not isinstance(return_data, SalesReturnUpdate):
                return_data = SalesReturnUpdate.model_validate(return_data)

            payload = return_data.model_dump(exclude_unset=True, exclude={"items"})
            input_warehouse_id = payload.pop("warehouse_id", None)
            input_warehouse_name = payload.pop("warehouse_name", None)

            if input_warehouse_id is not None or input_warehouse_name is not None:
                resolved_warehouse_id, resolved_warehouse_name = await _resolve_warehouse_identity(
                    tenant_id=tenant_id,
                    warehouse_id=input_warehouse_id if input_warehouse_id is not None else return_obj.warehouse_id,
                    warehouse_name=input_warehouse_name,
                )
                return_obj.warehouse_id = resolved_warehouse_id
                return_obj.warehouse_name = resolved_warehouse_name

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
                    if not material:
                        raise ValidationError(f"物料不存在: {item_data.material_id}")
                    material_code, material_name, material_unit, material_spec = (
                        _resolve_material_snapshot_fields(material, item_data)
                    )
                    if not material_code or not material_name:
                        raise ValidationError(f"物料 {item_data.material_id} 缺少编码或名称")
                    batch_number = getattr(item_data, "batch_number", None)
                    serial_numbers = getattr(item_data, "serial_numbers", None)
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
                        material_label=material_name or material_code or "未知物料",
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
                        material_code=material_code,
                        material_name=material_name,
                        material_spec=material_spec,
                        material_unit=material_unit,
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
            return_obj.updated_by_name = (await self.get_user_info(updated_by))["name"]
            await return_obj.save()
            return await self.get_sales_return_by_id(tenant_id, return_id)

    async def delete_sales_return(self, tenant_id: int, return_id: int) -> bool:
        """删除销售退货单（软删除，仅待退货状态可删）"""
        return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")
        from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

        assert_sales_return_capability(return_obj, "delete")
        await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
            deleted_at=resolve_business_datetime()
        )
        return True

    async def withdraw_confirmation(self, tenant_id: int, return_id: int, updated_by: int) -> SalesReturnResponse:
        """撤回退货确认（已退货 -> 待退货），并回滚库存增加。"""
        async with in_transaction():
            return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
            if not return_obj:
                raise NotFoundError(f"销售退货单不存在: {return_id}")
            from apps.kuaizhizao.services.document_action_policy.sales_return import assert_sales_return_capability

            assert_sales_return_capability(return_obj, "withdraw")

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


PURCHASE_RETURN_SORTABLE_FIELDS = frozenset({
    "return_code",
    "supplier_name",
    "purchase_receipt_code",
    "purchase_order_code",
    "warehouse_name",
    "return_time",
    "total_quantity",
    "total_amount",
    "status",
    "review_status",
    "created_at",
    "updated_at",
})


class PurchaseReturnService(AppBaseService[PurchaseReturn]):
    """采购退货单服务"""

    def __init__(self):
        super().__init__(PurchaseReturn)

    async def _purchase_return_has_items_map(self, tenant_id: int, return_ids: List[int]) -> dict[int, bool]:
        if not return_ids:
            return {}
        from tortoise.functions import Count

        rows = await PurchaseReturnItem.filter(
            tenant_id=tenant_id,
            return_id__in=return_ids,
        ).annotate(cnt=Count("id")).group_by("return_id").values("return_id", "cnt")
        return {int(r["return_id"]): int(r["cnt"] or 0) > 0 for r in rows}

    async def _enrich_purchase_return_response(
        self,
        tenant_id: int,
        return_obj: PurchaseReturn,
        response: PurchaseReturnResponse,
    ) -> PurchaseReturnResponse:
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_purchase_return_capabilities_on_response,
        )

        item_count = await PurchaseReturnItem.filter(tenant_id=tenant_id, return_id=return_obj.id).count()
        return enrich_purchase_return_capabilities_on_response(
            return_obj,
            response,
            has_items=item_count > 0,
        )

    async def create_purchase_return(self, tenant_id: int, return_data: PurchaseReturnCreate, created_by: int) -> PurchaseReturnResponse:
        """创建采购退货单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供return_code，则自动生成
            if return_data.return_code:
                code = return_data.return_code
            else:
                today = today_site_str()
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
                created_by_name=user_info.get("name", ""),
                updated_by=user_info.get("id"),
                updated_by_name=user_info.get("name", ""),
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

        order_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=purchase_order_id).all()
        has_received = any(float(item.received_quantity or 0) > 0 for item in order_items)
        from apps.kuaizhizao.models.purchase_return import PurchaseReturn
        from apps.kuaizhizao.models.purchase_return_item import PurchaseReturnItem
        from apps.kuaizhizao.services.document_action_policy.enricher import _purchase_order_returnable_by_ids
        from apps.kuaizhizao.services.document_action_policy.purchase_order import assert_purchase_order_capability

        returnable_map = await _purchase_order_returnable_by_ids(tenant_id, [purchase_order_id])
        assert_purchase_order_capability(
            purchase_order,
            "push_purchase_return",
            has_items=bool(order_items),
            has_received=has_received,
            has_returnable=returnable_map.get(purchase_order_id, False),
        )

        if not order_items:
            raise BusinessLogicError("采购订单没有明细，无法下推采购退货单")

        return_ids = await PurchaseReturn.filter(
            tenant_id=tenant_id,
            purchase_order_id=purchase_order_id,
            deleted_at__isnull=True,
        ).exclude(status="已取消").values_list("id", flat=True)
        returned_by_material: Dict[int, float] = {}
        if return_ids:
            return_items = await PurchaseReturnItem.filter(
                tenant_id=tenant_id,
                return_id__in=list(return_ids),
            ).all()
            for ri in return_items:
                mid = int(ri.material_id)
                returned_by_material[mid] = returned_by_material.get(mid, 0.0) + float(ri.return_quantity or 0)

        return_items: List[PurchaseReturnItemCreate] = []
        for item in order_items:
            received_qty = Decimal(str(item.received_quantity or 0))
            if received_qty <= 0:
                continue
            returned_qty = Decimal(str(returned_by_material.get(int(item.material_id), 0.0)))
            max_return_qty = received_qty - returned_qty
            if max_return_qty <= 0:
                continue
            if return_quantities and item.id in return_quantities:
                selected_qty = Decimal(str(return_quantities[item.id]))
            else:
                selected_qty = max_return_qty
            if selected_qty <= 0:
                continue
            if selected_qty > max_return_qty:
                raise BusinessLogicError(
                    f"物料 {item.material_code or item.material_name} 的退货数量不能超过可退数量 {max_return_qty}"
                )
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
            warehouse_name=await _resolve_warehouse_name_by_id(tenant_id, warehouse_id, warehouse_name),
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
        response = PurchaseReturnResponse.model_validate(return_obj)
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_document_milestones,
            get_purchase_return_lifecycle,
        )

        milestones = await get_document_milestones(tenant_id, "purchase_return", return_id)
        response.lifecycle = get_purchase_return_lifecycle(return_obj, milestones=milestones)
        return await self._enrich_purchase_return_response(tenant_id, return_obj, response)

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

    async def list_purchase_returns(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取采购退货单列表"""
        from datetime import time as dt_time

        query = PurchaseReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('purchase_receipt_id'):
            query = query.filter(purchase_receipt_id=filters['purchase_receipt_id'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=int(filters['supplier_id']))
        if filters.get('warehouse_id'):
            query = query.filter(warehouse_id=int(filters['warehouse_id']))
        if filters.get('return_start_date'):
            query = query.filter(
                return_time__gte=datetime.combine(filters['return_start_date'], dt_time.min)
            )
        if filters.get('return_end_date'):
            query = query.filter(
                return_time__lte=datetime.combine(filters['return_end_date'], dt_time(23, 59, 59))
            )
        if filters.get('created_start_date'):
            query = query.filter(
                created_at__gte=datetime.combine(filters['created_start_date'], dt_time.min)
            )
        if filters.get('created_end_date'):
            query = query.filter(
                created_at__lte=datetime.combine(filters['created_end_date'], dt_time(23, 59, 59))
            )
        keyword = str(filters.get('keyword') or '').strip()
        if keyword:
            from apps.kuaizhizao.utils.list_item_material_keyword import (
                header_ids_matching_item_material,
            )

            material_return_ids = await header_ids_matching_item_material(
                tenant_id,
                PurchaseReturnItem,
                "return_id",
                keyword,
            )
            query = query.filter(
                Q(return_code__icontains=keyword)
                | Q(supplier_name__icontains=keyword)
                | Q(purchase_receipt_code__icontains=keyword)
                | Q(purchase_order_code__icontains=keyword)
                | Q(warehouse_name__icontains=keyword)
                | Q(id__in=material_return_ids)
            )
        if filters.get('return_code'):
            code = str(filters['return_code']).strip()
            if code:
                query = query.filter(return_code__icontains=code)
        if filters.get('purchase_receipt_code'):
            receipt_code = str(filters['purchase_receipt_code']).strip()
            if receipt_code:
                query = query.filter(purchase_receipt_code__icontains=receipt_code)
        if filters.get('purchase_order_code'):
            order_code = str(filters['purchase_order_code']).strip()
            if order_code:
                query = query.filter(purchase_order_code__icontains=order_code)

        total = await query.count()
        order_clause = filters.get('order_by') or '-created_at'
        field = order_clause.lstrip("-")
        if field not in PURCHASE_RETURN_SORTABLE_FIELDS:
            order_clause = '-created_at'
        returns = await query.offset(skip).limit(limit).order_by(order_clause, '-id')
        return_list = list(returns)
        return_ids = [int(r.id) for r in return_list if r.id is not None]
        include_items = bool(filters.get("include_items"))
        items_by_return: dict[int, list] = {}
        if include_items and return_ids:
            from apps.kuaizhizao.schemas.warehouse import PurchaseReturnItemResponse

            all_items = (
                await PurchaseReturnItem.filter(tenant_id=tenant_id, return_id__in=return_ids)
                .order_by("return_id", "id")
                .all()
            )
            for it in all_items:
                rid = int(it.return_id)
                items_by_return.setdefault(rid, []).append(
                    PurchaseReturnItemResponse.model_validate(it)
                )
        has_items_by_id = await self._purchase_return_has_items_map(tenant_id, return_ids)
        from apps.kuaizhizao.services.document_action_policy.enricher import enrich_purchase_return_list_capabilities
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_return_lifecycle

        list_responses: List[PurchaseReturnResponse] = []
        for return_obj in return_list:
            resp = PurchaseReturnResponse.model_validate(return_obj)
            resp.lifecycle = get_purchase_return_lifecycle(return_obj)
            if include_items:
                resp.items = items_by_return.get(int(return_obj.id), [])
            list_responses.append(resp)
        enriched = enrich_purchase_return_list_capabilities(
            return_list,
            list_responses,
            has_items_by_id=has_items_by_id,
        )
        return {
            'data': enriched,
            'total': total,
            'success': True,
        }

    async def confirm_return(self, tenant_id: int, return_id: int, confirmed_by: int) -> PurchaseReturnResponse:
        """确认退货"""
        async with in_transaction():
            return_obj = await PurchaseReturn.get_or_none(
                tenant_id=tenant_id, id=return_id, deleted_at__isnull=True
            )
            if not return_obj:
                raise NotFoundError(f"采购退货单不存在: {return_id}")
            from apps.kuaizhizao.services.document_action_policy.purchase_return import (
                assert_purchase_return_capability,
            )

            item_count = await PurchaseReturnItem.filter(tenant_id=tenant_id, return_id=return_id).count()
            assert_purchase_return_capability(return_obj, "confirm", has_items=item_count > 0)

            returner_name = await self.get_user_name(confirmed_by)

            await PurchaseReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status='已退货',
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=resolve_business_datetime(),
                updated_by=confirmed_by,
                updated_by_name=returner_name,
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
                if isinstance(inv_e, BusinessLogicError):
                    raise
                raise BusinessLogicError(str(inv_e) or "采购退货确认失败：库存扣减异常")

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
                    from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date

                    payable_service = PayableService()
                    biz_date = to_site_date(resolve_business_datetime())
                    due_date = await resolve_partner_due_date(
                        tenant_id, "supplier", int(ret_obj.supplier_id), biz_date
                    )
                    payable_data = PayableCreate(
                        source_type="采购退货",
                        source_id=return_id,
                        source_code=ret_obj.return_code,
                        supplier_id=ret_obj.supplier_id,
                        supplier_name=ret_obj.supplier_name,
                        total_amount=total_amount,
                        paid_amount=0.0,
                        remaining_amount=total_amount,
                        due_date=due_date,
                        business_date=biz_date,
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
            return_obj.updated_by_name = (await self.get_user_info(updated_by))["name"]
            await return_obj.save()
            return await self.get_purchase_return_by_id(tenant_id, return_id)

    async def withdraw_confirmation(self, tenant_id: int, return_id: int, updated_by: int) -> PurchaseReturnResponse:
        """撤回采购退货确认（已退货 -> 待退货），并回滚库存扣减。"""
        async with in_transaction():
            return_obj = await PurchaseReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
            if not return_obj:
                raise NotFoundError(f"采购退货单不存在: {return_id}")
            from apps.kuaizhizao.services.document_action_policy.purchase_return import (
                assert_purchase_return_capability,
            )

            assert_purchase_return_capability(return_obj, "withdraw")

            from apps.kuaizhizao.services.inventory_service import InventoryService
            from tortoise.timezone import now as tz_now

            items = await PurchaseReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
            ledger_production_date = (
                to_site_date(return_obj.return_time)
                if return_obj.return_time
                else to_site_date(tz_now())
            )
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
                    ledger_production_date=ledger_production_date,
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
            deleted_at=resolve_business_datetime()
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
            today = today_site_str()
            code = await self.generate_code(tenant_id, "OTHER_INBOUND_CODE", prefix=f"OI{today}")

            dump = inbound_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "inbound_code"})
            if inbound_data.inbound_code:
                code = inbound_data.inbound_code

            inbound = await OtherInbound.create(
                tenant_id=tenant_id,
                inbound_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
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
                    # 兜底补齐物料展示字段，避免前端仅传 material_id 时详情页出现空编码/空名称/空单位
                    if not str(item_dict.get("material_code") or "").strip():
                        item_dict["material_code"] = (getattr(material, "main_code", None) or getattr(material, "code", None) or "")
                    if not str(item_dict.get("material_name") or "").strip():
                        item_dict["material_name"] = getattr(material, "name", "") or ""
                    if not str(item_dict.get("material_unit") or "").strip():
                        item_dict["material_unit"] = getattr(material, "base_unit", "") or ""

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
        if items:
            await _hydrate_item_material_snapshot(tenant_id, items)

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
    ) -> tuple[List[OtherInboundListResponse], int]:
        """获取其他入库单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import (
            OTHER_INBOUND_KEYWORD_FIELDS,
            OTHER_INBOUND_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query = OtherInbound.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("reason_type"):
            query = query.filter(reason_type=filters["reason_type"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            allowed_fields=OTHER_INBOUND_SORTABLE_FIELDS,
            default_order="-updated_at",
            keyword_fields=OTHER_INBOUND_KEYWORD_FIELDS,
            doc_date_field="receipt_time",
            doc_start_date=filters.get("receipt_start_date"),
            doc_end_date=filters.get("receipt_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        total = await query.count()
        inbounds = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_inbound_hub_list_capabilities,
        )
        responses = [OtherInboundListResponse.model_validate(r) for r in inbounds]
        item_counts = await batch_document_item_counts(
            tenant_id, OtherInboundItem, "inbound_id", [r.id for r in inbounds]
        )
        from apps.kuaizhizao.services.document_lifecycle_service import get_other_inbound_lifecycle

        for inbound, resp in zip(inbounds, responses):
            resp.lifecycle = get_other_inbound_lifecycle(inbound, milestones=[])
        enriched = enrich_inbound_hub_list_capabilities(
            inbounds, responses, "other_inbound", item_counts=item_counts
        )
        return enriched, total

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
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
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
            deleted_at=resolve_business_datetime()
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
            material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
            material_by_id = await _load_materials_by_ids(tenant_id, material_ids)

            for item in items:
                qty = Decimal(str(item.inbound_quantity or 0))
                if qty <= 0:
                    continue
                base_qty = _convert_line_quantity_to_base(
                    quantity=qty,
                    material_unit=getattr(item, "material_unit", None),
                    material=material_by_id.get(item.material_id),
                )
                await InventoryService._decrease_stock_no_atomic(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=base_qty,
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

            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                assert_inbound_hub_capability,
            )

            assert_inbound_hub_capability(inbound, "confirm", receipt_type="other_inbound")

            # OtherInboundItem 无 serial_numbers 字段，确认流程内用 dict 暂存行级序列号
            serial_nos_by_item_id: Dict[int, List[str]] = {}

            # 1. 更新确认数据
            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
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
                        if item_data.serial_numbers:
                            parsed_serials = _parse_serial_numbers(item_data.serial_numbers)
                            if parsed_serials:
                                serial_nos_by_item_id[int(item_data.item_id)] = parsed_serials

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
                    if count <= 0:
                        continue
                    preset_serials = serial_nos_by_item_id.get(int(item.id))
                    serial_source = (
                        SimpleNamespace(serial_numbers=preset_serials)
                        if preset_serials
                        else item
                    )
                    serial_nos = await ensure_serial_nos_for_item(tenant_id, material, serial_source, count)
                    if serial_nos:
                        serial_nos_by_item_id[int(item.id)] = serial_nos

            receiver_name = await self.get_user_name(confirmed_by)
            receipt_time = resolve_business_datetime(
                confirmation_data.receipt_time if confirmation_data and confirmation_data.receipt_time else None
            )

            await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(
                status="已入库",
                receiver_id=confirmed_by,
                receiver_name=receiver_name,
                receipt_time=receipt_time,
                updated_by=confirmed_by,
                updated_by_name=receiver_name,
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
                material_ids = list({int(it.material_id) for it in reload_items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in reload_items:
                    qty = Decimal(str(item.inbound_quantity or 0))
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    wh_id = getattr(item, "warehouse_id", None) or inbound.warehouse_id
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        serial_nos=serial_nos_by_item_id.get(int(item.id)) or None,
                        source_type="other_inbound",
                        source_doc_id=inbound_id,
                        source_doc_code=inbound.inbound_code,
                        ledger_production_date=to_site_date(receipt_time),
                        ledger_expiry_date=getattr(item, "expiry_date", None),
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
                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                
                for item in items:
                    qty = Decimal(str(item.inbound_quantity or 0))
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    
                    # 反向扣减库存（decrease_stock 内部会校验余量，如果已被领用，这里会报错拦截）
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
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
            today = today_site_str()
            code = await self.generate_code(tenant_id, "OTHER_OUTBOUND_CODE", prefix=f"OO{today}")

            dump = outbound_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "outbound_code"})
            if outbound_data.outbound_code:
                code = outbound_data.outbound_code

            outbound = await OtherOutbound.create(
                tenant_id=tenant_id,
                outbound_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
                **dump
            )

            items = getattr(outbound_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            from apps.master_data.models.material import Material
            for item_data in items:
                qty = Decimal(str(item_data.outbound_quantity))
                item_dict = item_data.model_dump(exclude_unset=True)
                material = await Material.get_or_none(
                    tenant_id=tenant_id,
                    id=item_data.material_id,
                    deleted_at__isnull=True,
                )
                if not material:
                    raise ValidationError(f"物料不存在: {item_data.material_id}")
                if not str(item_dict.get("material_code") or "").strip():
                    item_dict["material_code"] = str(material.main_code or material.code or "").strip()
                if not str(item_dict.get("material_name") or "").strip():
                    item_dict["material_name"] = str(material.name or "").strip()
                if not str(item_dict.get("material_unit") or "").strip():
                    item_dict["material_unit"] = str(material.base_unit or "").strip()
                if not item_dict.get("material_code") or not item_dict.get("material_name"):
                    raise ValidationError(f"物料 {item_data.material_id} 缺少编码或名称")
                material_label = item_dict.get("material_name") or item_dict.get("material_code") or "未知物料"
                _validate_location_if_required(
                    location_required=location_required,
                    location_id=getattr(item_data, 'location_id', None),
                    location_code=getattr(item_data, 'location_code', None),
                    scene="其他出库",
                    material_label=material_label,
                )
                price = Decimal(str(item_data.unit_price))
                amt = qty * price
                await OtherOutboundItem.create(
                    tenant_id=tenant_id,
                    outbound_id=outbound.id,
                    outbound_quantity=qty,
                    unit_price=price,
                    total_amount=amt,
                    **{k: v for k, v in item_dict.items() if k not in ("outbound_quantity", "unit_price", "total_amount")}
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
        if items:
            await _hydrate_item_material_snapshot(tenant_id, items)
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
    ) -> tuple[List[OtherOutboundListResponse], int]:
        """获取其他出库单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import (
            OTHER_OUTBOUND_KEYWORD_FIELDS,
            OTHER_OUTBOUND_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query = OtherOutbound.filter(tenant_id=tenant_id)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("reason_type"):
            query = query.filter(reason_type=filters["reason_type"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            allowed_fields=OTHER_OUTBOUND_SORTABLE_FIELDS,
            default_order="-updated_at",
            keyword_fields=OTHER_OUTBOUND_KEYWORD_FIELDS,
            doc_date_field="delivery_time",
            doc_start_date=filters.get("delivery_start_date"),
            doc_end_date=filters.get("delivery_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        total = await query.count()
        outbounds = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_outbound_hub_list_capabilities,
        )
        from apps.kuaizhizao.services.document_lifecycle_service import get_other_outbound_lifecycle

        out: List[OtherOutboundListResponse] = []
        for outbound in outbounds:
            resp = OtherOutboundListResponse.model_validate(outbound)
            resp.lifecycle = get_other_outbound_lifecycle(outbound, milestones=[])
            out.append(resp)
        item_counts = await batch_document_item_counts(
            tenant_id, OtherOutboundItem, "outbound_id", [int(o.id) for o in outbounds]
        )
        enriched = enrich_outbound_hub_list_capabilities(
            outbounds, out, "other_outbound", item_counts=item_counts
        )
        return enriched, total

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
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
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
            deleted_at=resolve_business_datetime()
        )
        return True

    async def confirm_outbound(
        self,
        tenant_id: int,
        outbound_id: int,
        confirmed_by: int,
        confirmation_data: Optional[OutboundConfirmationRequest] = None,
    ) -> OtherOutboundResponse:
        """确认出库"""
        async with in_transaction():
            outbound = await self.get_other_outbound_by_id(tenant_id, outbound_id)

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(outbound, "confirm", outbound_type="other_outbound")

            if outbound.status != "待出库":
                raise BusinessLogicError("只有待出库状态的其他出库单才能确认出库")
            if not outbound.items or all((item.outbound_quantity or Decimal(0)) <= 0 for item in outbound.items):
                raise BusinessLogicError("请至少添加一条有效出库明细（数量大于0）")

            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                if update_dict:
                    await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(**update_dict)
                    outbound = await self.get_other_outbound_by_id(tenant_id, outbound_id)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_update:
                            await OtherOutboundItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, outbound_id=outbound_id
                            ).update(**item_update)
                    outbound = await self.get_other_outbound_by_id(tenant_id, outbound_id)

            deliverer_name = await self.get_user_name(confirmed_by)
            delivery_time = resolve_business_datetime(
                confirmation_data.delivery_time if confirmation_data and confirmation_data.delivery_time else None
            )
            await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(
                status="已出库",
                deliverer_id=confirmed_by,
                deliverer_name=deliverer_name,
                delivery_time=delivery_time,
                updated_by=confirmed_by,
                updated_by_name=deliverer_name,
            )
            for item in outbound.items:
                await OtherOutboundItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已出库", delivery_time=delivery_time)

            # 更新库存（扣减库存）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                outbound_obj = await OtherOutbound.get(tenant_id=tenant_id, id=outbound_id)
                fresh_items = await OtherOutboundItem.filter(
                    tenant_id=tenant_id, outbound_id=outbound_id
                ).all()
                biz_config = await BusinessConfigService().get_business_config(tenant_id)
                enforce_fifo = (
                    biz_config.get("parameters", {})
                    .get("warehouse", {})
                    .get("fifo", False)
                )
                wh_id = outbound_obj.warehouse_id if outbound_obj.warehouse_id else None
                material_ids = list({int(it.material_id) for it in fresh_items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in fresh_items:
                    qty = Decimal(str(item.outbound_quantity or 0))
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
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

    async def withdraw_confirmation(
        self,
        tenant_id: int,
        outbound_id: int,
        updated_by: int,
    ) -> OtherOutboundResponse:
        """撤回确认出库"""
        async with in_transaction():
            outbound = await self.get_other_outbound_by_id(tenant_id, outbound_id)

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(outbound, "withdraw", outbound_type="other_outbound")

            if outbound.status != "已出库":
                raise BusinessLogicError("只有已出库状态的其他出库单才能撤回确认")

            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                outbound_obj = await OtherOutbound.get(tenant_id=tenant_id, id=outbound_id)
                wh_id = outbound_obj.warehouse_id if outbound_obj.warehouse_id else None
                items = await OtherOutboundItem.filter(tenant_id=tenant_id, outbound_id=outbound_id).all()
                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)

                for item in items:
                    qty = Decimal(str(item.outbound_quantity or 0))
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    await InventoryService.increase_stock(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="other_outbound_revoke",
                        source_doc_id=outbound_id,
                        source_doc_code=outbound_obj.outbound_code,
                    )

                await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(
                    status="待出库",
                    deliverer_id=None,
                    deliverer_name=None,
                    delivery_time=None,
                    updated_by=updated_by,
                )
                await OtherOutboundItem.filter(
                    tenant_id=tenant_id, outbound_id=outbound_id
                ).update(status="待出库", delivery_time=None)
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回其他出库确认-未知错误: %s", e)
                raise BusinessLogicError(f"系统错误: {str(e)}")

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
            user_info = await self.get_user_info(created_by)
            today = today_site_str()
            code = await self.generate_code(tenant_id, "MATERIAL_BORROW_CODE", prefix=f"MB{today}")

            dump = borrow_data.model_dump(exclude_unset=True, exclude={"items", "borrow_code"})
            if borrow_data.borrow_code:
                code = borrow_data.borrow_code

            borrow = await MaterialBorrow.create(
                tenant_id=tenant_id,
                borrow_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
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
    ) -> tuple[List[MaterialBorrowListResponse], int]:
        """获取借料单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import (
            MATERIAL_BORROW_KEYWORD_FIELDS,
            MATERIAL_BORROW_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query = MaterialBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            allowed_fields=MATERIAL_BORROW_SORTABLE_FIELDS,
            default_order="-updated_at",
            keyword_fields=MATERIAL_BORROW_KEYWORD_FIELDS,
            doc_date_field="borrow_time",
            doc_start_date=filters.get("borrow_start_date"),
            doc_end_date=filters.get("borrow_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        total = await query.count()
        borrows = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_outbound_hub_list_capabilities,
        )
        from apps.kuaizhizao.services.document_lifecycle_service import get_material_borrow_lifecycle

        out: List[MaterialBorrowListResponse] = []
        for borrow in borrows:
            resp = MaterialBorrowListResponse.model_validate(borrow)
            resp.lifecycle = get_material_borrow_lifecycle(borrow, milestones=[])
            out.append(resp)
        item_counts = await batch_document_item_counts(
            tenant_id, MaterialBorrowItem, "borrow_id", [int(b.id) for b in borrows]
        )
        enriched = enrich_outbound_hub_list_capabilities(
            borrows, out, "material_borrow", item_counts=item_counts
        )
        return enriched, total

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
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
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
            deleted_at=resolve_business_datetime()
        )
        return True

    async def confirm_borrow(
        self,
        tenant_id: int,
        borrow_id: int,
        confirmed_by: int,
        confirmation_data: Optional[OutboundConfirmationRequest] = None,
    ) -> MaterialBorrowResponse:
        """确认借出"""
        async with in_transaction():
            borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(borrow, "confirm", outbound_type="material_borrow")

            if borrow.status != "待借出":
                raise BusinessLogicError("只有待借出状态的借料单才能确认借出")

            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                if update_dict:
                    await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(**update_dict)
                    borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)

                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        if item_data.warehouse_id:
                            item_update["warehouse_id"] = item_data.warehouse_id
                            item_update["warehouse_name"] = await _resolve_warehouse_name_by_id(
                                tenant_id,
                                item_data.warehouse_id,
                                item_data.warehouse_name,
                            )
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_update:
                            await MaterialBorrowItem.filter(
                                tenant_id=tenant_id, id=item_data.item_id, borrow_id=borrow_id
                            ).update(**item_update)
                    borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)

            borrower_name = await self.get_user_name(confirmed_by)
            borrow_time = resolve_business_datetime(
                confirmation_data.delivery_time if confirmation_data and confirmation_data.delivery_time else None
            )
            await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(
                status="已借出",
                borrower_id=confirmed_by,
                borrower_name=borrower_name,
                borrow_time=borrow_time,
                updated_by=confirmed_by,
                updated_by_name=borrower_name,
            )
            for item in borrow.items:
                await MaterialBorrowItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已借出", borrow_time=borrow_time)

            # 更新库存（扣减仓库库存）
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                borrow_obj = await MaterialBorrow.get(tenant_id=tenant_id, id=borrow_id)
                fresh_items = await MaterialBorrowItem.filter(
                    tenant_id=tenant_id, borrow_id=borrow_id
                ).all()
                biz_config = await BusinessConfigService().get_business_config(tenant_id)
                enforce_fifo = (
                    biz_config.get("parameters", {})
                    .get("warehouse", {})
                    .get("fifo", False)
                )
                material_ids = list({int(it.material_id) for it in fresh_items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in fresh_items:
                    qty = item.borrow_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
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

    async def withdraw_confirmation(
        self,
        tenant_id: int,
        borrow_id: int,
        updated_by: int,
    ) -> MaterialBorrowResponse:
        """撤回借料确认（库存回冲并恢复待借出）。"""
        async with in_transaction():
            borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)

            from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
                assert_outbound_hub_capability,
            )

            assert_outbound_hub_capability(borrow, "withdraw", outbound_type="material_borrow")

            if borrow.status != "已借出":
                raise BusinessLogicError("只有已借出状态的借料单才能撤回借出")

            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                borrow_obj = await MaterialBorrow.get(tenant_id=tenant_id, id=borrow_id)
                items = await MaterialBorrowItem.filter(
                    tenant_id=tenant_id, borrow_id=borrow_id
                ).all()
                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in items:
                    qty = item.borrow_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService.increase_stock(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="material_borrow_withdraw",
                        source_doc_id=borrow_id,
                        source_doc_code=borrow_obj.borrow_code,
                    )

                await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(
                    status="待借出",
                    borrower_id=None,
                    borrower_name=None,
                    borrow_time=None,
                    updated_by=updated_by,
                )
                await MaterialBorrowItem.filter(
                    tenant_id=tenant_id, borrow_id=borrow_id
                ).update(status="待借出", borrow_time=None)
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回借料确认-库存回冲失败: %s", e)
                raise BusinessLogicError(f"撤回失败: {str(e)}")

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

            today = today_site_str()
            code = await self.generate_code(tenant_id, "MATERIAL_RETURN_CODE", prefix=f"MR{today}")

            dump = return_data.model_dump(
                exclude_unset=True,
                exclude={"items", "return_code", "borrow_id", "borrow_code"},
            )
            if return_data.return_code:
                code = return_data.return_code

            user_info = await self.get_user_info(created_by)
            return_obj = await MaterialReturn.create(
                tenant_id=tenant_id,
                return_code=code,
                borrow_id=borrow.id,
                borrow_code=borrow.borrow_code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
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
        from apps.kuaizhizao.services.document_lifecycle_service import get_material_return_lifecycle

        response = MaterialReturnWithItemsResponse.model_validate(return_obj)
        response.items = [MaterialReturnItemResponse.model_validate(i) for i in items]
        response.lifecycle = get_material_return_lifecycle(return_obj)
        return response

    async def list_material_returns(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> tuple[List[MaterialReturnListResponse], int]:
        """获取还料单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import (
            MATERIAL_RETURN_KEYWORD_FIELDS,
            MATERIAL_RETURN_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query = MaterialReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("borrow_id"):
            query = query.filter(borrow_id=filters["borrow_id"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])
        if filters.get("scoped_ids") is not None:
            query = query.filter(id__in=filters["scoped_ids"])

        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            allowed_fields=MATERIAL_RETURN_SORTABLE_FIELDS,
            default_order="-updated_at",
            keyword_fields=MATERIAL_RETURN_KEYWORD_FIELDS,
            doc_date_field="return_time",
            doc_start_date=filters.get("return_start_date"),
            doc_end_date=filters.get("return_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        total = await query.count()
        returns = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            enrich_inbound_hub_list_capabilities,
        )
        from apps.kuaizhizao.models.material_return_item import MaterialReturnItem
        from apps.kuaizhizao.services.document_lifecycle_service import get_material_return_lifecycle

        responses = [MaterialReturnListResponse.model_validate(r) for r in returns]
        for return_obj, resp in zip(returns, responses):
            resp.lifecycle = get_material_return_lifecycle(return_obj, milestones=[])
        item_counts = await batch_document_item_counts(
            tenant_id, MaterialReturnItem, "return_id", [r.id for r in returns]
        )
        enriched = enrich_inbound_hub_list_capabilities(
            returns, responses, "material_return", item_counts=item_counts
        )
        return enriched, total

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
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
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
            deleted_at=resolve_business_datetime()
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

            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                assert_inbound_hub_capability,
            )

            assert_inbound_hub_capability(return_obj, "confirm", receipt_type="material_return")

            confirmer_name = await self.get_user_name(confirmed_by)
            return_time = resolve_business_datetime()
            # 归还人以单据上已选为准；未填写时才回填为确认操作人
            keep_returner = bool(getattr(return_obj, "returner_id", None) or getattr(return_obj, "returner_name", None))
            update_fields: dict = {
                "status": "已归还",
                "return_time": return_time,
                "updated_by": confirmed_by,
                "updated_by_name": confirmer_name,
            }
            if not keep_returner:
                update_fields["returner_id"] = confirmed_by
                update_fields["returner_name"] = confirmer_name
            await MaterialReturn.filter(tenant_id=tenant_id, id=return_id).update(**update_fields)
            for item in return_obj.items:
                await MaterialReturnItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已归还", return_time=return_time)

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
                material_ids = list({int(it.material_id) for it in return_obj.items if getattr(it, "material_id", None)})
                material_by_id = await _load_materials_by_ids(tenant_id, material_ids)
                for item in return_obj.items:
                    qty = item.return_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = _convert_line_quantity_to_base(
                        quantity=qty,
                        material_unit=getattr(item, "material_unit", None),
                        material=material_by_id.get(item.material_id),
                    )
                    wh_id = item.warehouse_id if item.warehouse_id else None
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="material_return",
                        source_doc_id=return_id,
                        source_doc_code=return_entity.return_code,
                        ledger_production_date=to_site_date(return_time),
                    )
            except Exception as inv_e:
                logger.error("还料确认-更新库存失败: %s", inv_e)
                raise

            return MaterialReturnResponse.model_validate(
                await MaterialReturn.get(tenant_id=tenant_id, id=return_id)
            )

