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


SAVE_PATH = "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Save.common.kdsvc"

SUBMIT_PATH = "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Submit.common.kdsvc"

AUDIT_PATH = "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Audit.common.kdsvc"

SAL_SALE_ORDER_FORM_ID = "SAL_SaleOrder"

SAL_SALE_ORDER_DEFAULT_BILL_TYPE = "XSDD01_SYS"

SAL_SALE_ORDER_SAVE_PRESET_CODE_SUFFIX = "save_sal_saleorder"

SAL_SALE_ORDER_PUSH_PRESET_CODE_SUFFIX = "push_sal_saleorder"

PUR_PURCHASE_ORDER_FORM_ID = "PUR_PurchaseOrder"

PUR_PURCHASE_ORDER_DEFAULT_BILL_TYPE = "CGDD01_SYS"

PUR_PURCHASE_ORDER_SAVE_PRESET_CODE_SUFFIX = "save_pur_purchaseorder"

PUR_PURCHASE_ORDER_PUSH_PRESET_CODE_SUFFIX = "push_pur_purchaseorder"

STK_MISCELLANEOUS_FORM_ID = "STK_MISCELLANEOUS"

STK_MISCELLANEOUS_DEFAULT_BILL_TYPE = "QTRKD01_SYS"

STK_MISCELLANEOUS_SAVE_PRESET_CODE_SUFFIX = "save_stk_miscellaneous"

STK_MISCELLANEOUS_PUSH_PRESET_CODE_SUFFIX = "push_stk_miscellaneous"

PRD_MO_FORM_ID = "PRD_MO"

PRD_MO_DEFAULT_BILL_TYPE = "SCDD01_SYS"

PRD_MO_SAVE_PRESET_CODE_SUFFIX = "save_prd_mo"

PRD_MO_PUSH_PRESET_CODE_SUFFIX = "push_prd_mo"

PRD_MO_SUBMIT_PRESET_CODE_SUFFIX = "submit_prd_mo"

PRD_MO_AUDIT_PRESET_CODE_SUFFIX = "audit_prd_mo"

PRD_MO_VIEW_PRESET_CODE_SUFFIX = "view_prd_mo"

PRD_MORPT_PRESET_CODE_SUFFIX = "query_prd_morpt"

PRD_MORPT_FIELD_KEYS = (
    "FID,FBillNo,FDate,"
    "FPrdOrgId.FNumber,FBillType.FNUMBER,"
    "FEntity_FEntryID,FMoBillNo,"
    "FMaterialId.FNumber,FMaterialId.FName,"
    "FReportType.FNumber,"
    "FFinishQty,FQuaQty,FFailQty,FHrWorkTime,FUnitID.FNumber,"
    "FDocumentStatus"
)

PRD_MORPT_FIELD_MARKER = "FQuaQty"

PRD_MORPT_STALE_FIELD_MARKERS = ("FStockOrgId", "FRealQty", "FProcessId")

PRD_REPORT_PRESET_CODE_SUFFIX = "query_prd_report"

PRD_REPORT_FIELD_KEYS = PRD_MORPT_FIELD_KEYS

PRD_MORPT_SAVE_PRESET_CODE_SUFFIX = "save_prd_morpt"

PRD_MORPT_SUBMIT_PRESET_CODE_SUFFIX = "submit_prd_morpt"

PRD_MORPT_AUDIT_PRESET_CODE_SUFFIX = "audit_prd_morpt"

PRD_MORPT_VIEW_PRESET_CODE_SUFFIX = "view_prd_morpt"

PRD_MORPT_FORM_ID = "PRD_MORPT"

PRD_MORPT_DEFAULT_BILL_TYPE = "SCHBD02_SYS"

PRD_MORPT_DEFAULT_REPORT_TYPE = "HBLX01_SYS"

PRD_PICK_MTRL_PRESET_CODE_SUFFIX = "query_prd_pick_mtrl"

PRD_PICK_MTRL_FIELD_KEYS = (
    "FID,FBillNo,FDate,"
    "FPrdOrgId.FNumber,FStockOrgId.FNumber,"
    "FEntity_FEntryID,FMoBillNo,"
    "FMaterialId.FNumber,FMaterialId.FName,FUnitID.FNumber,"
    "FActualQty,FStockId.FNumber,FLot.FNumber,"
    "FDocumentStatus"
)

PRD_RETURN_MTRL_PRESET_CODE_SUFFIX = "query_prd_return_mtrl"

PRD_RETURN_MTRL_FIELD_KEYS = (
    "FID,FBillNo,FDate,"
    "FPrdOrgId.FNumber,FStockOrgId.FNumber,"
    "FEntity_FEntryID,FMoBillNo,"
    "FMaterialId.FNumber,FMaterialId.FName,FUnitID.FNumber,"
    "FQty,FStockId.FNumber,FLot.FNumber,"
    "FDocumentStatus"
)

PRD_INSTOCK_PRESET_CODE_SUFFIX = "query_prd_instock"

PRD_INSTOCK_FIELD_KEYS = (
    "FID,FBillNo,FDate,"
    "FPrdOrgId.FNumber,FStockOrgId.FNumber,"
    "FEntity_FEntryID,FMoBillNo,"
    "FMaterialId.FNumber,FMaterialId.FName,FUnitID.FNumber,"
    "FRealQty,FStockId.FNumber,FLot.FNumber,"
    "FDocumentStatus"
)

def build_save_data_payload(
    *,
    model: Dict[str, Any],
    need_return_fields: Optional[List[str]] = None,
    need_update_fields: Optional[List[str]] = None,
    is_delete_entry: bool = True,
    is_verify_base_data_field: bool = False,
    is_entry_batch_fill: bool = True,
    validate_flag: bool = True,
    number_search: bool = True,
    is_auto_adjust_field: bool = False,
    interation_flags: str = "",
    ignore_interation_flag: bool = True,
    is_control_precision: bool = False,
    validate_repeat_json: bool = False,
    sub_system_id: str = "",
) -> Dict[str, Any]:
    """金蝶 DynamicFormService.Save 的 data 对象（与 WebAPI 控制台说明一致）。"""
    return {
        "NeedUpDateFields": need_update_fields or [],
        # 为空时金蝶可不回传单据号 → 业务侧表现为「同步未返回结果」
        "NeedReturnFields": need_return_fields or ["FID", "FBillNo"],
        "IsDeleteEntry": str(is_delete_entry).lower(),
        "SubSystemId": sub_system_id or "",
        "IsVerifyBaseDataField": str(is_verify_base_data_field).lower(),
        "IsEntryBatchFill": str(is_entry_batch_fill).lower(),
        "ValidateFlag": str(validate_flag).lower(),
        "NumberSearch": str(number_search).lower(),
        "IsAutoAdjustField": str(is_auto_adjust_field).lower(),
        "InterationFlags": interation_flags or "",
        "IgnoreInterationFlag": str(ignore_interation_flag).lower(),
        "IsControlPrecision": str(is_control_precision).lower(),
        "ValidateRepeatJson": str(validate_repeat_json).lower(),
        "Model": model,
    }

def build_save_body(*, form_id: str, model: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
    data = build_save_data_payload(model=model, **kwargs)
    return build_kdsvc_envelope([form_id, json.dumps(data, ensure_ascii=False)])

def build_operate_body(
    *,
    form_id: str,
    bill_id: str = "",
    bill_no: str = "",
    create_org_id: int = 0,
) -> Dict[str, Any]:
    """Submit / Audit 共用报文：优先 Ids，否则 Numbers。"""
    use_id = bool(str(bill_id or "").strip())
    data = {
        "CreateOrgId": int(create_org_id or 0),
        "Numbers": [] if use_id else ([str(bill_no)] if str(bill_no or "").strip() else [""]),
        "Ids": str(bill_id) if use_id else "",
    }
    return build_kdsvc_envelope([form_id, json.dumps(data, ensure_ascii=False)])

def build_prd_morpt_sample_model() -> Dict[str, Any]:
    """生产汇报单 Save 示例 Model（占位值，联调前请改成账套真实编码）。

    字段对齐金蝶 WebAPI 控制台「生产汇报单」说明必填项：
    FBillType / FPrdOrgId / FDate / FReportType / FTimeUnitId / FWorkshipId / FStandHourUnitId
    """
    return {
        "FID": 0,
        "FBillType": {"FNUMBER": PRD_MORPT_DEFAULT_BILL_TYPE},
        "FDate": "2026-01-01",
        "FPrdOrgId": {"FNumber": "100"},
        "FWorkshipIdH": {"FNumber": "BM000001"},
        "FDescription": "快格云报工推送示例",
        "FEntity": [
            {
                "FEntryID": 0,
                "FIsNew": "true",
                "FProductType": "1",
                "FMaterialId": {"FNumber": "CH4441"},
                "FReportType": {"FNumber": PRD_MORPT_DEFAULT_REPORT_TYPE},
                "FUnitID": {"FNumber": "Pcs"},
                "FWorkshipId": {"FNumber": "BM000001"},
                "FMoBillNo": "MO00000001",
                "FFinishQty": 1,
                "FQuaQty": 1,
                "FFailQty": 0,
                "FHrWorkTime": 0,
                "FTimeUnitId": "1",
                "FStandHourUnitId": "1",
                "FStockInOrgId": {"FNumber": "100"},
                "FSrcBillType": "PRD_MO",
                "FDescriptionE": "快格云报工推送示例明细",
            }
        ],
    }

def build_prd_morpt_save_preset_body() -> Dict[str, Any]:
    return build_save_body(
        form_id=PRD_MORPT_FORM_ID,
        model=build_prd_morpt_sample_model(),
        need_return_fields=["FID", "FBillNo"],
    )

def build_prd_morpt_submit_preset_body() -> Dict[str, Any]:
    return build_operate_body(form_id=PRD_MORPT_FORM_ID, bill_no="")

def build_prd_morpt_audit_preset_body() -> Dict[str, Any]:
    return build_operate_body(form_id=PRD_MORPT_FORM_ID, bill_no="")

def build_prd_morpt_view_preset_body() -> Dict[str, Any]:
    return build_view_body(form_id=PRD_MORPT_FORM_ID, number="")

def build_sal_sale_order_sample_model() -> Dict[str, Any]:
    return {
        "FID": 0,
        "FBillTypeID": {"FNUMBER": SAL_SALE_ORDER_DEFAULT_BILL_TYPE},
        "FDate": "2026-01-01",
        "FSaleOrgId": {"FNumber": "100"},
        "FCustId": {"FNumber": "CUST001"},
        "FNote": "快格云销售订单推送示例",
        "FSaleOrderEntry": [
            {
                "FEntryID": 0,
                "FMaterialId": {"FNumber": "CH4441"},
                "FUnitID": {"FNumber": "006"},
                "FQty": 1,
                "FPrice": 1,
                "FTaxPrice": 1,
                "FEntryTaxRate": 13,
                "FDeliveryDate": "2026-01-10",
            }
        ],
    }

def build_sal_sale_order_save_preset_body() -> Dict[str, Any]:
    return build_save_body(
        form_id=SAL_SALE_ORDER_FORM_ID,
        model=build_sal_sale_order_sample_model(),
        need_return_fields=["FID", "FBillNo"],
    )

def build_sal_sale_order_push_preset_body() -> Dict[str, Any]:
    return build_sal_sale_order_save_preset_body()

def build_pur_purchase_order_sample_model() -> Dict[str, Any]:
    return {
        "FID": 0,
        "FBillTypeID": {"FNUMBER": PUR_PURCHASE_ORDER_DEFAULT_BILL_TYPE},
        "FDate": "2026-01-01",
        "FPurchaseOrgId": {"FNumber": "100"},
        "FSupplierId": {"FNumber": "VEN001"},
        "FNote": "快格云采购订单推送示例",
        "FPOOrderEntry": [
            {
                "FEntryID": 0,
                "FMaterialId": {"FNumber": "CH4441"},
                "FUnitId": {"FNumber": "006"},
                "FQty": 1,
                "FPrice": 1,
                "FTaxPrice": 1,
                "FEntryTaxRate": 13,
                "FDeliveryDate": "2026-01-10",
            }
        ],
    }

def build_pur_purchase_order_save_preset_body() -> Dict[str, Any]:
    return build_save_body(
        form_id=PUR_PURCHASE_ORDER_FORM_ID,
        model=build_pur_purchase_order_sample_model(),
        need_return_fields=["FID", "FBillNo"],
    )

def build_pur_purchase_order_push_preset_body() -> Dict[str, Any]:
    return build_pur_purchase_order_save_preset_body()

def build_stk_miscellaneous_sample_model() -> Dict[str, Any]:
    return {
        "FID": 0,
        "FBillTypeID": {"FNUMBER": STK_MISCELLANEOUS_DEFAULT_BILL_TYPE},
        "FStockOrgId": {"FNumber": "100"},
        "FDate": "2026-01-01",
        "FOwnerTypeIdHead": "BD_OwnerOrg",
        "FOwnerIdHead": {"FNumber": "100"},
        "FNote": "快格云即时库存推送示例",
        "FEntity": [
            {
                "FEntryID": 0,
                "FMATERIALID": {"FNumber": "CH4441"},
                "FUnitID": {"FNumber": "006"},
                "FSTOCKID": {"FNumber": "CK001"},
                "FQty": 1,
                "FLot": {"FNumber": "LOT001"},
            }
        ],
    }

def build_stk_miscellaneous_save_preset_body() -> Dict[str, Any]:
    return build_save_body(
        form_id=STK_MISCELLANEOUS_FORM_ID,
        model=build_stk_miscellaneous_sample_model(),
        need_return_fields=["FID", "FBillNo"],
    )

def build_stk_miscellaneous_push_preset_body() -> Dict[str, Any]:
    return build_stk_miscellaneous_save_preset_body()

def build_prd_mo_sample_model() -> Dict[str, Any]:
    """生产订单 Save 示例 Model（占位值，联调前请改成账套真实编码）。"""
    return {
        "FID": 0,
        "FBillNo": "",
        "FBillType": {"FNUMBER": PRD_MO_DEFAULT_BILL_TYPE},
        "FDate": "2026-01-01",
        "FPrdOrgId": {"FNumber": "100"},
        "FOwnerTypeId": "BD_OwnerOrg",
        "FPPBOMType": "1",
        "FDescription": "快格云工单推送示例",
        "FTreeEntity": [
            {
                "FEntryID": 0,
                "FProductType": "1",
                "FMaterialId": {"FNumber": "CH4441"},
                "FUnitId": {"FNumber": "006"},
                "FBaseUnitId": {"FNumber": "006"},
                "FQty": 1,
                "FWorkShopID": {"FNumber": "BM000001"},
                "FPlanStartDate": "2026-01-01",
                "FPlanFinishDate": "2026-01-02",
                "FStockInOrgId": {"FNumber": "100"},
                "FCreateType": "1",
                "FReqType": "1",
                "FScheduleStatus": "1",
                "FFirstInspectStatus": "0",
                "FFirstQCControlType": "1",
            }
        ],
    }

def build_prd_mo_save_preset_body() -> Dict[str, Any]:
    return build_save_body(
        form_id=PRD_MO_FORM_ID,
        model=build_prd_mo_sample_model(),
        need_return_fields=["FID", "FBillNo"],
    )

def build_prd_mo_push_preset_body() -> Dict[str, Any]:
    """工单页「推送」专用：生产订单 Save 请求体（完整 JSON，可在接口管理编辑）。"""
    model = build_prd_mo_sample_model()
    model["FDescription"] = "快格云工单推送金蝶生产订单"
    return build_save_body(
        form_id=PRD_MO_FORM_ID,
        model=model,
        need_return_fields=["FID", "FBillNo"],
        # 推送场景默认校验基础资料，减少静默丢字段
        is_verify_base_data_field=True,
    )

def build_prd_mo_submit_preset_body() -> Dict[str, Any]:
    return build_operate_body(form_id=PRD_MO_FORM_ID, bill_no="")

def build_prd_mo_audit_preset_body() -> Dict[str, Any]:
    return build_operate_body(form_id=PRD_MO_FORM_ID, bill_no="")

def build_prd_mo_view_preset_body() -> Dict[str, Any]:
    return build_view_body(form_id=PRD_MO_FORM_ID, number="")

def build_prd_morpt_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="PRD_MORPT",
        field_keys=PRD_MORPT_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )

def build_prd_report_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="PRD_MORPT",
        field_keys=PRD_REPORT_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )

def build_prd_pick_mtrl_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="PRD_PickMtrl",
        field_keys=PRD_PICK_MTRL_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )

def build_prd_return_mtrl_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="PRD_ReturnMtrl",
        field_keys=PRD_RETURN_MTRL_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )

def build_prd_instock_query_preset_body(
    *,
    filter_string: str = "FDocumentStatus='C'",
    start_row: int = 0,
    limit: int = 2000,
) -> Dict[str, Any]:
    return build_execute_bill_query_body(
        form_id="PRD_INSTOCK",
        field_keys=PRD_INSTOCK_FIELD_KEYS,
        filter_string=filter_string,
        order_string="FDate DESC,FBillNo DESC",
        start_row=start_row,
        limit=limit,
    )

def prd_morpt_query_preset_needs_upgrade(request_body: Any) -> bool:
    """生产汇报查询预置仍含 FStockOrgId/FRealQty/FProcessId，或缺少 FQuaQty 时需升级。"""
    query = _parse_execute_bill_query(request_body)
    if query is None:
        return True
    field_keys = str(query.get("FieldKeys") or query.get("fieldKeys") or "")
    if PRD_MORPT_FIELD_MARKER not in field_keys:
        return True
    return any(marker in field_keys for marker in PRD_MORPT_STALE_FIELD_MARKERS)

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
            "code_suffix": PUR_PURCHASE_ORDER_SAVE_PRESET_CODE_SUFFIX,
            "name": "金蝶保存采购订单",
            "description": (
                "Save：采购订单（PUR_PurchaseOrder）。"
                "示例含单据类型/组织/供应商/物料行；联调前请改账套编码。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_pur_purchase_order_save_preset_body(),
        },
        {
            "code_suffix": PUR_PURCHASE_ORDER_PUSH_PRESET_CODE_SUFFIX,
            "name": "金蝶推送采购订单",
            "description": (
                "快格云采购订单 → 金蝶 PUR_PurchaseOrder 推送用 Save 接口。"
                "页面推送弹窗优先选用本接口。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_pur_purchase_order_push_preset_body(),
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
            "code_suffix": PRD_MO_SAVE_PRESET_CODE_SUFFIX,
            "name": "金蝶保存生产订单",
            "description": (
                "Save：生产订单（PRD_MO）。"
                "示例含必填 FBillType/FPrdOrgId/FDate/物料/数量/单位/计划日期；"
                "默认单据类型 SCDD01_SYS（汇报入库-普通生产）。联调前请改组织/物料/单位等编码。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_prd_mo_save_preset_body(),
        },
        {
            "code_suffix": PRD_MO_PUSH_PRESET_CODE_SUFFIX,
            "name": "金蝶推送生产订单",
            "description": (
                "快格云工单 → 金蝶生产订单（PRD_MO）推送用 Save 接口。"
                "与「金蝶保存生产订单」同路径；页面推送弹窗优先选用本接口。"
                "联调前请按账套改组织/车间/物料/单位等编码。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_prd_mo_push_preset_body(),
        },
        {
            "code_suffix": PRD_MO_SUBMIT_PRESET_CODE_SUFFIX,
            "name": "金蝶提交生产订单",
            "description": "Submit：生产订单（PRD_MO）",
            "path": SUBMIT_PATH,
            "method": "POST",
            "request_body": build_prd_mo_submit_preset_body(),
        },
        {
            "code_suffix": PRD_MO_AUDIT_PRESET_CODE_SUFFIX,
            "name": "金蝶审核生产订单",
            "description": "Audit：生产订单（PRD_MO）",
            "path": AUDIT_PATH,
            "method": "POST",
            "request_body": build_prd_mo_audit_preset_body(),
        },
        {
            "code_suffix": PRD_MO_VIEW_PRESET_CODE_SUFFIX,
            "name": "金蝶查看生产订单",
            "description": "View：生产订单（PRD_MO）",
            "path": VIEW_PATH,
            "method": "POST",
            "request_body": build_prd_mo_view_preset_body(),
        },
        {
            "code_suffix": PRD_MORPT_PRESET_CODE_SUFFIX,
            "name": "金蝶查询生产汇报单",
            "description": "ExecuteBillQuery：生产汇报单（PRD_MORPT）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_prd_morpt_query_preset_body(),
        },
        {
            "code_suffix": PRD_REPORT_PRESET_CODE_SUFFIX,
            "name": "金蝶查询生产汇报/报工",
            "description": "ExecuteBillQuery：生产汇报/报工（PRD_MORPT），用于报工同步场景",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_prd_report_query_preset_body(),
        },
        {
            "code_suffix": PRD_MORPT_SAVE_PRESET_CODE_SUFFIX,
            "name": "金蝶保存生产汇报单",
            "description": (
                "Save：生产汇报单（PRD_MORPT）。"
                "示例含必填 FBillType/FPrdOrgId/FReportType/FWorkshipId/FTimeUnitId；"
                "联调前请改组织/车间/物料/生产订单等编码。NeedReturnFields 默认 FID+FBillNo。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_prd_morpt_save_preset_body(),
        },
        {
            "code_suffix": PRD_MORPT_SUBMIT_PRESET_CODE_SUFFIX,
            "name": "金蝶提交生产汇报单",
            "description": "Submit：生产汇报单（PRD_MORPT）。保存成功后按单号或内码提交；请填 Numbers 或 Ids。",
            "path": SUBMIT_PATH,
            "method": "POST",
            "request_body": build_prd_morpt_submit_preset_body(),
        },
        {
            "code_suffix": PRD_MORPT_AUDIT_PRESET_CODE_SUFFIX,
            "name": "金蝶审核生产汇报单",
            "description": "Audit：生产汇报单（PRD_MORPT）。提交成功后按单号或内码审核；请填 Numbers 或 Ids。",
            "path": AUDIT_PATH,
            "method": "POST",
            "request_body": build_prd_morpt_audit_preset_body(),
        },
        {
            "code_suffix": PRD_MORPT_VIEW_PRESET_CODE_SUFFIX,
            "name": "金蝶查看生产汇报单",
            "description": "View：生产汇报单（PRD_MORPT）。按单据编号查看详情。",
            "path": VIEW_PATH,
            "method": "POST",
            "request_body": build_prd_morpt_view_preset_body(),
        },
        {
            "code_suffix": PRD_PICK_MTRL_PRESET_CODE_SUFFIX,
            "name": "金蝶查询生产领料单",
            "description": "ExecuteBillQuery：生产领料单（PRD_PickMtrl）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_prd_pick_mtrl_query_preset_body(),
        },
        {
            "code_suffix": PRD_RETURN_MTRL_PRESET_CODE_SUFFIX,
            "name": "金蝶查询生产退料单",
            "description": "ExecuteBillQuery：生产退料单（PRD_ReturnMtrl）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_prd_return_mtrl_query_preset_body(),
        },
        {
            "code_suffix": PRD_INSTOCK_PRESET_CODE_SUFFIX,
            "name": "金蝶查询生产入库单",
            "description": "ExecuteBillQuery：生产入库单（PRD_INSTOCK）",
            "path": EXECUTE_BILL_QUERY_PATH,
            "method": "POST",
            "request_body": build_prd_instock_query_preset_body(),
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
            "code_suffix": SAL_SALE_ORDER_SAVE_PRESET_CODE_SUFFIX,
            "name": "金蝶保存销售订单",
            "description": (
                "Save：销售订单（SAL_SaleOrder）。"
                "示例含单据类型/组织/客户/物料行；联调前请改账套编码。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_sal_sale_order_save_preset_body(),
        },
        {
            "code_suffix": SAL_SALE_ORDER_PUSH_PRESET_CODE_SUFFIX,
            "name": "金蝶推送销售订单",
            "description": (
                "快格云销售订单 → 金蝶 SAL_SaleOrder 推送用 Save 接口。"
                "页面推送弹窗优先选用本接口。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_sal_sale_order_push_preset_body(),
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
            "code_suffix": STK_MISCELLANEOUS_SAVE_PRESET_CODE_SUFFIX,
            "name": "金蝶保存其他入库单",
            "description": (
                "Save：其他入库单（STK_MISCELLANEOUS）。"
                "STK_Inventory 多为查询态不可 Save；即时库存回写请用本单据。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_stk_miscellaneous_save_preset_body(),
        },
        {
            "code_suffix": STK_MISCELLANEOUS_PUSH_PRESET_CODE_SUFFIX,
            "name": "金蝶推送其他入库单",
            "description": (
                "快格云物料批次 → 金蝶 STK_MISCELLANEOUS 推送用 Save 接口。"
                "页面推送弹窗优先选用本接口。"
            ),
            "path": SAVE_PATH,
            "method": "POST",
            "request_body": build_stk_miscellaneous_push_preset_body(),
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
