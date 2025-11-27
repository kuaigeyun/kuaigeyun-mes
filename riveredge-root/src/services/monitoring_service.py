"""
运营监控服务模块

提供组织运营监控和系统监控相关的业务逻辑
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json

from loguru import logger

from models.tenant import Tenant, TenantStatus
from models.user import User
from core.cache import cache


class MonitoringService:
    """
    运营监控服务类
    
    提供组织运营监控和系统监控相关的业务逻辑处理。
    """
    
    async def get_tenant_statistics(self) -> Dict[str, Any]:
        """
        获取组织数量统计
        
        统计所有组织的数量，按状态和套餐分组。
        
        Returns:
            Dict[str, Any]: 组织统计信息
        """
        # 从缓存获取（如果存在）
        cache_key = "monitoring:tenant_statistics"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # 查询数据库
        total_tenants = await Tenant.all().count()
        active_tenants = await Tenant.filter(status=TenantStatus.ACTIVE).count()
        inactive_tenants = await Tenant.filter(status=TenantStatus.INACTIVE).count()
        expired_tenants = await Tenant.filter(status=TenantStatus.EXPIRED).count()
        suspended_tenants = await Tenant.filter(status=TenantStatus.SUSPENDED).count()
        
        # 按套餐统计
        from models.tenant import TenantPlan
        basic_tenants = await Tenant.filter(plan=TenantPlan.BASIC).count()
        professional_tenants = await Tenant.filter(plan=TenantPlan.PROFESSIONAL).count()
        enterprise_tenants = await Tenant.filter(plan=TenantPlan.ENTERPRISE).count()
        
        statistics = {
            "total": total_tenants,
            "by_status": {
                "active": active_tenants,
                "inactive": inactive_tenants,
                "expired": expired_tenants,
                "suspended": suspended_tenants,
            },
            "by_plan": {
                "basic": basic_tenants,
                "professional": professional_tenants,
                "enterprise": enterprise_tenants,
            },
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # 缓存 5 分钟
        await cache.set(cache_key, json.dumps(statistics), expire=300)
        
        return statistics
    
    async def get_tenant_activity(
        self,
        tenant_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        获取组织活跃度监控数据
        
        统计组织的日活、月活、访问量等数据。
        
        Args:
            tenant_id: 组织 ID（可选，如果提供则只统计该组织）
            days: 统计天数（默认 30 天）
            
        Returns:
            Dict[str, Any]: 组织活跃度数据
        """
        # 从缓存获取（如果存在）
        cache_key = f"monitoring:tenant_activity:{tenant_id or 'all'}:{days}"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # TODO: 实现实际的活跃度统计逻辑
        # 当前返回占位数据，后续需要：
        # 1. 从操作日志中统计访问量
        # 2. 统计日活用户数
        # 3. 统计月活用户数
        # 4. 统计 API 调用次数
        
        activity_data = {
            "tenant_id": tenant_id,
            "period_days": days,
            "daily_active_users": [],  # 每日活跃用户数
            "monthly_active_users": 0,  # 月活用户数
            "total_visits": 0,  # 总访问量
            "api_calls": 0,  # API 调用次数
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # 缓存 1 分钟
        await cache.set(cache_key, json.dumps(activity_data), expire=60)
        
        return activity_data
    
    async def get_tenant_resource_usage(
        self,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取组织资源使用监控数据
        
        统计组织的存储空间、API 调用次数、数据量等。
        
        Args:
            tenant_id: 组织 ID（可选，如果提供则只统计该组织）
            
        Returns:
            Dict[str, Any]: 组织资源使用数据
        """
        # 从缓存获取（如果存在）
        cache_key = f"monitoring:tenant_resource:{tenant_id or 'all'}"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # TODO: 实现实际的资源使用统计逻辑
        # 当前返回占位数据，后续需要：
        # 1. 统计存储空间使用量
        # 2. 统计 API 调用次数
        # 3. 统计数据量（用户数、业务数据量等）
        
        resource_data = {
            "tenant_id": tenant_id,
            "storage_used_mb": 0,  # 已使用存储空间（MB）
            "storage_limit_mb": 0,  # 存储空间限制（MB）
            "api_calls_today": 0,  # 今日 API 调用次数
            "api_calls_month": 0,  # 本月 API 调用次数
            "user_count": 0,  # 用户数
            "data_count": 0,  # 业务数据量
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # 如果指定了组织，查询实际数据
        if tenant_id:
            # 查询用户数
            user_count = await User.filter(tenant_id=tenant_id).count()
            resource_data["user_count"] = user_count
            
            # 查询组织信息获取限制
            tenant = await Tenant.get_or_none(id=tenant_id)
            if tenant:
                resource_data["storage_limit_mb"] = tenant.max_storage
        
        # 缓存 1 分钟
        await cache.set(cache_key, json.dumps(resource_data), expire=60)
        
        return resource_data
    
    async def get_tenant_data_statistics(
        self,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取组织数据统计
        
        统计组织的用户数、订单数、业务数据量等。
        
        Args:
            tenant_id: 组织 ID（可选，如果提供则只统计该组织）
            
        Returns:
            Dict[str, Any]: 组织数据统计
        """
        # 从缓存获取（如果存在）
        cache_key = f"monitoring:tenant_data_stats:{tenant_id or 'all'}"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # 查询用户数
        if tenant_id:
            user_count = await User.filter(tenant_id=tenant_id).count()
        else:
            user_count = await User.all().count()
        
        # TODO: 实现其他业务数据统计
        # 当前只统计用户数，后续需要：
        # 1. 统计订单数（如果有订单插件）
        # 2. 统计其他业务数据量
        
        data_statistics = {
            "tenant_id": tenant_id,
            "user_count": user_count,
            "order_count": 0,  # 订单数（占位）
            "business_data_count": 0,  # 业务数据量（占位）
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # 缓存 5 分钟
        await cache.set(cache_key, json.dumps(data_statistics), expire=300)
        
        return data_statistics
    
    async def get_system_status(self) -> Dict[str, Any]:
        """
        获取系统整体运行状态
        
        返回系统的基本运行状态信息，包括数据库、Redis连接状态和运行时间。
        
        Returns:
            Dict[str, Any]: 系统运行状态
        """
        # 从缓存获取（如果存在）
        cache_key = "monitoring:system_status"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # 检查数据库连接状态
        from core.database import check_db_connection
        try:
            db_connected = await check_db_connection()
            database_status = "healthy" if db_connected else "error"
        except Exception as e:
            logger.error(f"数据库连接检查失败: {e}")
            database_status = "error"
        
        # 检查 Redis 连接状态
        from core.cache import check_redis_connection
        try:
            redis_connected = await check_redis_connection()
            redis_status = "healthy" if redis_connected else "error"
        except Exception as e:
            logger.error(f"Redis 连接检查失败: {e}")
            redis_status = "error"
        
        # 获取运行时间（使用 psutil 获取进程启动时间）
        uptime_seconds = 0
        start_time_iso = None
        cpu_count = None
        try:
            import psutil
            import os
            current_process = psutil.Process(os.getpid())
            # 获取进程启动时间
            start_time = current_process.create_time()
            uptime_seconds = int(datetime.now().timestamp() - start_time)
            start_time_iso = datetime.fromtimestamp(start_time).isoformat()
            # 获取CPU核心数
            cpu_count = psutil.cpu_count(logical=False)  # 物理核心数
            cpu_count_logical = psutil.cpu_count(logical=True)  # 逻辑核心数
        except Exception as e:
            logger.warning(f"获取运行时间失败: {e}")
        
        # 获取时区信息
        try:
            import time
            timezone_offset = time.timezone if time.daylight == 0 else time.altzone
            timezone_hours = abs(timezone_offset) // 3600
            timezone_minutes = (abs(timezone_offset) % 3600) // 60
            timezone_str = f"UTC{'+' if timezone_offset <= 0 else '-'}{timezone_hours:02d}:{timezone_minutes:02d}"
        except Exception as e:
            logger.warning(f"获取时区信息失败: {e}")
            timezone_str = None
        
        # 获取应用配置信息
        from app.config import settings
        app_version = settings.APP_VERSION
        environment = settings.ENVIRONMENT
        
        # 判断整体状态
        if database_status == "error" or redis_status == "error":
            overall_status = "error"
        elif database_status == "warning" or redis_status == "warning":
            overall_status = "warning"
        else:
            overall_status = "healthy"
        
        system_status = {
            "status": overall_status,
            "database": database_status,
            "redis": redis_status,
            "uptime_seconds": uptime_seconds,
            "start_time": start_time_iso,
            "cpu_count": cpu_count,
            "cpu_count_logical": cpu_count_logical,
            "timezone": timezone_str,
            "app_version": app_version,
            "environment": environment,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # 缓存 30 秒
        await cache.set(cache_key, json.dumps(system_status), expire=30)
        
        return system_status
    
    async def get_system_resources(self) -> Dict[str, Any]:
        """
        获取系统资源使用情况
        
        使用 psutil 获取真实的系统资源信息（CPU、内存、磁盘等）。
        
        Returns:
            Dict[str, Any]: 系统资源使用情况
        """
        # 从缓存获取（如果存在）
        cache_key = "monitoring:system_resources"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        try:
            import psutil
            
            # 1. 获取 CPU 使用率（间隔1秒，获取更准确的值）
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # 2. 获取内存使用情况
            memory = psutil.virtual_memory()
            memory_total_mb = round(memory.total / (1024 * 1024), 2)
            memory_used_mb = round(memory.used / (1024 * 1024), 2)
            memory_percent = round(memory.percent, 2)
            
            # 3. 获取磁盘使用情况（根目录或当前工作目录）
            try:
                # 尝试获取根目录磁盘使用情况
                disk = psutil.disk_usage('/')
            except (PermissionError, OSError):
                # Windows 系统可能无法访问根目录，使用当前工作目录
                import os
                disk = psutil.disk_usage(os.getcwd())
            
            disk_total_mb = round(disk.total / (1024 * 1024), 2)
            disk_used_mb = round(disk.used / (1024 * 1024), 2)
            disk_percent = round(disk.percent, 2)
            
            resource_data = {
                "cpu_percent": round(cpu_percent, 2),
                "memory_total_mb": memory_total_mb,
                "memory_used_mb": memory_used_mb,
                "memory_percent": memory_percent,
                "disk_total_mb": disk_total_mb,
                "disk_used_mb": disk_used_mb,
                "disk_percent": disk_percent,
                "updated_at": datetime.utcnow().isoformat(),
            }
            
            # 缓存 30 秒
            await cache.set(cache_key, json.dumps(resource_data), expire=30)
            
            return resource_data
            
        except ImportError:
            # psutil 未安装，返回占位数据
            resource_data = {
                "cpu_percent": 0.0,
                "memory_total_mb": 0,
                "memory_used_mb": 0,
                "memory_percent": 0.0,
                "disk_total_mb": 0,
                "disk_used_mb": 0,
                "disk_percent": 0.0,
                "updated_at": datetime.utcnow().isoformat(),
                "error": "psutil 未安装，请运行: pip install psutil",
            }
            return resource_data
        except Exception as e:
            # 获取系统资源时出错，返回错误信息
            from loguru import logger
            logger.error(f"获取系统资源失败: {str(e)}")
            resource_data = {
                "cpu_percent": 0.0,
                "memory_total_mb": 0,
                "memory_used_mb": 0,
                "memory_percent": 0.0,
                "disk_total_mb": 0,
                "disk_used_mb": 0,
                "disk_percent": 0.0,
                "updated_at": datetime.utcnow().isoformat(),
                "error": f"获取系统资源失败: {str(e)}",
            }
            return resource_data
    
    async def get_system_performance(self) -> Dict[str, Any]:
        """
        获取系统性能指标
        
        返回系统的性能指标，如 API 响应时间、请求量等。
        
        Returns:
            Dict[str, Any]: 系统性能指标
        """
        # 从缓存获取（如果存在）
        cache_key = "monitoring:system_performance"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # TODO: 实现实际的性能指标统计
        # 当前返回占位数据，后续需要：
        # 1. 统计 API 平均响应时间
        # 2. 统计请求量（QPS）
        # 3. 统计错误率
        
        performance_data = {
            "avg_response_time_ms": 0.0,  # 平均响应时间（毫秒）
            "requests_per_second": 0.0,  # 每秒请求数（QPS）
            "error_rate": 0.0,  # 错误率（%）
            "total_requests_today": 0,  # 今日总请求数
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # 缓存 1 分钟
        await cache.set(cache_key, json.dumps(performance_data), expire=60)
        
        return performance_data
    
    async def get_system_alerts(self) -> List[Dict[str, Any]]:
        """
        获取系统异常告警
        
        返回系统的异常告警列表。
        
        Returns:
            List[Dict[str, Any]]: 异常告警列表
        """
        alerts = []
        
        try:
            # 1. 检查系统资源使用是否超限
            resources = await self.get_system_resources()
            if resources and not resources.get("error"):
                if resources.get("cpu_percent", 0) >= 90:
                    alerts.append({
                        "id": "cpu_high",
                        "type": "warning",
                        "message": f"CPU 使用率过高: {resources.get('cpu_percent', 0):.1f}%",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                if resources.get("memory_percent", 0) >= 90:
                    alerts.append({
                        "id": "memory_high",
                        "type": "warning",
                        "message": f"内存使用率过高: {resources.get('memory_percent', 0):.1f}%",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                if resources.get("disk_percent", 0) >= 90:
                    alerts.append({
                        "id": "disk_high",
                        "type": "error",
                        "message": f"磁盘使用率过高: {resources.get('disk_percent', 0):.1f}%",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
            
            # 2. 检查数据库和Redis连接状态
            status = await self.get_system_status()
            if status.get("database") == "error":
                alerts.append({
                    "id": "database_error",
                    "type": "error",
                    "message": "数据库连接失败",
                    "timestamp": datetime.utcnow().isoformat(),
                })
            if status.get("redis") == "error":
                alerts.append({
                    "id": "redis_error",
                    "type": "warning",
                    "message": "Redis 连接失败",
                    "timestamp": datetime.utcnow().isoformat(),
                })
        except Exception as e:
            logger.error(f"获取系统告警失败: {e}")
        
        return alerts
    
    async def get_system_info(self) -> Dict[str, Any]:
        """
        获取系统环境信息
        
        返回系统的环境信息，包括 Python 版本、操作系统、平台信息、网络信息等。
        
        Returns:
            Dict[str, Any]: 系统环境信息
        """
        # 从缓存获取（如果存在）
        cache_key = "monitoring:system_info"
        cached_data = await cache.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        import sys
        import platform
        import os
        
        system_info = {
            "python_version": sys.version.split()[0],
            "python_full_version": sys.version,
            "platform": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "architecture": platform.architecture()[0],
            "hostname": platform.node(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # 获取网络信息
        try:
            import psutil
            network_info = []
            net_io = psutil.net_io_counters()
            
            # 获取网络接口信息
            net_if_addrs = psutil.net_if_addrs()
            for interface_name, interface_addresses in net_if_addrs.items():
                for address in interface_addresses:
                    if address.family == 2:  # IPv4
                        network_info.append({
                            "interface": interface_name,
                            "ip": address.address,
                            "netmask": address.netmask,
                            "type": "IPv4",
                        })
                    elif address.family == 10:  # IPv6
                        network_info.append({
                            "interface": interface_name,
                            "ip": address.address,
                            "netmask": address.netmask,
                            "type": "IPv6",
                        })
            
            system_info["network"] = {
                "interfaces": network_info,
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv,
            }
        except Exception as e:
            logger.warning(f"获取网络信息失败: {e}")
            system_info["network"] = {
                "error": f"获取网络信息失败: {str(e)}",
            }
        
        # 获取进程信息
        try:
            import psutil
            import os
            current_process = psutil.Process(os.getpid())
            system_info["process"] = {
                "pid": current_process.pid,
                "name": current_process.name(),
                "status": current_process.status(),
                "create_time": datetime.fromtimestamp(current_process.create_time()).isoformat(),
                "num_threads": current_process.num_threads(),
                "memory_info_mb": {
                    "rss": round(current_process.memory_info().rss / (1024 * 1024), 2),
                    "vms": round(current_process.memory_info().vms / (1024 * 1024), 2),
                },
            }
        except Exception as e:
            logger.warning(f"获取进程信息失败: {e}")
            system_info["process"] = {
                "error": f"获取进程信息失败: {str(e)}",
            }
        
        # 缓存 5 分钟（系统信息变化不频繁）
        await cache.set(cache_key, json.dumps(system_info), expire=300)
        
        return system_info

