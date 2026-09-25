"""
金蝶AI苍穹 OpenAPI（kingdee_cosmic）入站常用接口预设。

与金蝶AI星空 WebAPI（ExecuteBillQuery / .kdsvc）不同，标准业务对象查询为：
POST {门户}/kapi/sys/{业务对象标识}/query
（连接器 Base 已含 /ierp 时不要再在路径前加 ierp，否则会变成 /ierp/ierp/kapi 并被容器 404。）
查询参数：select（必填且不可为 *）、filter、orderby、page_no、page_size（可放在 URL 或请求体）。

依据：金蝶开放平台「操作 API / 业务对象 query」说明及标品基础资料、采购订单对象标识。
租户须先在「开放服务云 → OpenAPI」初始化并对第三方应用授权；若 select/filter 与现场字段不一致，请在接口管理中按本环境微调。
"""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict

# 增强型 Token（固定路径，用于联调对照；日常同步由连接器自动带 token）
OAUTH_GET_TOKEN_PATH = "kapi/oauth2/getToken"

# 标品业务对象标识（与 OpenAPI 初始化后的 sys 路径一致）
BIZ_BD_MATERIAL = "bd_material"
BIZ_BD_MEASUREUNITS = "bd_measureunits"
BIZ_BD_MATERIALGROUP = "bd_materialgroup"
BIZ_BD_SUPPLIER = "bd_supplier"
BIZ_BD_CUSTOMER = "bd_customer"
BIZ_BD_WAREHOUSE = "bd_warehouse"
BIZ_PM_PURORDERBILL = "pm_purorderbill"

# 入站同步常用过滤：已审核且启用（字段名因版本可能略有差异，可按现场调整）
MASTER_DATA_INBOUND_FILTER = "status EQ 'C' AND enable EQ 1"
PURORDER_INBOUND_FILTER = "billstatus EQ 'C'"


class KingdeeCosmicApiPreset(TypedDict, total=False):
    code_suffix: str
    name: str
    description: str
    path: str
    method: str
    request_body: Dict[str, Any]
    request_params: Dict[str, Any]


def _basedata_batch_query_preset(
    *,
    code_suffix: str,
    name: str,
    biz_object: str,
    usage: str,
) -> KingdeeCosmicApiPreset:
    """与基础资料API服务中物料批量查询同一拼法：/v2/basedata/{对象}/batchQuery。"""
    return {
        "code_suffix": code_suffix,
        "name": name,
        "description": (
            f"基础资料API服务里的{usage}批量查询。"
            f"请求地址 /v2/basedata/{biz_object}/batchQuery，"
            "请求体为 data、pageNo、pageSize。筛选字段放在 data 内。"
        ),
        "path": f"kapi/v2/basedata/{biz_object}/batchQuery",
        "method": "POST",
        "request_body": {
            "data": {},
            "pageNo": 1,
            "pageSize": 100,
        },
    }


def _sys_query_path(biz_object: str) -> str:
    return f"kapi/sys/{biz_object}/query"


def build_sys_query_params(
    *,
    select: str,
    filter_expr: str = "",
    page_no: int = 1,
    page_size: int = 500,
    orderby: str = "",
) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "select": select,
        "page_no": page_no,
        "page_size": page_size,
    }
    if filter_expr.strip():
        params["filter"] = filter_expr.strip()
    if orderby.strip():
        params["orderby"] = orderby.strip()
    return params


def build_get_token_preset_body() -> Dict[str, Any]:
    """与官方增强型 Token 请求体一致；联调时须换成连接器同款凭证。"""
    return {
        "client_id": "<系统编码 client_id>",
        "client_secret": "<AccessToken认证密钥>",
        "username": "<代理用户登录名>",
        "accountId": "<数据中心 accountId>",
        "language": "zh_CN",
        "nonce": "<10分钟内不重复的随机串>",
        "timestamp": "<YYYY-MM-DD HH:MM:SS，前后5分钟内>",
    }


def resolve_preset_api_code(connection_code: str, code_suffix: str) -> str:
    """租户内唯一：连接器 code + 后缀，截断至 50 字符。"""
    base = str(connection_code or "kingdee").strip() or "kingdee"
    suffix = str(code_suffix or "").strip()
    raw = f"{base}_{suffix}" if suffix else base
    return raw[:50]


def list_kingdee_cosmic_api_presets() -> List[KingdeeCosmicApiPreset]:
    """
    入站优先：主数据与采购订单查询。
    已精简：去掉占位符通用模板、令牌检测/撤回、文档演示接口（生产极少用）。
    """
    return [
        {
            "code_suffix": "oauth_get_token",
            "name": "苍穹获取access_token",
            "description": (
                "增强型 Token 联调接口，路径固定。"
                "日常业务调用无需单独测本条，连接器「测试连接」与接口测试会自动获取 token。"
            ),
            "path": OAUTH_GET_TOKEN_PATH,
            "method": "POST",
            "request_body": build_get_token_preset_body(),
        },
        {
            "code_suffix": "query_material",
            "name": "苍穹查询物料",
            "description": (
                "基础资料API服务里的物料批量查询。"
                "请求地址 /v2/basedata/bd_material/batchQuery，"
                "完整地址为门户域名/kapi 加上该请求地址。"
                "筛选放在请求体的 data 内，字段与开放平台该 API 的请求体一致；均为非必填。"
            ),
            "path": "kapi/v2/basedata/bd_material/batchQuery",
            "method": "POST",
            "request_body": {
                "data": {},
                "pageNo": 1,
                "pageSize": 100,
            },
        },
        _basedata_batch_query_preset(
            code_suffix="query_measureunits",
            name="苍穹查询计量单位",
            biz_object=BIZ_BD_MEASUREUNITS,
            usage="计量单位",
        ),
        _basedata_batch_query_preset(
            code_suffix="query_material_group",
            name="苍穹查询物料分组",
            biz_object=BIZ_BD_MATERIALGROUP,
            usage="物料分组",
        ),
        {
            "code_suffix": "query_supplier",
            "name": "苍穹查询供应商",
            "description": (
                "基础资料API服务里的查询供应商信息。"
                "请求方式 GET，地址 /v2/basedata/bd_supplier/query。"
                "Query 参数 number、createorg_number 为必填，示例值来自该 API 详情。"
            ),
            "path": "kapi/v2/basedata/bd_supplier/query",
            "method": "GET",
            "request_params": {
                "number": "9chu",
                "createorg_number": "WANG",
            },
            "request_body": {},
        },
        _basedata_batch_query_preset(
            code_suffix="query_customer",
            name="苍穹查询客户",
            biz_object=BIZ_BD_CUSTOMER,
            usage="客户",
        ),
        _basedata_batch_query_preset(
            code_suffix="query_warehouse",
            name="苍穹查询仓库",
            biz_object=BIZ_BD_WAREHOUSE,
            usage="仓库",
        ),
        {
            "code_suffix": "query_purchase_order",
            "name": "苍穹查询采购订单",
            "description": (
                f"业务对象 {BIZ_PM_PURORDERBILL} 分页查询（含分录字段时返回平铺行）。"
                f"默认 filter：{PURORDER_INBOUND_FILTER}（已审核）。"
                "select 含供应商与行物料、数量、单位；字段名请按本环境单据模型核对。"
            ),
            "path": _sys_query_path(BIZ_PM_PURORDERBILL),
            "method": "POST",
            "request_params": build_sys_query_params(
                select=(
                    "id,billno,billdate,supplier.number,supplier.name,"
                    "billentry.id,billentry.material.number,billentry.material.name,"
                    "billentry.qty,billentry.unit.number,billstatus,closestatus"
                ),
                filter_expr=PURORDER_INBOUND_FILTER,
                orderby="billdate desc",
                page_size=200,
            ),
            "request_body": {},
        },
    ]
