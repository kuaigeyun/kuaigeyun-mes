"""业务单据类型中文标签（供 KU-AI 工具与目录 API 使用）。"""

from __future__ import annotations

DOCUMENT_TYPE_LABELS: dict[str, str] = {
    # 快制造
    "kuaizhizao:work-order": "生产工单",
    "kuaizhizao:sales-order": "销售订单",
    "kuaizhizao:purchase-order": "采购订单",
    "kuaizhizao:rework-order": "返工工单",
    "kuaizhizao:outsource-order": "委外订单",
    "kuaizhizao:outsource-work-order": "委外工单",
    "kuaizhizao:purchase-receipt": "采购入库单",
    "kuaizhizao:purchase-return": "采购退货单",
    "kuaizhizao:sales-delivery": "销售出库单",
    "kuaizhizao:sales-return": "销售退货单",
    "kuaizhizao:plan-management-rolling-scheduling": "滚动计划",
    "kuaizhizao:production-picking": "生产领料单",
    "kuaizhizao:production-return": "生产退料单",
    "kuaizhizao:other-inbound": "其他入库单",
    "kuaizhizao:other-outbound": "其他出库单",
    "kuaizhizao:finished-goods-receipt": "成品入库单",
    "kuaizhizao:quality-management-incoming-inspection": "来料检验单",
    "kuaizhizao:quality-management-process-inspection": "过程检验单",
    "kuaizhizao:quality-management-finished-goods-inspection": "成品检验单",
    "kuaizhizao:quality-management-oqc-inspection": "出货检验单(OQC)",
    "kuaizhizao:equipment": "设备台账",
    "kuaizhizao:mold": "模具台账",
    "kuaizhizao:performance-holidays": "节假日",
    "kuaizhizao:performance-skills": "技能",
    # 好力 GO
    "haoligo:molds-ledger": "模具台账",
    "haoligo:molds-warehouse": "模具仓库",
    "haoligo:molds-upkeep-param-sets": "模具保养参数集",
    "haoligo:molds-upkeep-params": "模具保养参数",
    "haoligo:equipment-ledger": "设备台账",
    "haoligo:equipment-categories": "设备分类",
    "haoligo:equipment-manufacturers": "设备厂商",
    "haoligo:equipment-upkeep-param-sets": "设备保养参数集",
    "haoligo:equipment-upkeep-params": "设备保养参数",
    "haoligo:equipment-inspection-param-sets": "设备点检参数集",
    "haoligo:equipment-inspection-params": "设备点检参数",
    "haoligo:master-data-factory-workshops": "车间",
    # 主数据
    "master-data:factory:plant": "工厂",
    "master-data:factory:workshop": "车间",
    "master-data:factory:production-line": "产线",
    "master-data:factory:workstation": "工位",
    "master-data:factory:work-center": "工作中心",
    "master-data:warehouse:warehouse": "仓库",
    "master-data:warehouse:storage-area": "库区",
    "master-data:warehouse:storage-location": "库位",
    "master-data:material": "物料",
    "master-data:material:group": "物料分组",
    "master-data:material:bom": "BOM",
    "master-data:process:defect-type": "不良类型",
    "master-data:process:operation": "工序",
    "master-data:process:route": "工艺路线",
    "master-data:process:sop": "SOP",
    "master-data:process:drawing": "工程图",
    "master-data:supply-chain:customer": "客户",
    "master-data:supply-chain:supplier": "供应商",
    # 系统
    "system:user": "用户",
    "system:department": "部门",
    "system:position": "岗位",
}


def label_for_resource_key(resource_key: str) -> str:
    key = (resource_key or "").strip().lower()
    if key in DOCUMENT_TYPE_LABELS:
        return DOCUMENT_TYPE_LABELS[key]
    parts = key.split(":")
    if len(parts) >= 2:
        slug = parts[-1].replace("-", " ")
        return slug
    return key
