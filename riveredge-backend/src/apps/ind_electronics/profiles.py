"""电子制造行业包：样品/BOM/ECN/试流/返工 profile 种子与 ESD 独立能力。"""

from __future__ import annotations

from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# R-04 工程变更（用户提供：变更单对照列 + 八部门会签 + 勾选项）
# 列 key 映射通用 extension_payload / 现有中性字段；标签与必填由 profile 驱动
# ---------------------------------------------------------------------------

_ECN_MATERIAL_LINE_COLUMNS: List[Dict[str, Any]] = [
    {"key": "material_code", "label": "物料编码", "sort": 5, "required": True, "width": 120},
    {"key": "material_name", "label": "物料名称", "sort": 10, "required": True, "width": 140},
    {"key": "before_material_code", "label": "修改前料号", "sort": 20, "width": 110},
    {"key": "after_material_code", "label": "修改后料号", "sort": 25, "width": 110},
    {"key": "before_desc", "label": "变更前描述", "sort": 30, "width": 120},
    {"key": "after_desc", "label": "变更后描述", "sort": 35, "width": 120},
    {"key": "unit_price", "label": "单价", "sort": 40, "width": 90, "type": "decimal"},
    {"key": "cost_delta", "label": "成本增减", "sort": 45, "width": 90, "type": "decimal"},
    {"key": "own_material_stock", "label": "自有材料库存", "sort": 50, "width": 100, "type": "decimal"},
    {"key": "supplier_material_stock", "label": "供方材料库存", "sort": 55, "width": 100, "type": "decimal"},
    {"key": "material_disposition", "label": "材料处理方式", "sort": 60, "width": 110},
    {"key": "material_disposition_notes", "label": "材料处理备注", "sort": 65, "width": 120},
    {"key": "wip_qty", "label": "在制品库存", "sort": 70, "width": 90, "type": "decimal", "dept": "plan"},
    {"key": "wip_disposition", "label": "在制品处理", "sort": 75, "width": 110, "dept": "plan"},
    {"key": "own_fg_stock", "label": "自有成品库存", "sort": 80, "width": 100, "type": "decimal", "dept": "sales"},
    {"key": "customer_fg_stock", "label": "客户成品库存", "sort": 85, "width": 100, "type": "decimal", "dept": "sales"},
    {"key": "fg_disposition", "label": "成品处理", "sort": 90, "width": 110, "dept": "sales"},
    {"key": "shipment_remarks", "label": "出货备注", "sort": 95, "width": 120, "dept": "sales"},
    {"key": "processing_repair_cost", "label": "加工返修费", "sort": 100, "width": 100, "type": "decimal"},
    {"key": "disposition", "label": "库存处置", "sort": 105, "width": 100},
    {"key": "owner_user_name", "label": "会签负责人", "sort": 110, "width": 100},
    {"key": "remarks", "label": "备注", "sort": 115, "width": 120},
]

ELECTRONICS_ECN_SEED: Dict[str, Any] = {
    "field_labels": {
        "change_reason": "变更原因",
        "content_before": "变更前内容",
        "content_after": "变更后内容",
        "change_product_type": "更改产品类型",
        "change_method": "更改方式",
        "erp_ecn_no": "ERP 变更单号",
    },
    "material_line_columns": _ECN_MATERIAL_LINE_COLUMNS,
    "signoff_depts": [
        {"code": "purchasing_regular", "label": "常规采购", "sort": 10, "parallel": True},
        {"code": "purchasing_early", "label": "前期采购", "sort": 20, "parallel": True},
        {"code": "qa", "label": "质量", "sort": 30, "parallel": True},
        {"code": "prod", "label": "制造", "sort": 40, "parallel": True},
        {"code": "smt", "label": "SMT", "sort": 50, "parallel": True},
        {"code": "sales", "label": "销售", "sort": 60, "parallel": True},
        {"code": "finance", "label": "财务", "sort": 70, "parallel": True},
        {"code": "plan", "label": "计划", "sort": 80, "parallel": True},
    ],
    "header_option_flags": [
        {"key": "old_material_disposition", "label": "旧物料处理方式", "sort": 10, "type": "text"},
        {"key": "new_material_disposition", "label": "新物料处理方式", "sort": 20, "type": "text"},
        {"key": "allow_mixed", "label": "新旧物料是否混用", "sort": 30, "type": "boolean"},
        {"key": "intercept_work_order", "label": "是否拦截工单", "sort": 40, "type": "boolean"},
        {"key": "product_label_change", "label": "变更后产品标识", "sort": 50, "type": "boolean"},
        {"key": "need_production_prep", "label": "制造是否需要生产准备", "sort": 60, "type": "boolean"},
        {"key": "involve_scrap", "label": "是否涉及报废", "sort": 70, "type": "boolean"},
    ],
    "entry_sources": [
        {"code": "engineering_change", "label": "工程变更单", "sort": 10},
        {"code": "design_change_request", "label": "设计更改申请单", "sort": 20},
    ],
    # 设计更改申请：销/质/产/采四部门发起（须具备对应模块 create 权限之一）
    "entry_source_create_permissions": {
        "design_change_request": [
            "kuaizhizao:sales-order:create",
            "kuaizhizao:quality-complaint:create",
            "kuaizhizao:work-order:create",
            "kuaizhizao:purchase-order:create",
        ],
    },
    "header_fields": [
        {"key": "content_before", "label": "变更前内容", "sort": 10, "type": "textarea"},
        {"key": "content_after", "label": "变更后内容", "sort": 20, "type": "textarea"},
        {"key": "change_product_type", "label": "更改产品类型", "sort": 30, "type": "text"},
        {"key": "change_method", "label": "更改方式", "sort": 40, "type": "text"},
    ],
    "change_kinds": [
        {"code": "material", "label": "物料变更", "sort": 10},
        {"code": "process", "label": "工艺变更", "sort": 20},
        {"code": "drawing", "label": "图纸变更", "sort": 30},
        {"code": "doc_template", "label": "文件套模板变更", "sort": 35},
        {"code": "other", "label": "其它变更", "sort": 40},
    ],
    # 真源摘要：03-变更单专项设计 §4.3.7（《变更单填写说明》xlsx 仍无单元格）
    "validation_rules": [
        {
            "when_change_kind_in": ["material", "process", "drawing", "doc_template", "other"],
            "require": ["change_reason"],
            "message": "请填写变更原因",
        },
        {
            "when_change_kind_in": ["material"],
            "require": ["content_before", "content_after"],
            "message": "物料变更须填写变更前/变更后内容",
        },
        {
            "when_change_kind_in": ["process", "drawing", "doc_template"],
            "require": ["content_before", "content_after"],
            "message": "请填写变更前/变更后内容",
        },
    ],
}

# ---------------------------------------------------------------------------
# R-08 试流（用户提供：材料试流 / 结构试流 R-08-19 / 整机试生产报告）
# ---------------------------------------------------------------------------

ELECTRONICS_TRIAL_FLOW_SEED: Dict[str, Any] = {
    "field_labels": {
        "urgency_level": "级别",
        "customer_code": "客户代码",
        "order_no": "订单号",
        "order_qty": "订单数量",
        "trial_qty": "试流/试生产数量",
        "trial_reason": "提出/试用原因",
        "kit_date": "齐套日期",
        "production_date": "生产日期",
        "compatibility_requirements": "互配要求",
        "precautions": "注意事项",
        "sample_management": "样品管理",
        "defect_rate": "不良率",
        "material_code": "12位代码",
        "material_name": "材料名称",
        "supplier_name": "供应商",
        "material_spec": "材料规格",
        "mold_no": "模号",
        "inspection_date": "检验日期",
    },
    "header_fields": [
        {"key": "urgency_level", "label": "级别", "sort": 10, "type": "select", "options": [
            {"value": "normal", "label": "正常"},
            {"value": "urgent", "label": "应急"},
        ]},
        {"key": "customer_code", "label": "客户代码", "sort": 20, "type": "text"},
        {"key": "order_no", "label": "订单号", "sort": 30, "type": "text"},
        {"key": "order_qty", "label": "订单数量", "sort": 40, "type": "decimal"},
        {"key": "trial_qty", "label": "试流数量", "sort": 50, "type": "decimal"},
        {"key": "trial_reason", "label": "提出原因", "sort": 60, "type": "textarea"},
        {"key": "kit_date", "label": "齐套日期", "sort": 70, "type": "date"},
        {"key": "production_date", "label": "生产日期", "sort": 80, "type": "date"},
        {"key": "compatibility_requirements", "label": "互配要求", "sort": 90, "type": "textarea"},
        {"key": "precautions", "label": "注意事项", "sort": 100, "type": "textarea"},
        {"key": "sample_management", "label": "样品管理", "sort": 110, "type": "textarea"},
        {"key": "supplier_name", "label": "供应商", "sort": 115, "type": "text"},
        {"key": "material_spec", "label": "材料规格", "sort": 116, "type": "text"},
        {"key": "mold_no", "label": "模号", "sort": 117, "type": "text"},
        {"key": "inspection_date", "label": "检验日期", "sort": 118, "type": "date"},
    ],
    "step_templates": {
        "component": [
            {"step_key": "rd_manager", "step_name": "经理审核", "dept_code": "rd", "sort": 10},
            {"step_key": "purchasing", "step_name": "采购审核", "dept_code": "purchasing", "sort": 20},
            {"step_key": "production", "step_name": "生产试流结果", "dept_code": "prod", "sort": 30},
        ],
        "structure": [
            {"step_key": "plan", "step_name": "生产计划排产", "dept_code": "plan", "sort": 10},
            {"step_key": "purchasing", "step_name": "采购下单跟进", "dept_code": "purchasing", "sort": 20},
            {"step_key": "mc", "step_name": "物控会签", "dept_code": "plan", "sort": 30},
            {"step_key": "wh_receive", "step_name": "仓库收料核对齐套", "dept_code": "warehouse", "sort": 40},
            {"step_key": "wh_to_iqc", "step_name": "仓库送检IQC", "dept_code": "warehouse", "sort": 50},
            {"step_key": "iqc", "step_name": "IQC组合装配检验入库", "dept_code": "iqc", "sort": 60},
            {"step_key": "wh_issue", "step_name": "仓库齐套发料", "dept_code": "warehouse", "sort": 70},
            {"step_key": "line_receive", "step_name": "产线收料试组装", "dept_code": "prod", "sort": 80},
            {"step_key": "pe_pqc_check", "step_name": "PE/PQC核对试流品标识", "dept_code": "pe", "sort": 90},
            {"step_key": "prod_trial", "step_name": "生产试流", "dept_code": "prod", "sort": 100},
            {"step_key": "trial_result", "step_name": "PQC/PE/OQC填试流结果", "dept_code": "pqc", "sort": 110},
            {"step_key": "rd_conclusion", "step_name": "研发结论", "dept_code": "rd", "sort": 120, "phase": "conclusion"},
            {"step_key": "rd_signoff_close", "step_name": "研发会签关闭", "dept_code": "rd", "sort": 130, "phase": "conclusion"},
        ],
        "complete": [
            {"step_key": "purchasing", "step_name": "采购填写型号订单", "dept_code": "purchasing", "sort": 10},
            {"step_key": "iqc", "step_name": "IQC", "dept_code": "iqc", "sort": 20},
            {"step_key": "pe", "step_name": "PE", "dept_code": "pe", "sort": 30},
            {"step_key": "qc", "step_name": "QC", "dept_code": "qa", "sort": 40},
            {"step_key": "qa", "step_name": "QA", "dept_code": "qa", "sort": 50},
            {"step_key": "rd", "step_name": "研发", "dept_code": "rd", "sort": 60},
            {"step_key": "manufacturing", "step_name": "制造工序", "dept_code": "prod", "sort": 70},
            {"step_key": "conclusion_rd", "step_name": "研发中心结论", "dept_code": "rd", "sort": 80, "phase": "conclusion"},
            {"step_key": "conclusion_qa", "step_name": "质量部结论", "dept_code": "qa", "sort": 90, "phase": "conclusion"},
            {"step_key": "conclusion_prod", "step_name": "制造部结论", "dept_code": "prod", "sort": 100, "phase": "conclusion"},
            {"step_key": "conclusion_purchasing", "step_name": "采购结论", "dept_code": "purchasing", "sort": 110, "phase": "conclusion"},
        ],
    },
    "validation_rules": [
        {
            "when_business_type": "complete",
            "when_step_keys": [
                "iqc",
                "pe",
                "qc",
                "qa",
                "rd",
                "manufacturing",
            ],
            "require": ["step_description", "defect_rate", "result"],
            "message": "整机试流工序须填写描述、不良率与判定",
        },
    ],
}

# ---------------------------------------------------------------------------
# 研发交付物命名（26.9.1：部品规格书/测试报告/软件规格/图纸）
# ---------------------------------------------------------------------------

ELECTRONICS_RD_DELIVERABLE_SEED: Dict[str, Any] = {
    "naming_rules": {
        "part_spec_types": ["part_spec", "component_spec"],
        "test_report_types": ["test_report", "test"],
        "software_spec_types": ["software_spec", "sw_spec"],
        "schematic_gerber_types": ["schematic", "gerber", "schematic_gerber"],
    },
}

# ---------------------------------------------------------------------------
# R-11 返工（用户提供：销售返工单 FND/R-18-05 + 排位表 + AA/AB 路径）
# ---------------------------------------------------------------------------

ELECTRONICS_REWORK_SEED: Dict[str, Any] = {
    "field_labels": {
        "propose_dept": "提出部门",
        "rework_reason": "返工原因",
        "product_code": "原产品型号",
        "target_product_code": "目标型号",
        "rd_material_diff": "研发料号差异",
        "estimated_cost_rmb": "预计费用(不含税RMB)",
        "logistics_purchase_progress": "物流采购进度",
        "manufacturing_process_notes": "返工工艺",
        "scrap_rate_estimate": "材料报损率估算",
        "labor_cost_estimate": "人工成本估算",
        "quality_requirements_text": "质量要求",
        "planned_rework_at": "返工计划时间",
        "rework_inspection_record": "返工产品检验记录",
        "product_line_code": "产品线码",
        "disassembly_da_requirements": "拆机要求(DA)",
        "disassembly_dp_requirements": "拆机要求(DP)",
        "disassembly_dr_requirements": "拆机要求(DR)",
        "post_rework_assembly_notes": "返工后组装整机",
        "disassembly_control_items": "拆机管控事项",
        "reassembly_station_name": "再次组装岗位名称",
        "reassembly_control_items": "再次组装管控事项",
        "reassembly_owner_name": "再次组装负责人",
        "rework_material_name": "返工物料名称",
        "rework_material_code": "返工物料代码",
        "rework_material_qty": "返工物料数量",
        "rework_purchase_signoff": "采购签字",
    },
    # 真源：启动协调/成品 材料返工单号编码规则2026-9-7.xls「编号」页（FR+码+年+流水）；完整码表待产品线码表.docx
    "product_line_options": [
        {"code": "1", "label": "遥控器", "sort": 10},
    ],
    "rework_code_format_hint": "FR + 产品线码 + 年份 + 流水号",
    "rework_path_types": [
        {"code": "aa", "label": "A-A", "sort": 10},
        {"code": "ab", "label": "A-B", "sort": 20},
    ],
    "form_sections": [
        {
            "key": "propose",
            "label": "返工提出",
            "sort": 10,
            "fields": ["propose_dept", "rework_reason", "product_code", "product_name", "quantity"],
        },
        {
            "key": "rd_diff",
            "label": "研发差异",
            "sort": 20,
            "when_path_in": ["ab"],
            "fields": ["target_product_code", "target_product_name", "rd_material_diff"],
        },
        {
            "key": "cost",
            "label": "预计费用",
            "sort": 30,
            "fields": ["estimated_cost_rmb"],
        },
        {
            "key": "logistics",
            "label": "物流采购",
            "sort": 40,
            "fields": ["logistics_purchase_progress"],
        },
        {
            "key": "rework_planning",
            "label": "返工策划",
            "sort": 45,
            "fields": [
                "disassembly_da_requirements",
                "disassembly_dp_requirements",
                "disassembly_dr_requirements",
                "post_rework_assembly_notes",
                "disassembly_control_items",
                "reassembly_station_name",
                "reassembly_control_items",
                "reassembly_owner_name",
                "rework_material_name",
                "rework_material_code",
                "rework_material_qty",
                "rework_purchase_signoff",
            ],
        },
        {
            "key": "manufacturing",
            "label": "制造工艺",
            "sort": 50,
            "fields": ["manufacturing_process_notes", "scrap_rate_estimate", "labor_cost_estimate"],
        },
        {
            "key": "quality",
            "label": "质量要求",
            "sort": 60,
            "fields": ["quality_requirements_text"],
        },
        {
            "key": "planning",
            "label": "计划排产",
            "sort": 70,
            "fields": ["planned_rework_at"],
        },
        {
            "key": "production",
            "label": "生产线记录",
            "sort": 80,
            "fields": ["need_warehouse_in", "rework_inspection_record"],
        },
    ],
    "position_plan_columns": [
        {"key": "sequence", "label": "序号", "sort": 10, "width": 60},
        {"key": "station_name", "label": "工序名称", "sort": 20, "width": 120, "required": True},
        {"key": "job_category", "label": "岗位类别", "sort": 30, "width": 100},
        {"key": "equipment_fixture", "label": "设备或工装", "sort": 40, "width": 120},
        {"key": "standard_unit_seconds", "label": "标准工时(S/PCS)", "sort": 50, "width": 120, "type": "decimal"},
        {"key": "theoretical_headcount", "label": "理论人数", "sort": 60, "width": 90, "type": "decimal"},
        {"key": "actual_headcount", "label": "实际人数", "sort": 70, "width": 90, "type": "decimal"},
        {"key": "control_points", "label": "控制要点", "sort": 80, "width": 160},
        {"key": "remarks", "label": "备注", "sort": 90, "width": 120},
    ],
    "signoff_depts": [
        {"code": "sales", "label": "销售", "sort": 10},
        {"code": "rd", "label": "研发", "sort": 20, "when_path_in": ["ab"]},
        {"code": "quality", "label": "质量", "sort": 30},
        {"code": "manufacturing", "label": "制造", "sort": 40},
        {"code": "purchasing", "label": "采购", "sort": 50},
        {"code": "leadership", "label": "领导", "sort": 60},
        {"code": "planning", "label": "计划", "sort": 70},
        {"code": "warehouse", "label": "仓库", "sort": 80},
        {"code": "manufacturing_exec", "label": "制造执行", "sort": 90},
        {"code": "finance", "label": "财务", "sort": 100, "required_for_close": True},
    ],
    "validation_rules": [],
}

ELECTRONICS_SAMPLE_PROCESS_SEED: Dict[str, Any] = {
    "request_kinds": [
        {"code": "general", "label": "通用加工", "sort": 10, "active": True},
        {"code": "stencil", "label": "钢网制作", "sort": 20, "active": True},
        {"code": "smt", "label": "SMT 贴片", "sort": 30, "active": True},
    ],
    "attachment_types": [
        {"code": "gerber", "label": "Gerber", "sort": 10, "active": True},
        {"code": "pick_place_bom", "label": "贴片 BOM", "sort": 20, "active": True},
        {"code": "coordinate", "label": "坐标", "sort": 30, "active": True},
        {"code": "silkscreen", "label": "丝印", "sort": 40, "active": True},
        {"code": "stencil", "label": "钢网资料", "sort": 50, "active": True},
        {"code": "other", "label": "其它", "sort": 90, "active": True},
    ],
    "field_labels": {
        "material_code": "PCB 料号",
        "material_version": "PCB 版本",
    },
    "validation_rules": [
        {
            "when_kind_in": ["stencil", "smt"],
            "require": ["material_code"],
            "message": "钢网/SMT 申请须填写 PCB 料号",
        }
    ],
}

ELECTRONICS_LAB_REQUEST_SEED: Dict[str, Any] = {
    "business_type_labels": {
        "project_material": "材料试验",
        "project_product": "整机例试",
    },
    "extension_fields": {
        "project_product": [
            {
                "key": "structure_special_test",
                "label": "结构特殊试验说明",
                "sort": 10,
                "type": "textarea",
            },
            {
                "key": "electronics_special_test",
                "label": "电子特殊试验说明",
                "sort": 20,
                "type": "textarea",
            },
            {
                "key": "structure_manager_approved",
                "label": "结构经理已审批",
                "sort": 30,
                "type": "boolean",
            },
            {
                "key": "electronics_manager_approved",
                "label": "电子经理已审批",
                "sort": 40,
                "type": "boolean",
            },
        ],
    },
}

ELECTRONICS_RD_DELIVERABLE_SEED: Dict[str, Any] = {
    "drawing_types": [
        {"code": "silkscreen", "label": "丝印图纸", "sort": 10, "active": True},
        {"code": "assembly", "label": "总装图纸", "sort": 20, "active": True},
        {"code": "packaging", "label": "包装图纸", "sort": 30, "active": True},
        {"code": "pcb_assembly", "label": "线路板组件图纸", "sort": 40, "active": True},
    ],
    "customer_doc_types": [
        {"code": "spec_sheet", "label": "规格书", "sort": 10, "active": True},
        {"code": "approval_sheet", "label": "承认书", "sort": 20, "active": True},
    ],
}

ELECTRONICS_BOM_COLLAB_SEED: Dict[str, Any] = {
    "sections": [
        {"key": "electronics", "label": "电子分区", "sort": 10, "active": True},
        {"key": "structure", "label": "结构分区", "sort": 20, "active": True},
    ],
    "post_approval_steps": [
        {
            "key": "clerk_entry",
            "label": "文员录入 ERP/系统",
            "action": "execute",
            "sort": 10,
            "required_before_close": True,
        },
    ],
    "line_columns": [
        {"key": "bom_level", "label": "BOM层次", "sort": 5, "width": 80},
        {"key": "designator", "label": "位号/位置号", "sort": 10, "width": 100},
        {"key": "material_code", "label": "物料编码/12位代码", "sort": 20, "width": 130, "required": True},
        {"key": "odm_material_code", "label": "ODM厂家物料编号", "sort": 25, "width": 130},
        {"key": "odm_vendor_name", "label": "ODM厂家名称", "sort": 28, "width": 120},
        {"key": "category_name", "label": "品类名称", "sort": 29, "width": 100},
        {"key": "material_name", "label": "物料名称/描述", "sort": 30, "width": 140, "required": True},
        {"key": "specification", "label": "规格型号", "sort": 40, "width": 120},
        {"key": "footprint", "label": "封装", "sort": 50, "width": 90},
        {"key": "brand_name", "label": "品牌名称", "sort": 55, "width": 100},
        {"key": "qty", "label": "单位用量", "sort": 60, "width": 90, "type": "decimal"},
        {"key": "unit", "label": "单位", "sort": 70, "width": 70},
        {"key": "eco_index", "label": "环保指数", "sort": 72, "width": 90},
        {"key": "purchase_type", "label": "采购类型", "sort": 74, "width": 90},
        {"key": "valid_from", "label": "开始时间", "sort": 76, "width": 100},
        {"key": "valid_to", "label": "停止时间", "sort": 78, "width": 100},
        {"key": "remarks", "label": "备注", "sort": 80, "width": 120},
    ],
}

# manifest profile_key → 内置种子（IndustryExtensionRuntimeService 唯一入口）
ELECTRONICS_PROFILE_SEEDS_BY_KEY: Dict[str, Dict[str, Any]] = {
    "kuaiplm.sample_process": ELECTRONICS_SAMPLE_PROCESS_SEED,
    "kuaiplm.bom_collab": ELECTRONICS_BOM_COLLAB_SEED,
    "kuaiplm.rd_deliverable": ELECTRONICS_RD_DELIVERABLE_SEED,
}


def resolve_electronics_profile_seed(profile_key: str) -> Dict[str, Any] | None:
    seed = ELECTRONICS_PROFILE_SEEDS_BY_KEY.get(profile_key)
    if seed is None:
        return None
    return dict(seed)


# ESD 预置方案编码（通用点检方案 domain=esd）
ESD_SCHEME_CODE = "ESD-STD-DAILY"
ESD_SCHEME_NAME = "ESD 日常点检"
ESD_CONFIG_KEY = "industry.ext.electronics.esd"

# 16 类 ESD 项目（行业包预置；租户可改 active/label/判定）
ELECTRONICS_ESD_PROJECT_TYPES: List[Dict[str, Any]] = [
    {"code": "ESD-01", "label": "防静电线", "sort": 10, "active": True, "value_type": "boolean"},
    {"code": "ESD-02", "label": "线体接地", "sort": 20, "active": True, "value_type": "boolean"},
    {"code": "ESD-03", "label": "设备接地", "sort": 30, "active": True, "value_type": "boolean"},
    {"code": "ESD-04", "label": "人员防静电手腕带", "sort": 40, "active": True, "value_type": "boolean"},
    {"code": "ESD-05", "label": "静电报警器", "sort": 50, "active": True, "value_type": "boolean"},
    {
        "code": "ESD-06",
        "label": "恒温烙铁接地电阻漏电流温度",
        "sort": 60,
        "active": True,
        "value_type": "boolean",
    },
    {"code": "ESD-07", "label": "离子风机", "sort": 70, "active": True, "value_type": "boolean"},
    {
        "code": "ESD-08",
        "label": "线别绝缘体孤立导体测试",
        "sort": 80,
        "active": True,
        "value_type": "boolean",
    },
    {"code": "ESD-09", "label": "PCB 料框", "sort": 90, "active": True, "value_type": "boolean"},
    {"code": "ESD-10", "label": "流水线皮带", "sort": 100, "active": True, "value_type": "boolean"},
    {"code": "ESD-11", "label": "防静电箱", "sort": 110, "active": True, "value_type": "boolean"},
    {"code": "ESD-12", "label": "防静电工作台", "sort": 120, "active": True, "value_type": "boolean"},
    {"code": "ESD-13", "label": "防静电气泡袋", "sort": 130, "active": True, "value_type": "boolean"},
    {"code": "ESD-14", "label": "防静电盒", "sort": 140, "active": True, "value_type": "boolean"},
    {"code": "ESD-15", "label": "防静电服", "sort": 150, "active": True, "value_type": "boolean"},
    {"code": "ESD-16", "label": "温湿度", "sort": 160, "active": True, "value_type": "boolean"},
]

ELECTRONICS_ESD_SEED: Dict[str, Any] = {
    "scheme_code": ESD_SCHEME_CODE,
    "scheme_name": ESD_SCHEME_NAME,
    "cycle_type": "每天",
    "capture_mode": "A",
    "overdue_hours": 8,
    "review_overdue_hours": 4,
    "project_types": ELECTRONICS_ESD_PROJECT_TYPES,
    # 看板按主数据厂区动态切换；设备归属由车间绑定，不写死厂区名
    "board_layout": {
        "plant_source": "master_data.plant",
        "show_overview": True,
    },
}

# OEM 标签签样包目录（抽象编码；书面签样模板 UUID 由租户绑定）
# 真源实现见 services/label_oem_seed_service.ELECTRONICS_LABEL_OEM_PACKS
ELECTRONICS_LABEL_OEM_PROFILE_KEY = "ind-electronics.label_oem"
