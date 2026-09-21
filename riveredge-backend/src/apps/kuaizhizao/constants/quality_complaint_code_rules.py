"""质量投诉分类型编码规则（26.9.1 P1）。

各类型独立 rule_code，禁止在业务代码写死客户专名前缀。
行业插件启用时可映射 INDUSTRY_COMPLAINT_RC。
"""

from __future__ import annotations

from apps.kuaizhizao.constants.quality_complaint_types import (
    COMPLAINT_CUSTOMER,
    COMPLAINT_IQC_INCOMING,
    COMPLAINT_LINE_INCOMING,
    COMPLAINT_OQC,
    COMPLAINT_PQC,
)

QUALITY_COMPLAINT_RULE_CODE_BY_TYPE: dict[str, str] = {
    COMPLAINT_IQC_INCOMING: "QUALITY_COMPLAINT_IQC_CODE",
    COMPLAINT_LINE_INCOMING: "QUALITY_COMPLAINT_LINE_CODE",
    COMPLAINT_PQC: "QUALITY_COMPLAINT_PQC_CODE",
    COMPLAINT_OQC: "QUALITY_COMPLAINT_OQC_CODE",
    COMPLAINT_CUSTOMER: "QUALITY_COMPLAINT_CUSTOMER_CODE",
}

QUALITY_COMPLAINT_CODE_PREFIX_BY_TYPE: dict[str, str] = {
    COMPLAINT_IQC_INCOMING: "RCI",
    COMPLAINT_LINE_INCOMING: "RCL",
    COMPLAINT_PQC: "RCP",
    COMPLAINT_OQC: "RCO",
    COMPLAINT_CUSTOMER: "RCC",
}

# 客诉双时效默认值
CUSTOMER_CONTAINMENT_HOUR = 17
CUSTOMER_CORRECTIVE_SLA_WORKDAYS = 3


def resolve_complaint_rule_code(business_type: str) -> str:
    bt = (business_type or "").strip().lower()
    code = QUALITY_COMPLAINT_RULE_CODE_BY_TYPE.get(bt)
    if not code:
        return "QUALITY_COMPLAINT_CODE"
    return code


def resolve_complaint_code_prefix(business_type: str) -> str:
    bt = (business_type or "").strip().lower()
    return QUALITY_COMPLAINT_CODE_PREFIX_BY_TYPE.get(bt, "QC")
