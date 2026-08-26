"""
金蝶云星空（kingdee_galaxy）常用接口预设。

绑定应用连接器后，path 为相对 K3Cloud 站点路径；请求体为 .common.kdsvc format=1 信封。
调用前须 LoginByAppSecret 取得 kdservice-sessionid（见 kingdee_galaxy_service）。
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, Dict, List, TypedDict


class KingdeeGalaxyApiPreset(TypedDict):
    code_suffix: str
    name: str
    description: str
    path: str
    method: str
    request_body: Dict[str, Any]


EXECUTE_BILL_QUERY_PATH = (
    "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc"
)
VIEW_PATH = "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.View.common.kdsvc"


def build_kdsvc_envelope(parameters: List[Any]) -> Dict[str, Any]:
    """与 LoginByAppSecret 一致的 .common.kdsvc 报文信封。"""
    return {
        "format": 1,
        "useragent": "ApiClient",
        "rid": str(uuid.uuid4()),
        "parameters": parameters,
        "timestamp": str(int(time.time())),
        "v": "1.0",
    }


def build_execute_bill_query_body(
    *,
    form_id: str,
    field_keys: str,
    filter_string: str = "",
    order_string: str = "",
    start_row: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    query = {
        "FormId": form_id,
        "FieldKeys": field_keys,
        "FilterString": filter_string,
        "OrderString": order_string,
        "TopRowCount": 0,
        "StartRow": int(start_row),
        "Limit": int(limit),
    }
    return build_kdsvc_envelope([json.dumps(query, ensure_ascii=False)])


def build_view_body(*, form_id: str, number: str = "", id: str = "") -> Dict[str, Any]:
    data: Dict[str, Any] = {"CreateOrgId": 0, "Number": number, "Id": id}
    return build_kdsvc_envelope([form_id, json.dumps(data, ensure_ascii=False)])


def list_kingdee_galaxy_api_presets() -> List[KingdeeGalaxyApiPreset]:
    """常用查询类预设（物料/客商/采购销售订单/即时库存 + 单据查看）。"""
    return [
        {
            "code_suffix": "query_material",
            "name": "金蝶查询物料",
            "description": "ExecuteBillQuery：物料清单（BD_MATERIAL），默认未禁用前 100 条",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_execute_bill_query_body(
                form_id="BD_MATERIAL",
                field_keys=(
                    "FMATERIALID,FNumber,FName,FSpecification,"
                    "FBaseUnitId.FNumber,FDocumentStatus,FForbidStatus"
                ),
                filter_string="FForbidStatus='A'",
                order_string="FNumber ASC",
            ),
        },
        {
            "code_suffix": "query_customer",
            "name": "金蝶查询客户",
            "description": "ExecuteBillQuery：客户（BD_Customer）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_execute_bill_query_body(
                form_id="BD_Customer",
                field_keys="FCUSTID,FNumber,FName,FShortName,FDocumentStatus,FForbidStatus",
                filter_string="FForbidStatus='A'",
                order_string="FNumber ASC",
            ),
        },
        {
            "code_suffix": "query_supplier",
            "name": "金蝶查询供应商",
            "description": "ExecuteBillQuery：供应商（BD_Supplier）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_execute_bill_query_body(
                form_id="BD_Supplier",
                field_keys="FSupplierId,FNumber,FName,FShortName,FDocumentStatus,FForbidStatus",
                filter_string="FForbidStatus='A'",
                order_string="FNumber ASC",
            ),
        },
        {
            "code_suffix": "query_purchase_order",
            "name": "金蝶查询采购订单",
            "description": "ExecuteBillQuery：采购订单（PUR_PurchaseOrder）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_execute_bill_query_body(
                form_id="PUR_PurchaseOrder",
                field_keys=(
                    "FID,FBillNo,FDate,FSupplierId.FNumber,FSupplierId.FName,"
                    "FDocumentStatus,FCloseStatus"
                ),
                filter_string="",
                order_string="FDate DESC,FBillNo DESC",
            ),
        },
        {
            "code_suffix": "query_sales_order",
            "name": "金蝶查询销售订单",
            "description": "ExecuteBillQuery：销售订单（SAL_SaleOrder）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_execute_bill_query_body(
                form_id="SAL_SaleOrder",
                field_keys=(
                    "FID,FBillNo,FDate,FCustId.FNumber,FCustId.FName,"
                    "FDocumentStatus,FCloseStatus"
                ),
                filter_string="",
                order_string="FDate DESC,FBillNo DESC",
            ),
        },
        {
            "code_suffix": "query_inventory",
            "name": "金蝶查询即时库存",
            "description": "ExecuteBillQuery：即时库存（STK_Inventory）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_execute_bill_query_body(
                form_id="STK_Inventory",
                field_keys=(
                    "FMaterialId.FNumber,FMaterialName,FStockId.FNumber,"
                    "FStockName,FLot.FNumber,FBaseQty,FStockStatusId.FNumber"
                ),
                filter_string="FBaseQty<>0",
                order_string="FMaterialId.FNumber ASC",
            ),
        },
        {
            "code_suffix": "view_bill",
            "name": "金蝶查看单据",
            "description": "View：按 FormId + 单号查看单据详情（默认示例为物料）",
            "path": VIEW_PATH,
            "method": "POST",
            "request_body": build_view_body(form_id="BD_MATERIAL", number=""),
        },
    ]


def resolve_preset_api_code(connection_code: str, code_suffix: str) -> str:
    """租户内唯一：连接器 code + 后缀，截断至 50 字符。"""
    base = str(connection_code or "kingdee").strip() or "kingdee"
    suffix = str(code_suffix or "").strip()
    raw = f"{base}_{suffix}" if suffix else base
    return raw[:50]
