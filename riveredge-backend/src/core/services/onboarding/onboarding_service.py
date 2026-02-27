"""
上线向导服务模块

提供角色上线准备和使用场景引导的业务逻辑处理。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Dict, Any, Optional
from core.models.role import Role
from core.services.role_scenario.role_scenario_service import ROLE_SCENARIOS
from infra.exceptions.exceptions import NotFoundError
from loguru import logger


# 角色上线准备清单（预定义）
ROLE_ONBOARDING_GUIDES: Dict[str, Dict[str, Any]] = {
    "sales": {
        "name": "销售",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "customer_data", "name": "导入客户数据", "required": True, "description": "导入客户基本信息、联系方式等"},
                    {"id": "product_data", "name": "导入产品数据", "required": True, "description": "导入产品信息、价格等"},
                    {"id": "sales_template", "name": "配置销售模板", "required": False, "description": "配置销售订单模板、报价模板等"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配销售角色", "required": True, "description": "为用户分配销售角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认销售相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "sales_order_training", "name": "销售订单操作培训", "required": True, "description": "学习如何创建、编辑、查询销售订单"},
                    {"id": "customer_management_training", "name": "客户管理培训", "required": True, "description": "学习如何管理客户信息"},
                ],
            },
        ],
    },
    "purchase": {
        "name": "采购",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "supplier_data", "name": "导入供应商数据", "required": True, "description": "导入供应商基本信息、联系方式等"},
                    {"id": "material_data", "name": "导入物料数据", "required": True, "description": "导入物料信息、价格等"},
                    {"id": "purchase_template", "name": "配置采购模板", "required": False, "description": "配置采购订单模板等"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配采购角色", "required": True, "description": "为用户分配采购角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认采购相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "purchase_order_training", "name": "采购订单操作培训", "required": True, "description": "学习如何创建、编辑、查询采购订单"},
                    {"id": "supplier_management_training", "name": "供应商管理培训", "required": True, "description": "学习如何管理供应商信息"},
                ],
            },
        ],
    },
    "warehouse": {
        "name": "仓库",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "warehouse_data", "name": "创建仓库信息", "required": True, "description": "创建仓库、库位等基础数据"},
                    {"id": "inventory_data", "name": "导入期初库存", "required": True, "description": "导入期初库存数据"},
                    {"id": "material_data", "name": "确认物料数据", "required": True, "description": "确认物料数据已完整"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配仓库角色", "required": True, "description": "为用户分配仓库角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认仓库相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "inventory_management_training", "name": "库存管理培训", "required": True, "description": "学习如何查询、管理库存"},
                    {"id": "stock_in_out_training", "name": "出入库操作培训", "required": True, "description": "学习如何执行出入库操作"},
                ],
            },
        ],
    },
    "production": {
        "name": "生产",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "workstation_data", "name": "创建工作中心/工位", "required": True, "description": "创建工作中心、工位等基础数据"},
                    {"id": "bom_data", "name": "确认BOM数据", "required": True, "description": "确认BOM数据已完整"},
                    {"id": "routing_data", "name": "确认工艺路线", "required": False, "description": "确认工艺路线数据"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配生产角色", "required": True, "description": "为用户分配生产角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认生产相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "reporting_training", "name": "报工操作培训", "required": True, "description": "学习如何执行报工操作"},
                    {"id": "work_order_training", "name": "工单查看培训", "required": True, "description": "学习如何查看工单信息"},
                ],
            },
        ],
    },
    "quality": {
        "name": "质量",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "inspection_standard", "name": "配置检验标准", "required": True, "description": "配置来料、过程、成品检验标准"},
                    {"id": "quality_template", "name": "配置质量模板", "required": False, "description": "配置质量检验模板"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配质量角色", "required": True, "description": "为用户分配质量角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认质量相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "inspection_training", "name": "检验操作培训", "required": True, "description": "学习如何执行质量检验"},
                    {"id": "quality_exception_training", "name": "质量异常处理培训", "required": True, "description": "学习如何处理质量异常"},
                ],
            },
        ],
    },
    "planner": {
        "name": "计划",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "material_data", "name": "确认物料数据", "required": True, "description": "确认物料数据已完整"},
                    {"id": "bom_data", "name": "确认BOM数据", "required": True, "description": "确认BOM数据已完整"},
                    {"id": "sales_forecast_data", "name": "导入销售预测", "required": False, "description": "导入销售预测数据"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配计划角色", "required": True, "description": "为用户分配计划角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认计划相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "planning_training", "name": "生产计划培训", "required": True, "description": "学习如何创建和执行生产计划"},
                    {"id": "mrp_training", "name": "MRP/LRP运算培训", "required": True, "description": "学习如何执行MRP/LRP运算"},
                ],
            },
        ],
    },
    "manager": {
        "name": "管理者",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "organization_data", "name": "完善组织信息", "required": True, "description": "完善组织基本信息、设置等"},
                    {"id": "user_data", "name": "创建用户账号", "required": True, "description": "为各角色创建用户账号"},
                    {"id": "role_data", "name": "配置角色权限", "required": True, "description": "配置各角色的权限"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配管理角色", "required": True, "description": "为用户分配管理角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认管理相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "dashboard_training", "name": "工作台使用培训", "required": True, "description": "学习如何使用工作台查看统计数据"},
                    {"id": "report_training", "name": "报表查看培训", "required": True, "description": "学习如何查看各类报表"},
                ],
            },
        ],
    },
    "technician": {
        "name": "技术研发人员",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "product_data", "name": "导入产品数据", "required": True, "description": "导入产品基本信息、规格等"},
                    {"id": "bom_data", "name": "创建BOM数据", "required": True, "description": "创建物料清单（BOM）"},
                    {"id": "routing_data", "name": "创建工艺路线", "required": True, "description": "创建工艺路线数据"},
                    {"id": "sop_data", "name": "创建SOP", "required": False, "description": "创建标准作业程序（SOP）"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配技术角色", "required": True, "description": "为用户分配技术研发角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认技术相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "bom_training", "name": "BOM管理培训", "required": True, "description": "学习如何创建和管理BOM"},
                    {"id": "routing_training", "name": "工艺路线设计培训", "required": True, "description": "学习如何设计工艺路线"},
                    {"id": "sop_training", "name": "SOP设计培训", "required": False, "description": "学习如何设计SOP"},
                ],
            },
        ],
    },
    "supervisor": {
        "name": "班组长",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "workstation_data", "name": "确认工作中心/工位", "required": True, "description": "确认工作中心、工位数据已完整"},
                    {"id": "work_order_data", "name": "查看工单数据", "required": True, "description": "查看待下达的工单"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配班组长角色", "required": True, "description": "为用户分配班组长角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认班组长相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "work_order_training", "name": "工单管理培训", "required": True, "description": "学习如何管理工单、下达工单"},
                    {"id": "progress_tracking_training", "name": "生产进度跟踪培训", "required": True, "description": "学习如何跟踪生产进度"},
                    {"id": "personnel_training", "name": "人员安排培训", "required": True, "description": "学习如何安排生产人员"},
                ],
            },
        ],
    },
    "operator": {
        "name": "生产人员",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "work_order_data", "name": "查看工单信息", "required": True, "description": "查看待报工的工单"},
                    {"id": "sop_data", "name": "查看SOP", "required": False, "description": "查看标准作业程序"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配生产角色", "required": True, "description": "为用户分配生产人员角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认生产相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "reporting_training", "name": "报工操作培训", "required": True, "description": "学习如何执行报工操作"},
                    {"id": "sop_viewing_training", "name": "SOP查看培训", "required": False, "description": "学习如何查看SOP"},
                    {"id": "drawing_viewing_training", "name": "图纸查看培训", "required": False, "description": "学习如何查看图纸"},
                ],
            },
        ],
    },
    "equipment": {
        "name": "设备组",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "equipment_data", "name": "导入设备数据", "required": True, "description": "导入设备基本信息、规格等"},
                    {"id": "maintenance_plan", "name": "配置维护计划", "required": True, "description": "配置设备维护计划"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配设备角色", "required": True, "description": "为用户分配设备组角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认设备相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "equipment_management_training", "name": "设备管理培训", "required": True, "description": "学习如何管理设备信息"},
                    {"id": "maintenance_training", "name": "设备维护培训", "required": True, "description": "学习如何执行设备维护"},
                    {"id": "monitoring_training", "name": "设备监控培训", "required": True, "description": "学习如何监控设备状态"},
                ],
            },
        ],
    },
    "finance": {
        "name": "财务",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "account_data", "name": "配置会计科目", "required": True, "description": "配置会计科目体系"},
                    {"id": "cost_center_data", "name": "配置成本中心", "required": True, "description": "配置成本中心"},
                    {"id": "receivable_payable_data", "name": "导入应收应付数据", "required": False, "description": "导入期初应收应付数据"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配财务角色", "required": True, "description": "为用户分配财务角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认财务相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "receivable_payable_training", "name": "应收应付管理培训", "required": True, "description": "学习如何管理应收应付账款"},
                    {"id": "cost_accounting_training", "name": "成本核算培训", "required": True, "description": "学习如何核算生产成本"},
                    {"id": "financial_report_training", "name": "财务报表培训", "required": True, "description": "学习如何查看财务报表"},
                ],
            },
        ],
    },
    "implementer": {
        "name": "系统实施人员",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "system_initialization", "name": "系统初始化", "required": True, "description": "执行系统初始化向导"},
                    {"id": "organization_data", "name": "完善组织信息", "required": True, "description": "完善组织基本信息、设置等"},
                    {"id": "base_data_import", "name": "导入基础数据", "required": True, "description": "导入物料、BOM、客户、供应商等基础数据"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "user_creation", "name": "创建用户账号", "required": True, "description": "为各角色创建用户账号"},
                    {"id": "role_assignment", "name": "分配角色", "required": True, "description": "为用户分配相应角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认各角色权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "system_training", "name": "系统使用培训", "required": True, "description": "学习系统基本功能和使用方法"},
                    {"id": "data_import_training", "name": "数据导入培训", "required": True, "description": "学习如何导入基础数据"},
                    {"id": "user_training", "name": "用户培训", "required": True, "description": "学习如何培训最终用户"},
                ],
            },
        ],
    },
}


# 上线助手四阶段配置（蓝图确认 → 基础数据 → 业务流程 → 期初数据对齐）
GO_LIVE_ASSISTANT_PHASES = [
    {
        "id": "phase1_blueprint",
        "name": "蓝图确认",
        "order": 1,
        "items": [
            {
                "id": "blueprint_config",
                "name": "业务蓝图配置",
                "required": True,
                "description": "配置行业、规模、启用模块、单据审核规则",
                "jump_path": "/system/config-center?tab=graph",
                "check_key": "blueprint_confirmed",
            },
            {
                "id": "init_completed",
                "name": "组织初始化",
                "required": True,
                "description": "完成组织信息、默认设置、编码规则、管理员配置",
                "jump_path": "/init/wizard",
                "check_key": "init_completed",
            },
        ],
    },
    {
        "id": "phase2_basic_data",
        "name": "基础数据",
        "order": 2,
        "items": [
            {"id": "customer", "name": "客户", "required": True, "description": "至少1个客户", "jump_path": "/apps/master-data/supply-chain/customers", "check_key": "customer_count"},
            {"id": "supplier", "name": "供应商", "required": True, "description": "至少1个供应商", "jump_path": "/apps/master-data/supply-chain/suppliers", "check_key": "supplier_count"},
            {"id": "material", "name": "物料/产品", "required": True, "description": "至少1个物料", "jump_path": "/apps/master-data/materials", "check_key": "material_count"},
            {"id": "warehouse", "name": "仓库", "required": True, "description": "至少1个仓库", "jump_path": "/apps/master-data/warehouse/warehouses", "check_key": "warehouse_count"},
            {"id": "bom", "name": "BOM", "required": False, "description": "生产型需BOM（可选）", "jump_path": "/apps/master-data/materials", "check_key": "bom_count"},
            {"id": "process_route", "name": "工艺路线", "required": False, "description": "生产型需工艺路线（可选）", "jump_path": "/apps/master-data/process", "check_key": "routing_count"},
            {"id": "user", "name": "业务用户", "required": True, "description": "除管理员外至少1个用户", "jump_path": "/system/users", "check_key": "user_count"},
        ],
    },
    {
        "id": "phase3_business_flow",
        "name": "业务流程",
        "order": 3,
        "items": [
            {"id": "sales_order", "name": "创建销售订单", "required": True, "description": "新建并提交销售订单", "jump_path": "/apps/kuaizhizao/sales-management/sales-orders", "check_key": "sales_order_count"},
            {"id": "demand_computation", "name": "下推需求计算", "required": True, "description": "需求计算已生成", "jump_path": "/apps/kuaizhizao/plan-management/demand-computation", "check_key": "demand_computation_count"},
            {"id": "work_order", "name": "下推工单", "required": True, "description": "工单已生成", "jump_path": "/apps/kuaizhizao/production-execution/work-orders", "check_key": "work_order_count"},
            {"id": "reporting", "name": "工单报工", "required": True, "description": "至少1条报工记录", "jump_path": "/apps/kuaizhizao/production-execution/work-orders", "check_key": "reporting_record_count"},
            {"id": "finished_goods_receipt", "name": "成品入库", "required": True, "description": "成品入库单已创建", "jump_path": "/apps/kuaizhizao/warehouse-management/inbound", "check_key": "finished_goods_receipt_count"},
            {"id": "sales_delivery", "name": "销售出库", "required": True, "description": "销售出库单已创建", "jump_path": "/apps/kuaizhizao/warehouse-management/inbound", "check_key": "sales_delivery_count"},
        ],
    },
    {
        "id": "phase4_initial_data",
        "name": "期初数据对齐",
        "order": 4,
        "items": [
            {"id": "initial_inventory", "name": "期初库存", "required": True, "description": "导入期初库存", "jump_path": "/apps/kuaizhizao/warehouse-management/initial-data", "check_key": "initial_inventory_count"},
            {"id": "initial_wip", "name": "期初在制品", "required": False, "description": "导入期初在制品（可选）", "jump_path": "/apps/kuaizhizao/warehouse-management/initial-data", "check_key": "initial_wip_count"},
            {"id": "initial_receivable_payable", "name": "期初应收应付", "required": False, "description": "导入期初应收应付（可选）", "jump_path": "/apps/kuaizhizao/warehouse-management/initial-data", "check_key": "initial_receivable_payable_count"},
            {"id": "initial_data_verified", "name": "数据核对完成", "required": True, "description": "确认期初数据已核对", "jump_path": "/apps/kuaizhizao/warehouse-management/initial-data", "check_key": "initial_data_verified"},
        ],
    },
]


# 系统上线向导步骤配置（从0到可开单）
SYSTEM_GO_LIVE_CHECKLIST = {
    "name": "系统上线",
    "checklist": [
        {
            "id": "data_preparation",
            "name": "基础数据准备",
            "items": [
                {
                    "id": "customer_data",
                    "name": "创建客户",
                    "required": True,
                    "description": "至少创建1个客户，用于销售订单",
                    "jump_path": "/apps/master-data/supply-chain/customers",
                    "check_key": "customer_count",
                },
                {
                    "id": "material_data",
                    "name": "创建物料/产品",
                    "required": True,
                    "description": "至少创建1个物料，用于销售订单、采购订单、工单",
                    "jump_path": "/apps/master-data/materials",
                    "check_key": "material_count",
                },
                {
                    "id": "warehouse_data",
                    "name": "创建仓库",
                    "required": True,
                    "description": "至少创建1个仓库，用于出入库单据",
                    "jump_path": "/apps/master-data/warehouse/warehouses",
                    "check_key": "warehouse_count",
                },
                {
                    "id": "supplier_data",
                    "name": "创建供应商",
                    "required": True,
                    "description": "至少创建1个供应商，用于采购订单",
                    "jump_path": "/apps/master-data/supply-chain/suppliers",
                    "check_key": "supplier_count",
                },
            ],
        },
        {
            "id": "user_config",
            "name": "用户与权限",
            "items": [
                {
                    "id": "user_data",
                    "name": "创建业务用户",
                    "required": True,
                    "description": "除管理员外至少1个用户，用于业务单据",
                    "jump_path": "/system/users",
                    "check_key": "user_count",
                },
            ],
        },
        {
            "id": "verification",
            "name": "完成验证",
            "items": [
                {
                    "id": "create_first_document",
                    "name": "开出一张测试单据",
                    "required": True,
                    "description": "创建销售订单或采购订单，验证系统可正常开单",
                    "jump_path": "/apps/kuaizhizao/sales-management/sales-orders",
                    "check_key": None,
                },
            ],
        },
    ],
}


class OnboardingService:
    """
    上线向导服务类
    
    处理角色上线准备和使用场景引导相关的业务逻辑。
    """

    @staticmethod
    async def get_system_go_live_guide(tenant_id: int) -> Dict[str, Any]:
        """
        获取系统上线向导（从0到可开单的步骤式引导）

        Args:
            tenant_id: 组织ID

        Returns:
            Dict[str, Any]: 系统上线向导信息，含 init_completed、checklist 及每项完成状态
        """
        from infra.models.tenant import Tenant

        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            return {
                "init_completed": False,
                "message": "组织不存在",
                "checklist": [],
            }

        settings = tenant.settings or {}
        init_completed = bool(settings.get("init_completed"))

        if not init_completed:
            return {
                "init_completed": False,
                "message": "请先完成组织初始化",
                "checklist": SYSTEM_GO_LIVE_CHECKLIST["checklist"],
                "guide": SYSTEM_GO_LIVE_CHECKLIST,
            }

        # 校验各步骤数据是否存在（懒加载避免循环依赖）
        check_results = {}
        try:
            from apps.master_data.models.customer import Customer
            from apps.master_data.models.material import Material
            from apps.master_data.models.warehouse import Warehouse
            from apps.master_data.models.supplier import Supplier
            from infra.models.user import User

            customer_count = await Customer.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            material_count = await Material.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            warehouse_count = await Warehouse.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            supplier_count = await Supplier.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            user_count = await User.filter(
                tenant_id=tenant_id, is_tenant_admin=False, deleted_at__isnull=True
            ).count()

            check_results = {
                "customer_count": customer_count >= 1,
                "material_count": material_count >= 1,
                "warehouse_count": warehouse_count >= 1,
                "supplier_count": supplier_count >= 1,
                "user_count": user_count >= 1,
            }
        except Exception as e:
            logger.warning(f"系统上线向导数据校验失败: {e}")
            check_results = {}

        # 为 checklist 每项填充 completed 状态
        def enrich_checklist(items: list, results: dict) -> list:
            enriched = []
            for item in items:
                check_key = item.get("check_key")
                completed = results.get(check_key, False) if check_key else False
                enriched.append({**item, "completed": completed})
            return enriched

        enriched_checklist = []
        for category in SYSTEM_GO_LIVE_CHECKLIST["checklist"]:
            enriched_items = enrich_checklist(category["items"], check_results)
            enriched_checklist.append({
                **category,
                "items": enriched_items,
            })

        return {
            "init_completed": True,
            "guide": {
                "name": SYSTEM_GO_LIVE_CHECKLIST["name"],
                "checklist": enriched_checklist,
            },
        }

    @staticmethod
    async def get_go_live_assistant(tenant_id: int) -> Dict[str, Any]:
        """
        获取上线助手四阶段及每项完成状态

        Args:
            tenant_id: 组织ID

        Returns:
            Dict[str, Any]: 四阶段 phases、每项 completed 状态、all_completed 总览
        """
        from infra.models.tenant import Tenant

        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            return {"phases": [], "all_completed": False, "message": "组织不存在"}

        settings = tenant.settings or {}
        check_results: Dict[str, Any] = {
            "blueprint_confirmed": bool(settings.get("blueprint_confirmed")),
            "init_completed": bool(settings.get("init_completed")),
            "initial_data_verified": bool(settings.get("initial_data_verified")),
        }

        try:
            from apps.master_data.models.customer import Customer
            from apps.master_data.models.material import Material, BOM
            from apps.master_data.models.warehouse import Warehouse
            from apps.master_data.models.supplier import Supplier
            from apps.master_data.models.process import ProcessRoute
            from infra.models.user import User

            customer_count = await Customer.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            material_count = await Material.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            warehouse_count = await Warehouse.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            supplier_count = await Supplier.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            user_count = await User.filter(
                tenant_id=tenant_id, is_tenant_admin=False, deleted_at__isnull=True
            ).count()
            bom_count = await BOM.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            routing_count = await ProcessRoute.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()

            check_results.update({
                "customer_count": customer_count >= 1,
                "supplier_count": supplier_count >= 1,
                "material_count": material_count >= 1,
                "warehouse_count": warehouse_count >= 1,
                "bom_count": bom_count >= 1,
                "routing_count": routing_count >= 1,
                "user_count": user_count >= 1,
            })
        except Exception as e:
            logger.warning(f"上线助手基础数据校验失败: {e}")

        try:
            from apps.kuaizhizao.models.sales_order import SalesOrder
            from apps.kuaizhizao.models.demand_computation import DemandComputation
            from apps.kuaizhizao.models.work_order import WorkOrder
            from apps.kuaizhizao.models.reporting_record import ReportingRecord
            from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery

            sales_order_count = await SalesOrder.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            demand_computation_count = await DemandComputation.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            work_order_count = await WorkOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).exclude(name__icontains="期初在制品").count()
            reporting_record_count = await ReportingRecord.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            finished_goods_receipt_count = await FinishedGoodsReceipt.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            sales_delivery_count = await SalesDelivery.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()

            check_results.update({
                "sales_order_count": sales_order_count >= 1,
                "demand_computation_count": demand_computation_count >= 1,
                "work_order_count": work_order_count >= 1,
                "reporting_record_count": reporting_record_count >= 1,
                "finished_goods_receipt_count": finished_goods_receipt_count >= 1,
                "sales_delivery_count": sales_delivery_count >= 1,
            })
        except Exception as e:
            logger.warning(f"上线助手业务流程校验失败: {e}")

        try:
            from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
            from apps.kuaizhizao.models.work_order import WorkOrder
            from apps.kuaizhizao.models.receivable import Receivable
            from apps.kuaizhizao.models.payable import Payable

            initial_inventory_count = await PurchaseReceipt.filter(
                tenant_id=tenant_id,
                purchase_order_code="期初库存",
                deleted_at__isnull=True,
            ).count()
            initial_wip_count = await WorkOrder.filter(
                tenant_id=tenant_id,
                name__icontains="期初在制品",
                deleted_at__isnull=True,
            ).count()
            initial_receivable_count = await Receivable.filter(
                tenant_id=tenant_id,
                notes__icontains="期初应收",
                deleted_at__isnull=True,
            ).count()
            initial_payable_count = await Payable.filter(
                tenant_id=tenant_id,
                notes__icontains="期初应付",
                deleted_at__isnull=True,
            ).count()
            initial_receivable_payable_count = initial_receivable_count >= 1 or initial_payable_count >= 1

            check_results.update({
                "initial_inventory_count": initial_inventory_count >= 1,
                "initial_wip_count": initial_wip_count >= 1,
                "initial_receivable_payable_count": initial_receivable_payable_count,
            })
        except Exception as e:
            logger.warning(f"上线助手期初数据校验失败: {e}")

        def enrich_phase(phase: dict) -> dict:
            items = []
            for item in phase.get("items", []):
                check_key = item.get("check_key")
                completed = check_results.get(check_key, False) if check_key else False
                items.append({**item, "completed": completed})
            return {**phase, "items": items}

        phases = [enrich_phase(p) for p in GO_LIVE_ASSISTANT_PHASES]
        all_required_completed = all(
            item.get("completed", False)
            for phase in phases
            for item in phase.get("items", [])
            if item.get("required", True)
        )
        return {
            "phases": phases,
            "all_completed": all_required_completed,
        }

    @staticmethod
    async def mark_blueprint_confirmed(tenant_id: int) -> None:
        """标记业务蓝图已确认"""
        from infra.models.tenant import Tenant

        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError("组织不存在")
        settings = dict(tenant.settings or {})
        settings["blueprint_confirmed"] = True
        tenant.settings = settings
        await tenant.save(update_fields=["settings"])

    @staticmethod
    async def mark_initial_data_verified(tenant_id: int) -> None:
        """标记期初数据已核对"""
        from infra.models.tenant import Tenant

        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError("组织不存在")
        settings = dict(tenant.settings or {})
        settings["initial_data_verified"] = True
        tenant.settings = settings
        await tenant.save(update_fields=["settings"])

    @staticmethod
    async def get_role_onboarding_guide(
        tenant_id: int,
        role_id: Optional[int] = None,
        role_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取角色上线准备向导
        
        Args:
            tenant_id: 组织ID
            role_id: 角色ID（可选）
            role_code: 角色代码（可选）
            
        Returns:
            Dict[str, Any]: 角色上线准备向导信息
        """
        # 获取角色信息
        role = None
        if role_id:
            role = await Role.filter(
                tenant_id=tenant_id,
                id=role_id,
                deleted_at__isnull=True
            ).first()
        elif role_code:
            role = await Role.filter(
                tenant_id=tenant_id,
                code=role_code,
                deleted_at__isnull=True
            ).first()
        
        # 根据角色代码匹配向导
        role_guide_key = None
        if role:
            for key in ROLE_ONBOARDING_GUIDES.keys():
                if role.code.lower() == key or role.code.lower().startswith(key):
                    role_guide_key = key
                    break
        
        if not role_guide_key:
            # 如果没有匹配的向导，返回通用向导（管理者）
            role_guide_key = "manager"
        
        guide = ROLE_ONBOARDING_GUIDES[role_guide_key]
        
        return {
            "role": {
                "id": role.id if role else None,
                "uuid": role.uuid if role else None,
                "name": role.name if role else "通用",
                "code": role.code if role else "general",
            } if role else None,
            "guide": guide,
        }
    
    @staticmethod
    async def get_role_scenario_guide(
        tenant_id: int,
        role_id: Optional[int] = None,
        role_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取角色使用场景向导
        
        Args:
            tenant_id: 组织ID
            role_id: 角色ID（可选）
            role_code: 角色代码（可选）
            
        Returns:
            Dict[str, Any]: 角色使用场景向导信息
        """
        # 获取角色场景（复用角色场景服务）
        from core.services.role_scenario.role_scenario_service import RoleScenarioService
        scenario_data = await RoleScenarioService.get_role_scenarios(
            tenant_id=tenant_id,
            role_id=role_id,
            role_code=role_code
        )
        
        scenarios = scenario_data.get("scenarios", {})
        if isinstance(scenarios, dict):
            # 提取场景信息
            scenario_list = scenarios.get("scenarios", [])
            
            # 为每个场景添加操作流程和常见问题
            enhanced_scenarios = []
            for scenario in scenario_list:
                enhanced_scenario = {
                    **scenario,
                    "workflow": [
                        {"step": 1, "name": "进入功能", "description": f"从菜单进入{scenario['name']}功能"},
                        {"step": 2, "name": "执行操作", "description": f"根据业务需求执行{scenario['name']}相关操作"},
                        {"step": 3, "name": "保存数据", "description": "保存操作结果"},
                    ],
                    "common_issues": [
                        {"question": f"如何创建{scenario['name']}？", "answer": f"点击创建按钮，填写必要信息后保存即可。"},
                        {"question": f"如何查询{scenario['name']}？", "answer": f"使用搜索功能，输入关键词进行查询。"},
                    ],
                    "best_practices": [
                        f"建议定期查看{scenario['name']}数据，及时处理异常情况",
                        f"操作前请确认数据准确性，避免错误操作",
                    ],
                }
                enhanced_scenarios.append(enhanced_scenario)
            
            return {
                "role": scenario_data.get("role"),
                "scenarios": {
                    "name": scenarios.get("name", ""),
                    "description": scenarios.get("description", ""),
                    "scenarios": enhanced_scenarios,
                },
            }
        else:
            return {
                "role": scenario_data.get("role"),
                "scenarios": {
                    "name": "通用场景",
                    "description": "通用使用场景",
                    "scenarios": [],
                },
            }
    
    @staticmethod
    async def get_quick_start_tutorial(
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        获取快速入门教程
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: 快速入门教程信息
        """
        tutorial = {
            "title": "快速入门教程",
            "description": "帮助新用户快速了解系统基本功能和使用方法",
            "steps": [
                {
                    "step": 1,
                    "title": "系统登录",
                    "description": "使用手机号或用户名登录系统",
                    "details": [
                        "打开系统登录页面",
                        "输入手机号或用户名和密码",
                        "点击登录按钮",
                    ],
                    "screenshot": None,  # TODO: 添加截图路径
                },
                {
                    "step": 2,
                    "title": "工作台概览",
                    "description": "了解工作台的基本功能",
                    "details": [
                        "登录后进入工作台页面",
                        "查看待办事项、统计数据等",
                        "点击卡片可跳转到详细页面",
                    ],
                    "screenshot": None,
                },
                {
                    "step": 3,
                    "title": "基础数据配置",
                    "description": "配置系统基础数据",
                    "details": [
                        "进入系统设置菜单",
                        "配置组织信息、编码规则等",
                        "导入基础数据（物料、BOM等）",
                    ],
                    "screenshot": None,
                },
                {
                    "step": 4,
                    "title": "业务流程操作",
                    "description": "学习基本业务流程操作",
                    "details": [
                        "根据角色查看对应的功能菜单",
                        "学习创建、编辑、查询等基本操作",
                        "参考使用场景向导了解详细流程",
                    ],
                    "screenshot": None,
                },
                {
                    "step": 5,
                    "title": "获取帮助",
                    "description": "如何获取帮助和支持",
                    "details": [
                        "查看帮助文档",
                        "使用AI智能建议功能",
                        "联系系统管理员",
                    ],
                    "screenshot": None,
                },
            ],
            "tips": [
                "建议先完成基础数据配置，再进行业务流程操作",
                "遇到问题可以查看帮助文档或使用AI智能建议",
                "定期查看工作台，及时处理待办事项",
            ],
        }
        
        return {
            "tutorial": tutorial,
        }

