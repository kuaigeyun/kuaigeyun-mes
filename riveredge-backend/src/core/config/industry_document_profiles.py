"""通用单据扩展 profile 默认值（未启用行业包时使用）。"""

from __future__ import annotations

from typing import Any, Dict

# 样品加工：仅中性种类与附件；标签不含 PCB
GENERIC_SAMPLE_PROCESS_PROFILE: Dict[str, Any] = {
    "request_kinds": [
        {"code": "general", "label": "通用加工", "sort": 10, "active": True},
    ],
    "attachment_types": [
        {"code": "other", "label": "其它", "sort": 10, "active": True},
    ],
    "field_labels": {
        "material_code": "物料编码",
        "material_version": "物料版本",
    },
    "validation_rules": [],
}

GENERIC_BOM_COLLAB_PROFILE: Dict[str, Any] = {
    # 分区 key 与库字段稳定契约（electronics/structure）；展示文案可被行业包覆盖
    "sections": [
        {"key": "electronics", "label": "分区一", "sort": 10, "active": True},
        {"key": "structure", "label": "分区二", "sort": 20, "active": True},
    ],
}

GENERIC_ECN_PROFILE: Dict[str, Any] = {
    "field_labels": {
        "change_reason": "变更原因",
        "content_before": "变更前内容",
        "content_after": "变更后内容",
    },
    "material_line_columns": [
        {"key": "material_code", "label": "物料编码", "sort": 10, "required": True},
        {"key": "material_name", "label": "物料名称", "sort": 20, "required": True},
        {"key": "before_desc", "label": "变更前", "sort": 30},
        {"key": "after_desc", "label": "变更后", "sort": 40},
        {"key": "unit_price", "label": "单价", "sort": 50, "type": "decimal"},
        {"key": "cost_amount", "label": "成本", "sort": 60, "type": "decimal"},
        {"key": "disposition", "label": "库存处置", "sort": 70},
        {"key": "owner_user_name", "label": "负责人", "sort": 80},
        {"key": "remarks", "label": "备注", "sort": 90},
    ],
    "signoff_depts": [
        {"code": "rd", "label": "研发", "sort": 10},
        {"code": "pe", "label": "工艺", "sort": 20},
        {"code": "qa", "label": "质量", "sort": 30},
        {"code": "prod", "label": "制造", "sort": 40},
        {"code": "purchasing", "label": "采购", "sort": 50},
        {"code": "warehouse", "label": "仓储", "sort": 60},
    ],
    "header_option_flags": [],
    "entry_sources": [{"code": "engineering_change", "label": "工程变更单", "sort": 10}],
    "validation_rules": [],
}

GENERIC_TRIAL_FLOW_PROFILE: Dict[str, Any] = {
    "field_labels": {
        "trial_reason": "试流原因",
        "defect_rate": "不良率",
    },
    "header_fields": [
        {"key": "trial_reason", "label": "试流原因", "sort": 10, "type": "textarea"},
    ],
    "step_templates": {
        "component": [
            {"step_key": "iqc", "step_name": "来料确认", "dept_code": "iqc", "sort": 10},
            {"step_key": "rd", "step_name": "研发试流", "dept_code": "rd", "sort": 20},
            {"step_key": "pe", "step_name": "工艺确认", "dept_code": "pe", "sort": 30},
            {"step_key": "qa", "step_name": "质量结论", "dept_code": "qa", "sort": 40},
        ],
        "structure": [
            {"step_key": "rd", "step_name": "结构试装", "dept_code": "rd", "sort": 10},
            {"step_key": "pe", "step_name": "工艺确认", "dept_code": "pe", "sort": 20},
            {"step_key": "qa", "step_name": "质量结论", "dept_code": "qa", "sort": 30},
        ],
        "complete": [
            {"step_key": "plan", "step_name": "试产计划", "dept_code": "plan", "sort": 10},
            {"step_key": "prod", "step_name": "制造执行", "dept_code": "prod", "sort": 20},
            {"step_key": "pqc", "step_name": "过程检验", "dept_code": "pqc", "sort": 30},
            {"step_key": "oqc", "step_name": "最终检验", "dept_code": "oqc", "sort": 40},
            {"step_key": "qa", "step_name": "质量结论", "dept_code": "qa", "sort": 50},
        ],
    },
    "validation_rules": [],
}

GENERIC_REWORK_ORDER_PROFILE: Dict[str, Any] = {
    "field_labels": {
        "rework_reason": "返工原因",
        "product_code": "产品编码",
        "quantity": "返工数量",
    },
    "rework_path_types": [
        {"code": "aa", "label": "标准路径", "sort": 10},
    ],
    "form_sections": [
        {
            "key": "basic",
            "label": "基本信息",
            "sort": 10,
            "fields": ["rework_reason", "product_code", "product_name", "quantity"],
        },
    ],
    "position_plan_columns": [
        {"key": "sequence", "label": "序号", "sort": 10},
        {"key": "station_name", "label": "工序名称", "sort": 20, "required": True},
        {"key": "remarks", "label": "备注", "sort": 30},
    ],
    "signoff_depts": [
        {"code": "quality", "label": "质量", "sort": 10},
        {"code": "manufacturing", "label": "制造", "sort": 20},
        {"code": "finance", "label": "财务", "sort": 30, "required_for_close": True},
    ],
    "validation_rules": [],
}

GENERIC_RD_DELIVERABLE_PROFILE: Dict[str, Any] = {
    "naming_rules": {},
}

GENERIC_PROFILES_BY_KEY: Dict[str, Dict[str, Any]] = {
    "kuaiplm.sample_process": GENERIC_SAMPLE_PROCESS_PROFILE,
    "kuaiplm.bom_collab": GENERIC_BOM_COLLAB_PROFILE,
    "kuaiplm.ecn": GENERIC_ECN_PROFILE,
    "kuaiplm.trial_flow": GENERIC_TRIAL_FLOW_PROFILE,
    "kuaiplm.rd_deliverable": GENERIC_RD_DELIVERABLE_PROFILE,
    "kuaizhizao.rework_order": GENERIC_REWORK_ORDER_PROFILE,
}
