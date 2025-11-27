#!/usr/bin/env python3
"""
系统监控脚本

提供系统状态监控、性能指标收集、告警检测等功能
"""

import asyncio
import sys
import os
import psutil
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import json

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from loguru import logger
from app.config import settings
from core.database import check_db_connection
from core.cache import check_redis_connection


class SystemMonitor:
    """系统监控器"""

    def __init__(self):
        self.metrics = {}
        self.alerts = []
        self.thresholds = {
            "cpu_percent": 80.0,
            "memory_percent": 85.0,
            "disk_percent": 90.0,
            "response_time": 2.0,  # 秒
        }

    async def collect_system_metrics(self) -> Dict[str, Any]:
        """
        收集系统性能指标

        Returns:
            Dict[str, Any]: 系统指标数据
        """
        metrics = {
            "timestamp": datetime.now().isoformat(),
            "cpu": {
                "percent": psutil.cpu_percent(interval=1),
                "cores": psutil.cpu_count(),
                "frequency": psutil.cpu_freq().current if psutil.cpu_freq() else None
            },
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent,
                "used": psutil.virtual_memory().used
            },
            "disk": {
                "total": psutil.disk_usage('/').total,
                "free": psutil.disk_usage('/').free,
                "percent": psutil.disk_usage('/').percent,
                "used": psutil.disk_usage('/').used
            },
            "network": {
                "connections": len(psutil.net_connections()),
                "io_counters": psutil.net_io_counters()._asdict() if psutil.net_io_counters() else None
            }
        }

        # 格式化字节大小
        for key in ["total", "available", "used", "free"]:
            if key in metrics["memory"]:
                metrics["memory"][f"{key}_mb"] = metrics["memory"][key] / (1024 ** 2)
            if key in metrics["disk"]:
                metrics["disk"][f"{key}_gb"] = metrics["disk"][key] / (1024 ** 3)

        self.metrics = metrics
        return metrics

    async def check_service_health(self) -> Dict[str, Any]:
        """
        检查服务健康状态

        Returns:
            Dict[str, Any]: 服务健康状态
        """
        health_status = {
            "database": await check_db_connection(),
            "redis": await check_redis_connection(),
            "overall": False
        }

        # 检查应用进程是否存在
        app_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if 'uvicorn' in proc.info['name'] or 'python' in proc.info['name']:
                    if proc.info['cmdline'] and any('main:app' in arg for arg in proc.info['cmdline']):
                        app_processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        health_status["application"] = {
            "running": len(app_processes) > 0,
            "process_count": len(app_processes),
            "processes": app_processes
        }

        # 整体健康状态
        health_status["overall"] = all([
            health_status["database"],
            health_status["redis"],
            health_status["application"]["running"]
        ])

        return health_status

    async def check_thresholds(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        检查阈值并生成告警

        Args:
            metrics: 系统指标

        Returns:
            List[Dict[str, Any]]: 告警列表
        """
        alerts = []

        # CPU 使用率告警
        if metrics["cpu"]["percent"] > self.thresholds["cpu_percent"]:
            alerts.append({
                "level": "warning",
                "type": "cpu_usage",
                "message": f"CPU 使用率过高: {metrics['cpu']['percent']:.1f}%",
                "current": metrics["cpu"]["percent"],
                "threshold": self.thresholds["cpu_percent"]
            })

        # 内存使用率告警
        if metrics["memory"]["percent"] > self.thresholds["memory_percent"]:
            alerts.append({
                "level": "warning",
                "type": "memory_usage",
                "message": f"内存使用率过高: {metrics['memory']['percent']:.1f}%",
                "current": metrics["memory"]["percent"],
                "threshold": self.thresholds["memory_percent"]
            })

        # 磁盘使用率告警
        if metrics["disk"]["percent"] > self.thresholds["disk_percent"]:
            alerts.append({
                "level": "critical",
                "type": "disk_usage",
                "message": f"磁盘使用率过高: {metrics['disk']['percent']:.1f}%",
                "current": metrics["disk"]["percent"],
                "threshold": self.thresholds["disk_percent"]
            })

        self.alerts.extend(alerts)
        return alerts

    async def generate_report(self) -> Dict[str, Any]:
        """
        生成监控报告

        Returns:
            Dict[str, Any]: 监控报告
        """
        # 收集所有指标
        system_metrics = await self.collect_system_metrics()
        health_status = await self.check_service_health()
        alerts = await self.check_thresholds(system_metrics)

        report = {
            "timestamp": datetime.now().isoformat(),
            "system": system_metrics,
            "services": health_status,
            "alerts": alerts,
            "summary": {
                "overall_status": "healthy" if health_status["overall"] and not alerts else "unhealthy",
                "active_alerts": len([a for a in alerts if a["level"] in ["critical", "warning"]]),
                "services_status": {
                    "healthy": sum(1 for v in health_status.values() if isinstance(v, bool) and v),
                    "total": len([v for v in health_status.values() if isinstance(v, bool)])
                }
            }
        }

        return report

    def save_report(self, report: Dict[str, Any], filename: str = None):
        """
        保存监控报告

        Args:
            report: 监控报告
            filename: 文件名（可选）
        """
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"monitor_report_{timestamp}.json"

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        logger.info(f"监控报告已保存到: {filename}")


async def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description="RiverEdge 系统监控工具")
    parser.add_argument("--output", "-o", help="输出文件路径")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式输出")
    parser.add_argument("--quiet", "-q", action="store_true", help="静默模式")

    args = parser.parse_args()

    if not args.quiet:
        print("🔍 RiverEdge 系统监控")
        print("=" * 50)

    monitor = SystemMonitor()
    report = await monitor.generate_report()

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        # 格式化输出
        print(f"📊 系统状态报告 - {report['timestamp']}")
        print()

        print("🖥️  系统指标:")
        sys_metrics = report["system"]
        print(".1f")
        print(".1f")
        print(".1f")
        print()

        print("🔧 服务状态:")
        services = report["services"]
        status_icons = {"True": "✅", "False": "❌"}
        print(f"  数据库: {status_icons[str(services['database'])]}")
        print(f"  Redis: {status_icons[str(services['redis'])]}")
        print(f"  应用: {status_icons[str(services['application']['running'])]} ({services['application']['process_count']} 个进程)")
        print()

        print("🚨 告警信息:")
        if report["alerts"]:
            for alert in report["alerts"]:
                level_icon = "🔴" if alert["level"] == "critical" else "🟡"
                print(f"  {level_icon} {alert['message']}")
        else:
            print("  ✅ 无告警")
        print()

        print("📈 整体状态:")
        summary = report["summary"]
        overall_icon = "✅" if summary["overall_status"] == "healthy" else "❌"
        print(f"  {overall_icon} {summary['overall_status'].upper()}")
        print(f"  🔢 活跃告警: {summary['active_alerts']}")
        print(f"  🔧 服务状态: {summary['services_status']['healthy']}/{summary['services_status']['total']} 正常")

    # 保存报告
    if args.output:
        monitor.save_report(report, args.output)

    # 返回状态码（用于脚本调用）
    return 0 if report["summary"]["overall_status"] == "healthy" else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
