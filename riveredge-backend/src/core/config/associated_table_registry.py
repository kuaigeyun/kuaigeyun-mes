"""
关联对象表名到模型的映射

用于自定义字段「关联对象」类型，根据 table_name 查询关联表数据作为下拉选项。
table_name 来自 custom_field_pages 配置。
"""

from typing import Optional, Type, Any, List, Dict
from tortoise import Model


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
        "apps_kuaizhizao_production_plans": "apps.kuaizhizao.models.production_plan.ProductionPlan",
        "apps_kuaizhizao_equipment": "apps.kuaizhizao.models.equipment.Equipment",
        "apps_kuaizhizao_molds": "apps.kuaizhizao.models.mold.Mold",
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
        # 检查模型是否有 tenant_id
        has_tenant = hasattr(model, "tenant_id")
        query = model.all()
        if has_tenant:
            query = query.filter(tenant_id=tenant_id)

        rows = await query.limit(limit).values_list("id", display_field)

        result = []
        for row in rows:
            rec_id, label_val = row
            label = str(label_val) if label_val is not None else str(rec_id)
            result.append({"value": rec_id, "label": label})
        return result
    except Exception:
        return []
