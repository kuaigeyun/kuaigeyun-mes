"""
编码规则功能页面配置

定义系统中所有有编码字段的功能页面，用于在编码规则页面展示和配置。
"""

from typing import List, Dict, Any

# 页面代码 -> 固定字符预设（汉语拼音缩写）
# 用于编码规则默认前缀和重置
PAGE_CODE_TO_FIXED_TEXT_PRESET: Dict[str, str] = {
    "master-data-factory-plant": "CQ",           # 厂区
    "master-data-factory-workshop": "CJ",        # 车间
    "master-data-factory-production-line": "CX", # 产线
    "master-data-factory-workstation": "GW",     # 工位
    "master-data-warehouse-warehouse": "CK",     # 仓库
    "master-data-warehouse-storage-area": "KQ",  # 库区
    "master-data-warehouse-storage-location": "KW",  # 库位
    "master-data-material-group": "FZ",          # 分组
    "master-data-material": "WL",                # 物料
    "master-data-process-operation": "GX",       # 工序
    "master-data-process-route": "GY",           # 工艺
    "master-data-engineering-bom": "GC",         # 物料清单BOM（沿用原工程BOM编码前缀）
    "master-data-defect-type": "BL",             # 不良
    "master-data-supply-chain-customer": "KH",   # 客户
    "master-data-supply-chain-supplier": "GYS",  # 供应商
    "master-data-performance-skill": "JN",       # 技能
    "kuaizhizao-production-work-order": "GD",    # 工单
    "kuaizhizao-production-rework-order": "FGD", # 返工单
    "kuaizhizao-production-outsource-order": "WW",   # 委外
    "kuaizhizao-production-outsource-work-order": "WWGD",  # 委外工单
    "kuaizhizao-purchase-order": "CG",           # 采购
    "kuaizhizao-purchase-receipt": "CGSD",      # 采购收货
    "kuaizhizao-purchase-return": "CGTH",       # 采购退货
    "kuaizhizao-sales-order": "XS",             # 销售
    "kuaizhizao-quotation": "BJ",              # 报价
    "kuaizhizao-sales-delivery": "XSFH",        # 销售发货
    "kuaizhizao-sample-trial": "ST",           # 样品试用
    "kuaizhizao-sales-forecast": "XSYC",        # 销售预测
    "kuaizhizao-sales-return": "XSTH",          # 销售退货
    "kuaizhizao-warehouse-inbound": "LL",       # 领料
    "kuaizhizao-warehouse-finished-goods-inbound": "CPRK",  # 成品入库
    "kuaizhizao-quality-incoming-inspection": "LLJY",   # 来料检验
    "kuaizhizao-quality-process-inspection": "GCJY",   # 过程检验
    "kuaizhizao-quality-finished-goods-inspection": "CPJY",  # 成品检验
    "kuaizhizao-plan-production-plan": "SCJH",  # 生产计划
}

# 页面配置数据结构
CodeRulePageConfig = Dict[str, Any]

# 功能页面配置列表
CODE_RULE_PAGES: List[CodeRulePageConfig] = [
    # 主数据管理 - 工厂建模
    {
        "page_code": "master-data-factory-plant",
        "page_name": "厂区管理",
        "page_path": "/apps/master-data/factory/plants",
        "code_field": "code",
        "code_field_label": "厂区编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    {
        "page_code": "master-data-factory-workshop",
        "page_name": "车间管理",
        "page_path": "/apps/master-data/factory/workshops",
        "code_field": "code",
        "code_field_label": "车间编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    {
        "page_code": "master-data-factory-production-line",
        "page_name": "产线管理",
        "page_path": "/apps/master-data/factory/production-lines",
        "code_field": "code",
        "code_field_label": "产线编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    {
        "page_code": "master-data-factory-workstation",
        "page_name": "工位管理",
        "page_path": "/apps/master-data/factory/workstations",
        "code_field": "code",
        "code_field_label": "工位编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    # 主数据管理 - 仓库管理
    {
        "page_code": "master-data-warehouse-warehouse",
        "page_name": "仓库管理",
        "page_path": "/apps/master-data/warehouse/warehouses",
        "code_field": "code",
        "code_field_label": "仓库编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    {
        "page_code": "master-data-warehouse-storage-area",
        "page_name": "库区管理",
        "page_path": "/apps/master-data/warehouse/storage-areas",
        "code_field": "code",
        "code_field_label": "库区编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    {
        "page_code": "master-data-warehouse-storage-location",
        "page_name": "库位管理",
        "page_path": "/apps/master-data/warehouse/storage-locations",
        "code_field": "code",
        "code_field_label": "库位编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    # 主数据管理 - 物料管理
    {
        "page_code": "master-data-material-group",
        "page_name": "物料分组",
        "page_path": "/apps/master-data/materials",
        "code_field": "code",
        "code_field_label": "分组编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    {
        "page_code": "master-data-material",
        "page_name": "物料管理",
        "page_path": "/apps/master-data/materials",
        "code_field": "main_code",
        "code_field_label": "物料主编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": True,
        "rule_code": "MATERIAL_CODE",
        "available_fields": [
            {
                "field_name": "group_code",
                "field_label": "物料分组编码",
                "field_type": "string",
                "description": "物料所属分组的编码"
            },
            {
                "field_name": "group_name",
                "field_label": "物料分组名称",
                "field_type": "string",
                "description": "物料所属分组的名称"
            },
            {
                "field_name": "material_type",
                "field_label": "物料类型",
                "field_type": "string",
                "description": "物料类型（FIN/SEMI/RAW/PACK/AUX）"
            },
            {
                "field_name": "name",
                "field_label": "物料名称",
                "field_type": "string",
                "description": "物料名称"
            }
        ]
    },
    # 主数据管理 - 工艺管理
    {
        "page_code": "master-data-process-operation",
        "page_name": "工序管理",
        "page_path": "/apps/master-data/process/operations",
        "code_field": "code",
        "code_field_label": "工序编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": True,
        "rule_code": "OPERATION_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "master-data-process-route",
        "page_name": "工艺路线",
        "page_path": "/apps/master-data/process/routes",
        "code_field": "code",
        "code_field_label": "路线编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": True,
        "rule_code": "PROCESS_ROUTE_CODE",
        "allow_manual_edit": True,
        "available_fields": [
            {
                "field_name": "name",
                "field_label": "工艺路线名称",
                "field_type": "string",
                "description": "工艺路线名称"
            }
        ]
    },
    {
        "page_code": "master-data-engineering-bom",
        "page_name": "物料清单BOM",
        "page_path": "/apps/master-data/process/engineering-bom",
        "code_field": "bom_code",
        "code_field_label": "BOM编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": True,
        "rule_code": "ENGINEERING_BOM_CODE",
        "allow_manual_edit": True,
        "available_fields": [
            {
                "field_name": "material_code",
                "field_label": "主物料编码",
                "field_type": "string",
                "description": "BOM主物料的编码"
            },
            {
                "field_name": "material_name",
                "field_label": "主物料名称",
                "field_type": "string",
                "description": "BOM主物料的名称"
            },
            {
                "field_name": "version",
                "field_label": "版本号",
                "field_type": "string",
                "description": "BOM版本号"
            }
        ]
    },
    {
        "page_code": "master-data-defect-type",
        "page_name": "不良品项",
        "page_path": "/apps/master-data/process/defect-types",
        "code_field": "code",
        "code_field_label": "不良品编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
        "rule_code": "DEFECT_TYPE_CODE",
    },
    # 主数据管理 - 供应链
    {
        "page_code": "master-data-supply-chain-customer",
        "page_name": "客户管理",
        "page_path": "/apps/master-data/supply-chain/customers",
        "code_field": "code",
        "code_field_label": "客户编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": True,
        "rule_code": "customer",
        "allow_manual_edit": True,
    },
    {
        "page_code": "master-data-supply-chain-supplier",
        "page_name": "供应商管理",
        "page_path": "/apps/master-data/supply-chain/suppliers",
        "code_field": "code",
        "code_field_label": "供应商编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": True,
        "rule_code": "supplier",
        "allow_manual_edit": True,
    },
    # 主数据管理 - 绩效管理
    {
        "page_code": "master-data-performance-skill",
        "page_name": "技能管理",
        "page_path": "/apps/master-data/performance/skills",
        "code_field": "code",
        "code_field_label": "技能编码",
        "module": "主数据管理",
        "module_icon": "database",
        "auto_generate": False,
    },
    
    # ==================== 快格轻制造 APP ====================
    # 快格轻制造 - 生产执行
    {
        "page_code": "kuaizhizao-production-work-order",
        "page_name": "工单管理",
        "page_path": "/apps/kuaizhizao/production-execution/work-orders",
        "code_field": "code",
        "code_field_label": "工单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "WORK_ORDER_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-production-rework-order",
        "page_name": "返工单",
        "page_path": "/apps/kuaizhizao/production-execution/rework-orders",
        "code_field": "code",
        "code_field_label": "返工单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "REWORK_ORDER_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-production-outsource-order",
        "page_name": "委外单",
        "page_path": "/apps/kuaizhizao/production-execution/outsource-orders",
        "code_field": "code",
        "code_field_label": "委外单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "OUTSOURCE_ORDER_CODE",
        "allow_manual_edit": True,
    },
    # 快格轻制造 - 采购管理
    {
        "page_code": "kuaizhizao-purchase-order",
        "page_name": "采购订单",
        "page_path": "/apps/kuaizhizao/purchase-management/purchase-orders",
        "code_field": "order_code",
        "code_field_label": "采购订单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "PURCHASE_ORDER_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-purchase-receipt",
        "page_name": "采购收货",
        "page_path": "/apps/kuaizhizao/purchase-management/purchase-receipts",
        "code_field": "receipt_code",
        "code_field_label": "采购收货单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "PURCHASE_RECEIPT_CODE",
        "allow_manual_edit": True,
    },
    # 快格轻制造 - 销售管理
    {
        "page_code": "kuaizhizao-quotation",
        "page_name": "报价单",
        "page_path": "/apps/kuaizhizao/sales-management/quotations",
        "code_field": "quotation_code",
        "code_field_label": "报价单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "QUOTATION_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-sales-order",
        "page_name": "销售订单",
        "page_path": "/apps/kuaizhizao/sales-management/sales-orders",
        "code_field": "order_code",
        "code_field_label": "销售订单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "SALES_ORDER_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-sales-delivery",
        "page_name": "销售发货",
        "page_path": "/apps/kuaizhizao/sales-management/sales-deliveries",
        "code_field": "delivery_code",
        "code_field_label": "销售发货单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "SALES_DELIVERY_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-delivery-notice",
        "page_name": "送货单",
        "page_path": "/apps/kuaizhizao/sales-management/delivery-notices",
        "code_field": "notice_code",
        "code_field_label": "送货单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "DELIVERY_NOTICE_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-shipment-notice",
        "page_name": "发货通知单",
        "page_path": "/apps/kuaizhizao/sales-management/shipment-notices",
        "code_field": "notice_code",
        "code_field_label": "发货通知单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "SHIPMENT_NOTICE_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-receipt-notice",
        "page_name": "收货通知单",
        "page_path": "/apps/kuaizhizao/purchase-management/receipt-notices",
        "code_field": "notice_code",
        "code_field_label": "收货通知单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "RECEIPT_NOTICE_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-sample-trial",
        "page_name": "样品试用",
        "page_path": "/apps/kuaizhizao/sales-management/sample-trials",
        "code_field": "trial_code",
        "code_field_label": "样品试用单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "SAMPLE_TRIAL_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-sales-forecast",
        "page_name": "销售预测",
        "page_path": "/apps/kuaizhizao/sales-management/sales-forecasts",
        "code_field": "code",
        "code_field_label": "销售预测编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": False,
        "rule_code": "SALES_FORECAST_CODE",
    },
    # 快格轻制造 - 仓储管理
    {
        "page_code": "kuaizhizao-warehouse-inbound",
        "page_name": "生产领料",
        "page_path": "/apps/kuaizhizao/warehouse-management/inbound",
        "code_field": "picking_code",
        "code_field_label": "领料单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "PRODUCTION_PICKING_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-warehouse-production-return",
        "page_name": "生产退料",
        "page_path": "/apps/kuaizhizao/warehouse-management/production-returns",
        "code_field": "return_code",
        "code_field_label": "退料单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "PRODUCTION_RETURN_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-warehouse-other-inbound",
        "page_name": "其他入库",
        "page_path": "/apps/kuaizhizao/warehouse-management/other-inbound",
        "code_field": "inbound_code",
        "code_field_label": "入库单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "OTHER_INBOUND_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-warehouse-other-outbound",
        "page_name": "其他出库",
        "page_path": "/apps/kuaizhizao/warehouse-management/other-outbound",
        "code_field": "outbound_code",
        "code_field_label": "出库单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "OTHER_OUTBOUND_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-warehouse-material-borrow",
        "page_name": "借料单",
        "page_path": "/apps/kuaizhizao/warehouse-management/material-borrows",
        "code_field": "borrow_code",
        "code_field_label": "借料单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "MATERIAL_BORROW_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-warehouse-material-return",
        "page_name": "还料单",
        "page_path": "/apps/kuaizhizao/warehouse-management/material-returns",
        "code_field": "return_code",
        "code_field_label": "还料单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "MATERIAL_RETURN_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-warehouse-finished-goods-inbound",
        "page_name": "成品入库",
        "page_path": "/apps/kuaizhizao/warehouse-management/product-inbound",
        "code_field": "receipt_code",
        "code_field_label": "成品入库单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "FINISHED_GOODS_RECEIPT_CODE",
        "allow_manual_edit": True,
    },
    # 快格轻制造 - 质量管理
    {
        "page_code": "kuaizhizao-quality-incoming-inspection",
        "page_name": "来料检验",
        "page_path": "/apps/kuaizhizao/quality-management/incoming-inspection",
        "code_field": "inspection_code",
        "code_field_label": "来料检验单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "INCOMING_INSPECTION_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-quality-process-inspection",
        "page_name": "过程检验",
        "page_path": "/apps/kuaizhizao/quality-management/process-inspection",
        "code_field": "inspection_code",
        "code_field_label": "过程检验单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "PROCESS_INSPECTION_CODE",
        "allow_manual_edit": True,
    },
    {
        "page_code": "kuaizhizao-quality-finished-goods-inspection",
        "page_name": "成品检验",
        "page_path": "/apps/kuaizhizao/quality-management/finished-goods-inspection",
        "code_field": "inspection_code",
        "code_field_label": "成品检验单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "FINISHED_GOODS_INSPECTION_CODE",
        "allow_manual_edit": True,
    },
    # 快格轻制造 - 计划管理
    {
        "page_code": "kuaizhizao-plan-production-plan",
        "page_name": "生产计划",
        "page_path": "/apps/kuaizhizao/plan-management/production-plans",
        "code_field": "plan_code",
        "code_field_label": "生产计划编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "PRODUCTION_PLAN_CODE",
        "allow_manual_edit": True,
    },
    # 快格轻制造 - 采购管理（补充）
    {
        "page_code": "kuaizhizao-purchase-return",
        "page_name": "采购退货",
        "page_path": "/apps/kuaizhizao/purchase-management/purchase-returns",
        "code_field": "return_code",
        "code_field_label": "采购退货单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "PURCHASE_RETURN_CODE",
        "allow_manual_edit": True,
    },
    # 快格轻制造 - 销售管理（补充）
    {
        "page_code": "kuaizhizao-sales-return",
        "page_name": "销售退货",
        "page_path": "/apps/kuaizhizao/sales-management/sales-returns",
        "code_field": "return_code",
        "code_field_label": "销售退货单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "SALES_RETURN_CODE",
        "allow_manual_edit": True,
    },
    # 快格轻制造 - 生产执行（补充）
    {
        "page_code": "kuaizhizao-production-outsource-work-order",
        "page_name": "委外工单",
        "page_path": "/apps/kuaizhizao/production-execution/outsource-work-orders",
        "code_field": "code",
        "code_field_label": "委外工单编码",
        "module": "快格轻制造",
        "module_icon": "tool",
        "auto_generate": True,
        "rule_code": "OUTSOURCE_WORK_ORDER_CODE",
        "allow_manual_edit": True,
    },
]


def get_rule_code_to_page_code() -> Dict[str, str]:
    """
    规则代码 -> 页面代码映射
    包含：1) 显式配置的 rule_code  2) 由 page_code 派生的规则代码（如 MASTER_DATA_FACTORY_PLANT）
    用于覆盖所有可能的规则代码格式（包括自定义/未配置 rule_code 的页面）
    """
    mapping: Dict[str, str] = {}
    for p in CODE_RULE_PAGES:
        page_code = p["page_code"]
        # 显式 rule_code
        if p.get("rule_code"):
            mapping[p["rule_code"]] = page_code
        # 派生规则代码（前端无 rule_code 时使用 page_code 转大写+下划线）
        derived = page_code.upper().replace("-", "_")
        mapping[derived] = page_code
    return mapping


# 规则代码 -> 实体模型（用于序列号校准：导入数据后从库中取最大序号，使新生成的序号接着往后）
# 格式: rule_code -> (模块路径, 模型类名, 编码字段名)
# 仅配置支持“前缀+序号”且可查库的实体，用于 generate_code 时自动校准 current_seq
RULE_CODE_ENTITY_FOR_SEQ_SYNC: Dict[str, tuple] = {
    "DEFECT_TYPE_CODE": ("apps.master_data.models.process", "DefectType", "code"),
    "master-data-defect-type": ("apps.master_data.models.process", "DefectType", "code"),
    "OPERATION_CODE": ("apps.master_data.models.process", "Operation", "code"),
    "master-data-process-operation": ("apps.master_data.models.process", "Operation", "code"),
    "master-data-factory-plant": ("apps.master_data.models.factory", "Plant", "code"),
    "master-data-factory-workshop": ("apps.master_data.models.factory", "Workshop", "code"),
    "master-data-warehouse-warehouse": ("apps.master_data.models.warehouse", "Warehouse", "code"),
    "master-data-supply-chain-customer": ("apps.master_data.models.customer", "Customer", "code"),
    "master-data-supply-chain-supplier": ("apps.master_data.models.supplier", "Supplier", "code"),
}

