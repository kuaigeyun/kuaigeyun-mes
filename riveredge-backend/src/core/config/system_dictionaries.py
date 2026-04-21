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
    {
        "code": "CURRENCY",
        "name": "货币类型",
        "description": "系统支持的货币类型",
        "items": [
            {"label": "人民币 (CNY)", "value": "CNY", "description": "中国人民币", "sort_order": 1},
            {"label": "美元 (USD)", "value": "USD", "description": "美国美元", "sort_order": 2},
            {"label": "欧元 (EUR)", "value": "EUR", "description": "欧盟欧元", "sort_order": 3},
            {"label": "日元 (JPY)", "value": "JPY", "description": "日本日元", "sort_order": 4},
            {"label": "英镑 (GBP)", "value": "GBP", "description": "英国英镑", "sort_order": 5},
        ],
    },
    {
        "code": "TIMEZONE",
        "name": "时区设置",
        "description": "系统支持的时区设置",
        "items": [
            # UTC-12 to UTC-1
            {"label": "(UTC-12:00) 国际日期变更线西", "value": "Etc/GMT+12", "description": "国际日期变更线西", "sort_order": 1},
            {"label": "(UTC-11:00) 协调世界时-11", "value": "Etc/GMT+11", "description": "协调世界时-11", "sort_order": 2},
            {"label": "(UTC-10:00) 夏威夷", "value": "Pacific/Honolulu", "description": "夏威夷", "sort_order": 3},
            {"label": "(UTC-09:00) 阿拉斯加", "value": "America/Anchorage", "description": "阿拉斯加", "sort_order": 4},
            {"label": "(UTC-08:00) 太平洋时间 (美国和加拿大)", "value": "America/Los_Angeles", "description": "太平洋时间 (美国和加拿大)", "sort_order": 5},
            {"label": "(UTC-07:00) 山地时间 (美国和加拿大)", "value": "America/Denver", "description": "山地时间 (美国和加拿大)", "sort_order": 6},
            {"label": "(UTC-06:00) 中部时间 (美国和加拿大)", "value": "America/Chicago", "description": "中部时间 (美国和加拿大)", "sort_order": 7},
            {"label": "(UTC-05:00) 东部时间 (美国和加拿大)", "value": "America/New_York", "description": "东部时间 (美国和加拿大)", "sort_order": 8},
            {"label": "(UTC-04:00) 大西洋时间 (加拿大)", "value": "America/Halifax", "description": "大西洋时间 (加拿大)", "sort_order": 9},
            {"label": "(UTC-03:00) 巴西利亚", "value": "America/Sao_Paulo", "description": "巴西利亚", "sort_order": 10},
            {"label": "(UTC-03:00) 布宜诺斯艾利斯", "value": "America/Argentina/Buenos_Aires", "description": "布宜诺斯艾利斯", "sort_order": 11},
            {"label": "(UTC-02:00) 协调世界时-02", "value": "Etc/GMT+2", "description": "协调世界时-02", "sort_order": 12},
            {"label": "(UTC-01:00) 亚速尔群岛", "value": "Atlantic/Azores", "description": "亚速尔群岛", "sort_order": 13},
            
            # UTC+0
            {"label": "(UTC+00:00) 协调世界时", "value": "Etc/UTC", "description": "协调世界时", "sort_order": 14},
            {"label": "(UTC+00:00) 伦敦, 都柏林, 里斯本", "value": "Europe/London", "description": "格林威治标准时间", "sort_order": 15},
            
            # UTC+1 to UTC+12
            {"label": "(UTC+01:00) 巴黎, 柏林, 罗马, 马德里", "value": "Europe/Paris", "description": "中欧标准时间", "sort_order": 16},
            {"label": "(UTC+02:00) 雅典, 布加勒斯特", "value": "Europe/Athens", "description": "雅典, 布加勒斯特", "sort_order": 17},
            {"label": "(UTC+02:00) 开罗", "value": "Africa/Cairo", "description": "开罗", "sort_order": 18},
            {"label": "(UTC+02:00) 耶路撒冷", "value": "Asia/Jerusalem", "description": "耶路撒冷", "sort_order": 19},
            {"label": "(UTC+03:00) 莫斯科, 圣彼得堡", "value": "Europe/Moscow", "description": "莫斯科, 圣彼得堡", "sort_order": 20},
            {"label": "(UTC+03:00) 巴格达", "value": "Asia/Baghdad", "description": "巴格达", "sort_order": 21},
            {"label": "(UTC+04:00) 迪拜", "value": "Asia/Dubai", "description": "迪拜", "sort_order": 22},
            {"label": "(UTC+05:00) 卡拉奇", "value": "Asia/Karachi", "description": "卡拉奇", "sort_order": 23},
            {"label": "(UTC+05:30) 新德里, 孟买", "value": "Asia/Kolkata", "description": "印度标准时间", "sort_order": 24},
            {"label": "(UTC+06:00) 达卡", "value": "Asia/Dhaka", "description": "达卡", "sort_order": 25},
            {"label": "(UTC+07:00) 曼谷, 河内, 雅加达", "value": "Asia/Bangkok", "description": "曼谷, 河内, 雅加达", "sort_order": 26},
            {"label": "(UTC+08:00) 北京, 上海, 香港, 台北", "value": "Asia/Shanghai", "description": "中国标准时间", "sort_order": 27},
            {"label": "(UTC+08:00) 新加坡", "value": "Asia/Singapore", "description": "新加坡", "sort_order": 28},
            {"label": "(UTC+08:00) 珀斯", "value": "Australia/Perth", "description": "珀斯", "sort_order": 29},
            {"label": "(UTC+09:00) 东京, 大阪, 札幌", "value": "Asia/Tokyo", "description": "日本标准时间", "sort_order": 30},
            {"label": "(UTC+09:00) 首尔", "value": "Asia/Seoul", "description": "韩国标准时间", "sort_order": 31},
            {"label": "(UTC+09:30) 达尔文", "value": "Australia/Darwin", "description": "达尔文", "sort_order": 32},
            {"label": "(UTC+10:00) 悉尼, 墨尔本, 堪培拉", "value": "Australia/Sydney", "description": "悉尼, 墨尔本, 堪培拉", "sort_order": 33},
            {"label": "(UTC+10:00) 布里斯班", "value": "Australia/Brisbane", "description": "布里斯班", "sort_order": 34},
            {"label": "(UTC+11:00) 马加丹, 索罗门群岛", "value": "Pacific/Guadalcanal", "description": "马加丹, 索罗门群岛", "sort_order": 35},
            {"label": "(UTC+12:00) 奥克兰, 惠灵顿", "value": "Pacific/Auckland", "description": "奥克兰, 惠灵顿", "sort_order": 36},
            {"label": "(UTC+13:00) 努库阿洛法", "value": "Pacific/Tongatapu", "description": "努库阿洛法", "sort_order": 37},
        ],
    },
    {
        "code": "SHIPPING_METHOD",
        "name": "发货方式",
        "description": "销售订单、出库单等单据的发货方式",
        "items": [
            {"label": "快递", "value": "EXPRESS", "description": "快递配送", "sort_order": 1},
            {"label": "物流", "value": "LOGISTICS", "description": "物流配送", "sort_order": 2},
            {"label": "自提", "value": "SELF_PICKUP", "description": "客户自提", "sort_order": 3},
            {"label": "专车配送", "value": "DEDICATED", "description": "专车配送", "sort_order": 4},
            {"label": "空运", "value": "AIR", "description": "航空运输", "sort_order": 5},
            {"label": "海运", "value": "SEA", "description": "海运", "sort_order": 6},
        ],
    },
    {
        "code": "PAYMENT_TERMS",
        "name": "付款条件",
        "description": "销售订单、采购订单等单据的付款条件",
        "items": [
            {"label": "月结30天", "value": "NET30", "description": "月结30天", "sort_order": 1},
            {"label": "月结60天", "value": "NET60", "description": "月结60天", "sort_order": 2},
            {"label": "货到付款", "value": "COD", "description": "货到付款", "sort_order": 3},
            {"label": "预付", "value": "PREPAID", "description": "预付全款", "sort_order": 4},
            {"label": "预付30%", "value": "PREPAID_30", "description": "预付30%定金", "sort_order": 5},
            {"label": "账期30天", "value": "CREDIT_30", "description": "账期30天", "sort_order": 6},
            {"label": "账期60天", "value": "CREDIT_60", "description": "账期60天", "sort_order": 7},
        ],
    },
    {
        "code": "RETURN_REASON",
        "name": "退货原因",
        "description": "销售退货、采购退货等业务的退货原因",
        "items": [
            {"label": "质量问题", "value": "QUALITY_ISSUE", "description": "产品存在质量问题", "sort_order": 1},
            {"label": "规格不符", "value": "SPEC_MISMATCH", "description": "规格型号不匹配", "sort_order": 2},
            {"label": "数量错误", "value": "QTY_ERROR", "description": "收发数量不一致", "sort_order": 3},
            {"label": "包装破损", "value": "PACKAGE_DAMAGE", "description": "包装或运输破损", "sort_order": 4},
            {"label": "错发漏发", "value": "WRONG_OR_MISSING", "description": "错发或漏发", "sort_order": 5},
            {"label": "客户取消", "value": "CUSTOMER_CANCEL", "description": "客户取消订单导致退货", "sort_order": 6},
            {"label": "其他", "value": "OTHER", "description": "其他原因", "sort_order": 99},
        ],
    },
    {
        "code": "RETURN_TYPE",
        "name": "退货类型",
        "description": "销售退货、采购退货等业务的退货类型",
        "items": [
            {"label": "换货", "value": "EXCHANGE", "description": "退货后重新发货", "sort_order": 1},
            {"label": "退款", "value": "REFUND", "description": "退货后退款", "sort_order": 2},
            {"label": "返修", "value": "REWORK", "description": "退货返修后回传", "sort_order": 3},
            {"label": "报废退货", "value": "SCRAP_RETURN", "description": "无法修复或复用，做报废处理", "sort_order": 4},
            {"label": "其他", "value": "OTHER", "description": "其他类型", "sort_order": 99},
        ],
    },
    # 设备/模具/工装 - 类型与状态
    {
        "code": "EQUIPMENT_TYPE",
        "name": "设备类型",
        "description": "设备管理中的设备类型",
        "items": [
            {"label": "加工设备", "value": "加工设备", "description": "加工设备", "sort_order": 1},
            {"label": "检测设备", "value": "检测设备", "description": "检测设备", "sort_order": 2},
            {"label": "包装设备", "value": "包装设备", "description": "包装设备", "sort_order": 3},
            {"label": "其他", "value": "其他", "description": "其他类型", "sort_order": 4},
        ],
    },
    {
        "code": "MOLD_TYPE",
        "name": "模具类型",
        "description": "模具管理中的模具类型",
        "items": [
            {"label": "注塑模具", "value": "注塑模具", "description": "注塑模具", "sort_order": 1},
            {"label": "压铸模具", "value": "压铸模具", "description": "压铸模具", "sort_order": 2},
            {"label": "冲压模具", "value": "冲压模具", "description": "冲压模具", "sort_order": 3},
            {"label": "其他", "value": "其他", "description": "其他类型", "sort_order": 4},
        ],
    },
    {
        "code": "TOOL_TYPE",
        "name": "工装类型",
        "description": "工装台账中的工装类型",
        "items": [
            {"label": "夹具", "value": "夹具", "description": "夹具", "sort_order": 1},
            {"label": "治具", "value": "治具", "description": "治具", "sort_order": 2},
            {"label": "检具", "value": "检具", "description": "检具", "sort_order": 3},
            {"label": "刀具", "value": "刀具", "description": "刀具", "sort_order": 4},
            {"label": "其他", "value": "其他", "description": "其他类型", "sort_order": 5},
        ],
    },
    {
        "code": "EQUIPMENT_STATUS",
        "name": "设备状态",
        "description": "设备管理中的设备状态",
        "items": [
            {"label": "正常", "value": "正常", "description": "正常", "sort_order": 1},
            {"label": "维修中", "value": "维修中", "description": "维修中", "sort_order": 2},
            {"label": "停用", "value": "停用", "description": "停用", "sort_order": 3},
            {"label": "报废", "value": "报废", "description": "报废", "sort_order": 4},
        ],
    },
    {
        "code": "MOLD_STATUS",
        "name": "模具状态",
        "description": "模具管理中的模具状态",
        "items": [
            {"label": "正常", "value": "正常", "description": "正常", "sort_order": 1},
            {"label": "使用中", "value": "使用中", "description": "使用中", "sort_order": 2},
            {"label": "维护中", "value": "维护中", "description": "维护中", "sort_order": 3},
            {"label": "停用", "value": "停用", "description": "停用", "sort_order": 4},
            {"label": "报废", "value": "报废", "description": "报废", "sort_order": 5},
        ],
    },
    {
        "code": "TOOL_STATUS",
        "name": "工装状态",
        "description": "工装台账中的工装状态",
        "items": [
            {"label": "正常", "value": "正常", "description": "正常", "sort_order": 1},
            {"label": "领用中", "value": "领用中", "description": "领用中", "sort_order": 2},
            {"label": "维修中", "value": "维修中", "description": "维修中", "sort_order": 3},
            {"label": "校验中", "value": "校验中", "description": "校验中", "sort_order": 4},
            {"label": "停用", "value": "停用", "description": "停用", "sort_order": 5},
            {"label": "报废", "value": "报废", "description": "报废", "sort_order": 6},
        ],
    },
    {
        "code": "INDUSTRY_SECTOR",
        "name": "行业分类",
        "description": "客户与供应商所属行业（可扩展）",
        "items": [
            {"label": "制造业", "value": "MFG", "description": "制造业", "sort_order": 1},
            {"label": "电子信息", "value": "ELEC", "description": "电子信息", "sort_order": 2},
            {"label": "汽车及零部件", "value": "AUTO", "description": "汽车及零部件", "sort_order": 3},
            {"label": "机械设备", "value": "MACH", "description": "机械设备", "sort_order": 4},
            {"label": "能源化工", "value": "CHEM", "description": "能源化工", "sort_order": 5},
            {"label": "批发零售", "value": "TRADE", "description": "批发零售", "sort_order": 6},
            {"label": "其他", "value": "OTHER", "description": "其他", "sort_order": 99},
        ],
    },
    {
        "code": "PARTNER_SOURCE_CHANNEL",
        "name": "伙伴来源渠道",
        "description": "客户线索与供应商引入来源",
        "items": [
            {"label": "展会", "value": "EXPO", "description": "展会", "sort_order": 1},
            {"label": "招投标", "value": "BID", "description": "招投标", "sort_order": 2},
            {"label": "老客户介绍", "value": "REF", "description": "老客户介绍", "sort_order": 3},
            {"label": "线上推广", "value": "ONLINE", "description": "线上推广", "sort_order": 4},
            {"label": "销售开发", "value": "SDR", "description": "销售开发", "sort_order": 5},
            {"label": "采购寻源", "value": "SOURCING", "description": "采购寻源", "sort_order": 6},
            {"label": "其他", "value": "OTHER", "description": "其他", "sort_order": 99},
        ],
    },
    {
        "code": "CUSTOMER_LEVEL",
        "name": "客户级别",
        "description": "客户分级",
        "items": [
            {"label": "战略客户", "value": "STRATEGIC", "description": "战略客户", "sort_order": 1},
            {"label": "A级", "value": "A", "description": "A级", "sort_order": 2},
            {"label": "B级", "value": "B", "description": "B级", "sort_order": 3},
            {"label": "C级", "value": "C", "description": "C级", "sort_order": 4},
        ],
    },
    {
        "code": "SALES_FOLLOW_UP_TYPE",
        "name": "销售跟进方式",
        "description": "客户跟进记录中的沟通方式",
        "items": [
            {"label": "电话", "value": "PHONE", "description": "电话", "sort_order": 1},
            {"label": "拜访", "value": "VISIT", "description": "上门拜访", "sort_order": 2},
            {"label": "微信/即时通讯", "value": "IM", "description": "微信等", "sort_order": 3},
            {"label": "邮件", "value": "EMAIL", "description": "邮件", "sort_order": 4},
            {"label": "展会/会议", "value": "EXPO", "description": "展会或会议", "sort_order": 5},
            {"label": "样品/技术沟通", "value": "SAMPLE_TECH", "description": "样品或技术交流", "sort_order": 6},
            {"label": "其他", "value": "OTHER", "description": "其他", "sort_order": 99},
        ],
    },
    {
        "code": "FEE_TYPE",
        "name": "费用类型",
        "description": "订单（销售/采购）涉及的附加费用类型",
        "items": [
            {"label": "物流费", "value": "LOGISTICS", "description": "运费、配送费", "sort_order": 1},
            {"label": "包装费", "value": "PACKAGING", "description": "包装、加固费", "sort_order": 2},
            {"label": "保险费", "value": "INSURANCE", "description": "运输保险费", "sort_order": 3},
            {"label": "报关费", "value": "CUSTOMS", "description": "报关、清关费用", "sort_order": 4},
            {"label": "手续费", "value": "HANDLING", "description": "装卸、手续费", "sort_order": 5},
            {"label": "其他", "value": "OTHER", "description": "其他杂费", "sort_order": 99},
        ],
    },
    {
        "code": "MATERIAL_CALL_TYPE",
        "name": "叫料类型",
        "description": "单独叫料为自选一种或多种物料；整单叫料按工单齐套缺料生成一张叫料单多行明细",
        "items": [
            {
                "label": "单独叫料",
                "value": "CUSTOM_SELECTION",
                "description": "自选一种或多种物料及数量发起叫料",
                "sort_order": 1,
            },
            {
                "label": "整单叫料",
                "value": "FULL_ORDER",
                "description": "按工单齐套分析缺料生成一张叫料单（多行明细）",
                "sort_order": 2,
            },
        ],
    },
    {
        "code": "MATERIAL_CALL_REASON",
        "name": "叫料原因",
        "description": "单独叫料时说明现场需求场景，便于仓库与计划追溯",
        "items": [
            {
                "label": "线边仓缺料",
                "value": "LINE_SIDE_SHORTAGE",
                "description": "线边库存不足，需从主仓等配送",
                "sort_order": 1,
            },
            {
                "label": "批量领料未领足",
                "value": "PICKING_SHORTAGE",
                "description": "按批量领料单领取的数量不足，需补叫",
                "sort_order": 2,
            },
            {
                "label": "报废/质量异常补料",
                "value": "SCRAP_REPLENISH",
                "description": "报废、返工或质检异常导致的补料需求",
                "sort_order": 3,
            },
            {
                "label": "工艺或设计变更换料",
                "value": "ENGINEERING_CHANGE",
                "description": "工艺调整、设计变更引起的物料规格或数量变化",
                "sort_order": 4,
            },
            {
                "label": "计划变更/紧急插单",
                "value": "PLAN_CHANGE",
                "description": "计划变更、插单导致用料与领料计划不一致",
                "sort_order": 5,
            },
            {
                "label": "试制/打样加料",
                "value": "TRIAL_SAMPLE",
                "description": "试制、打样、小批量验证的额外用料",
                "sort_order": 6,
            },
            {
                "label": "其他",
                "value": "OTHER",
                "description": "其他原因（建议在备注中说明）",
                "sort_order": 99,
            },
        ],
    },
]
