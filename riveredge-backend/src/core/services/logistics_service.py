"""
物流查询服务

凭证来自应用连接器：
- type=aliyun_market / tencent_market 且 scene=express_query
- type=kuaidi100（企业实时查询）
- type=kdniao（快递鸟即时查询 1002）

同时启用时只走最近更新的那一条；查询失败不改去另一家。
未配置或查询失败须明确报错，禁止 mock / 环境变量旁路。
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from core.config.cloud_market_spec import (
    CLOUD_MARKET_CONNECTOR_TYPE_SET,
    CLOUD_MARKET_SCENE_EXPRESS_QUERY,
)
from core.models.integration_config import IntegrationConfig
from core.services.cloud_market_service import (
    call_cloud_market,
    is_cloud_market_auth_failure,
    resolve_cloud_market_app_code,
    resolve_cloud_market_method,
    resolve_cloud_market_query_url,
    resolve_cloud_market_scene,
)
from core.utils.timezone_utils import coerce_business_datetime_to_utc, to_api_isoformat
from infra.exceptions.exceptions import ValidationError

KUAIDI100_QUERY_URL = "https://poll.kuaidi100.com/poll/query.do"
KUAIDI100_AUTONUMBER_URL = "https://www.kuaidi100.com/autonumber/auto"
KDNIAO_QUERY_URL = "https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx"
LOGISTICS_DEDICATED_TYPES = ("kuaidi100", "kdniao")
LOGISTICS_CONNECTOR_TYPES = LOGISTICS_DEDICATED_TYPES + tuple(CLOUD_MARKET_CONNECTOR_TYPE_SET)

# 承运商编码/名称 → 快递100 com（小写）
_CARRIER_TO_COM: Dict[str, str] = {
    "shunfeng": "shunfeng",
    "sf": "shunfeng",
    "sfexpress": "shunfeng",
    "顺丰": "shunfeng",
    "顺丰速运": "shunfeng",
    "zhongtong": "zhongtong",
    "zt": "zhongtong",
    "zto": "zhongtong",
    "中通": "zhongtong",
    "中通快递": "zhongtong",
    "yuantong": "yuantong",
    "yt": "yuantong",
    "yto": "yuantong",
    "圆通": "yuantong",
    "圆通速递": "yuantong",
    "yunda": "yunda",
    "yd": "yunda",
    "韵达": "yunda",
    "韵达快递": "yunda",
    "shentong": "shentong",
    "st": "shentong",
    "sto": "shentong",
    "申通": "shentong",
    "申通快递": "shentong",
    "jtexpress": "jtexpress",
    "jt": "jtexpress",
    "jitu": "jtexpress",
    "极兔": "jtexpress",
    "极兔速递": "jtexpress",
    "jd": "jd",
    "jdwy": "jd",
    "jingdong": "jd",
    "京东": "jd",
    "京东物流": "jd",
    "ems": "ems",
    "邮政": "ems",
    "邮政快递": "ems",
    "youzhengguonei": "youzhengguonei",
    "中国邮政": "youzhengguonei",
    "debangwuliu": "debangwuliu",
    "db": "debangwuliu",
    "dbl": "debangwuliu",
    "德邦": "debangwuliu",
    "德邦快递": "debangwuliu",
    "huitongkuaidi": "huitongkuaidi",
    "best": "huitongkuaidi",
    "百世": "huitongkuaidi",
    "百世快递": "huitongkuaidi",
    "tiantian": "tiantian",
    "天天": "tiantian",
    "天天快递": "tiantian",
    "danniao": "danniao",
    "丹鸟": "danniao",
    "suning": "suning",
    "苏宁": "suning",
    "苏宁物流": "suning",
    "annengwuliu": "annengwuliu",
    "ane": "annengwuliu",
    "安能": "annengwuliu",
    "kuayue": "kuayue",
    "跨越": "kuayue",
    "跨越速运": "kuayue",
    "zhongyouex": "zhongyouex",
    "中邮": "zhongyouex",
    "中邮快递": "zhongyouex",
}

_STATE_LABELS: Dict[str, str] = {
    "0": "在途",
    "1": "揽收",
    "2": "疑难",
    "3": "已签收",
    "4": "退签",
    "5": "派件",
    "6": "退回",
    "7": "转投",
    "8": "清关",
    "14": "拒签",
}

_AUTH_FAIL_CODES = frozenset({"403", "503", "601", "5001", "4001"})
_PHONE_REQUIRED_COMS = frozenset({"shunfeng", "fengwang", "zhongtong"})
_KUAIDI100_TO_KDNIAO: Dict[str, str] = {
    "shunfeng": "SF",
    "zhongtong": "ZTO",
    "yuantong": "YTO",
    "yunda": "YD",
    "shentong": "STO",
    "jtexpress": "JTSD",
    "jd": "JD",
    "ems": "EMS",
    "youzhengguonei": "YZPY",
    "debangwuliu": "DBL",
    "huitongkuaidi": "HTKY",
    "tiantian": "HHTT",
    "danniao": "DNWL",
    "suning": "SNWL",
    "annengwuliu": "ANE",
    "kuayue": "KYSY",
    "zhongyouex": "ZYEX",
}
_KDNIAO_SHIPPER_CODES = frozenset(_KUAIDI100_TO_KDNIAO.values())
_KDNIAO_PHONE_REQUIRED = frozenset({"SF", "ZTO"})
_KDNIAO_STATE_LABELS: Dict[str, str] = {
    "0": "无轨迹",
    "1": "已揽收",
    "2": "在途",
    "3": "已签收",
    "4": "问题件",
}


def _norm_carrier_key(value: str) -> str:
    return re.sub(r"[\s_\-]+", "", (value or "").strip().lower())


def resolve_kuaidi100_com(carrier: str) -> Optional[str]:
    raw = (carrier or "").strip()
    if not raw:
        return None
    lowered = raw.lower()
    if lowered in _CARRIER_TO_COM:
        return _CARRIER_TO_COM[lowered]
    compact = _norm_carrier_key(raw)
    if compact in _CARRIER_TO_COM:
        return _CARRIER_TO_COM[compact]
    # 已是快递100 编码
    if re.fullmatch(r"[a-z][a-z0-9]{1,30}", lowered):
        return lowered
    return None


def resolve_kdniao_shipper(carrier: str) -> Optional[str]:
    raw = (carrier or "").strip()
    if not raw:
        return None
    upper = raw.upper()
    if upper in _KDNIAO_SHIPPER_CODES:
        return upper
    com = resolve_kuaidi100_com(raw)
    if com and com in _KUAIDI100_TO_KDNIAO:
        return _KUAIDI100_TO_KDNIAO[com]
    return None


def _payload_code(payload: Dict[str, Any]) -> str:
    return str(payload.get("returnCode") or payload.get("status") or "").strip()


def _is_auth_failure(payload: Dict[str, Any]) -> bool:
    code = _payload_code(payload)
    if code in _AUTH_FAIL_CODES:
        return True
    message = str(payload.get("message") or "")
    return any(token in message for token in ("签名失败", "key已过期", "无效的key", "授权码", "没有可用单量"))


def _format_event_time(raw: Any) -> Optional[str]:
    if isinstance(raw, (int, float)) and not isinstance(raw, bool) and raw > 0:
        seconds = float(raw) / 1000.0 if raw >= 1e11 else float(raw)
        return to_api_isoformat(datetime.fromtimestamp(seconds, tz=timezone.utc))
    text = str(raw or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        utc = coerce_business_datetime_to_utc(parsed)
        return to_api_isoformat(utc)
    return text


def _sign_query(param: str, api_key: str, customer: str) -> str:
    raw = f"{param}{api_key}{customer}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest().upper()


def _is_logistics_connector(row: IntegrationConfig) -> bool:
    if row.type in LOGISTICS_DEDICATED_TYPES:
        return True
    if row.type not in CLOUD_MARKET_CONNECTOR_TYPE_SET:
        return False
    cfg = row.config if isinstance(row.config, dict) else {}
    return str(cfg.get("scene") or "").strip() == CLOUD_MARKET_SCENE_EXPRESS_QUERY


async def resolve_tenant_logistics_connector(tenant_id: int) -> IntegrationConfig:
    rows = (
        await IntegrationConfig.filter(
            tenant_id=tenant_id,
            type__in=list(LOGISTICS_CONNECTOR_TYPES),
            is_active=True,
            deleted_at__isnull=True,
        )
        .order_by("-updated_at")
        .all()
    )
    for row in rows:
        if _is_logistics_connector(row):
            return row
    raise ValidationError(
        "未配置快递查询。请在系统管理「应用连接器」启用快递查询，或将云市场连接器场景设为快递轨迹查询"
    )


async def _autonumber_com(api_key: str, tracking_number: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                KUAIDI100_AUTONUMBER_URL,
                params={"num": tracking_number, "key": api_key},
            )
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:
        logger.warning("快递100 智能识别失败 num={} err={}", tracking_number, exc)
        return None
    if not isinstance(payload, list) or not payload:
        return None
    first = payload[0] if isinstance(payload[0], dict) else {}
    com = str(first.get("comCode") or first.get("com") or "").strip().lower()
    return com or None


async def _query_kuaidi100(
    *,
    customer: str,
    api_key: str,
    com: str,
    tracking_number: str,
    phone: str = "",
) -> Dict[str, Any]:
    param_obj: Dict[str, Any] = {
        "com": com,
        "num": tracking_number,
        "resultv2": "1",
        "show": "0",
        "order": "desc",
    }
    if phone:
        param_obj["phone"] = phone
    param = json.dumps(param_obj, ensure_ascii=False, separators=(",", ":"))
    form = {
        "customer": customer,
        "sign": _sign_query(param, api_key, customer),
        "param": param,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                KUAIDI100_QUERY_URL,
                data=form,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("快递100 查询请求失败 num={} err={}", tracking_number, exc)
        raise ValidationError("快递100 查询请求失败，请检查网络后重试") from exc
    if not isinstance(payload, dict):
        raise ValidationError("快递100 返回格式无效")
    return payload


def _kdniao_sign(request_data: str, api_key: str) -> str:
    md5_hex = hashlib.md5((request_data + api_key).encode("utf-8")).hexdigest()
    return base64.b64encode(md5_hex.encode("utf-8")).decode("ascii")


async def _query_kdniao(
    *,
    ebusiness_id: str,
    api_key: str,
    shipper: str,
    tracking_number: str,
    phone: str = "",
) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "OrderCode": "",
        "ShipperCode": shipper,
        "LogisticCode": tracking_number,
    }
    if phone:
        body["CustomerName"] = phone[-4:]
    request_data = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    form = {
        "EBusinessID": ebusiness_id,
        "RequestType": "1002",
        "RequestData": request_data,
        "DataSign": _kdniao_sign(request_data, api_key),
        "DataType": "2",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                KDNIAO_QUERY_URL,
                data=form,
                headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"},
            )
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("快递鸟 查询请求失败 num={} err={}", tracking_number, exc)
        raise ValidationError("快递鸟 查询请求失败，请检查网络后重试") from exc
    if not isinstance(payload, dict):
        raise ValidationError("快递鸟 返回格式无效")
    return payload


async def _query_cloud_market_express(
    config: Dict[str, Any],
    tracking_number: str,
    phone: str,
) -> Dict[str, Any]:
    resolve_cloud_market_scene(config)
    fields: Dict[str, str] = {"expressNo": tracking_number}
    if phone:
        fields["mobile"] = phone
    return await call_cloud_market(
        query_url=resolve_cloud_market_query_url(config),
        app_code=resolve_cloud_market_app_code(config),
        method=resolve_cloud_market_method(config),
        fields=fields,
    )


def _map_cloud_market_express_events(rows: List[Any]) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        description = str(row.get("desc") or "").strip()
        events.append(
            {
                "time": _format_event_time(row.get("time")),
                "status": str(row.get("logisticsStatus") or "").strip() or None,
                "description": description or None,
                "location": str(row.get("areaName") or "").strip() or None,
            }
        )
    events.reverse()
    return events


def _map_kdniao_events(rows: List[Any]) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        description = str(row.get("AcceptStation") or "").strip()
        events.append(
            {
                "time": _format_event_time(row.get("AcceptTime")),
                "status": None,
                "description": description or None,
                "location": str(row.get("Location") or "").strip() or None,
            }
        )
    events.reverse()
    return events


def _map_events(rows: List[Any]) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        description = str(row.get("context") or row.get("status") or "").strip()
        events.append(
            {
                "time": _format_event_time(row.get("ftime") or row.get("time")),
                "status": str(row.get("status") or "").strip() or None,
                "description": description or None,
                "location": str(row.get("location") or "").strip() or None,
            }
        )
    return events


class LogisticsService:
    """物流查询服务"""

    @staticmethod
    async def track(
        carrier: str,
        tracking_number: str,
        *,
        tenant_id: int,
        phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        number = (tracking_number or "").strip()
        if len(number) < 6:
            raise ValidationError("运单号至少 6 位")
        connector = await resolve_tenant_logistics_connector(tenant_id)
        phone_digits = re.sub(r"\D", "", phone or "")
        if connector.type in CLOUD_MARKET_CONNECTOR_TYPE_SET:
            return await LogisticsService._track_cloud_market_express(
                connector, carrier, number, phone_digits
            )
        if connector.type == "kdniao":
            return await LogisticsService._track_kdniao(
                connector, carrier, number, phone_digits
            )
        return await LogisticsService._track_kuaidi100(
            connector, carrier, number, phone_digits
        )

    @staticmethod
    async def _track_kuaidi100(
        connector: IntegrationConfig,
        carrier: str,
        number: str,
        phone_digits: str,
    ) -> Dict[str, Any]:
        cfg = connector.config if isinstance(connector.config, dict) else {}
        customer = str(cfg.get("customer") or "").strip()
        api_key = str(cfg.get("api_key") or "").strip()
        if not customer or not api_key:
            raise ValidationError(
                "快递100 连接器未填授权码或 API Key，请到应用连接器中补全"
            )
        com = resolve_kuaidi100_com(carrier)
        if not com:
            com = await _autonumber_com(api_key, number)
        if not com:
            raise ValidationError(
                "无法识别快递公司。请把承运商编码改为快递100公司编码（如 shunfeng），或填写可识别的承运商名称"
            )
        if com in _PHONE_REQUIRED_COMS and len(phone_digits) < 4:
            raise ValidationError(
                "该承运商查询须填写收件人或寄件人手机号（可填后四位），请补全后再查"
            )

        payload = await _query_kuaidi100(
            customer=customer,
            api_key=api_key,
            com=com,
            tracking_number=number,
            phone=phone_digits,
        )
        if _is_auth_failure(payload):
            raise ValidationError(
                str(payload.get("message") or "快递100 授权失败，请检查授权码、API Key 与剩余单量")
            )
        code = _payload_code(payload)
        if code and code != "200":
            raise ValidationError(str(payload.get("message") or f"快递100 查询失败（{code}）"))

        data = payload.get("data")
        if not isinstance(data, list):
            raise ValidationError("快递100 未返回轨迹")
        state = str(payload.get("state") or "").strip()
        return {
            "success": True,
            "provider": "kuaidi100",
            "carrier": carrier,
            "company_code": str(payload.get("com") or com),
            "tracking_number": str(payload.get("nu") or number),
            "status": _STATE_LABELS.get(state, state or "在途"),
            "events": _map_events(data),
            "message": None,
        }

    @staticmethod
    async def _track_kdniao(
        connector: IntegrationConfig,
        carrier: str,
        number: str,
        phone_digits: str,
    ) -> Dict[str, Any]:
        cfg = connector.config if isinstance(connector.config, dict) else {}
        ebusiness_id = str(cfg.get("ebusiness_id") or "").strip()
        api_key = str(cfg.get("api_key") or "").strip()
        if not ebusiness_id or not api_key:
            raise ValidationError(
                "快递鸟 连接器未填用户 ID 或 API Key，请到应用连接器中补全"
            )
        shipper = resolve_kdniao_shipper(carrier)
        if not shipper:
            raise ValidationError(
                "无法识别快递公司。请把承运商编码改为快递鸟公司编码（如 SF、ZTO）"
            )
        if shipper in _KDNIAO_PHONE_REQUIRED and len(phone_digits) < 4:
            raise ValidationError(
                "该承运商查询须填写收件人或寄件人手机号（可填后四位），请补全后再查"
            )
        payload = await _query_kdniao(
            ebusiness_id=ebusiness_id,
            api_key=api_key,
            shipper=shipper,
            tracking_number=number,
            phone=phone_digits,
        )
        if payload.get("Success") is not True:
            raise ValidationError(str(payload.get("Reason") or "快递鸟 查询失败"))
        traces = payload.get("Traces")
        if not isinstance(traces, list):
            raise ValidationError("快递鸟 未返回轨迹")
        state = str(payload.get("State") or "").strip()
        return {
            "success": True,
            "provider": "kdniao",
            "carrier": carrier,
            "company_code": str(payload.get("ShipperCode") or shipper),
            "tracking_number": str(payload.get("LogisticCode") or number),
            "status": _KDNIAO_STATE_LABELS.get(state, state or "在途"),
            "events": _map_kdniao_events(traces),
            "message": None,
        }

    @staticmethod
    async def _track_cloud_market_express(
        connector: IntegrationConfig,
        carrier: str,
        number: str,
        phone_digits: str,
    ) -> Dict[str, Any]:
        cfg = connector.config if isinstance(connector.config, dict) else {}
        payload = await _query_cloud_market_express(cfg, number, phone_digits)
        if is_cloud_market_auth_failure(payload):
            raise ValidationError(
                str(payload.get("msg") or "AppCode 无效或套餐余量不足")
            )
        ok = payload.get("success") is True or payload.get("code") in (200, "200")
        if not ok:
            raise ValidationError(str(payload.get("msg") or "快递查询失败"))
        data = payload.get("data")
        if not isinstance(data, dict):
            raise ValidationError("快递查询未返回轨迹")
        events_raw = data.get("logisticsTraceDetailList")
        if not isinstance(events_raw, list):
            raise ValidationError("快递查询未返回轨迹")
        return {
            "success": True,
            "provider": connector.type,
            "carrier": carrier,
            "company_code": str(data.get("cpCode") or ""),
            "tracking_number": str(data.get("mailNo") or number),
            "status": str(data.get("logisticsStatusDesc") or data.get("logisticsStatus") or "在途"),
            "events": _map_cloud_market_express_events(events_raw),
            "message": None,
        }


async def test_kuaidi100_connection_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """用一条不可能存在的运单探测授权是否有效（不回落 mock）。"""
    customer = str(config.get("customer") or "").strip()
    api_key = str(config.get("api_key") or "").strip()
    if not customer:
        return {"success": False, "message": "请填写快递100 授权码 customer"}
    if not api_key:
        return {"success": False, "message": "请填写快递100 API Key"}
    try:
        payload = await _query_kuaidi100(
            customer=customer,
            api_key=api_key,
            com="shunfeng",
            tracking_number="SF0000000000000",
            phone="0000",
        )
    except ValidationError as exc:
        return {"success": False, "message": exc.message}
    if _is_auth_failure(payload):
        return {
            "success": False,
            "message": str(payload.get("message") or "授权失败，请检查授权码、API Key 与剩余单量"),
        }
    return {"success": True, "message": "快递100 授权校验通过"}


async def test_kdniao_connection_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """用一条不可能存在的运单探测快递鸟授权是否有效。"""
    ebusiness_id = str(config.get("ebusiness_id") or "").strip()
    api_key = str(config.get("api_key") or "").strip()
    if not ebusiness_id:
        return {"success": False, "message": "请填写快递鸟用户 ID（EBusinessID）"}
    if not api_key:
        return {"success": False, "message": "请填写快递鸟 API Key"}
    try:
        payload = await _query_kdniao(
            ebusiness_id=ebusiness_id,
            api_key=api_key,
            shipper="SF",
            tracking_number="SF0000000000000",
            phone="0000",
        )
    except ValidationError as exc:
        return {"success": False, "message": exc.message}
    reason = str(payload.get("Reason") or "")
    if any(token in reason for token in ("缺少", "无效", "签名", "AppKey", "用户ID", "未授权")):
        return {"success": False, "message": reason or "快递鸟 授权失败"}
    if payload.get("Success") is True or reason:
        return {"success": True, "message": "快递鸟 授权校验通过"}
    return {"success": True, "message": "快递鸟 授权校验通过"}


async def test_cloud_market_connection_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """按场景探测调用地址与 AppCode 是否有效。"""
    try:
        scene = resolve_cloud_market_scene(config)
        resolve_cloud_market_app_code(config)
        resolve_cloud_market_query_url(config)
        resolve_cloud_market_method(config)
    except ValidationError as exc:
        return {"success": False, "message": exc.message}
    if scene != CLOUD_MARKET_SCENE_EXPRESS_QUERY:
        return {"success": False, "message": "当前场景尚不支持测试连接"}
    try:
        payload = await _query_cloud_market_express(
            config,
            "SF0000000000000",
            "0000",
        )
    except ValidationError as exc:
        return {"success": False, "message": exc.message}
    message = str(payload.get("msg") or "")
    if is_cloud_market_auth_failure(payload):
        return {"success": False, "message": message or "AppCode 无效或套餐余量不足"}
    if "缺少必要参数" in message:
        return {"success": False, "message": message}
    return {"success": True, "message": "云市场授权校验通过"}
