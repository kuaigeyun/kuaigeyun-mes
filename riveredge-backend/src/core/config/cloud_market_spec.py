"""
云市场连接器真源：类型、请求方式、业务场景。

阿里云 / 腾讯云市场共用 AppCode 简单认证；业务差异用 scene 区分，
禁止再为每个商品单独加连接器 type。
"""

from __future__ import annotations

from typing import FrozenSet

CLOUD_MARKET_CONNECTOR_TYPES: tuple[str, ...] = (
    "aliyun_market",
    "tencent_market",
)
CLOUD_MARKET_CONNECTOR_TYPE_SET: FrozenSet[str] = frozenset(CLOUD_MARKET_CONNECTOR_TYPES)

CLOUD_MARKET_HTTP_METHODS: tuple[str, ...] = ("POST", "GET")
CLOUD_MARKET_HTTP_METHOD_SET: FrozenSet[str] = frozenset(CLOUD_MARKET_HTTP_METHODS)

CLOUD_MARKET_SCENE_EXPRESS_QUERY = "express_query"
CLOUD_MARKET_SCENES: tuple[str, ...] = (CLOUD_MARKET_SCENE_EXPRESS_QUERY,)
CLOUD_MARKET_SCENE_SET: FrozenSet[str] = frozenset(CLOUD_MARKET_SCENES)
