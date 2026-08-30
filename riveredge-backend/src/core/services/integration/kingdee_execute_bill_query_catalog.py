"""
金蝶 ExecuteBillQuery 常用 FormId 与可选字段目录（编辑弹窗字段勾选）。

字段编码来自金蝶 WebAPI 文档与常用预设；可按 FormId 扩展。
"""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class KingdeeFieldOption(TypedDict):
    key: str
    label: str


class KingdeeFormCatalogEntry(TypedDict):
    form_id: str
    name: str
    default_field_keys: List[str]
    fields: List[KingdeeFieldOption]


def _fields(*pairs: tuple[str, str]) -> List[KingdeeFieldOption]:
    return [{"key": key, "label": label} for key, label in pairs]


_KINGDEE_EXECUTE_BILL_QUERY_CATALOG: List[KingdeeFormCatalogEntry] = [
    {
        "form_id": "BD_MATERIAL",
        "name": "物料",
        "default_field_keys": [
            "FMATERIALID",
            "FNumber",
            "FName",
            "FSpecification",
            "FBaseUnitId.FNumber",
            "FBaseUnitId.FName",
            "FMaterialGroup.FNumber",
            "FMaterialGroup.FName",
            "FDocumentStatus",
            "FForbidStatus",
        ],
        "fields": _fields(
            ("FMATERIALID", "物料内码"),
            ("FNumber", "物料编码"),
            ("FName", "物料名称"),
            ("FSpecification", "规格型号"),
            ("FBaseUnitId.FNumber", "基本单位编码"),
            ("FBaseUnitId.FName", "基本单位名称"),
            ("FMaterialGroup.FNumber", "物料分组编码"),
            ("FMaterialGroup.FName", "物料分组名称"),
            ("FDocumentStatus", "单据状态"),
            ("FForbidStatus", "禁用状态"),
            ("FCreateDate", "创建日期"),
            ("FModifyDate", "修改日期"),
        ),
    },
    {
        "form_id": "BD_UNIT",
        "name": "计量单位",
        "default_field_keys": [
            "FUNITID",
            "FNumber",
            "FName",
            "FDocumentStatus",
            "FForbidStatus",
        ],
        "fields": _fields(
            ("FUNITID", "单位内码"),
            ("FNumber", "单位编码"),
            ("FName", "单位名称"),
            ("FDocumentStatus", "单据状态"),
            ("FForbidStatus", "禁用状态"),
        ),
    },
    {
        "form_id": "BD_MATERIALGROUP",
        "name": "物料分组",
        "default_field_keys": [
            "FID",
            "FNumber",
            "FName",
        ],
        "fields": _fields(
            ("FID", "分组内码"),
            ("FNumber", "分组编码"),
            ("FName", "分组名称"),
            ("FParentId.FNumber", "父分组编码（部分账套可用，勿作默认必选）"),
            ("FDocumentStatus", "单据状态"),
            ("FForbidStatus", "禁用状态"),
        ),
    },
    {
        "form_id": "BD_Customer",
        "name": "客户",
        "default_field_keys": [
            "FCUSTID",
            "FNumber",
            "FName",
            "FShortName",
            "FDocumentStatus",
            "FForbidStatus",
        ],
        "fields": _fields(
            ("FCUSTID", "客户内码"),
            ("FNumber", "客户编码"),
            ("FName", "客户名称"),
            ("FShortName", "简称"),
            ("FDocumentStatus", "单据状态"),
            ("FForbidStatus", "禁用状态"),
        ),
    },
    {
        "form_id": "BD_Supplier",
        "name": "供应商",
        "default_field_keys": [
            "FSupplierId",
            "FNumber",
            "FName",
            "FShortName",
            "FDocumentStatus",
            "FForbidStatus",
        ],
        "fields": _fields(
            ("FSupplierId", "供应商内码"),
            ("FNumber", "供应商编码"),
            ("FName", "供应商名称"),
            ("FShortName", "简称"),
            ("FDocumentStatus", "单据状态"),
            ("FForbidStatus", "禁用状态"),
        ),
    },
    {
        "form_id": "BD_STOCK",
        "name": "仓库",
        "default_field_keys": [
            "FStockId",
            "FNumber",
            "FName",
            "FDocumentStatus",
            "FForbidStatus",
        ],
        "fields": _fields(
            ("FStockId", "仓库内码"),
            ("FNumber", "仓库编码"),
            ("FName", "仓库名称"),
            ("FDocumentStatus", "单据状态"),
            ("FForbidStatus", "禁用状态"),
        ),
    },
    {
        "form_id": "PUR_PurchaseOrder",
        "name": "采购订单",
        "default_field_keys": [
            "FID",
            "FBillNo",
            "FDate",
            "FSupplierId.FNumber",
            "FSupplierId.FName",
            "FPOOrderEntry_FEntryID",
            "FMaterialId.FNumber",
            "FMaterialId.FName",
            "FMaterialId.FSpecification",
            "FUnitId.FNumber",
            "FQty",
            "FPrice",
            "FTaxPrice",
            "FEntryTaxRate",
            "FDeliveryDate",
            "FDocumentStatus",
            "FCloseStatus",
        ],
        "fields": _fields(
            ("FID", "单据内码"),
            ("FBillNo", "单据编号"),
            ("FDate", "单据日期"),
            ("FSupplierId.FNumber", "供应商编码"),
            ("FSupplierId.FName", "供应商名称"),
            ("FPOOrderEntry_FEntryID", "分录内码"),
            ("FMaterialId.FNumber", "物料编码"),
            ("FMaterialId.FName", "物料名称"),
            ("FMaterialId.FSpecification", "规格型号"),
            ("FUnitId.FNumber", "单位编码"),
            ("FQty", "采购数量"),
            ("FPrice", "单价"),
            ("FTaxPrice", "含税单价"),
            ("FEntryTaxRate", "税率"),
            ("FDeliveryDate", "交货日期"),
            ("FDocumentStatus", "单据状态"),
            ("FCloseStatus", "关闭状态"),
        ),
    },
    {
        "form_id": "PRD_MO",
        "name": "生产订单",
        "default_field_keys": [
            "FID",
            "FBillNo",
            "FMaterialId.FNumber",
            "FMaterialId.FName",
            "FQty",
            "FPlanStartDate",
            "FPlanFinishDate",
            "FSaleOrderNo",
            "FDocumentStatus",
            "FStatus",
            "FCloseStatus",
        ],
        "fields": _fields(
            ("FID", "单据内码"),
            ("FBillNo", "单据编号"),
            ("FMaterialId.FNumber", "物料编码"),
            ("FMaterialId.FName", "物料名称"),
            ("FQty", "生产数量"),
            ("FPlanStartDate", "计划开工日期"),
            ("FPlanFinishDate", "计划完工日期"),
            ("FSaleOrderNo", "销售订单号"),
            ("FDocumentStatus", "单据状态"),
            ("FStatus", "业务状态"),
            ("FCloseStatus", "关闭状态"),
        ),
    },
    {
        "form_id": "SAL_SaleOrder",
        "name": "销售订单",
        "default_field_keys": [
            "FID",
            "FBillNo",
            "FDate",
            "FCustId.FNumber",
            "FCustId.FName",
            "FSaleOrderEntry_FEntryID",
            "FMaterialId.FNumber",
            "FMaterialId.FName",
            "FMaterialId.FSpecification",
            "FUnitId.FNumber",
            "FQty",
            "FPrice",
            "FTaxPrice",
            "FEntryTaxRate",
            "FDeliveryDate",
            "FDocumentStatus",
            "FCloseStatus",
        ],
        "fields": _fields(
            ("FID", "单据内码"),
            ("FBillNo", "单据编号"),
            ("FDate", "单据日期"),
            ("FCustId.FNumber", "客户编码"),
            ("FCustId.FName", "客户名称"),
            ("FSaleOrderEntry_FEntryID", "分录内码"),
            ("FMaterialId.FNumber", "物料编码"),
            ("FMaterialId.FName", "物料名称"),
            ("FMaterialId.FSpecification", "规格型号"),
            ("FUnitId.FNumber", "单位编码"),
            ("FQty", "销售数量"),
            ("FPrice", "单价"),
            ("FTaxPrice", "含税单价"),
            ("FEntryTaxRate", "税率"),
            ("FDeliveryDate", "交货日期"),
            ("FDocumentStatus", "单据状态"),
            ("FCloseStatus", "关闭状态"),
        ),
    },
    {
        "form_id": "STK_Inventory",
        "name": "即时库存",
        "default_field_keys": [
            "FMaterialId.FNumber",
            "FMaterialName",
            "FStockId.FNumber",
            "FStockName",
            "FLot.FNumber",
            "FBaseQty",
            "FStockStatusId.FNumber",
        ],
        "fields": _fields(
            ("FMaterialId.FNumber", "物料编码"),
            ("FMaterialName", "物料名称"),
            ("FStockId.FNumber", "仓库编码"),
            ("FStockName", "仓库名称"),
            ("FLot.FNumber", "批号"),
            ("FBaseQty", "库存量(基本单位)"),
            ("FStockStatusId.FNumber", "库存状态"),
            ("FMaterialId.FSpecification", "规格型号"),
            ("FStockUnitId.FNumber", "库存单位编码"),
            ("FQty", "库存量"),
            ("FAVBQty", "可用量"),
            ("FProduceDate", "生产日期"),
            ("FExpiryDate", "有效期至"),
        ),
    },
]

_CATALOG_BY_FORM_ID: Dict[str, KingdeeFormCatalogEntry] = {
    item["form_id"]: item for item in _KINGDEE_EXECUTE_BILL_QUERY_CATALOG
}


def list_kingdee_execute_bill_query_catalog() -> List[Dict[str, Any]]:
    """返回全部 FormId 目录（含字段列表）。"""
    return [
        {
            "form_id": item["form_id"],
            "name": item["name"],
            "default_field_keys": list(item["default_field_keys"]),
            "fields": list(item["fields"]),
        }
        for item in _KINGDEE_EXECUTE_BILL_QUERY_CATALOG
    ]


def get_kingdee_form_catalog(form_id: str) -> KingdeeFormCatalogEntry | None:
    return _CATALOG_BY_FORM_ID.get(str(form_id or "").strip())
