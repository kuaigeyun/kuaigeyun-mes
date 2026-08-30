"""
金蝶云星空（kingdee_galaxy）常用接口预设。

绑定应用连接器后，path 为相对 K3Cloud 站点路径；请求体为 .common.kdsvc format=1 信封。
调用前须 LoginByAppSecret 取得 kdservice-sessionid（见 kingdee_galaxy_service）。
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, Dict, List, Optional, TypedDict


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

# 销售订单 ExecuteBillQuery：表头 + 行（一行一明细）
SAL_SALE_ORDER_LINE_FIELD_KEYS = (
    "FID,FBillNo,FDate,"
    "FCustId.FNumber,FCustId.FName,"
    "FSaleOrderEntry_FEntryID,"
    "FMaterialId.FNumber,FMaterialId.FName,FMaterialId.FSpecification,"
    "FUnitId.FNumber,FQty,FPrice,FTaxPrice,FEntryTaxRate,"
    "FDeliveryDate,"
    "FDocumentStatus,FCloseStatus"
)

SALES_ORDER_PRESET_CODE_SUFFIX = "query_sales_order"
SALES_ORDER_LINE_MARKER = "FMaterialId.FNumber"

MATERIAL_PRESET_CODE_SUFFIX = "query_material"
MATERIAL_QUERY_FIELD_KEYS = (
    "FMATERIALID,FNumber,FName,FSpecification,"
    "FBaseUnitId.FNumber,FBaseUnitId.FName,"
    "FMaterialGroup.FNumber,FMaterialGroup.FName,"
    "FDocumentStatus,FForbidStatus"
)
MATERIAL_UNIT_NAME_MARKER = "FBaseUnitId.FName"

UNIT_PRESET_CODE_SUFFIX = "query_unit"
UNIT_QUERY_FIELD_KEYS = "FUNITID,FNumber,FName,FDocumentStatus,FForbidStatus"

MATERIAL_GROUP_PRESET_CODE_SUFFIX = "query_material_group"
# 分组树字段因金蝶版本差异大：勿默认带 FParentId.FNumber / 状态列，否则整次查询失败只回 1 条错误对象
MATERIAL_GROUP_QUERY_FIELD_KEYS = "FID,FNumber,FName"
# 分组主数据常见无「已审核」语义；仅排除禁用，避免 FilterString 把全部分组滤空
MATERIAL_GROUP_ACTIVE_FILTER = "FForbidStatus='A'"
MATERIAL_GROUP_ACTIVE_FILTER_MARKER = "FForbidStatus='A'"
MATERIAL_GROUP_FIELD_KEYS_MARKER = "FNumber,FName"

WAREHOUSE_PRESET_CODE_SUFFIX = "query_warehouse"
WAREHOUSE_QUERY_FIELD_KEYS = (
    "FStockId,FNumber,FName,FDocumentStatus,FForbidStatus"
)

# 客商主数据：仅同步已审核且未禁用（无效/草稿/禁用不进本地）
CUSTOMER_PRESET_CODE_SUFFIX = "query_customer"
CUSTOMER_QUERY_FIELD_KEYS = (
    "FCUSTID,FNumber,FName,FShortName,FDocumentStatus,FForbidStatus"
)
SUPPLIER_PRESET_CODE_SUFFIX = "query_supplier"
SUPPLIER_QUERY_FIELD_KEYS = (
    "FSupplierId,FNumber,FName,FShortName,FDocumentStatus,FForbidStatus"
)
MASTER_DATA_APPROVED_ACTIVE_FILTER = "FForbidStatus='A' AND FDocumentStatus='C'"
MASTER_DATA_APPROVED_STATUS_MARKER = "FDocumentStatus='C'"
BILL_OPEN_FILTER = "FDocumentStatus='C' AND FCloseStatus='A'"
BILL_OPEN_STATUS_MARKER = "FCloseStatus='A'"

PUR_PURCHASE_ORDER_LINE_FIELD_KEYS = (
    "FID,FBillNo,FDate,"
    "FSupplierId.FNumber,FSupplierId.FName,"
    "FPOOrderEntry_FEntryID,"
    "FMaterialId.FNumber,FMaterialId.FName,FMaterialId.FSpecification,"
    "FUnitId.FNumber,FQty,FPrice,FTaxPrice,FEntryTaxRate,"
    "FDeliveryDate,"
    "FDocumentStatus,FCloseStatus"
)
PURCHASE_ORDER_PRESET_CODE_SUFFIX = "query_purchase_order"
PURCHASE_ORDER_LINE_MARKER = "FPOOrderEntry_FEntryID"

PRD_MO_PRESET_CODE_SUFFIX = "query_prd_mo"
# FSaleOrderNo：销售订单号（金蝶生产订单常见关联字段）
PRD_MO_FIELD_KEYS = (
    "FID,FBillNo,"
    "FMaterialId.FNumber,FMaterialId.FName,"
    "FQty,FPlanStartDate,FPlanFinishDate,"
    "FSaleOrderNo,"
    "FDocumentStatus,FStatus,FCloseStatus"
)


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
            "request_body": build_material_query_preset_body(),
        },
        {
            "code_suffix": UNIT_PRESET_CODE_SUFFIX,
            "name": "金蝶查询计量单位",
            "description": "ExecuteBillQuery：计量单位（BD_UNIT）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_unit_query_preset_body(),
        },
        {
            "code_suffix": MATERIAL_GROUP_PRESET_CODE_SUFFIX,
            "name": "金蝶查询物料分组",
            "description": "ExecuteBillQuery：物料分组（BD_MATERIALGROUP）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_material_group_query_preset_body(),
        },
        {
            "code_suffix": CUSTOMER_PRESET_CODE_SUFFIX,
            "name": "金蝶查询客户",
            "description": "ExecuteBillQuery：客户（BD_Customer），仅已审核且未禁用",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_customer_query_preset_body(),
        },
        {
            "code_suffix": SUPPLIER_PRESET_CODE_SUFFIX,
            "name": "金蝶查询供应商",
            "description": "ExecuteBillQuery：供应商（BD_Supplier），仅已审核且未禁用",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_supplier_query_preset_body(),
        },
        {
            "code_suffix": WAREHOUSE_PRESET_CODE_SUFFIX,
            "name": "金蝶查询仓库",
            "description": "ExecuteBillQuery：仓库（BD_STOCK）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_warehouse_query_preset_body(),
        },
        {
            "code_suffix": PURCHASE_ORDER_PRESET_CODE_SUFFIX,
            "name": "金蝶查询采购订单",
            "description": "ExecuteBillQuery：采购订单（PUR_PurchaseOrder，含行明细）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_purchase_order_query_preset_body(),
        },
        {
            "code_suffix": PRD_MO_PRESET_CODE_SUFFIX,
            "name": "金蝶查询生产订单",
            "description": "ExecuteBillQuery：生产订单（PRD_MO）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_prd_mo_query_preset_body(),
        },
        {
            "code_suffix": SALES_ORDER_PRESET_CODE_SUFFIX,
            "name": "金蝶查询销售订单",
            "description": "ExecuteBillQuery：销售订单（SAL_SaleOrder，含行明细）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_sales_order_query_preset_body(),
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


def build_material_query_preset_body(
    *,
    filter_string: str = MASTER_DATA_APPROVED_ACTIVE_FILTER,
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="BD_MATERIAL",
        field_keys=MATERIAL_QUERY_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FNumber ASC",
        start_row=start_row,
        limit=limit,
    )


def build_unit_query_preset_body(
    *,
    filter_string: str = MASTER_DATA_APPROVED_ACTIVE_FILTER,
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="BD_UNIT",
        field_keys=UNIT_QUERY_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FNumber ASC",
        start_row=start_row,
        limit=limit,
    )


def build_material_group_query_preset_body(
    *,
    filter_string: str = MATERIAL_GROUP_ACTIVE_FILTER,
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="BD_MATERIALGROUP",
        field_keys=MATERIAL_GROUP_QUERY_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FNumber ASC",
        start_row=start_row,
        limit=limit,
    )


def build_sales_order_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C' AND FCloseStatus='A'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="SAL_SaleOrder",
        field_keys=SAL_SALE_ORDER_LINE_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )


def build_warehouse_query_preset_body(
    *,
    filter_string: str = MASTER_DATA_APPROVED_ACTIVE_FILTER,
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="BD_STOCK",
        field_keys=WAREHOUSE_QUERY_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FNumber ASC",
        start_row=start_row,
        limit=limit,
    )


def build_customer_query_preset_body(
    *,
    filter_string: str = MASTER_DATA_APPROVED_ACTIVE_FILTER,
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="BD_Customer",
        field_keys=CUSTOMER_QUERY_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FNumber ASC",
        start_row=start_row,
        limit=limit,
    )


def build_supplier_query_preset_body(
    *,
    filter_string: str = MASTER_DATA_APPROVED_ACTIVE_FILTER,
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="BD_Supplier",
        field_keys=SUPPLIER_QUERY_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FNumber ASC",
        start_row=start_row,
        limit=limit,
    )


def build_purchase_order_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C' AND FCloseStatus='A'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="PUR_PurchaseOrder",
        field_keys=PUR_PURCHASE_ORDER_LINE_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )


def build_prd_mo_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C' AND FCloseStatus='A'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="PRD_MO",
        field_keys=PRD_MO_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FPlanStartDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )


def _parse_execute_bill_query(request_body: Any) -> Optional[dict]:
    if not isinstance(request_body, dict):
        return None
    params = request_body.get("parameters")
    query: Any = None
    if isinstance(params, list) and params:
        first = params[0]
        if isinstance(first, str):
            try:
                query = json.loads(first)
            except json.JSONDecodeError:
                return None
        elif isinstance(first, dict):
            query = first
    elif isinstance(params, dict):
        query = params
    elif isinstance(params, str):
        try:
            query = json.loads(params)
        except json.JSONDecodeError:
            return None
    return query if isinstance(query, dict) else None


def material_preset_needs_upgrade(request_body: Any) -> bool:
    """旧预置缺单位字段，或未要求已审核有效时需升级。"""
    query = _parse_execute_bill_query(request_body)
    if query is None:
        return True
    field_keys = str(query.get("FieldKeys") or query.get("fieldKeys") or "")
    if MATERIAL_UNIT_NAME_MARKER not in field_keys:
        return True
    filter_string = str(query.get("FilterString") or query.get("filterString") or "")
    return MASTER_DATA_APPROVED_STATUS_MARKER not in filter_string.replace(" ", "")


def master_data_scope_preset_needs_upgrade(request_body: Any) -> bool:
    """主数据预置未含已审核过滤时需升级。"""
    query = _parse_execute_bill_query(request_body)
    if query is None:
        return True
    filter_string = str(query.get("FilterString") or query.get("filterString") or "")
    return MASTER_DATA_APPROVED_STATUS_MARKER not in filter_string.replace(" ", "")


def material_group_preset_needs_upgrade(request_body: Any) -> bool:
    """物料分组预置：旧版 FieldKeys 含父级/状态列或仍用审核过滤时需升级。"""
    query = _parse_execute_bill_query(request_body)
    if query is None:
        return True
    field_keys = str(query.get("FieldKeys") or query.get("fieldKeys") or "").replace(" ", "")
    upper_keys = field_keys.upper()
    if "PARENTID.FNUMBER" in upper_keys:
        return True
    if "FDOCUMENTSTATUS" in upper_keys or "FFORBIDSTATUS" in upper_keys:
        return True
    if "FNUMBER" not in upper_keys or "FNAME" not in upper_keys:
        return True
    filter_string = str(query.get("FilterString") or query.get("filterString") or "").replace(" ", "")
    if "FDocumentStatus" in filter_string:
        return True
    if MATERIAL_GROUP_ACTIVE_FILTER_MARKER.replace(" ", "") not in filter_string:
        return True
    return False


def customer_preset_needs_upgrade(request_body: Any) -> bool:
    """旧预置仅过滤未禁用、未要求已审核时需升级。"""
    return master_data_scope_preset_needs_upgrade(request_body)


def supplier_preset_needs_upgrade(request_body: Any) -> bool:
    """旧预置仅过滤未禁用、未要求已审核时需升级。"""
    return master_data_scope_preset_needs_upgrade(request_body)


def bill_open_preset_needs_upgrade(request_body: Any) -> bool:
    """业务单据预置未限制未完成（未关闭）时需升级。"""
    query = _parse_execute_bill_query(request_body)
    if query is None:
        return True
    filter_string = str(query.get("FilterString") or query.get("filterString") or "")
    return BILL_OPEN_STATUS_MARKER not in filter_string.replace(" ", "")


def sales_order_preset_needs_upgrade(request_body: Any) -> bool:
    """旧预置缺行字段或未限制未完成单据时需升级。"""
    query = _parse_execute_bill_query(request_body)
    if query is None:
        return True
    field_keys = str(query.get("FieldKeys") or query.get("fieldKeys") or "")
    if SALES_ORDER_LINE_MARKER not in field_keys:
        return True
    return bill_open_preset_needs_upgrade(request_body)


def purchase_order_preset_needs_upgrade(request_body: Any) -> bool:
    """旧预置缺行字段或未限制未完成单据时需升级。"""
    query = _parse_execute_bill_query(request_body)
    if query is None:
        return True
    field_keys = str(query.get("FieldKeys") or query.get("fieldKeys") or "")
    if PURCHASE_ORDER_LINE_MARKER not in field_keys:
        return True
    return bill_open_preset_needs_upgrade(request_body)


def resolve_preset_api_code(connection_code: str, code_suffix: str) -> str:
    """租户内唯一：连接器 code + 后缀，截断至 50 字符。"""
    base = str(connection_code or "kingdee").strip() or "kingdee"
    suffix = str(code_suffix or "").strip()
    raw = f"{base}_{suffix}" if suffix else base
    return raw[:50]
