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

from typing import Any, Dict, List, Optional, TypedDict

# 增强型 Token（固定路径，用于联调对照；日常同步由连接器自动带 token）
OAUTH_GET_TOKEN_PATH = "kapi/oauth2/getToken"

# 标品业务对象标识（与 OpenAPI 初始化后的 sys 路径一致）
BIZ_BD_MATERIAL = "bd_material"
# 多数租户 OpenAPI 未发布独立 bd_measureunits（调测 404）；单位同步用多计量单位
BIZ_BD_MEASUREUNITS = "bd_measureunits"
BIZ_BD_MULTIMEASUREUNIT = "bd_multimeasureunit"
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


WAREHOUSE_PRESET_CODE_SUFFIX = "query_warehouse"
MEASUREUNITS_PRESET_CODE_SUFFIX = "query_measureunits"
MATERIAL_PRESET_CODE_SUFFIX = "query_material"
MATERIAL_GROUP_PRESET_CODE_SUFFIX = "query_material_group"
# 单位同步只取物料编码/名称与基础单位，避免batchQuery默认吐全量列
UNIT_SYNC_MATERIAL_SELECT = "number,name,baseunit.number,baseunit.name"
# 物料同步：编码/名称/规格/基础单位/分组（字段以本环境模型为准，可微调）
MATERIAL_SYNC_SELECT = (
    "number,name,modelnum,baseunit.number,baseunit.name,group.number,group.name"
)
GOODS_CLASS_QUERY_PATH = "kapi/v2/gmc/mdr_goodsclass/getMalGoodsClass"


def build_warehouse_batch_query_preset_body() -> Dict[str, Any]:
    """仓库 batchQuery：createorg_number 必须放在 data 里。"""
    return {
        "data": {"createorg_number": "WANG"},
        "pageNo": 1,
        "pageSize": 1000,
    }


def warehouse_batch_query_preset_needs_upgrade(request_body: Any) -> bool:
    if not isinstance(request_body, dict):
        return True
    data = request_body.get("data")
    if not isinstance(data, dict):
        return True
    return not str(data.get("createorg_number") or data.get("createOrgNumber") or "").strip()


def _resolve_request_select(request_body: Any = None, request_params: Any = None) -> str:
    if isinstance(request_params, dict):
        raw = request_params.get("select")
        if raw not in (None, ""):
            return str(raw).strip()
    if isinstance(request_body, dict):
        raw = request_body.get("select")
        if raw not in (None, ""):
            return str(raw).strip()
        data = request_body.get("data")
        if isinstance(data, dict) and data.get("select") not in (None, ""):
            return str(data.get("select")).strip()
    return ""


def measureunits_preset_needs_upgrade(
    path: Any,
    request_body: Any = None,
    request_params: Any = None,
) -> bool:
    """
    旧预置常指向网关未挂通的单位对象，或未带精简 select，
    须升级为物料 batchQuery + 仅基础单位字段。
    """
    lower = str(path or "").lower().replace("\\", "/")
    if not lower:
        return True
    on_material = f"/{BIZ_BD_MATERIAL}/batchquery" in lower
    if not on_material:
        return True
    select = _resolve_request_select(request_body, request_params).lower().replace(" ", "")
    return "baseunit.number" not in select or "baseunit.name" not in select


def material_preset_needs_upgrade(
    path: Any,
    request_body: Any = None,
    request_params: Any = None,
) -> bool:
    """物料预置缺 select 或未带基础单位/分组字段时升级，便于同步映射自动对齐。"""
    lower = str(path or "").lower().replace("\\", "/")
    if f"/{BIZ_BD_MATERIAL}/batchquery" not in lower:
        return False
    select = _resolve_request_select(request_body, request_params).lower().replace(" ", "")
    if not select:
        return True
    return "baseunit.number" not in select or "baseunit.name" not in select


def build_material_batch_query_preset() -> KingdeeCosmicApiPreset:
    """物料同步：batchQuery + select，返回列可自动映射主编码/名称/单位/分组。"""
    return {
        "code_suffix": MATERIAL_PRESET_CODE_SUFFIX,
        "name": "苍穹查询物料",
        "description": (
            "基础资料物料批量查询 /v2/basedata/bd_material/batchQuery。"
            f"请求 select={MATERIAL_SYNC_SELECT}，便于同步自动映射："
            "主编码←number，名称←name，规格←modelnum，"
            "基础单位←baseunit.number/name，分组←group.number/name。"
            "字段名若与本环境模型不一致，请在接口管理中微调 select。"
        ),
        "path": f"kapi/v2/basedata/{BIZ_BD_MATERIAL}/batchQuery",
        "method": "POST",
        "request_params": {
            "select": MATERIAL_SYNC_SELECT,
        },
        "request_body": {
            "data": {},
            "pageNo": 1,
            "pageSize": 100,
            "select": MATERIAL_SYNC_SELECT,
        },
    }


def material_group_preset_needs_upgrade(path: Any) -> bool:
    """旧预置指向未发布的 bd_materialgroup 时，升级为 getMalGoodsClass。"""
    lower = str(path or "").lower().replace("\\", "/")
    if not lower:
        return True
    if "getmalgoodsclass" in lower or "mdr_goodsclass" in lower:
        return False
    return "bd_materialgroup" in lower or "materialgroup" in lower


def build_material_group_goods_class_preset() -> KingdeeCosmicApiPreset:
    """无独立 bd_materialgroup 时，用 GMC 商品分类拉分组树。"""
    return {
        "code_suffix": MATERIAL_GROUP_PRESET_CODE_SUFFIX,
        "name": "苍穹查询物料分组",
        "description": (
            "本环境常无 bd_materialgroup（OpenAPI 404）。"
            f"改用 GMC 商品分类 {GOODS_CLASS_QUERY_PATH}；"
            "pageSize 必填，筛选项与分页同级（勿包 data）。"
            "同步映射：编码←number，名称←name，父编码←parent_parent_number。"
        ),
        "path": GOODS_CLASS_QUERY_PATH,
        "method": "POST",
        "request_body": {
            "pageNo": 1,
            "pageSize": 100,
        },
    }


def build_measureunits_batch_query_preset() -> KingdeeCosmicApiPreset:
    """
    单位目录同步（苍穹）。

    现场网关常对独立计量单位 / 多计量单位返回「路由未找到」；
    物料 batchQuery 已探活。请求带 select，只拉编码/名称与基础单位。
    """
    return {
        "code_suffix": MEASUREUNITS_PRESET_CODE_SUFFIX,
        "name": "苍穹单位同步（从物料基础单位）",
        "description": (
            "本环境开放平台常未挂通 bd_measureunits / bd_multimeasureunit（网关 404）。"
            f"单位目录请用已探活的物料批量查询 /v2/basedata/{BIZ_BD_MATERIAL}/batchQuery，"
            f"请求 select={UNIT_SYNC_MATERIAL_SELECT}（只拉需要的列）。"
            "字段映射：编码←baseunit.number / baseunit_number，名称←baseunit.name / baseunit_name；"
            "按编码去重写入单位管理。"
        ),
        "path": f"kapi/v2/basedata/{BIZ_BD_MATERIAL}/batchQuery",
        "method": "POST",
        "request_params": {
            "select": UNIT_SYNC_MATERIAL_SELECT,
        },
        "request_body": {
            "data": {},
            "pageNo": 1,
            # 按物料翻页抽单位；单页太小且物料单位单一时，测试去重后会误以为「只有一个单位」
            "pageSize": 500,
            "select": UNIT_SYNC_MATERIAL_SELECT,
        },
    }


def _basedata_batch_query_preset(
    *,
    code_suffix: str,
    name: str,
    biz_object: str,
    usage: str,
    request_body: Optional[Dict[str, Any]] = None,
) -> KingdeeCosmicApiPreset:
    """与基础资料API服务中物料批量查询同一拼法：/v2/basedata/{对象}/batchQuery。"""
    body = request_body if isinstance(request_body, dict) else {
        "data": {},
        "pageNo": 1,
        "pageSize": 100,
    }
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
        "request_body": body,
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
        build_material_batch_query_preset(),
        build_measureunits_batch_query_preset(),
        build_material_group_goods_class_preset(),
        {
            # 与 query_material_group 同路径，便于在接口库按「商品分类」搜索
            **build_material_group_goods_class_preset(),
            "code_suffix": "query_goods_class",
            "name": "苍穹查询物料分类（商品分类）",
        },
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
        {
            **_basedata_batch_query_preset(
                code_suffix=WAREHOUSE_PRESET_CODE_SUFFIX,
                name="苍穹查询仓库",
                biz_object=BIZ_BD_WAREHOUSE,
                usage="仓库",
                request_body=build_warehouse_batch_query_preset_body(),
            ),
            "description": (
                "基础资料API服务里的仓库批量查询。"
                "请求地址 /v2/basedata/bd_warehouse/batchQuery。"
                "请求体为 data、pageNo、pageSize；"
                "金蝶要求把 createorg_number 放在 data 内，默认示例 WANG，可按本环境创建组织编码修改。"
            ),
        },
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
