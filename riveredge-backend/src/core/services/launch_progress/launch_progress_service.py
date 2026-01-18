"""
上线进度跟踪服务模块

提供上线进度跟踪和检查清单的业务逻辑处理。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from loguru import logger

from apps.kuaizhizao.services.launch_countdown_service import LaunchCountdownService
from apps.kuaizhizao.models.launch_countdown import LaunchCountdown


class LaunchProgressService:
    """
    上线进度跟踪服务类
    
    提供上线进度跟踪、任务清单、进度报告等功能。
    """
    
    def __init__(self):
        self.countdown_service = LaunchCountdownService()
    
    async def get_progress_tracking(
        self,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        获取上线进度跟踪信息
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: 进度跟踪信息
        """
        countdown = await self.countdown_service.get_countdown(tenant_id)
        
        if not countdown:
            return {
                "has_countdown": False,
                "days_remaining": 0,
                "progress_percentage": 0,
                "stages": [],
                "tasks": [],
            }
        
        # 计算剩余天数
        days_remaining = (countdown.launch_date - datetime.now()).days
        days_remaining = max(0, days_remaining)
        
        # 计算进度百分比
        progress = countdown.progress or {}
        completed_stages = sum(1 for stage in progress.values() if stage.get("completed", False))
        total_stages = len(progress) if progress else 1
        progress_percentage = int((completed_stages / total_stages) * 100) if total_stages > 0 else 0
        
        # 生成阶段列表
        stages = self._generate_stages(progress)
        
        # 生成任务清单
        tasks = self._generate_tasks(progress, countdown)
        
        return {
            "has_countdown": True,
            "countdown_uuid": countdown.uuid,
            "launch_date": countdown.launch_date.isoformat() if countdown.launch_date else None,
            "snapshot_time": countdown.snapshot_time.isoformat() if countdown.snapshot_time else None,
            "status": countdown.status,
            "days_remaining": days_remaining,
            "progress_percentage": progress_percentage,
            "stages": stages,
            "tasks": tasks,
        }
    
    def _generate_stages(self, progress: Dict[str, Any]) -> List[Dict[str, Any]]:
        """生成阶段列表"""
        stage_configs = [
            {"key": "countdown", "name": "启动上线倒计时", "required": True},
            {"key": "snapshot", "name": "确定快照时间点", "required": True},
            {"key": "inventory", "name": "导入期初库存", "required": True},
            {"key": "wip", "name": "导入在制品", "required": True},
            {"key": "receivables_payables", "name": "导入应收应付", "required": True},
            {"key": "compensation", "name": "动态数据补偿", "required": True},
            {"key": "final_check", "name": "上线前最终检查", "required": True},
        ]
        
        stages = []
        for config in stage_configs:
            stage_progress = progress.get(config["key"], {})
            stages.append({
                "key": config["key"],
                "name": config["name"],
                "required": config["required"],
                "status": stage_progress.get("status", "pending"),
                "completed": stage_progress.get("completed", False),
                "updated_at": stage_progress.get("updated_at"),
            })
        
        return stages
    
    def _generate_tasks(self, progress: Dict[str, Any], countdown: LaunchCountdown) -> List[Dict[str, Any]]:
        """生成任务清单"""
        tasks = []
        
        # 基于进度生成任务
        for stage_key, stage_progress in progress.items():
            stage_names = {
                "inventory": "期初库存导入",
                "wip": "在制品导入",
                "receivables_payables": "应收应付导入",
                "compensation": "动态数据补偿",
            }
            
            task_name = stage_names.get(stage_key, stage_key)
            is_completed = stage_progress.get("completed", False)
            status = stage_progress.get("status", "pending")
            
            # 判断是否为关键任务
            is_critical = stage_key in ["inventory", "wip", "receivables_payables"]
            
            # 判断是否即将到期（距离上线日期3天内）
            days_remaining = (countdown.launch_date - datetime.now()).days if countdown.launch_date else 999
            is_due_soon = days_remaining <= 3 and not is_completed
            
            tasks.append({
                "id": f"task_{stage_key}",
                "name": task_name,
                "status": "completed" if is_completed else ("in_progress" if status == "in_progress" else "pending"),
                "is_critical": is_critical,
                "is_due_soon": is_due_soon,
                "updated_at": stage_progress.get("updated_at"),
            })
        
        return tasks
    
    async def generate_progress_report(
        self,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        生成进度报告
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: 进度报告
        """
        progress_tracking = await self.get_progress_tracking(tenant_id)
        
        # 统计信息
        total_tasks = len(progress_tracking["tasks"])
        completed_tasks = sum(1 for task in progress_tracking["tasks"] if task["status"] == "completed")
        pending_tasks = sum(1 for task in progress_tracking["tasks"] if task["status"] == "pending")
        in_progress_tasks = sum(1 for task in progress_tracking["tasks"] if task["status"] == "in_progress")
        
        # 风险提示
        risks = []
        if progress_tracking["days_remaining"] <= 3 and completed_tasks < total_tasks:
            risks.append({
                "level": "high",
                "message": f"距离上线仅剩{progress_tracking['days_remaining']}天，仍有{total_tasks - completed_tasks}个任务未完成",
            })
        
        critical_pending = [task for task in progress_tracking["tasks"] if task["is_critical"] and task["status"] != "completed"]
        if critical_pending:
            risks.append({
                "level": "high",
                "message": f"有{len(critical_pending)}个关键任务未完成",
            })
        
        return {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "pending_tasks": pending_tasks,
                "in_progress_tasks": in_progress_tasks,
                "completion_rate": int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0,
                "days_remaining": progress_tracking["days_remaining"],
            },
            "stages": progress_tracking["stages"],
            "tasks": progress_tracking["tasks"],
            "risks": risks,
        }
