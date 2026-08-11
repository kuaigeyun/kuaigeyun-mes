"""
业务配置服务模块

本模块只负责「业务参数（parameters.*）」与 PRO 功能相关逻辑。

变更说明（2026 重构，蓝图下线后）：
- 业务是否启用：由「菜单管理（is_active）」控制，不再落在本服务；
  历史 `check_node_enabled` 签名保留，内部恒返回 True，避免改动
  20+ 个业务 Service 的调用点；后续可逐步删除调用并移除此方法。
- 是否需要审核：由「审核设置（AuditDocumentBinding.is_enabled）」决定；
  `check_audit_required` 查 AuditDocumentBinding；流程在启用开关时按需创建。
  不再用 ApprovalProcess.code=node_key 的 is_active 充当开关。
- 运行模式 / 节点 / 模块 / 模板等蓝图时代的概念全部移除，不再提供相关常量与方法。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any, List, Optional
from loguru import logger

from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier
from core.config.functional_domain_spec import FUNCTIONAL_DOMAINS, normalize_functional_domain


def coerce_finance_parameter_dict(finance: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enforce mutual exclusion between shipment/receipt-based AR/AP and invoice-based generation.
    Persisted settings may contain stale booleans; readers should always merge through this.
    """
    fin = dict(finance or {})
    rev = str(fin.get("revenue_recognition") or "on_shipment").strip()
    if rev not in ("on_shipment", "on_invoice", "on_milestone", "mixed"):
        rev = "on_shipment"
    fin["revenue_recognition"] = rev
    if rev in ("on_shipment", "on_milestone", "mixed"):
        fin["auto_generate_receivable_from_sales_invoice"] = False
    pay = str(fin.get("payable_recognition") or "on_receipt").strip()
    if pay not in ("on_receipt", "on_purchase_invoice"):
        pay = "on_receipt"
    fin["payable_recognition"] = pay
    if pay == "on_receipt":
        fin["auto_generate_payable_from_purchase_invoice"] = False
    return fin

from infra.models.tenant import Tenant
from infra.exceptions.exceptions import NotFoundError
from core.models.approval_process import ApprovalProcess
from core.config.audit_registry import audit_node_keys


# ============================================================
# 注册表元数据（供前端动态渲染参数表单）
# ============================================================

# 流程注册表分类文案
PROCESS_REGISTRY_CATEGORY_META: Dict[str, Dict[str, str]] = {
    "sales": {
        "labelKey": "pages.system.configCenter.processCategory.sales",
        "descriptionKey": "pages.system.configCenter.processCategory.salesDesc",
    },
    "planning": {
        "labelKey": "pages.system.configCenter.processCategory.planning",
        "descriptionKey": "pages.system.configCenter.processCategory.planningDesc",
    },
    "procurement": {
        "labelKey": "pages.system.configCenter.processCategory.procurement",
        "descriptionKey": "pages.system.configCenter.processCategory.procurementDesc",
    },
    "purchase": {
        "labelKey": "pages.system.configCenter.processCategory.procurement",
        "descriptionKey": "pages.system.configCenter.processCategory.procurementDesc",
    },
    "quality": {
        "labelKey": "pages.system.configCenter.processCategory.procurement",
        "descriptionKey": "pages.system.configCenter.processCategory.procurementDesc",
    },
    "work_order": {
        "labelKey": "pages.system.configCenter.processCategory.work_order",
        "descriptionKey": "pages.system.configCenter.processCategory.work_orderDesc",
    },
    "reporting": {
        "labelKey": "pages.system.configCenter.processCategory.reporting",
        "descriptionKey": "pages.system.configCenter.processCategory.reportingDesc",
    },
}

# 参数注册表分类文案
PARAMETER_REGISTRY_CATEGORY_META: Dict[str, Dict[str, str]] = {
    "common": {
        "labelKey": "pages.system.configCenter.category.common",
        "descriptionKey": "pages.system.configCenter.category.commonDesc",
    },
    "work_order": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "reporting": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "planning": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "bom": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "warehouse": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
    "purchase": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
    "procurement": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
    "quality": {
        "labelKey": "pages.system.configCenter.category.sales_quality",
        "descriptionKey": "pages.system.configCenter.category.sales_qualityDesc",
    },
    "sales": {
        "labelKey": "pages.system.configCenter.category.sales_quality",
        "descriptionKey": "pages.system.configCenter.category.sales_qualityDesc",
    },
    "finance": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
    "automation": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
}

# 参数控件元数据（默认 boolean，可按 full key 覆盖为 number/string/color 并附 min/max）
REGISTRY_PARAM_CONTROL_META: Dict[str, Dict[str, Any]] = {
    "parameters.work_order.last_operation_auto_inbound_mode": {
        "type": "select",
        "options": [
            {
                "value": "none",
                "labelKey": "pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode_opt_none",
            },
            {
                "value": "direct_inbound",
                "labelKey": "pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode_opt_direct",
            },
            {
                "value": "inbound_notice",
                "labelKey": "pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode_opt_notice",
            },
        ],
    },
    "parameters.reporting.default_production_worker_mode": {
        "type": "select",
        "options": [
            {
                "value": "current_user",
                "labelKey": "pages.system.configCenter.param.reporting_default_production_worker_mode_opt_current_user",
            },
            {
                "value": "operation_assigned",
                "labelKey": "pages.system.configCenter.param.reporting_default_production_worker_mode_opt_operation_assigned",
            },
            {
                "value": "auto",
                "labelKey": "pages.system.configCenter.param.reporting_default_production_worker_mode_opt_auto",
            },
        ],
    },
    "parameters.reporting.default_reporting_quantity_mode": {
        "type": "select",
        "options": [
            {
                "value": "reportable",
                "labelKey": "pages.system.configCenter.param.reporting_default_reporting_quantity_mode_opt_reportable",
            },
            {
                "value": "zero",
                "labelKey": "pages.system.configCenter.param.reporting_default_reporting_quantity_mode_opt_zero",
            },
        ],
    },
    "parameters.common.quantity_decimal_places": {"type": "number", "min": 0, "max": 2},
    "parameters.common.price_decimal_places": {"type": "number", "min": 0, "max": 4},
    "parameters.common.amount_decimal_places": {"type": "number", "min": 0, "max": 2},
    "parameters.purchase.tolerance_percentage": {"type": "number", "min": 0, "max": 100},
    "parameters.purchase.price_fluctuation_limit_percent": {"type": "number", "min": 0, "max": 100},
    "parameters.work_order.material_shortage_block_level": {"type": "number", "min": 0, "max": 3},
    "parameters.work_order.score_stale_minutes": {"type": "number", "min": 5, "max": 1440},
    "parameters.finance.auto_write_off_precision_limit": {"type": "number", "min": 0, "max": 100},
    "parameters.finance.revenue_recognition": {
        "type": "select",
        "options": [
            {
                "value": "on_shipment",
                "labelKey": "pages.system.configCenter.param.finance_revenue_recognition_opt_on_shipment",
            },
            {
                "value": "on_invoice",
                "labelKey": "pages.system.configCenter.param.finance_revenue_recognition_opt_on_invoice",
            },
            {
                "value": "on_milestone",
                "labelKey": "pages.system.configCenter.param.finance_revenue_recognition_opt_on_milestone",
            },
            {
                "value": "mixed",
                "labelKey": "pages.system.configCenter.param.finance_revenue_recognition_opt_mixed",
            },
        ],
    },
    "parameters.finance.payable_recognition": {
        "type": "select",
        "options": [
            {
                "value": "on_receipt",
                "labelKey": "pages.system.configCenter.param.finance_payable_recognition_opt_on_receipt",
            },
            {
                "value": "on_purchase_invoice",
                "labelKey": "pages.system.configCenter.param.finance_payable_recognition_opt_on_purchase_invoice",
            },
        ],
    },
    "parameters.sales.low_margin_threshold_percent": {"type": "number", "min": 0, "max": 100},
    "parameters.sales.price_deviation_approval_threshold_percent": {"type": "number", "min": 0, "max": 100},
    "parameters.sales.require_contract_before_order": {"type": "boolean"},
    "parameters.sales.contract_expiry_alert_days": {"type": "number", "min": 1, "max": 365},
    "parameters.sales.contract_auto_close_on_full_release": {"type": "boolean"},
    "parameters.sales.contract_milestone_required": {"type": "boolean"},
    "parameters.automation.push_default_mode": {
        "type": "select",
        "options": [
            {
                "value": "draft",
                "labelKey": "pages.system.configCenter.param.automation_push_default_mode_opt_draft",
            },
            {
                "value": "confirm",
                "labelKey": "pages.system.configCenter.param.automation_push_default_mode_opt_confirm",
            },
        ],
    },
}


# ============================================================
# 参数键白名单（注册表来源）
# ============================================================

# 流程设置：企业流程控制（流转、领料确认等；单据是否人工审核由「审批流程 ApprovalProcess」单独管理）
PROCESS_KEYS = {
    "parameters.procurement.require_purchase_requisition",
    "parameters.work_order.picking_issue_strategy",
    "parameters.work_order.picking_confirm_warehouse_only",
    "parameters.work_order.picking_confirm_allowed_role_codes",
    "parameters.work_order.picking_confirm_allowed_functional_domains",
    "parameters.work_order.require_confirmed_picking_before_operation_start",
    "parameters.work_order.require_confirmed_picking_before_reporting",
}

# 参数设置：具体业务值（数值、阈值、功能开关）
PARAMETER_KEYS = {
    "parameters.common.trial_run_mode",
    "parameters.common.quantity_decimal_places",
    "parameters.common.price_decimal_places",
    "parameters.common.amount_decimal_places",
    "parameters.work_order.allow_production_without_material",
    "parameters.work_order.auto_generate",
    "parameters.work_order.priority",
    "parameters.work_order.split",
    "parameters.work_order.merge",
    "parameters.work_order.last_operation_auto_inbound_mode",
    "parameters.work_order.score_enabled",
    "parameters.work_order.score_stale_minutes",
    "parameters.reporting.quick_reporting",
    "parameters.reporting.parameter_reporting",
    "parameters.reporting.default_reporting_quantity_mode",
    "parameters.reporting.auto_approve",
    "parameters.reporting.default_production_worker_mode",
    "parameters.reporting.data_correction",
    "parameters.warehouse.batch_management",
    "parameters.warehouse.serial_management",
    "parameters.warehouse.multi_unit",
    "parameters.warehouse.fifo",
    "parameters.warehouse.lifo",
    "parameters.warehouse.location_management",
    "parameters.warehouse.auto_outbound",
    "parameters.purchase.tolerance_percentage",
    "parameters.purchase.price_fluctuation_limit_percent",
    "parameters.quality.incoming_inspection",
    "parameters.quality.require_incoming_inspection_for_receipt",
    "parameters.quality.require_incoming_inspection_for_customer_material",
    "parameters.quality.require_fqc_before_finished_goods_receipt",
    "parameters.quality.process_inspection",
    "parameters.quality.finished_inspection",
    "parameters.quality.defect_handling",
    "parameters.quality.auto_create_iqc_on_purchase_receipt",
    "parameters.quality.auto_create_ipqc_on_reporting",
    "parameters.quality.auto_create_fqc_on_last_reporting",
    "parameters.quality.auto_create_oqc_on_shipment_notice_notify",
    "parameters.quality.auto_create_oqc_on_sales_delivery",
    "parameters.bom.bom_multi_version_allowed",
    "parameters.work_order.material_shortage_block_level",
    "parameters.finance.auto_write_off_precision_limit",
    "parameters.finance.revenue_recognition",
    "parameters.finance.payable_recognition",
    "parameters.finance.auto_generate_receivable_from_sales_invoice",
    "parameters.finance.auto_generate_payable_from_purchase_invoice",
    "parameters.finance.credit_limit_enabled",
    "parameters.finance.gl_period_close_enabled",
    "parameters.finance.gl_closed_periods",
    "parameters.sales.low_margin_threshold_percent",
    "parameters.sales.price_deviation_approval_threshold_percent",
    "parameters.sales.require_contract_before_order",
    "parameters.sales.contract_expiry_alert_days",
    "parameters.sales.contract_auto_close_on_full_release",
    "parameters.sales.contract_milestone_required",
    "parameters.automation.push_default_mode",
}

# 已实装并在后端有明确生效点的配置项（用于前端禁用"假开关"）
IMPLEMENTED_PARAMETER_KEYS = {
    "parameters.common.trial_run_mode",
    "parameters.common.quantity_decimal_places",
    "parameters.common.price_decimal_places",
    "parameters.common.amount_decimal_places",
    "parameters.procurement.require_purchase_requisition",
    "parameters.work_order.picking_issue_strategy",
    "parameters.work_order.picking_confirm_warehouse_only",
    "parameters.work_order.picking_confirm_allowed_role_codes",
    "parameters.work_order.picking_confirm_allowed_functional_domains",
    "parameters.work_order.require_confirmed_picking_before_operation_start",
    "parameters.work_order.require_confirmed_picking_before_reporting",
    "parameters.work_order.allow_production_without_material",
    "parameters.work_order.auto_generate",
    "parameters.work_order.priority",
    "parameters.work_order.split",
    "parameters.work_order.merge",
    "parameters.work_order.last_operation_auto_inbound_mode",
    "parameters.work_order.score_enabled",
    "parameters.work_order.score_stale_minutes",
    "parameters.reporting.quick_reporting",
    "parameters.reporting.parameter_reporting",
    "parameters.reporting.default_reporting_quantity_mode",
    "parameters.reporting.auto_approve",
    "parameters.reporting.default_production_worker_mode",
    "parameters.reporting.data_correction",
    "parameters.warehouse.batch_management",
    "parameters.warehouse.serial_management",
    "parameters.warehouse.fifo",
    "parameters.warehouse.lifo",
    "parameters.warehouse.location_management",
    "parameters.warehouse.auto_outbound",
    "parameters.purchase.tolerance_percentage",
    "parameters.purchase.price_fluctuation_limit_percent",
    "parameters.quality.incoming_inspection",
    "parameters.quality.require_incoming_inspection_for_receipt",
    "parameters.quality.require_incoming_inspection_for_customer_material",
    "parameters.quality.require_fqc_before_finished_goods_receipt",
    "parameters.quality.process_inspection",
    "parameters.quality.finished_inspection",
    "parameters.quality.defect_handling",
    "parameters.quality.auto_create_iqc_on_purchase_receipt",
    "parameters.quality.auto_create_ipqc_on_reporting",
    "parameters.quality.auto_create_fqc_on_last_reporting",
    "parameters.quality.auto_create_oqc_on_shipment_notice_notify",
    "parameters.quality.auto_create_oqc_on_sales_delivery",
    "parameters.bom.bom_multi_version_allowed",
    "parameters.work_order.material_shortage_block_level",
    "parameters.finance.auto_write_off_precision_limit",
    "parameters.finance.revenue_recognition",
    "parameters.finance.payable_recognition",
    "parameters.finance.auto_generate_receivable_from_sales_invoice",
    "parameters.finance.auto_generate_payable_from_purchase_invoice",
    "parameters.finance.credit_limit_enabled",
    "parameters.finance.gl_period_close_enabled",
    "parameters.finance.gl_closed_periods",
    "parameters.sales.low_margin_threshold_percent",
    "parameters.sales.price_deviation_approval_threshold_percent",
    "parameters.sales.require_contract_before_order",
    "parameters.sales.contract_expiry_alert_days",
    "parameters.sales.contract_auto_close_on_full_release",
    "parameters.sales.contract_milestone_required",
    "parameters.automation.push_default_mode",
}

# 默认仓管/生产领料确认角色
DEFAULT_WAREHOUSE_ROLE_CODES = {
    "WAREHOUSE",
    "WAREHOUSE_MANAGER",
    "WAREHOUSE_ADMIN",
    "WAREHOUSE_OPERATOR",
    "INVENTORY",
    "INVENTORY_MANAGER",
}

DEFAULT_PRODUCTION_PICKING_CONFIRM_ROLE_CODES = {
    "PRODUCTION",
    "PRODUCTION_MANAGER",
    "PRODUCTION_TEAM_LEADER",
    "PRODUCTION_CLERK",
    "PRODUCTION_STAFF",
    "PRODUCTION_OPERATOR",
    "PRODUCTION_WORKER",
    "WORKSHOP",
    "WORKSHOP_MANAGER",
    "DEPT_MANAGER",
}


# ============================================================
# 纯参数默认值（替代旧 SIMPLE/FULL_MODE_CONFIG.parameters 兜底）
# 仅保留真实有默认值语义的键；未列出的键由业务 getter 自行定义 fallback。
# ============================================================
DEFAULT_PARAMETERS: Dict[str, Dict[str, Any]] = {
    "common": {
        "trial_run_mode": False,
        # 数量/单价/金额小数位（ERP 惯例分项；默认 2；上限对齐当前库字段）
        "quantity_decimal_places": 2,
        "price_decimal_places": 2,
        "amount_decimal_places": 2,
    },
    "work_order": {
        "auto_generate": True,
        "priority": True,
        "split": True,
        "merge": True,
        "allow_production_without_material": False,
        "material_shortage_block_level": 1,
        "picking_issue_strategy": "after_release",
        "picking_confirm_warehouse_only": True,
        "picking_confirm_allowed_role_codes": [],
        "picking_confirm_allowed_functional_domains": [],
        "require_confirmed_picking_before_operation_start": False,
        "require_confirmed_picking_before_reporting": False,
        "last_operation_auto_inbound_mode": "none",
        "score_enabled": True,
        "score_stale_minutes": 30,
        "score_profiles": {
            "scheduling": {
                "weights": {
                    "manual_priority": 0.25,
                    "due_urgency": 0.35,
                    "demand_urgency": 0.15,
                    "kitting_readiness": 0.20,
                    "plan_fidelity": 0.05,
                },
                "kitting_mode": "direct",
            },
            "picking": {
                "weights": {
                    "manual_priority": 0.20,
                    "due_urgency": 0.25,
                    "demand_urgency": 0.15,
                    "kitting_readiness": 0.40,
                    "plan_fidelity": 0.0,
                },
                "kitting_mode": "invert",
            },
        },
    },
    "reporting": {
        "quick_reporting": True,
        "parameter_reporting": True,
        "default_reporting_quantity_mode": "reportable",
        "default_production_worker_mode": "auto",
        "data_correction": True,
        "auto_approve": False,
    },
    "warehouse": {
        "batch_management": True,
        "serial_management": True,
        "multi_unit": True,
        "fifo": True,
        "lifo": False,
        "location_management": False,
        "auto_outbound": True,
    },
    "quality": {
        "incoming_inspection": True,
        "require_incoming_inspection_for_receipt": False,
        "require_incoming_inspection_for_customer_material": False,
        "require_fqc_before_finished_goods_receipt": True,
        "process_inspection": True,
        "finished_inspection": True,
        "defect_handling": True,
        "auto_create_iqc_on_purchase_receipt": False,
        "auto_create_ipqc_on_reporting": True,
        # 成品检建单改由入库前 ensure + 工单手工下推；末道报工自动建默认关闭
        "auto_create_fqc_on_last_reporting": False,
        "auto_create_oqc_on_shipment_notice_notify": False,
        "auto_create_oqc_on_sales_delivery": False,
    },
    "sales": {
        "audit_enabled": False,
        "low_margin_threshold_percent": 0,
        "price_deviation_approval_threshold_percent": 0,
        "require_contract_before_order": False,
        "contract_expiry_alert_days": 30,
        "contract_auto_close_on_full_release": True,
        "contract_milestone_required": False,
    },
    "purchase": {
        "auto_approval": False,
        "tolerance_percentage": 0,
        "price_fluctuation_limit_percent": 0,
        "price_control": False,
        "supplier_evaluation": False,
    },
    "procurement": {
        "require_purchase_requisition": False,
    },
    "planning": {
        "auto_push_sales_to_computation_on_approve": False,
    },
    "automation": {
        "push_default_mode": "confirm",
    },
    "bom": {
        "bom_multi_version_allowed": True,
    },
    "finance": {
        "auto_write_off_precision_limit": 0,
        "revenue_recognition": "on_shipment",
        "payable_recognition": "on_receipt",
        "auto_generate_receivable_from_sales_invoice": False,
        "auto_generate_payable_from_purchase_invoice": False,
        "credit_limit_enabled": False,
        "gl_period_close_enabled": False,
        "gl_closed_periods": [],
    },
}


# ============================================================
# schema 辅助（供 /business-config/schema 接口使用）
# ============================================================

def _build_registry_schema(full_keys: set) -> Dict[str, List[str]]:
    """将 parameters.<category>.<key> 集合构建为 {category: [key]}"""
    result: Dict[str, List[str]] = {}
    for full_key in full_keys:
        if not full_key.startswith("parameters."):
            continue
        parts = full_key.replace("parameters.", "").split(".", 1)
        if len(parts) == 2:
            category, key = parts
            if category not in result:
                result[category] = []
            if key not in result[category]:
                result[category].append(key)
    return result


def _build_process_registry_schema() -> Dict[str, List[str]]:
    return _build_registry_schema(PROCESS_KEYS)


def _build_parameter_registry_schema() -> Dict[str, List[str]]:
    return _build_registry_schema(PARAMETER_KEYS)


def _build_registry_category_meta_schema(
    registry_schema: Dict[str, List[str]],
    category_meta: Dict[str, Dict[str, str]],
) -> Dict[str, Dict[str, str]]:
    result: Dict[str, Dict[str, str]] = {}
    for category in registry_schema.keys():
        if category in category_meta:
            result[category] = dict(category_meta[category])
    return result


def _build_process_registry_meta_schema() -> Dict[str, Dict[str, str]]:
    return _build_registry_category_meta_schema(
        _build_process_registry_schema(),
        PROCESS_REGISTRY_CATEGORY_META,
    )


def _build_parameter_registry_meta_schema() -> Dict[str, Dict[str, str]]:
    return _build_registry_category_meta_schema(
        _build_parameter_registry_schema(),
        PARAMETER_REGISTRY_CATEGORY_META,
    )


def _build_registry_param_meta_schema(
    registry_schema: Dict[str, List[str]],
) -> Dict[str, Dict[str, Dict[str, str]]]:
    result: Dict[str, Dict[str, Dict[str, str]]] = {}
    for category, keys in registry_schema.items():
        result[category] = {}
        for key in keys:
            base = f"{category}_{key}"
            result[category][key] = {
                "labelKey": f"pages.system.configCenter.param.{base}",
                "descriptionKey": f"pages.system.configCenter.param.{base}_desc",
            }
    return result


def _build_process_registry_param_meta_schema() -> Dict[str, Dict[str, Dict[str, str]]]:
    return _build_registry_param_meta_schema(_build_process_registry_schema())


def _build_parameter_registry_param_meta_schema() -> Dict[str, Dict[str, Dict[str, str]]]:
    return _build_registry_param_meta_schema(_build_parameter_registry_schema())


def _build_registry_control_meta_schema(
    registry_schema: Dict[str, List[str]],
) -> Dict[str, Dict[str, Dict[str, Any]]]:
    result: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for category, keys in registry_schema.items():
        result[category] = {}
        for key in keys:
            full_key = f"parameters.{category}.{key}"
            override = REGISTRY_PARAM_CONTROL_META.get(full_key, {})
            item: Dict[str, Any] = {
                "type": override.get("type", "boolean"),
            }
            if "min" in override:
                item["min"] = override["min"]
            if "max" in override:
                item["max"] = override["max"]
            if "options" in override:
                item["options"] = override["options"]
            result[category][key] = item
    return result


def _build_process_registry_control_meta_schema() -> Dict[str, Dict[str, Dict[str, Any]]]:
    return _build_registry_control_meta_schema(_build_process_registry_schema())


def _build_parameter_registry_control_meta_schema() -> Dict[str, Dict[str, Dict[str, Any]]]:
    return _build_registry_control_meta_schema(_build_parameter_registry_schema())


def _build_parameter_keys_schema() -> Dict[str, List[str]]:
    """兼容字段：保留历史 parameterKeys（流程+参数并集），新调用方改用 processRegistry / parameterRegistry。"""
    result = _build_parameter_registry_schema()
    for category, keys in _build_process_registry_schema().items():
        if category not in result:
            result[category] = []
        for key in keys:
            if key not in result[category]:
                result[category].append(key)
    return result


def _build_parameter_implementation_schema() -> Dict[str, Dict[str, bool]]:
    """返回参数实装状态：{category: {key: implemented_bool}}"""
    result: Dict[str, Dict[str, bool]] = {}
    for full_key in PARAMETER_KEYS | PROCESS_KEYS:
        if not full_key.startswith("parameters."):
            continue
        parts = full_key.replace("parameters.", "").split(".", 1)
        if len(parts) != 2:
            continue
        category, key = parts
        if category not in result:
            result[category] = {}
        result[category][key] = full_key in IMPLEMENTED_PARAMETER_KEYS
    return result


class BusinessConfigService:
    """业务配置服务（参数 + 审核 + PRO 功能）"""

    # PRO 版功能列表（需要专业/企业套餐）
    PRO_FEATURES = {
        "modules": [
            "advanced_scheduling",
            "outsourcing",
            "purchase_inquiry",
            "purchase_contract",
            "quality_analysis",
            "customer_material",
            "warehouse_optimization",
            "supply_chain",
        ],
        "parameters": {
            "work_order": ["advanced_scheduling"],
            "warehouse": ["warehouse_optimization"],
            "quality": ["quality_analysis"],
        },
    }
    PRO_PLANS = ["professional", "enterprise"]
    # 可审核单据节点（= manifest.audit.node_key）唯一来源：audit_registry。
    # 是否审核、绑定哪条流程：AuditDocumentBinding（配置中心审核设置）。
    AUDIT_NODE_KEYS = audit_node_keys()

    # ========================================================
    # 功能开关 / 审核判定
    # ========================================================

    async def check_node_enabled(self, tenant_id: int, node_key: str) -> bool:
        """
        保留签名的空实现：功能是否开启由「菜单管理（is_active）」控制。
        保留此方法仅为避免改动 20+ 个业务 Service 调用点。
        """
        return True

    async def check_audit_required(self, tenant_id: int, node_key: str) -> bool:
        """
        是否需要人工审核：租户在审核设置中启用 node_key 且已绑定可用审批流程。
        """
        from core.services.approval.audit_binding_service import AuditBindingService

        return await AuditBindingService.is_audit_enabled(tenant_id, node_key)

    async def get_audit_required_map(
        self,
        tenant_id: int,
        node_keys: List[str] | None = None,
    ) -> Dict[str, bool]:
        """
        批量返回单据节点是否需要审核（来自 AuditDocumentBinding）。
        """
        from core.services.approval.audit_binding_service import AuditBindingService

        return await AuditBindingService.get_audit_required_map(tenant_id, node_keys)

    # ========================================================
    # 参数读取
    # ========================================================

    async def get_business_config(self, tenant_id: int) -> Dict[str, Any]:
        """
        获取业务「参数」配置，已合并 DEFAULT_PARAMETERS。

        返回结构固定为 {"parameters": {category: {key: value}}}。
        不再返回 running_mode / modules / nodes / complexity_* 等蓝图时代字段。
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")

        stored = (tenant.settings or {}).get("business_config", {}) or {}
        stored_params = stored.get("parameters", {}) or {}

        merged: Dict[str, Dict[str, Any]] = {}
        for category, defaults in DEFAULT_PARAMETERS.items():
            category_values = dict(defaults)
            category_values.update(stored_params.get(category, {}) or {})
            merged[category] = category_values

        for category, values in stored_params.items():
            if category not in merged:
                merged[category] = dict(values or {})

        if "finance" in merged:
            merged["finance"] = coerce_finance_parameter_dict(merged["finance"])

        return {"parameters": merged}

    async def get_bom_multi_version_allowed(self, tenant_id: int) -> bool:
        config = await self.get_business_config(tenant_id)
        return bool(config["parameters"].get("bom", {}).get("bom_multi_version_allowed", True))

    async def is_trial_run_mode_enabled(self, tenant_id: int) -> bool:
        """是否开启试运营模式（试运营期间部分业务校验可放宽，具体规则由各领域按需接入）。"""
        config = await self.get_business_config(tenant_id)
        return bool(config["parameters"].get("common", {}).get("trial_run_mode", False))

    async def _get_decimal_places_param(
        self,
        tenant_id: int,
        key: str,
        *,
        default: int,
        max_places: int,
    ) -> int:
        config = await self.get_business_config(tenant_id)
        raw = config["parameters"].get("common", {}).get(key, default)
        try:
            places = int(raw)
        except (TypeError, ValueError):
            places = default
        return max(0, min(max_places, places))

    async def get_quantity_decimal_places(self, tenant_id: int) -> int:
        """数量小数位（默认 2，上限 2，对齐主流数量 Decimal 字段）。"""
        return await self._get_decimal_places_param(
            tenant_id, "quantity_decimal_places", default=2, max_places=2
        )

    async def get_price_decimal_places(self, tenant_id: int) -> int:
        """单价小数位（默认 2，上限 4，对齐采购单价 Decimal 字段）。"""
        return await self._get_decimal_places_param(
            tenant_id, "price_decimal_places", default=2, max_places=4
        )

    async def get_amount_decimal_places(self, tenant_id: int) -> int:
        """金额小数位（默认 2，上限 2，对齐金额 Decimal 字段）。"""
        return await self._get_decimal_places_param(
            tenant_id, "amount_decimal_places", default=2, max_places=2
        )

    async def allow_production_without_material(self, tenant_id: int) -> bool:
        return (await self.get_material_shortage_block_level(tenant_id)) <= 0

    async def get_material_shortage_block_level(self, tenant_id: int) -> int:
        config = await self.get_business_config(tenant_id)
        wo_params = config["parameters"].get("work_order", {})
        raw_level = wo_params.get("material_shortage_block_level")
        if raw_level is None:
            allow_without_material = bool(wo_params.get("allow_production_without_material", False))
            return 0 if allow_without_material else 1
        try:
            level = int(raw_level)
        except (TypeError, ValueError):
            level = 1
        return max(0, min(3, level))

    async def _get_percentage_param(self, tenant_id: int, category: str, key: str) -> float:
        config = await self.get_business_config(tenant_id)
        raw = config["parameters"].get(category, {}).get(key, 0)
        try:
            pct = float(raw)
        except (TypeError, ValueError):
            pct = 0.0
        return max(0.0, min(100.0, pct))

    async def get_purchase_tolerance_percentage(self, tenant_id: int) -> float:
        return await self._get_percentage_param(tenant_id, "purchase", "tolerance_percentage")

    async def get_purchase_price_fluctuation_limit_percent(self, tenant_id: int) -> float:
        return await self._get_percentage_param(tenant_id, "purchase", "price_fluctuation_limit_percent")

    async def get_sales_low_margin_threshold_percent(self, tenant_id: int) -> float:
        return await self._get_percentage_param(tenant_id, "sales", "low_margin_threshold_percent")

    async def get_sales_price_deviation_approval_threshold_percent(self, tenant_id: int) -> float:
        return await self._get_percentage_param(tenant_id, "sales", "price_deviation_approval_threshold_percent")

    async def get_finance_auto_write_off_precision_limit(self, tenant_id: int) -> float:
        return await self._get_percentage_param(tenant_id, "finance", "auto_write_off_precision_limit")

    async def get_finance_auto_generate_receivable_from_sales_invoice(self, tenant_id: int) -> bool:
        config = await self.get_business_config(tenant_id)
        return bool(config["parameters"].get("finance", {}).get("auto_generate_receivable_from_sales_invoice", False))

    async def get_finance_auto_generate_payable_from_purchase_invoice(self, tenant_id: int) -> bool:
        config = await self.get_business_config(tenant_id)
        return bool(config["parameters"].get("finance", {}).get("auto_generate_payable_from_purchase_invoice", False))

    async def resolve_revenue_recognition(self, tenant_id: int, customer_id: Optional[int]) -> str:
        """有效应收确认策略：客户覆盖非空则用覆盖，否则用组织 finance.revenue_recognition（已 coerce）。"""
        config = await self.get_business_config(tenant_id)
        fin = config["parameters"].get("finance", {}) or {}
        org_rev = str(fin.get("revenue_recognition") or "on_shipment").strip()
        if org_rev not in ("on_shipment", "on_invoice", "on_milestone", "mixed"):
            org_rev = "on_shipment"
        if not customer_id:
            return org_rev
        cust = await Customer.get_or_none(
            id=int(customer_id), tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not cust or not cust.revenue_recognition_override:
            return org_rev
        ov = str(cust.revenue_recognition_override).strip()
        return ov if ov in ("on_shipment", "on_invoice", "on_milestone", "mixed") else org_rev

    async def resolve_payable_recognition(self, tenant_id: int, supplier_id: Optional[int]) -> str:
        """有效应付确认策略：供应商覆盖非空则用覆盖，否则用组织 finance.payable_recognition（已 coerce）。"""
        config = await self.get_business_config(tenant_id)
        fin = config["parameters"].get("finance", {}) or {}
        org_pay = str(fin.get("payable_recognition") or "on_receipt").strip()
        if org_pay not in ("on_receipt", "on_purchase_invoice"):
            org_pay = "on_receipt"
        if not supplier_id:
            return org_pay
        sup = await Supplier.get_or_none(
            id=int(supplier_id), tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not sup or not sup.payable_recognition_override:
            return org_pay
        ov = str(sup.payable_recognition_override).strip()
        return ov if ov in ("on_receipt", "on_purchase_invoice") else org_pay

    async def should_auto_generate_receivable_on_sales_delivery(
        self, tenant_id: int, customer_id: Optional[int] = None
    ) -> bool:
        resolved = await self.resolve_revenue_recognition(tenant_id, customer_id)
        return resolved in ("on_shipment", "mixed")

    async def should_auto_generate_receivable_from_sales_invoice_effective(
        self, tenant_id: int, customer_id: Optional[int] = None
    ) -> bool:
        """
        销项发票是否尝试自动生成应收。
        - 解析策略须为 on_invoice。
        - 组织默认为「按票」时：仍受 auto_generate_receivable_from_sales_invoice 总开关约束。
        - 组织默认为「按发货」时：参数互斥会把上述开关 coerce 为 False，此时仅当客户在主数据上
          显式覆盖为 on_invoice 时，仍允许走发票路径（避免无法为个别客户按票记账）。
        """
        resolved = await self.resolve_revenue_recognition(tenant_id, customer_id)
        if resolved != "on_invoice":
            return False
        config = await self.get_business_config(tenant_id)
        fin = config["parameters"].get("finance", {}) or {}
        auto = bool(fin.get("auto_generate_receivable_from_sales_invoice", False))
        org_rev = fin.get("revenue_recognition")
        if org_rev == "on_invoice":
            return auto
        if not customer_id:
            return False
        cust = await Customer.get_or_none(
            id=int(customer_id), tenant_id=tenant_id, deleted_at__isnull=True
        )
        return bool(cust and (cust.revenue_recognition_override or "") == "on_invoice")

    async def should_auto_generate_payable_on_purchase_receipt(
        self, tenant_id: int, supplier_id: Optional[int] = None
    ) -> bool:
        return (await self.resolve_payable_recognition(tenant_id, supplier_id)) == "on_receipt"

    async def should_auto_generate_payable_from_purchase_invoice_effective(
        self, tenant_id: int, supplier_id: Optional[int] = None
    ) -> bool:
        """对称于应收：组织按进项发票时看总开关；组织按入库时仅供应商显式覆盖 on_purchase_invoice 可走发票路径。"""
        resolved = await self.resolve_payable_recognition(tenant_id, supplier_id)
        if resolved != "on_purchase_invoice":
            return False
        config = await self.get_business_config(tenant_id)
        fin = config["parameters"].get("finance", {}) or {}
        auto = bool(fin.get("auto_generate_payable_from_purchase_invoice", False))
        org_pay = fin.get("payable_recognition")
        if org_pay == "on_purchase_invoice":
            return auto
        if not supplier_id:
            return False
        sup = await Supplier.get_or_none(
            id=int(supplier_id), tenant_id=tenant_id, deleted_at__isnull=True
        )
        return bool(sup and (sup.payable_recognition_override or "") == "on_purchase_invoice")

    # ========================================================
    # 计划 / 工单策略派生逻辑
    # ========================================================

    async def can_direct_generate_work_order_from_computation(self, tenant_id: int) -> bool:
        """生产计划功能下线后，需求计算始终可直接生成工单。"""
        return True

    async def auto_push_sales_to_computation_on_approve(self, tenant_id: int) -> bool:
        """销售订单/销售预测审核通过后是否自动下推到需求计算（组织级开关，默认关闭）。"""
        config = await self.get_business_config(tenant_id)
        return bool(
            config["parameters"]
            .get("planning", {})
            .get("auto_push_sales_to_computation_on_approve", False)
        )

    async def get_push_default_mode(self, tenant_id: int) -> str:
        """
        下推默认模式：
        - draft: 下推为草稿
        - confirm: 下推为正式（执行单据确认/下达路径）
        """
        config = await self.get_business_config(tenant_id)
        raw = (
            config.get("parameters", {})
            .get("automation", {})
            .get("push_default_mode", "confirm")
        )
        mode = str(raw or "confirm").strip().lower()
        return mode if mode in ("draft", "confirm") else "confirm"

    async def get_work_order_picking_policy(self, tenant_id: int) -> Dict[str, Any]:
        config = await self.get_business_config(tenant_id)
        wo_params = config["parameters"].get("work_order", {})

        issue_strategy = str(wo_params.get("picking_issue_strategy", "after_release") or "after_release")
        warehouse_only = bool(wo_params.get("picking_confirm_warehouse_only", True))
        require_before_start = bool(wo_params.get("require_confirmed_picking_before_operation_start", False))
        require_before_reporting = bool(wo_params.get("require_confirmed_picking_before_reporting", False))

        configured_codes = wo_params.get("picking_confirm_allowed_role_codes", [])
        if not isinstance(configured_codes, list):
            configured_codes = []
        normalized_extra_codes = sorted({
            str(code).strip().upper()
            for code in configured_codes
            if str(code).strip()
        })

        configured_domains = wo_params.get("picking_confirm_allowed_functional_domains", [])
        if not isinstance(configured_domains, list):
            configured_domains = []
        normalized_extra_domains: list[str] = []
        for raw_domain in configured_domains:
            try:
                normalized = normalize_functional_domain(raw_domain)
            except ValueError:
                continue
            if normalized and normalized not in normalized_extra_domains:
                normalized_extra_domains.append(normalized)
        normalized_extra_domains.sort()

        # 「仅仓库可确认领料」开启：仓储职能域 + 额外域；角色码白名单为补充。
        # 关闭且未配置额外名单：不卡职能域/角色码（由出库 RBAC 门控）。
        allowed_codes = set(DEFAULT_WAREHOUSE_ROLE_CODES)
        allowed_domains: set[str] = set()
        if warehouse_only:
            allowed_domains.add("warehouse")
            allowed_domains.update(normalized_extra_domains)
        elif normalized_extra_domains:
            allowed_domains.update(normalized_extra_domains)
        if not warehouse_only:
            if normalized_extra_codes:
                allowed_codes.update(normalized_extra_codes)
            else:
                allowed_codes = set()

        return {
            "picking_issue_strategy": issue_strategy,
            "picking_confirm_warehouse_only": warehouse_only,
            "picking_confirm_allowed_role_codes": normalized_extra_codes,
            "picking_confirm_allowed_functional_domains": normalized_extra_domains,
            "require_confirmed_picking_before_operation_start": require_before_start,
            "require_confirmed_picking_before_reporting": require_before_reporting,
            "default_warehouse_role_codes": sorted(DEFAULT_WAREHOUSE_ROLE_CODES),
            "default_production_picking_confirm_role_codes": sorted(
                DEFAULT_PRODUCTION_PICKING_CONFIRM_ROLE_CODES
            ),
            "default_functional_domains": sorted(FUNCTIONAL_DOMAINS),
            "effective_allowed_role_codes": sorted(allowed_codes),
            "effective_allowed_functional_domains": sorted(allowed_domains),
        }

    async def get_last_operation_auto_inbound_mode(self, tenant_id: int) -> str:
        config = await self.get_business_config(tenant_id)
        raw = config["parameters"].get("work_order", {}).get("last_operation_auto_inbound_mode", "none")
        v = str(raw or "none").strip()
        return v if v in ("none", "direct_inbound", "inbound_notice") else "none"

    async def get_reporting_default_production_worker_mode(self, tenant_id: int) -> str:
        config = await self.get_business_config(tenant_id)
        raw = config["parameters"].get("reporting", {}).get("default_production_worker_mode", "auto")
        v = str(raw or "auto").strip()
        return v if v in ("current_user", "operation_assigned", "auto") else "auto"

    async def get_reporting_default_quantity_mode(self, tenant_id: int) -> str:
        """报工弹窗合格/不合格数量默认值：reportable=本次可报，zero=0。"""
        config = await self.get_business_config(tenant_id)
        reporting = config["parameters"].get("reporting", {}) or {}
        raw = reporting.get("default_reporting_quantity_mode")
        if raw is not None:
            v = str(raw).strip()
            if v in ("reportable", "zero"):
                return v
        if reporting.get("auto_fill") is False:
            return "zero"
        return "reportable"

    # ========================================================
    # 参数写入
    # ========================================================

    async def update_process_parameter(
        self,
        tenant_id: int,
        category: str,
        parameter_key: str,
        value: Any,
    ) -> Dict[str, Any]:
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")

        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        business_config.setdefault("parameters", {})
        business_config["parameters"].setdefault(category, {})
        business_config["parameters"][category][parameter_key] = value
        if "finance" in business_config["parameters"]:
            business_config["parameters"]["finance"] = coerce_finance_parameter_dict(
                business_config["parameters"]["finance"]
            )

        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)

        logger.info(f"组织 {tenant_id} 更新流程参数 {category}.{parameter_key} = {value}")
        return {
            "success": True,
            "message": f"流程参数 {category}.{parameter_key} 已更新",
            "category": category,
            "parameter_key": parameter_key,
            "value": value,
        }

    async def batch_update_process_parameters(
        self,
        tenant_id: int,
        parameters: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")

        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        business_config.setdefault("parameters", {})
        for category, params in parameters.items():
            business_config["parameters"].setdefault(category, {}).update(params)
        if "quality" in parameters:
            from apps.kuaizhizao.services.inspection_policy_service import validate_quality_business_parameters

            merged_quality = business_config["parameters"].get("quality") or {}
            validate_quality_business_parameters(merged_quality)
        if "finance" in business_config["parameters"]:
            business_config["parameters"]["finance"] = coerce_finance_parameter_dict(
                business_config["parameters"]["finance"]
            )

        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)

        logger.info(f"组织 {tenant_id} 批量更新流程参数")
        return {
            "success": True,
            "message": "流程参数已批量更新",
            "updated_count": sum(len(params) for params in parameters.values()),
        }

    # ========================================================
    # PRO 功能
    # ========================================================

    async def check_pro_feature_access(
        self,
        tenant_id: int,
        feature_type: str,
        feature_code: str,
    ) -> Dict[str, Any]:
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")

        is_pro_feature = False
        if feature_type == "modules":
            is_pro_feature = feature_code in self.PRO_FEATURES["modules"]
        elif feature_type == "parameters":
            for features in self.PRO_FEATURES["parameters"].values():
                if feature_code in features:
                    is_pro_feature = True
                    break

        if not is_pro_feature:
            return {
                "has_access": True,
                "is_pro_feature": False,
                "current_plan": tenant.plan.value,
            }

        has_access = tenant.plan.value in self.PRO_PLANS
        return {
            "has_access": has_access,
            "is_pro_feature": True,
            "current_plan": tenant.plan.value,
            "upgrade_message": "此功能需要专业套餐或企业套餐，请升级后使用" if not has_access else None,
        }

    async def get_pro_features_list(self, tenant_id: int) -> Dict[str, Any]:
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")

        has_pro_access = tenant.plan.value in self.PRO_PLANS
        return {
            "has_pro_access": has_pro_access,
            "current_plan": tenant.plan.value,
            "pro_modules": self.PRO_FEATURES["modules"],
            "pro_parameters": self.PRO_FEATURES["parameters"],
        }
