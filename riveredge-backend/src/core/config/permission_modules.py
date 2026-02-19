"""
权限模块配置

定义权限的模块分组及资源归属，与前端 permission-modules 配置同步。
供权限元数据接口使用。
"""

# 模块 Key 到资源列表的映射
PERMISSION_MODULE_MAP = {
    "system": [
        "user",
        "role",
        "permission",
        "code_rule",
        "system_config",
        "dictionary",
        "operation_log",
        "tenant",
        "app_config",
        "menu",
    ],
    "master_data": [
        "material",
        "warehouse",
        "location",
        "inventory",
        "supplier",
        "customer",
        "bom",
        "routing",
        "process",
    ],
    "sales": ["sales_order", "sales_return", "sales_quotation"],
    "purchase": ["purchase_order", "purchase_return", "purchase_requisition"],
    "finance": ["payable", "receivable", "receipt", "payment"],
    "manufacturing": [
        "work_order",
        "production_plan",
        "process_inspection",
        "mrp",
        "lrp",
    ],
}

# 模块 Key 到展示名称的映射
PERMISSION_MODULE_NAMES = {
    "system": "系统管理",
    "master_data": "基础数据",
    "sales": "销售管理",
    "purchase": "采购管理",
    "finance": "财务管理",
    "manufacturing": "制造管理",
    "other": "其他",
}
