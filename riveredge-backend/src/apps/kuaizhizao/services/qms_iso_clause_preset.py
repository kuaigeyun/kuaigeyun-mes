"""ISO 9001:2015 公开条款号与短标题预置（不含标准正文）"""

from __future__ import annotations

from typing import List, Optional, TypedDict

ISO9001_2015_STANDARD = "ISO9001:2015"


class IsoClausePresetItem(TypedDict):
    clause_code: str
    title: str
    parent_code: Optional[str]
    sort_order: int


ISO9001_2015_PRESET: List[IsoClausePresetItem] = [
    {"clause_code": "1", "title": "范围", "parent_code": None, "sort_order": 100},
    {"clause_code": "2", "title": "规范性引用文件", "parent_code": None, "sort_order": 200},
    {"clause_code": "3", "title": "术语和定义", "parent_code": None, "sort_order": 300},
    {"clause_code": "4", "title": "组织环境", "parent_code": None, "sort_order": 400},
    {"clause_code": "4.1", "title": "理解组织及其环境", "parent_code": "4", "sort_order": 410},
    {"clause_code": "4.2", "title": "理解相关方的需求和期望", "parent_code": "4", "sort_order": 420},
    {"clause_code": "4.3", "title": "确定质量管理体系的范围", "parent_code": "4", "sort_order": 430},
    {"clause_code": "4.4", "title": "质量管理体系及其过程", "parent_code": "4", "sort_order": 440},
    {"clause_code": "5", "title": "领导作用", "parent_code": None, "sort_order": 500},
    {"clause_code": "5.1", "title": "领导作用和承诺", "parent_code": "5", "sort_order": 510},
    {"clause_code": "5.2", "title": "方针", "parent_code": "5", "sort_order": 520},
    {"clause_code": "5.3", "title": "组织的岗位、职责和权限", "parent_code": "5", "sort_order": 530},
    {"clause_code": "6", "title": "策划", "parent_code": None, "sort_order": 600},
    {"clause_code": "6.1", "title": "应对风险和机遇的措施", "parent_code": "6", "sort_order": 610},
    {"clause_code": "6.2", "title": "质量目标及其实现的策划", "parent_code": "6", "sort_order": 620},
    {"clause_code": "6.3", "title": "变更的策划", "parent_code": "6", "sort_order": 630},
    {"clause_code": "7", "title": "支持", "parent_code": None, "sort_order": 700},
    {"clause_code": "7.1", "title": "资源", "parent_code": "7", "sort_order": 710},
    {"clause_code": "7.2", "title": "能力", "parent_code": "7", "sort_order": 720},
    {"clause_code": "7.3", "title": "意识", "parent_code": "7", "sort_order": 730},
    {"clause_code": "7.4", "title": "沟通", "parent_code": "7", "sort_order": 740},
    {"clause_code": "7.5", "title": "成文信息", "parent_code": "7", "sort_order": 750},
    {"clause_code": "8", "title": "运行", "parent_code": None, "sort_order": 800},
    {"clause_code": "8.1", "title": "运行策划和控制", "parent_code": "8", "sort_order": 810},
    {"clause_code": "8.2", "title": "产品和服务的要求", "parent_code": "8", "sort_order": 820},
    {"clause_code": "8.3", "title": "产品和服务的设计和开发", "parent_code": "8", "sort_order": 830},
    {"clause_code": "8.4", "title": "外部提供的过程、产品和服务的控制", "parent_code": "8", "sort_order": 840},
    {"clause_code": "8.5", "title": "生产和服务提供的控制", "parent_code": "8", "sort_order": 850},
    {"clause_code": "8.5.1", "title": "生产和服务提供的控制", "parent_code": "8.5", "sort_order": 851},
    {"clause_code": "8.5.2", "title": "标识和可追溯性", "parent_code": "8.5", "sort_order": 852},
    {"clause_code": "8.5.3", "title": "顾客或外部供方的财产", "parent_code": "8.5", "sort_order": 853},
    {"clause_code": "8.5.4", "title": "防护", "parent_code": "8.5", "sort_order": 854},
    {"clause_code": "8.5.5", "title": "交付后活动", "parent_code": "8.5", "sort_order": 855},
    {"clause_code": "8.5.6", "title": "更改控制", "parent_code": "8.5", "sort_order": 856},
    {"clause_code": "8.6", "title": "产品和服务的放行", "parent_code": "8", "sort_order": 860},
    {"clause_code": "8.7", "title": "不合格输出的控制", "parent_code": "8", "sort_order": 870},
    {"clause_code": "9", "title": "绩效评价", "parent_code": None, "sort_order": 900},
    {"clause_code": "9.1", "title": "监视、测量、分析和评价", "parent_code": "9", "sort_order": 910},
    {"clause_code": "9.2", "title": "内部审核", "parent_code": "9", "sort_order": 920},
    {"clause_code": "9.3", "title": "管理评审", "parent_code": "9", "sort_order": 930},
    {"clause_code": "10", "title": "改进", "parent_code": None, "sort_order": 1000},
    {"clause_code": "10.1", "title": "总则", "parent_code": "10", "sort_order": 1010},
    {"clause_code": "10.2", "title": "不合格和纠正措施", "parent_code": "10", "sort_order": 1020},
    {"clause_code": "10.3", "title": "持续改进", "parent_code": "10", "sort_order": 1030},
]
