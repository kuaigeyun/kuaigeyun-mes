"""
物流查询服务模块

对接快递鸟/快递100等物流API，查询运单轨迹。
未配置API Key时返回模拟数据，便于开发调试。

Author: RiverEdge Team
Date: 2026-03-04
"""

import os
from typing import List, Dict, Any
from datetime import datetime, timedelta
from loguru import logger


class LogisticsService:
    """物流查询服务"""

    @staticmethod
    async def track(carrier: str, tracking_number: str) -> Dict[str, Any]:
        """
        查询物流轨迹

        Args:
            carrier: 承运商/物流公司（如：顺丰、中通、圆通）
            tracking_number: 运单号

        Returns:
            dict: {
                "success": bool,
                "carrier": str,
                "tracking_number": str,
                "status": str,
                "traces": [{"time": str, "status": str, "location": str}, ...],
                "message": str  # 失败时
            }
        """
        # 检查是否配置了物流API（快递鸟/快递100）
        api_key = os.environ.get("LOGISTICS_API_KEY") or os.environ.get("KUAIDI100_KEY") or os.environ.get("KDNIAO_API_KEY")
        if api_key:
            try:
                # TODO: 对接快递鸟或快递100 API
                # 参考: https://www.kuaidi100.com/openapi/ 或 https://www.kdniao.com/api-trackexpress
                return await LogisticsService._call_external_api(carrier, tracking_number, api_key)
            except Exception as e:
                logger.warning("物流API调用失败，返回模拟数据: %s", e)
                return LogisticsService._mock_track(carrier, tracking_number)

        # 未配置API Key时返回模拟数据
        return LogisticsService._mock_track(carrier, tracking_number)

    @staticmethod
    async def _call_external_api(carrier: str, tracking_number: str, api_key: str) -> Dict[str, Any]:
        """调用外部物流API（预留扩展）"""
        # 快递鸟/快递100 对接逻辑可在此实现
        raise NotImplementedError("物流API对接待实现，请配置 LOGISTICS_API_KEY 或使用模拟数据")

    @staticmethod
    def _mock_track(carrier: str, tracking_number: str) -> Dict[str, Any]:
        """返回模拟物流轨迹（开发/演示用）"""
        now = datetime.now()
        traces = [
            {
                "time": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "已揽收",
                "location": "【发件城市】已揽收",
            },
            {
                "time": (now - timedelta(days=1, hours=12)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "运输中",
                "location": "【转运中心】快件已到达转运中心",
            },
            {
                "time": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "派送中",
                "location": "【派件城市】快件正在派送中",
            },
        ]
        return {
            "success": True,
            "carrier": carrier,
            "tracking_number": tracking_number,
            "status": "在途",
            "traces": traces,
            "message": None,
        }
