"""
示例监控插件

提供基础的系统监控功能，包括CPU、内存、磁盘监控
"""

import asyncio
import psutil
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from datetime import datetime

from plugins.base import Plugin, PluginMetadata
from core.exceptions import ValidationError


class SystemMonitorService:
    """系统监控服务"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self._alerts: List[Dict[str, Any]] = []
        self._monitor_task: asyncio.Task = None

    async def get_system_stats(self) -> Dict[str, Any]:
        """获取系统统计信息"""
        try:
            return {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory": {
                    "total": psutil.virtual_memory().total,
                    "available": psutil.virtual_memory().available,
                    "percent": psutil.virtual_memory().percent,
                    "used": psutil.virtual_memory().used
                },
                "disk": {
                    "total": psutil.disk_usage('/').total,
                    "free": psutil.disk_usage('/').free,
                    "percent": psutil.disk_usage('/').percent
                },
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            raise ValidationError(f"获取系统统计信息失败: {e}")

    async def check_alerts(self, stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查告警条件"""
        alerts = []
        thresholds = self.config.get("alert_thresholds", {})

        # CPU使用率告警
        cpu_threshold = thresholds.get("cpu_percent", 80.0)
        if stats["cpu_percent"] > cpu_threshold:
            alerts.append({
                "level": "warning",
                "type": "cpu_usage",
                "message": f"CPU使用率过高: {stats['cpu_percent']:.1f}%",
                "current": stats["cpu_percent"],
                "threshold": cpu_threshold,
                "timestamp": datetime.now().isoformat()
            })

        # 内存使用率告警
        memory_threshold = thresholds.get("memory_percent", 85.0)
        if stats["memory"]["percent"] > memory_threshold:
            alerts.append({
                "level": "warning",
                "type": "memory_usage",
                "message": f"内存使用率过高: {stats['memory']['percent']:.1f}%",
                "current": stats["memory"]["percent"],
                "threshold": memory_threshold,
                "timestamp": datetime.now().isoformat()
            })

        return alerts

    async def start_monitoring(self):
        """启动监控任务"""
        if self._monitor_task and not self._monitor_task.done():
            return

        interval = self.config.get("monitor_interval", 60)

        async def monitor_loop():
            while True:
                try:
                    stats = await self.get_system_stats()
                    alerts = await self.check_alerts(stats)

                    if alerts:
                        self._alerts.extend(alerts)
                        # 保留最近100个告警
                        self._alerts = self._alerts[-100:]

                    await asyncio.sleep(interval)
                except Exception as e:
                    print(f"监控任务出错: {e}")
                    await asyncio.sleep(interval)

        self._monitor_task = asyncio.create_task(monitor_loop())
        print("系统监控任务已启动")

    async def stop_monitoring(self):
        """停止监控任务"""
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            print("系统监控任务已停止")

    def get_alerts(self) -> List[Dict[str, Any]]:
        """获取告警列表"""
        return self._alerts.copy()


class ExampleMonitorPlugin(Plugin):
    """
    示例监控插件

    提供系统监控和告警功能
    """

    def __init__(self, metadata: PluginMetadata):
        super().__init__(metadata)
        self.monitor_service: SystemMonitorService = None
        self._router: APIRouter = None

    def on_load(self):
        """插件加载时的初始化"""
        super().on_load()
        print(f"加载监控插件: {self.name}")

        # 创建监控服务
        self.monitor_service = SystemMonitorService(self.config)

    def on_activate(self):
        """插件激活时的处理"""
        super().on_activate()
        print(f"激活监控插件: {self.name}")

        # 启动监控任务
        if self.config.get("enabled", True):
            asyncio.create_task(self.monitor_service.start_monitoring())

    def on_deactivate(self):
        """插件停用时的处理"""
        super().on_deactivate()
        print(f"停用监控插件: {self.name}")

        # 停止监控任务
        if self.monitor_service:
            asyncio.create_task(self.monitor_service.stop_monitoring())

    def on_unload(self):
        """插件卸载时的清理"""
        super().on_unload()
        print(f"卸载监控插件: {self.name}")

        if self.monitor_service:
            asyncio.create_task(self.monitor_service.stop_monitoring())

    def get_api_routes(self):
        """获取插件提供的API路由"""
        if self._router is None:
            self._router = APIRouter(prefix="/api/v1/monitor", tags=["System Monitor"])

            @self._router.get("/stats")
            async def get_system_stats():
                """获取系统统计信息"""
                return await self.monitor_service.get_system_stats()

            @self._router.get("/alerts")
            async def get_alerts():
                """获取告警信息"""
                return {
                    "alerts": self.monitor_service.get_alerts(),
                    "count": len(self.monitor_service.get_alerts())
                }

            @self._router.post("/alerts/clear")
            async def clear_alerts():
                """清除告警信息"""
                self.monitor_service._alerts.clear()
                return {"message": "告警信息已清除"}

        return self._router

    def get_services(self):
        """获取插件提供的服务"""
        return {
            "system_monitor": self.monitor_service,
            "alert_manager": self.monitor_service  # 别名
        }

    def get_commands(self):
        """获取插件提供的命令"""
        return {
            "monitor:stats": self.monitor_service.get_system_stats,
            "monitor:alerts": lambda: self.monitor_service.get_alerts(),
            "monitor:clear": lambda: self.monitor_service._alerts.clear()
        }
