"""
系统字典定义配置模块

定义所有系统字典及其字典项的配置，用于租户初始化时自动创建。

Author: Luigi Lu
Date: 2026-01-16
"""

from typing import List, Dict, Any


# 系统字典定义
SYSTEM_DICTIONARIES: List[Dict[str, Any]] = [
    {
        "code": "MATERIAL_TYPE",
        "name": "物料类型",
        "description": "物料类型字典，用于物料主数据中的物料类型字段",
        "items": [
            {
                "label": "成品",
                "value": "FIN",
                "description": "最终产品，可直接销售的成品",
                "sort_order": 1,
            },
            {
                "label": "半成品",
                "value": "SEMI",
                "description": "需要进一步加工的半成品",
                "sort_order": 2,
            },
            {
                "label": "原材料",
                "value": "RAW",
                "description": "生产用的原材料",
                "sort_order": 3,
            },
            {
                "label": "包装材料",
                "value": "PACK",
                "description": "用于包装的材料",
                "sort_order": 4,
            },
            {
                "label": "辅助材料",
                "value": "AUX",
                "description": "辅助生产使用的材料",
                "sort_order": 5,
            },
        ],
    },
    {
        "code": "MATERIAL_UNIT",
        "name": "物料单位",
        "description": "物料单位字典，用于物料主数据中的基础单位和辅助单位字段",
        "items": [
            # 数量单位
            {"label": "个", "value": "EA", "description": "数量单位：个", "sort_order": 1},
            {"label": "件", "value": "PC", "description": "数量单位：件", "sort_order": 2},
            {"label": "台", "value": "UNIT", "description": "数量单位：台", "sort_order": 3},
            {"label": "套", "value": "SET", "description": "数量单位：套", "sort_order": 4},
            {"label": "箱", "value": "BOX", "description": "数量单位：箱", "sort_order": 5},
            {"label": "盒", "value": "CASE", "description": "数量单位：盒", "sort_order": 6},
            {"label": "包", "value": "BAG", "description": "数量单位：包", "sort_order": 7},
            {"label": "袋", "value": "PK", "description": "数量单位：袋", "sort_order": 8},
            {"label": "瓶", "value": "BTL", "description": "数量单位：瓶", "sort_order": 9},
            {"label": "桶", "value": "DRM", "description": "数量单位：桶", "sort_order": 10},
            {"label": "片", "value": "SHEET", "description": "数量单位：片", "sort_order": 11},
            {"label": "张", "value": "PCS", "description": "数量单位：张", "sort_order": 12},
            {"label": "条", "value": "STRIP", "description": "数量单位：条", "sort_order": 13},
            {"label": "块", "value": "BLOCK", "description": "数量单位：块", "sort_order": 14},
            {"label": "只", "value": "ONLY", "description": "数量单位：只", "sort_order": 15},
            {"label": "头", "value": "HEAD", "description": "数量单位：头", "sort_order": 16},
            {"label": "匹", "value": "ROLL", "description": "数量单位：匹", "sort_order": 17},
            # 重量单位
            {"label": "kg", "value": "KG", "description": "重量单位：千克", "sort_order": 18},
            {"label": "g", "value": "G", "description": "重量单位：克", "sort_order": 19},
            {"label": "t", "value": "TON", "description": "重量单位：吨", "sort_order": 20},
            {"label": "mg", "value": "MG", "description": "重量单位：毫克", "sort_order": 21},
            # 长度单位
            {"label": "m", "value": "M", "description": "长度单位：米", "sort_order": 22},
            {"label": "cm", "value": "CM", "description": "长度单位：厘米", "sort_order": 23},
            {"label": "mm", "value": "MM", "description": "长度单位：毫米", "sort_order": 24},
            {"label": "km", "value": "KM", "description": "长度单位：千米", "sort_order": 25},
            # 面积单位
            {"label": "m²", "value": "SQM", "description": "面积单位：平方米", "sort_order": 26},
            {"label": "cm²", "value": "SQCM", "description": "面积单位：平方厘米", "sort_order": 27},
            # 体积单位
            {"label": "L", "value": "L", "description": "体积单位：升", "sort_order": 28},
            {"label": "mL", "value": "ML", "description": "体积单位：毫升", "sort_order": 29},
            {"label": "m³", "value": "CBM", "description": "体积单位：立方米", "sort_order": 30},
        ],
    },
]
