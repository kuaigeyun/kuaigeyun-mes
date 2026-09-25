"""开放 API 对接文档：各单据动作的请求体字段示例（可直接改跑）。

与 open_api_module_catalog 解耦，避免 _gen_open_api_catalog 重生成时丢失示例。
"""

from __future__ import annotations

import json
from typing import Any

# 按权限码后缀 / 模块关键字匹配；值可为 dict（自动 pretty JSON）或已格式化的 str
_CREATE_SAMPLES: dict[str, dict[str, Any]] = {
    "sales-order": {
        "order_date": "2026-09-25",
        "delivery_date": "2026-10-15",
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "customer_contact": "张经理",
        "customer_phone": "13800138000",
        "shipping_address": "江苏省苏州市工业园区星湖街328号",
        "payment_terms": "月结30天",
        "currency_code": "CNY",
        "price_type": "tax_inclusive",
        "items": [
            {
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "material_spec": "120×80×25mm",
                "material_unit": "件",
                "required_quantity": 500,
                "delivery_date": "2026-10-15",
                "unit_price": 28.5,
                "tax_rate": 13,
            }
        ],
    },
    "work-order": {
        "code_rule": "work_order_default",
        "product_id": 501,
        "product_code": "MAT-FIN-0001",
        "product_name": "铝合金外壳",
        "quantity": 500,
        "production_mode": "MTO",
        "sales_order_id": 2001,
        "sales_order_code": "SO-20260925-001",
        "workshop_id": 10,
        "workshop_name": "机加工车间",
        "planned_start_date": "2026-09-26T08:00:00",
        "planned_end_date": "2026-10-10T18:00:00",
        "remarks": "客户急单",
    },
    "purchase-order": {
        "order_date": "2026-09-25",
        "delivery_date": "2026-10-05",
        "supplier_id": 301,
        "supplier_name": "深圳优质钢材供应商",
        "supplier_contact": "李采购",
        "buyer_name": "王采购",
        "order_type": "标准采购",
        "currency": "CNY",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_spec": "Φ50×3000",
                "ordered_quantity": 200,
                "unit": "kg",
                "unit_price": 32.0,
                "total_price": 6400.0,
                "required_date": "2026-10-05",
                "inspection_required": True,
            }
        ],
    },
    "quotation": {
        "quotation_date": "2026-09-25",
        "valid_until": "2026-10-25",
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "salesman_name": "陈销售",
        "payment_terms": "预付30%，发货前付清",
        "price_type": "tax_inclusive",
        "items": [
            {
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "material_unit": "件",
                "quote_quantity": 500,
                "unit_price": 28.5,
                "tax_rate": 13,
                "delivery_date": "2026-10-20",
            }
        ],
    },
    "sales-review": {
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "project_name": "2026年外壳批量订单评审",
        "review_date": "2026-09-25",
        "delivery_date": "2026-10-15",
        "urgency": "high",
        "items": [
            {
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "material_unit": "件",
                "quantity": 500,
                "unit_price": 28.5,
                "tech_requirements": "表面阳极氧化，Ra≤1.6",
            }
        ],
    },
    "sales-contract": {
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "contract_name": "年度框架采购合同",
        "sign_date": "2026-09-25",
        "start_date": "2026-10-01",
        "end_date": "2027-09-30",
        "total_amount": 1000000,
        "currency_code": "CNY",
        "payment_terms": "月结30天",
    },
    "sales-order-change": {
        "sales_order_id": 2001,
        "sales_order_code": "SO-20260925-001",
        "change_reason": "客户要求调整交期与数量",
        "items": [
            {
                "sales_order_item_id": 3001,
                "material_code": "MAT-FIN-0001",
                "required_quantity": 600,
                "delivery_date": "2026-10-20",
            }
        ],
    },
    "sales-forecast": {
        "forecast_name": "2026Q4外壳需求预测",
        "period_start": "2026-10-01",
        "period_end": "2026-12-31",
        "items": [
            {
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "forecast_qty": 2000,
            }
        ],
    },
    "shipment-notice": {
        "sales_order_id": 2001,
        "sales_order_code": "SO-20260925-001",
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "warehouse_id": 1,
        "warehouse_name": "成品仓",
        "planned_ship_date": "2026-09-28",
        "shipping_address": "江苏省苏州市工业园区星湖街328号",
        "items": [
            {
                "sales_order_item_id": 3001,
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "material_unit": "件",
                "notice_quantity": 100,
                "unit_price": 28.5,
            }
        ],
    },
    "outbound": {
        "sales_order_id": 2001,
        "sales_order_code": "SO-20260925-001",
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "warehouse_id": 1,
        "warehouse_name": "成品仓",
        "shipping_address": "江苏省苏州市工业园区星湖街328号",
        "items": [
            {
                "sales_order_item_id": 3001,
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "material_unit": "件",
                "delivery_quantity": 100,
                "unit_price": 28.5,
                "total_amount": 2850.0,
            }
        ],
    },
    "sales-return": {
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "warehouse_id": 1,
        "warehouse_name": "成品仓",
        "sales_order_id": 2001,
        "return_reason": "尺寸偏差",
        "items": [
            {
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "material_unit": "件",
                "return_quantity": 10,
                "unit_price": 28.5,
            }
        ],
    },
    "delivery-notice": {
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "sales_order_id": 2001,
        "sales_order_code": "SO-20260925-001",
        "planned_delivery_date": "2026-09-28",
        "shipping_address": "江苏省苏州市工业园区星湖街328号",
        "items": [
            {
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "material_name": "铝合金外壳",
                "material_unit": "件",
                "quantity": 100,
            }
        ],
    },
    "purchase-requisition": {
        "requisition_name": "机加工车间铝棒补料",
        "required_date": "2026-10-05",
        "notes": "工单 WO-20260925-008 缺料",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "unit": "kg",
                "quantity": 200,
                "suggested_unit_price": 32.0,
                "required_date": "2026-10-05",
                "work_order_id": 6001,
                "work_order_code": "WO-20260925-008",
            }
        ],
    },
    "purchase-inquiry": {
        "inquiry_date": "2026-09-25",
        "supplier_id": 301,
        "supplier_name": "深圳优质钢材供应商",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "quantity": 200,
                "unit": "kg",
            }
        ],
    },
    "purchase-order-change": {
        "purchase_order_id": 4001,
        "purchase_order_code": "PO-20260920-003",
        "change_reason": "交期提前",
        "items": [
            {
                "purchase_order_item_id": 5001,
                "ordered_quantity": 220,
                "required_date": "2026-10-03",
            }
        ],
    },
    "receipt-notice": {
        "purchase_order_id": 4001,
        "purchase_order_code": "PO-20260920-003",
        "supplier_id": 301,
        "supplier_name": "深圳优质钢材供应商",
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "planned_receipt_date": "2026-10-05",
        "items": [
            {
                "purchase_order_item_id": 5001,
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "notice_quantity": 200,
                "unit_price": 32.0,
            }
        ],
    },
    "inbound": {
        "purchase_order_id": 4001,
        "purchase_order_code": "PO-20260920-003",
        "supplier_id": 301,
        "supplier_name": "深圳优质钢材供应商",
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "delivery_note": "DN-88901",
        "items": [
            {
                "purchase_order_item_id": 5001,
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "receipt_quantity": 200,
                "unit_price": 32.0,
                "total_amount": 6400.0,
                "qualified_quantity": 200,
                "unqualified_quantity": 0,
                "quality_status": "合格",
            }
        ],
    },
    "purchase-return": {
        "supplier_id": 301,
        "supplier_name": "深圳优质钢材供应商",
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "purchase_order_id": 4001,
        "return_reason": "材质不符",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "return_quantity": 20,
                "unit_price": 32.0,
            }
        ],
    },
    "other-inbound": {
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "reason": "盘盈入库",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "quantity": 10,
            }
        ],
    },
    "other-outbound": {
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "reason": "报废出库",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "quantity": 5,
            }
        ],
    },
    "material-borrow": {
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "borrower_name": "张工",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "quantity": 15,
            }
        ],
    },
    "material-return": {
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "borrow_order_id": 7001,
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "quantity": 15,
            }
        ],
    },
    "warehouse-management-stocktaking": {
        "warehouse_id": 2,
        "warehouse_name": "原材料仓",
        "stocktaking_date": "2026-09-25",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "book_qty": 1000,
                "count_qty": 995,
            }
        ],
    },
    "warehouse-management-inventory-transfer": {
        "from_warehouse_id": 2,
        "from_warehouse_name": "原材料仓",
        "to_warehouse_id": 3,
        "to_warehouse_name": "线边仓",
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "material_name": "6061铝棒",
                "material_unit": "kg",
                "quantity": 50,
            }
        ],
    },
    "warehouse-management-assembly-orders": {
        "warehouse_id": 1,
        "warehouse_name": "成品仓",
        "product_id": 501,
        "product_code": "MAT-FIN-0001",
        "quantity": 10,
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "quantity": 20,
            }
        ],
    },
    "warehouse-management-disassembly-orders": {
        "warehouse_id": 1,
        "warehouse_name": "成品仓",
        "product_id": 501,
        "product_code": "MAT-FIN-0001",
        "quantity": 5,
    },
    "rework-order": {
        "source_work_order_id": 6001,
        "product_id": 501,
        "product_code": "MAT-FIN-0001",
        "quantity": 20,
        "rework_reason": "表面划伤返工",
    },
    "production-execution-reporting": {
        "work_order_id": 6001,
        "work_order_code": "WO-20260925-008",
        "operation_id": 1,
        "good_qty": 50,
        "scrap_qty": 0,
        "report_time": "2026-09-25T16:00:00",
        "operator_name": "李师傅",
    },
    "quality-management-incoming-inspection": {
        "source_doc_type": "purchase_receipt",
        "source_doc_id": 8001,
        "material_id": 801,
        "material_code": "MAT-RAW-0123",
        "inspect_qty": 200,
        "sample_qty": 20,
    },
    "quality-management-process-inspection": {
        "work_order_id": 6001,
        "operation_id": 1,
        "inspect_qty": 50,
        "sample_qty": 5,
    },
    "quality-management-finished-goods-inspection": {
        "work_order_id": 6001,
        "material_id": 501,
        "material_code": "MAT-FIN-0001",
        "inspect_qty": 100,
        "sample_qty": 10,
    },
    "quality-management-oqc-inspection": {
        "sales_order_id": 2001,
        "shipment_notice_id": 9001,
        "inspect_qty": 100,
        "sample_qty": 10,
    },
    "quality-management-fai-orders": {
        "work_order_id": 6001,
        "material_id": 501,
        "material_code": "MAT-FIN-0001",
        "sample_qty": 3,
    },
    "outsource-work-order": {
        "work_order_id": 6001,
        "supplier_id": 301,
        "supplier_name": "外协加工厂",
        "quantity": 100,
        "planned_return_date": "2026-10-05",
    },
    "outsource-order": {
        "work_order_id": 6001,
        "operation_id": 2,
        "supplier_id": 301,
        "supplier_name": "外协加工厂",
        "quantity": 100,
    },
    "outsource-issue": {
        "outsource_order_id": 11001,
        "warehouse_id": 2,
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "quantity": 100,
            }
        ],
    },
    "outsource-receipt": {
        "outsource_work_order_id": 11001,
        "warehouse_id": 1,
        "quantity": 100,
        "qualified_quantity": 98,
        "unqualified_quantity": 2,
    },
    "outsource-material-return": {
        "outsource_order_id": 11001,
        "warehouse_id": 2,
        "items": [
            {
                "material_id": 801,
                "material_code": "MAT-RAW-0123",
                "quantity": 5,
            }
        ],
    },
    "outsource-product-return": {
        "outsource_order_id": 11001,
        "warehouse_id": 1,
        "quantity": 2,
        "return_reason": "不合格退回",
    },
    "outsource-settlement": {
        "outsource_order_id": 11001,
        "supplier_id": 301,
        "settlement_amount": 5000,
        "currency": "CNY",
    },
    "plan-management-demand-management": {
        "demand_name": "2026Q4外壳需求",
        "demand_date": "2026-09-25",
        "required_date": "2026-10-15",
        "items": [
            {
                "material_id": 501,
                "material_code": "MAT-FIN-0001",
                "quantity": 2000,
            }
        ],
    },
    "plan-management-rolling-scheduling": {
        "schedule_name": "机加工滚动计划-W40",
        "period_start": "2026-09-28",
        "period_end": "2026-10-04",
        "workshop_id": 10,
    },
    "delivery-project": {
        "project_name": "华东精密交付项目",
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "sales_order_id": 2001,
        "planned_finish_date": "2026-10-15",
    },
    "delivery-process-template": {
        "template_name": "标准交付流程",
        "nodes": [
            {"name": "技术交底", "seq": 1},
            {"name": "试产确认", "seq": 2},
            {"name": "批量交付", "seq": 3},
        ],
    },
    "delivery-node-report": {
        "project_id": 12001,
        "node_id": 1,
        "progress_pct": 100,
        "comment": "技术交底完成",
    },
    "delivery-issue": {
        "project_id": 12001,
        "title": "包装破损",
        "severity": "medium",
        "description": "到货外箱破损两箱",
    },
    "after-sales-ticket": {
        "customer_id": 1001,
        "customer_name": "华东精密制造有限公司",
        "title": "现场安装异常",
        "description": "设备上电报警 E12",
        "priority": "high",
    },
    "after-sales-install": {
        "ticket_id": 13001,
        "customer_id": 1001,
        "planned_install_date": "2026-09-30",
        "address": "江苏省苏州市工业园区星湖街328号",
    },
    "repair-order": {
        "customer_id": 1001,
        "device_sn": "SN-2026-001",
        "fault_desc": "主轴异响",
        "priority": "medium",
    },
    "service-dispatch": {
        "ticket_id": 13001,
        "assignee_id": 20,
        "assignee_name": "服务工程师-赵",
        "planned_visit_date": "2026-09-28",
    },
    "after-sales-spare-part-requisition": {
        "ticket_id": 13001,
        "items": [
            {
                "material_id": 901,
                "material_code": "SP-001",
                "material_name": "轴承组件",
                "quantity": 2,
            }
        ],
    },
    "service-settlement": {
        "ticket_id": 13001,
        "labor_amount": 800,
        "parts_amount": 1200,
        "currency": "CNY",
    },
    "customer-return-visit": {
        "customer_id": 1001,
        "ticket_id": 13001,
        "visit_date": "2026-10-05",
        "satisfaction": 5,
        "comment": "客户满意",
    },
    "freight-order": {
        "sales_order_id": 2001,
        "carrier_name": "顺丰速运",
        "tracking_no": "SF1234567890",
        "ship_date": "2026-09-28",
    },
    "freight-bill": {
        "freight_order_id": 14001,
        "amount": 350,
        "currency": "CNY",
        "bill_date": "2026-09-28",
    },
    # master-data：API 同时接受 snake / camel；示例用 camel 与前端一致
    "supply-chain:customer": {
        "code": "CUST-0001",
        "name": "华东精密制造有限公司",
        "shortName": "华东精密",
        "contactPerson": "张经理",
        "phone": "13800138000",
        "email": "zhang@hdjm.example",
        "address": "江苏省苏州市工业园区星湖街328号",
        "category": "A类客户",
        "paymentTermsDays": 30,
        "isActive": True,
    },
    "supply-chain:supplier": {
        "code": "SUP-0001",
        "name": "深圳优质钢材供应商",
        "shortName": "优质钢材",
        "contactPerson": "李采购",
        "phone": "13900139000",
        "address": "广东省深圳市宝安区",
        "isActive": True,
    },
    "material": {
        "name": "6061铝棒",
        "baseUnit": "kg",
        "sourceType": "Buy",
        "groupId": 5,
        "specification": "Φ50×3000",
        "brand": "西南铝",
        "referenceCost": 30.0,
        "isActive": True,
    },
    "engineering-bom": {
        "materialId": 501,
        "materialCode": "MAT-FIN-0001",
        "version": "A",
        "items": [
            {
                "childMaterialId": 801,
                "childMaterialCode": "MAT-RAW-0123",
                "qty": 2,
                "unit": "kg",
            }
        ],
    },
    "route": {
        "code": "RT-FIN-0001",
        "name": "外壳机加路线",
        "materialId": 501,
        "operations": [
            {"seq": 10, "operationCode": "OP-CNC", "name": "数控加工", "workCenter": "机加中心"},
            {"seq": 20, "operationCode": "OP-QC", "name": "检验", "workCenter": "质检"},
        ],
    },
    "operation": {
        "code": "OP-CNC",
        "name": "数控加工",
        "workCenter": "机加中心",
        "stdTimeMinutes": 12,
    },
    "drawing": {
        "drawingNo": "DWG-FIN-0001",
        "name": "铝合金外壳图纸",
        "materialId": 501,
        "version": "A",
        "fileUuid": "00000000-0000-0000-0000-000000000001",
    },
    "drawing-distribution": {
        "drawingId": 15001,
        "toDept": "机加工车间",
        "copies": 2,
        "remark": "量产发放",
    },
    "drawing-loan": {
        "drawingId": 15001,
        "borrowerName": "张工",
        "plannedReturnDate": "2026-10-05",
    },
    "sop": {
        "code": "SOP-CNC-001",
        "name": "数控加工标准作业",
        "operationCode": "OP-CNC",
        "version": "A",
        "content": "1.装夹 2.对刀 3.加工 4.自检",
    },
}

_UPDATE_SAMPLES: dict[str, dict[str, Any]] = {
    "sales-order": {
        "customer_contact": "李经理",
        "customer_phone": "13900139000",
        "delivery_date": "2026-10-20",
        "payment_terms": "月结45天",
    },
    "work-order": {
        "quantity": 520,
        "planned_end_date": "2026-10-12T18:00:00",
        "remarks": "追加数量",
    },
    "purchase-order": {
        "delivery_date": "2026-10-08",
        "buyer_name": "赵采购",
    },
    "supply-chain:customer": {
        "phone": "13900139000",
        "address": "江苏省苏州市工业园区星湖街328号（新址）",
        "isActive": True,
    },
    "material": {
        "specification": "Φ50×3000（改）",
        "referenceCost": 31.5,
        "isActive": True,
    },
}


def _dump(obj: dict[str, Any]) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def _match_key(code: str, table: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    # 优先最长关键字匹配，避免 material 误伤 material-borrow
    for key in sorted(table.keys(), key=len, reverse=True):
        if key in code:
            return table[key]
    return None


def sample_body_for_permission(code: str, method: str) -> str:
    """按权限码 + HTTP 方法返回可复制的请求体示例。"""
    need_body = method in ("POST", "PUT", "PATCH")
    if not need_body:
        return ""

    if code.endswith(":create"):
        sample = _match_key(code, _CREATE_SAMPLES)
        if sample is not None:
            return _dump(sample)
        return _dump(
            {
                "_comment": "请按该单据 Create Schema 填写必填字段（见 OpenAPI / 后端 schemas）",
                "code": "<单据编码，可选则自动生成>",
                "remark": "对接测试",
            }
        )

    if code.endswith(":update"):
        sample = _match_key(code, _UPDATE_SAMPLES)
        if sample is not None:
            return _dump(sample)
        create = _match_key(code, _CREATE_SAMPLES)
        if create is not None:
            # 更新示例：只保留少量字段，避免整单覆盖误解
            keys = list(create.keys())[:4]
            slim = {k: create[k] for k in keys if k != "items"}
            if not slim:
                slim = {"remark": "仅传需要更新的字段"}
            return _dump(slim)
        return _dump({"_comment": "只传需要更新的字段"})

    if any(code.endswith(f":{x}") for x in ("submit", "revoke", "execute", "release", "assign", "complete", "close")):
        # 部分动作带备注更实用
        if code.endswith(":execute") or code.endswith(":confirm"):
            return _dump({"comment": "对接确认执行"})
        return "{}"

    if code.endswith(":audit") or code.endswith(":approve"):
        return _dump({"approved": True, "comment": "对接审核通过"})
    if code.endswith(":reject"):
        return _dump({"comment": "驳回原因：资料不完整"})

    return _dump({"_comment": "按业务 Schema 填写"}) if need_body else ""
