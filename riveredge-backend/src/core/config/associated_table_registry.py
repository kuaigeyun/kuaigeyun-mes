"""
关联对象表名到模型的映射

用于自定义字段「关联对象」类型，根据 table_name 查询关联表数据作为下拉选项。
table_name 来自 custom_field_pages 配置。
"""

from typing import Optional, Type, Any, List, Dict
from tortoise import Model

from core.models.model_fields import model_has_field


def _get_model(table_name: str) -> Optional[Type[Model]]:
    """根据 table_name 获取 Tortoise 模型类（延迟导入避免循环依赖）"""
    # table_name (custom_field_pages) -> (app.model_module, db_table)
    _TABLE_TO_MODEL: Dict[str, str] = {
        # 主数据 - 工厂
        "master_data_factory_plants": "apps.master_data.models.factory.Plant",
        "master_data_factory_workshops": "apps.master_data.models.factory.Workshop",
        "master_data_factory_production_lines": "apps.master_data.models.factory.ProductionLine",
        "master_data_factory_workstations": "apps.master_data.models.factory.Workstation",
        "master_data_factory_work_centers": "apps.master_data.models.factory.WorkCenter",
        # 主数据 - 仓库
        "master_data_warehouse_warehouses": "apps.master_data.models.warehouse.Warehouse",
        "master_data_warehouse_storage_areas": "apps.master_data.models.warehouse.StorageArea",
        "master_data_warehouse_storage_locations": "apps.master_data.models.warehouse.StorageLocation",
        # 主数据 - 物料
        "master_data_material_groups": "apps.master_data.models.material.MaterialGroup",
        "master_data_materials": "apps.master_data.models.material.Material",
        "master_data_boms": "apps.master_data.models.material.BOM",  # table: apps_master_data_bom
        # 主数据 - 工艺
        "master_data_defect_types": "apps.master_data.models.process.DefectType",
        "master_data_operations": "apps.master_data.models.process.Operation",
        "master_data_process_routes": "apps.master_data.models.process.ProcessRoute",
        "master_data_sops": "apps.master_data.models.process.SOP",
        "apps_master_data_engineering_drawings": "apps.master_data.models.drawing.EngineeringDrawing",
        # 主数据 - 供应链
        "master_data_customers": "apps.master_data.models.customer.Customer",
        "master_data_suppliers": "apps.master_data.models.supplier.Supplier",
        # 主数据 - 绩效
        "master_data_holidays": "apps.master_data.models.performance.Holiday",
        "master_data_skills": "apps.master_data.models.performance.Skill",
        # 快格轻制造
        "apps_kuaizhizao_work_orders": "apps.kuaizhizao.models.work_order.WorkOrder",
        "apps_kuaizhizao_rework_orders": "apps.kuaizhizao.models.rework_order.ReworkOrder",
        "apps_kuaizhizao_outsource_orders": "apps.kuaizhizao.models.outsource_order.OutsourceOrder",
        "apps_kuaizhizao_outsource_work_orders": "apps.kuaizhizao.models.outsource_work_order.OutsourceWorkOrder",
        "apps_kuaizhizao_purchase_orders": "apps.kuaizhizao.models.purchase_order.PurchaseOrder",
        "apps_kuaizhizao_purchase_receipts": "apps.kuaizhizao.models.purchase_receipt.PurchaseReceipt",
        "apps_kuaizhizao_purchase_returns": "apps.kuaizhizao.models.purchase_return.PurchaseReturn",
        "apps_kuaizhizao_sales_orders": "apps.kuaizhizao.models.sales_order.SalesOrder",
        "apps_kuaizhizao_sales_deliveries": "apps.kuaizhizao.models.sales_delivery.SalesDelivery",
        "apps_kuaizhizao_sales_returns": "apps.kuaizhizao.models.sales_return.SalesReturn",
        "apps_kuaizhizao_equipment": "apps.kuaizhizao.models.equipment.Equipment",
        "apps_kuaizhizao_molds": "apps.kuaizhizao.models.mold.Mold",
        "apps_kuaizhizao_production_pickings": "apps.kuaizhizao.models.production_picking.ProductionPicking",
        "apps_kuaizhizao_production_returns": "apps.kuaizhizao.models.production_return.ProductionReturn",
        "apps_kuaizhizao_other_inbounds": "apps.kuaizhizao.models.other_inbound.OtherInbound",
        "apps_kuaizhizao_other_outbounds": "apps.kuaizhizao.models.other_outbound.OtherOutbound",
        "apps_kuaizhizao_finished_goods_receipts": "apps.kuaizhizao.models.finished_goods_receipt.FinishedGoodsReceipt",
        "apps_kuaizhizao_incoming_inspections": "apps.kuaizhizao.models.incoming_inspection.IncomingInspection",
        "apps_kuaizhizao_process_inspections": "apps.kuaizhizao.models.process_inspection.ProcessInspection",
        "apps_kuaizhizao_finished_goods_inspections": "apps.kuaizhizao.models.finished_goods_inspection.FinishedGoodsInspection",
    }
    path = _TABLE_TO_MODEL.get(table_name)
    if not path:
        return None
    try:
        module_path, cls_name = path.rsplit(".", 1)
        import importlib
        mod = importlib.import_module(module_path)
        return getattr(mod, cls_name)
    except Exception:
        return None


# 允许的显示字段（防止 SQL 注入）
ALLOWED_DISPLAY_FIELDS = frozenset({"id", "name", "code", "title", "label", "description"})

# 关联表 → 引用资源 global key（走 ReferenceDisplayService + DataScope / RBAC display）
TABLE_REFERENCE_RESOURCE: Dict[str, str] = {
    "master_data_factory_plants": "master-data:factory:plant",
    "master_data_factory_workshops": "master-data:factory:workshop",
    "master_data_factory_production_lines": "master-data:factory:production-line",
    "master_data_factory_workstations": "master-data:factory:workstation",
    "master_data_factory_work_centers": "master-data:factory:work-center",
    "master_data_warehouse_warehouses": "master-data:warehouse:warehouse",
    "master_data_warehouse_storage_areas": "master-data:warehouse:storage-area",
    "master_data_warehouse_storage_locations": "master-data:warehouse:storage-location",
    "master_data_material_groups": "master-data:material:group",
    "master_data_materials": "master-data:material",
    "master_data_boms": "master-data:material:bom",
    "master_data_defect_types": "master-data:process:defect-type",
    "master_data_operations": "master-data:process:operation",
    "master_data_process_routes": "master-data:process:route",
    "master_data_sops": "master-data:process:sop",
    "apps_master_data_engineering_drawings": "master-data:process:drawing",
    "master_data_customers": "master-data:supply-chain:customer",
    "master_data_suppliers": "master-data:supply-chain:supplier",
    "master_data_holidays": "kuaizhizao:performance-holidays",
    "master_data_skills": "kuaizhizao:performance-skills",
    "apps_kuaizhizao_work_orders": "kuaizhizao:work-order",
    "apps_kuaizhizao_rework_orders": "kuaizhizao:rework-order",
    "apps_kuaizhizao_outsource_orders": "kuaizhizao:outsource-order",
    "apps_kuaizhizao_purchase_orders": "kuaizhizao:purchase-order",
    "apps_kuaizhizao_sales_orders": "kuaizhizao:sales-order",
    "apps_kuaizhizao_outsource_work_orders": "kuaizhizao:outsource-work-order",
    "apps_kuaizhizao_purchase_receipts": "kuaizhizao:purchase-receipt",
    "apps_kuaizhizao_purchase_returns": "kuaizhizao:purchase-return",
    "apps_kuaizhizao_sales_deliveries": "kuaizhizao:sales-delivery",
    "apps_kuaizhizao_sales_returns": "kuaizhizao:sales-return",
    "apps_kuaizhizao_equipment": "kuaizhizao:equipment",
    "apps_kuaizhizao_molds": "kuaizhizao:mold",
    "apps_kuaizhizao_production_pickings": "kuaizhizao:production-picking",
    "apps_kuaizhizao_production_returns": "kuaizhizao:production-return",
    "apps_kuaizhizao_other_inbounds": "kuaizhizao:other-inbound",
    "apps_kuaizhizao_other_outbounds": "kuaizhizao:other-outbound",
    "apps_kuaizhizao_finished_goods_receipts": "kuaizhizao:finished-goods-receipt",
    "apps_kuaizhizao_incoming_inspections": "kuaizhizao:quality-management-incoming-inspection",
    "apps_kuaizhizao_process_inspections": "kuaizhizao:quality-management-process-inspection",
    "apps_kuaizhizao_finished_goods_inspections": "kuaizhizao:quality-management-finished-goods-inspection",
}


def reference_resource_for_table(table_name: str) -> str | None:
    return TABLE_REFERENCE_RESOURCE.get((table_name or "").strip())


async def get_associated_options(
    table_name: str,
    display_field: str,
    tenant_id: int,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    """
    获取关联表的下拉选项

    Args:
        table_name: 表名（来自 custom_field_pages）
        display_field: 显示字段名
        tenant_id: 租户ID
        limit: 最大返回数量

    Returns:
        [{ value: id, label: display_value }, ...]
    """
    if display_field not in ALLOWED_DISPLAY_FIELDS:
        display_field = "name"

    model = _get_model(table_name)
    if not model:
        return []

    try:
        query = model.all()
        if model_has_field(model, "tenant_id"):
            query = query.filter(tenant_id=tenant_id)
        if model_has_field(model, "deleted_at"):
            query = query.filter(deleted_at__isnull=True)

        rows = await query.limit(limit).values_list("id", display_field)

        result = []
        for row in rows:
            rec_id, label_val = row
            label = str(label_val) if label_val is not None else str(rec_id)
            result.append({"value": rec_id, "label": label})
        return result
    except Exception:
        return []


async def get_associated_attribute_options(
    table_name: str,
    attribute_field: str,
    tenant_id: int,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    """
    关联属性（无关联对象字段时）：列出关联表 attribute_field 列的全部可选值。
    """
    attribute_field = _resolve_model_field_name(table_name, attribute_field, "name")

    model = _get_model(table_name)
    if not model:
        return []

    try:
        query = model.all()
        if model_has_field(model, "tenant_id"):
            query = query.filter(tenant_id=tenant_id)
        if model_has_field(model, "deleted_at"):
            query = query.filter(deleted_at__isnull=True)

        rows = await query.limit(limit).values_list(attribute_field)

        result: List[Dict[str, Any]] = []
        seen_values: set[str] = set()
        for row in rows:
            value = row[0]
            if value is None:
                continue
            key = str(value)
            if key in seen_values:
                continue
            seen_values.add(key)
            result.append({"value": value, "label": key})
        return result
    except Exception:
        return []


def _resolve_model_field_name(table_name: str, field_name: str, default: str) -> str:
    name = (field_name or "").strip()
    if not name:
        return default
    from core.config.custom_field_system_fields import is_valid_model_field

    if is_valid_model_field(table_name, name):
        return name
    return default


async def lookup_associated_record(
    table_name: str,
    match_field: str,
    match_value: Any,
    return_field: str,
    tenant_id: int,
) -> Optional[Dict[str, Any]]:
    """
    VLOOKUP：用 match_value 在关联表 match_field 列匹配，返回 return_field 值。
    """
    if match_value is None or str(match_value).strip() == "":
        return None

    match_field = _resolve_model_field_name(table_name, match_field, "code")
    return_field = _resolve_model_field_name(table_name, return_field, "id")

    model = _get_model(table_name)
    if not model:
        return None

    try:
        query = model.all()
        if model_has_field(model, "tenant_id"):
            query = query.filter(tenant_id=tenant_id)
        if model_has_field(model, "deleted_at"):
            query = query.filter(deleted_at__isnull=True)

        row = await query.filter(**{match_field: match_value}).first()
        if not row:
            return None

        return_value = getattr(row, return_field, None)
        record_id = getattr(row, "id", None)
        return {
            "value": return_value,
            "recordId": record_id,
            "label": str(return_value) if return_value is not None else "",
        }
    except Exception:
        return None


async def get_associated_attribute_value(
    table_name: str,
    record_id: Any,
    attribute_field: str,
    tenant_id: int,
) -> Optional[Dict[str, Any]]:
    """
    关联属性：按 record_id 读取关联表 attribute_field 列的值。
    """
    if record_id is None or str(record_id).strip() == "":
        return None

    try:
        record_id_int = int(record_id)
    except (TypeError, ValueError):
        return None

    attribute_field = _resolve_model_field_name(table_name, attribute_field, "name")

    model = _get_model(table_name)
    if not model:
        return None

    try:
        query = model.all()
        if model_has_field(model, "tenant_id"):
            query = query.filter(tenant_id=tenant_id)
        if model_has_field(model, "deleted_at"):
            query = query.filter(deleted_at__isnull=True)

        row = await query.filter(id=record_id_int).first()
        if not row:
            return None

        value = getattr(row, attribute_field, None)
        return {
            "value": value,
            "label": str(value) if value is not None else "",
        }
    except Exception:
        return None
