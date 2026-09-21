"""第一阶段通用会签表单预置（真源：.custom/funide-oa/5.资料模板/用户提供）。

启用 funide-oa 时写入 kuaioa 表单模板；仅补齐可读模板骨架，完整规则仍待客户补件。
"""

from __future__ import annotations

from typing import Any

# fields_schema 真源：apps/kuaioa/services/form_schema_validator.normalize_fields_schema
FUNIDE_PHASE1_SIGNOFF_TEMPLATES: list[dict[str, Any]] = [
    {
        "template_code": "funide_material_request",
        "template_name": "物料申请单",
        "business_type": "material_request",
        "description": "行业预置：研发结构物料申请单（部门、名称规格、数量、用途）",
        "category": "general_signoff",
        "show_in_menu": False,
        "sort_order": 10,
        "fields_schema": [
            {"name": "apply_dept", "label": "部门（单位）", "type": "department", "required": True},
            {"name": "material_name_spec", "label": "名称规格", "type": "textarea", "required": True, "span": 24},
            {"name": "qty", "label": "数量", "type": "number", "required": True},
            {"name": "purpose_remarks", "label": "备注（用途）", "type": "textarea", "span": 24},
            {"name": "dept_supervisor", "label": "部门主管", "type": "user"},
        ],
    },
    {
        "template_code": "funide_sample_inspection",
        "template_name": "样品检验单",
        "business_type": "sample_inspection",
        "description": "行业预置：IQC/PE/PQC 样品检验单头字段与检验项",
        "category": "general_signoff",
        "show_in_menu": False,
        "sort_order": 20,
        "fields_schema": [
            {"name": "product_model", "label": "产品型号", "type": "text", "required": True},
            {"name": "material_name", "label": "材料名称", "type": "text", "required": True},
            {"name": "material_code", "label": "12位代码", "type": "text", "required": True},
            {"name": "inspection_date", "label": "检验日期", "type": "date", "required": True},
            {"name": "qty", "label": "数量", "type": "number", "required": True},
            {"name": "supplier_name", "label": "供应商", "type": "text"},
            {"name": "mold_no", "label": "模号", "type": "text"},
            {"name": "iqc_checklist", "label": "IQC检验项目", "type": "textarea", "span": 24},
            {"name": "pe_checklist", "label": "PE检验项目", "type": "textarea", "span": 24},
            {"name": "pqc_checklist", "label": "PQC检验项目", "type": "textarea", "span": 24},
        ],
    },
    {
        "template_code": "funide_five_m_change",
        "template_name": "5M变更报告",
        "business_type": "five_m_change",
        "description": "行业预置：5M1E 变更前后对比与影响说明（完整对比表待客户补件）",
        "category": "general_signoff",
        "show_in_menu": False,
        "sort_order": 30,
        "fields_schema": [
            {"name": "change_subject", "label": "变更主题", "type": "text", "required": True, "span": 24},
            {
                "name": "change_category",
                "label": "变更类别",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "man", "label": "人"},
                    {"value": "machine", "label": "机"},
                    {"value": "material", "label": "料"},
                    {"value": "method", "label": "法"},
                    {"value": "environment", "label": "环"},
                    {"value": "measurement", "label": "测"},
                ],
            },
            {"name": "content_before", "label": "变更前内容", "type": "textarea", "required": True, "span": 24},
            {"name": "content_after", "label": "变更后内容", "type": "textarea", "required": True, "span": 24},
            {"name": "impact_scope", "label": "影响范围", "type": "textarea", "span": 24},
            {"name": "verification_plan", "label": "验证计划", "type": "textarea", "span": 24},
        ],
    },
    {
        "template_code": "funide_tech_work_contact",
        "template_name": "技术工作联系单",
        "business_type": "tech_work_contact",
        "description": "行业预置：跨部门技术工作联系",
        "category": "general_signoff",
        "show_in_menu": False,
        "sort_order": 40,
        "fields_schema": [
            {"name": "contact_dept", "label": "联系部门", "type": "department", "required": True},
            {"name": "receive_dept", "label": "接收部门", "type": "department", "required": True},
            {"name": "subject", "label": "联系事项", "type": "text", "required": True, "span": 24},
            {"name": "content", "label": "联系内容", "type": "textarea", "required": True, "span": 24},
            {"name": "expected_reply_at", "label": "期望回复日期", "type": "date"},
        ],
    },
    {
        "template_code": "funide_confirmation",
        "template_name": "确认书",
        "business_type": "confirmation",
        "description": "行业预置：技术/质量确认书",
        "category": "general_signoff",
        "show_in_menu": False,
        "sort_order": 50,
        "fields_schema": [
            {"name": "confirmation_subject", "label": "确认主题", "type": "text", "required": True, "span": 24},
            {"name": "related_doc_no", "label": "关联单号", "type": "text"},
            {"name": "confirmation_content", "label": "确认内容", "type": "textarea", "required": True, "span": 24},
            {"name": "confirmation_result", "label": "确认结论", "type": "select", "required": True, "options": [
                {"value": "agree", "label": "同意"},
                {"value": "reject", "label": "不同意"},
                {"value": "conditional", "label": "有条件同意"},
            ]},
        ],
    },
    {
        "template_code": "funide_review_sheet",
        "template_name": "评审单",
        "business_type": "review_sheet",
        "description": "行业预置：设计/工艺评审单",
        "category": "general_signoff",
        "show_in_menu": False,
        "sort_order": 60,
        "fields_schema": [
            {"name": "review_subject", "label": "评审主题", "type": "text", "required": True, "span": 24},
            {"name": "review_type", "label": "评审类型", "type": "text", "required": True},
            {"name": "review_content", "label": "评审内容", "type": "textarea", "required": True, "span": 24},
            {"name": "review_conclusion", "label": "评审结论", "type": "textarea", "span": 24},
            {"name": "action_items", "label": "后续行动项", "type": "textarea", "span": 24},
        ],
    },
]

FUNIDE_PHASE1_SIGNOFF_TEMPLATE_CODES = frozenset(
    t["template_code"] for t in FUNIDE_PHASE1_SIGNOFF_TEMPLATES
)
